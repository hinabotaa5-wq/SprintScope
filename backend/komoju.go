package main

import (
	"bytes"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"
)

const komojuAPIBase = "https://komoju.com/api/v1"

type komojuClient struct {
	secretKey     string
	webhookSecret string
	httpc         *http.Client
}

func newKomojuClient(cfg config) *komojuClient {
	return &komojuClient{
		secretKey:     cfg.KomojuSecretKey,
		webhookSecret: cfg.KomojuWebhookSecret,
		httpc:         &http.Client{Timeout: 30 * time.Second},
	}
}

func (k *komojuClient) authHeader() string {
	token := base64.StdEncoding.EncodeToString([]byte(k.secretKey + ":"))
	return "Basic " + token
}

func (k *komojuClient) createSession(body map[string]any) (map[string]any, error) {
	raw, err := json.Marshal(body)
	if err != nil {
		return nil, err
	}
	req, err := http.NewRequest(http.MethodPost, komojuAPIBase+"/sessions", bytes.NewReader(raw))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", k.authHeader())

	resp, err := k.httpc.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	respBody, _ := io.ReadAll(resp.Body)
	var session map[string]any
	if err := json.Unmarshal(respBody, &session); err != nil {
		return nil, fmt.Errorf("komoju session create failed (%d): invalid json", resp.StatusCode)
	}
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		detail := komojuErrorDetail(session, respBody)
		return nil, &komojuError{Status: resp.StatusCode, Message: fmt.Sprintf("KOMOJU session create failed (%d): %s", resp.StatusCode, detail)}
	}
	return session, nil
}

func (k *komojuClient) createSessionForCheckout(body map[string]any, paymentMethod string) (map[string]any, error) {
	paymentTypes := mapKomojuPaymentMethod(paymentMethod)
	if paymentTypes == nil {
		return k.createSession(body)
	}

	withTypes := make(map[string]any, len(body)+1)
	for key, value := range body {
		withTypes[key] = value
	}
	withTypes["payment_types"] = paymentTypes

	session, err := k.createSession(withTypes)
	if err == nil {
		return session, nil
	}
	if komojuErr, ok := err.(*komojuError); ok && komojuErr.Status == http.StatusUnprocessableEntity {
		return k.createSession(body)
	}
	return nil, err
}

func (k *komojuClient) getSession(sessionID string) (map[string]any, error) {
	apiURL := komojuAPIBase + "/sessions/" + url.PathEscape(sessionID)
	req, err := http.NewRequest(http.MethodGet, apiURL, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", k.authHeader())

	resp, err := k.httpc.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	respBody, _ := io.ReadAll(resp.Body)
	var session map[string]any
	if err := json.Unmarshal(respBody, &session); err != nil {
		return nil, fmt.Errorf("komoju session fetch failed (%d): invalid json", resp.StatusCode)
	}
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		msg, _ := session["message"].(string)
		if msg == "" {
			msg = fmt.Sprintf("KOMOJU session fetch failed (%d)", resp.StatusCode)
		}
		return nil, &komojuError{Status: resp.StatusCode, Message: msg}
	}
	return session, nil
}

func (k *komojuClient) verifyWebhook(rawBody []byte, signature string) bool {
	if k.webhookSecret == "" {
		return true
	}
	if signature == "" {
		return false
	}
	mac := hmac.New(sha256.New, []byte(k.webhookSecret))
	mac.Write(rawBody)
	computed := mac.Sum(nil)
	received, err := hex.DecodeString(signature)
	if err != nil {
		return false
	}
	if len(computed) != len(received) {
		return false
	}
	return hmac.Equal(computed, received)
}

type komojuError struct {
	Status  int
	Message string
}

func (e *komojuError) Error() string {
	return e.Message
}

func komojuErrorDetail(jsonBody map[string]any, raw []byte) string {
	if errObj, ok := jsonBody["error"].(map[string]any); ok {
		if msg, ok := errObj["message"].(string); ok && msg != "" {
			return msg
		}
	}
	if msg, ok := jsonBody["message"].(string); ok && msg != "" {
		return msg
	}
	if code, ok := jsonBody["code"].(string); ok && code != "" {
		return code
	}
	return string(raw)
}

func mapKomojuPaymentMethod(method string) []string {
	switch strings.ToLower(strings.TrimSpace(method)) {
	case "card":
		return []string{"credit_card"}
	case "paypay":
		return []string{"paypay"}
	case "applepay":
		return []string{"credit_card"}
	default:
		return nil
	}
}

func komojuSessionURL(session map[string]any) string {
	if v, ok := session["session_url"].(string); ok {
		return v
	}
	return ""
}

func komojuSessionID(session map[string]any) string {
	if v, ok := session["id"].(string); ok {
		return v
	}
	return ""
}

func komojuPaymentCaptured(session map[string]any) bool {
	status, _ := session["status"].(string)
	if status != "completed" {
		return false
	}
	payment, _ := session["payment"].(map[string]any)
	paymentStatus, _ := payment["status"].(string)
	return paymentStatus == "captured" || paymentStatus == "authorized"
}

