package main

import (
	"encoding/json"
	"io"
	"log"
	"net/http"
	"net/url"
	"strconv"
	"strings"
)

type checkoutQuestion struct {
	ID            flexString `json:"id"`
	PaymentRef    string `json:"payment_ref"`
	AmountYen     int    `json:"amount_yen"`
	PaymentStatus string `json:"payment_status"`
}

func (s *server) handleKomojuCheckout(w http.ResponseWriter, r *http.Request) {
	if s.cfg.KomojuSecretKey == "" {
		http.Error(w, "KOMOJU is not configured", http.StatusServiceUnavailable)
		return
	}

	ref := strings.TrimSpace(r.URL.Query().Get("ref"))
	amount, err := strconv.Atoi(strings.TrimSpace(r.URL.Query().Get("amount")))
	paymentMethod := strings.TrimSpace(r.URL.Query().Get("payment_method"))
	if paymentMethod == "" {
		paymentMethod = "card"
	}

	if ref == "" || err != nil || amount <= 0 {
		http.Error(w, "ref と amount が必要です", http.StatusBadRequest)
		return
	}

	var rows []checkoutQuestion
	if err := s.supabase.request(http.MethodGet, "questions", map[string]string{
		"select":      "id,payment_ref,amount_yen,payment_status",
		"payment_ref": "eq." + ref,
		"limit":       "1",
	}, nil, &rows); err != nil {
		log.Printf("[checkout] question lookup: %v", err)
		http.Error(w, "注文の確認に失敗しました", http.StatusInternalServerError)
		return
	}
	if len(rows) == 0 {
		http.Error(w, "お問い合わせ番号が見つかりません", http.StatusNotFound)
		return
	}
	question := rows[0]
	if question.PaymentStatus == "paid" {
		redirectURL := s.frontendReturnURL(ref, "already_paid", "")
		http.Redirect(w, r, redirectURL, http.StatusFound)
		return
	}

	returnURL := strings.TrimRight(s.cfg.PublicBaseURL, "/") + "/api/checkout/return?ref=" + url.QueryEscape(ref)
	sessionBody := map[string]any{
		"amount":             amount,
		"currency":           "JPY",
		"return_url":         returnURL,
		"external_order_num": ref,
		"metadata": map[string]string{
			"question_id": question.ID.String(),
			"tier":        r.URL.Query().Get("tier"),
			"format":      r.URL.Query().Get("format"),
		},
	}

	session, err := s.komoju.createSessionForCheckout(sessionBody, paymentMethod)
	if err != nil {
		log.Printf("[checkout/komoju] %v", err)
		http.Error(w, "決済セッションの作成に失敗しました", http.StatusBadGateway)
		return
	}

	if sessionID := komojuSessionID(session); sessionID != "" {
		if err := s.supabase.request(http.MethodPatch, "questions", map[string]string{"payment_ref": "eq." + ref}, map[string]any{
			"komoju_session_id": sessionID,
		}, nil); err != nil {
			log.Printf("[checkout/komoju] session id update: %v", err)
		}
	}

	sessionURL := komojuSessionURL(session)
	if sessionURL == "" {
		http.Error(w, "KOMOJU session_url が取得できませんでした", http.StatusBadGateway)
		return
	}
	http.Redirect(w, r, sessionURL, http.StatusFound)
}

func (s *server) handleCheckoutReturn(w http.ResponseWriter, r *http.Request) {
	ref := strings.TrimSpace(r.URL.Query().Get("ref"))
	sessionID := strings.TrimSpace(r.URL.Query().Get("session_id"))
	if ref == "" || sessionID == "" {
		http.Error(w, "ref または session_id が不足しています", http.StatusBadRequest)
		return
	}

	session, err := s.komoju.getSession(sessionID)
	if err != nil {
		log.Printf("[checkout/return] %v", err)
		http.Error(w, "決済結果の確認に失敗しました", http.StatusBadGateway)
		return
	}

	paid := komojuPaymentCaptured(session)
	if paid {
		if err := s.supabase.request(http.MethodPatch, "questions", map[string]string{"payment_ref": "eq." + ref}, map[string]any{
			"payment_status":    "paid",
			"komoju_session_id": sessionID,
		}, nil); err != nil {
			log.Printf("[checkout/return] mark paid: %v", err)
		}
	}

	status := "pending"
	if paid {
		status = "success"
	} else if sessionStatus, _ := session["status"].(string); sessionStatus == "cancelled" {
		status = "cancelled"
	}

	http.Redirect(w, r, s.frontendReturnURL(ref, status, sessionID), http.StatusFound)
}

func (s *server) handleKomojuWebhook(w http.ResponseWriter, r *http.Request) {
	rawBody, err := io.ReadAll(io.LimitReader(r.Body, 1*1024*1024))
	if err != nil {
		writeErrorWithOp(w, "checkout.webhook.readBody", &appError{Status: http.StatusBadRequest, Code: "invalid_body", Message: "failed to read webhook body"})
		return
	}

	signature := r.Header.Get("X-Komoju-Signature")
	if !s.komoju.verifyWebhook(rawBody, signature) {
		writeErrorWithOp(w, "checkout.webhook.invalidSignature", &appError{Status: http.StatusUnauthorized, Code: "invalid_signature", Message: "Invalid webhook signature"})
		return
	}

	var payload struct {
		Type string `json:"type"`
		Data struct {
			ExternalOrderNum string `json:"external_order_num"`
			Session          string `json:"session"`
			Metadata         struct {
				ExternalOrderNum string `json:"external_order_num"`
			} `json:"metadata"`
		} `json:"data"`
	}
	if err := json.Unmarshal(rawBody, &payload); err != nil {
		writeErrorWithOp(w, "checkout.webhook.decodeJSON", &appError{Status: http.StatusBadRequest, Code: "invalid_json", Message: "Invalid JSON"})
		return
	}

	paymentRef := payload.Data.ExternalOrderNum
	if paymentRef == "" {
		paymentRef = payload.Data.Metadata.ExternalOrderNum
	}

	if payload.Type == "payment.captured" && paymentRef != "" {
		update := map[string]any{"payment_status": "paid"}
		if payload.Data.Session != "" {
			update["komoju_session_id"] = payload.Data.Session
		}
		if err := s.supabase.request(http.MethodPatch, "questions", map[string]string{"payment_ref": "eq." + paymentRef}, update, nil); err != nil {
			log.Printf("[webhooks/komoju] update payment: %v", err)
		}
	}

	writeJSON(w, http.StatusOK, map[string]bool{"received": true})
}

func (s *server) frontendReturnURL(ref, paymentStatus, sessionID string) string {
	u, err := url.Parse(s.cfg.FrontendReturnURL)
	if err != nil {
		base := strings.TrimRight(s.cfg.FrontendReturnURL, "/")
		q := url.Values{}
		q.Set("payment", paymentStatus)
		q.Set("ref", ref)
		if sessionID != "" {
			q.Set("session_id", sessionID)
		}
		return base + "?" + q.Encode()
	}
	q := u.Query()
	q.Set("payment", paymentStatus)
	q.Set("ref", ref)
	if sessionID != "" {
		q.Set("session_id", sessionID)
	}
	u.RawQuery = q.Encode()
	return u.String()
}
