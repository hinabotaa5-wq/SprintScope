package main

import (
	"net/http"
	"net/url"
	"strings"
)

func (s *server) handleAuthOtpSend(w http.ResponseWriter, r *http.Request) {
	var in struct {
		Email string `json:"email"`
	}
	if err := decodeJSON(r, &in); err != nil {
		writeErrorWithOp(w, "auth.otp.send.decodeJSON", err)
		return
	}
	payload := map[string]any{
		"email":       strings.TrimSpace(in.Email),
		"create_user": true,
	}
	var out map[string]any
	if err := s.authRequest(http.MethodPost, "/otp", payload, &out); err != nil {
		writeErrorWithOp(w, "auth.otp.send.supabase", err)
		return
	}
	writeJSON(w, http.StatusOK, out)
}

func (s *server) handleAuthOtpVerify(w http.ResponseWriter, r *http.Request) {
	var in struct {
		Email string `json:"email"`
		Token string `json:"token"`
	}
	if err := decodeJSON(r, &in); err != nil {
		writeErrorWithOp(w, "auth.otp.verify.decodeJSON", err)
		return
	}
	types := []string{"email", "signup", "magiclink"}
	var lastErr error
	var out map[string]any
	for _, t := range types {
		payload := map[string]any{
			"email": strings.TrimSpace(in.Email),
			"token": strings.TrimSpace(in.Token),
			"type":  t,
		}
		err := s.authRequest(http.MethodPost, "/verify", payload, &out)
		if err == nil {
			writeJSON(w, http.StatusOK, out)
			return
		}
		lastErr = err
	}
	writeErrorWithOp(w, "auth.otp.verify.supabase", lastErr)
}

func (s *server) handleAuthPasswordSignup(w http.ResponseWriter, r *http.Request) {
	var in struct {
		Email    string `json:"email"`
		Password string `json:"password"`
	}
	if err := decodeJSON(r, &in); err != nil {
		writeErrorWithOp(w, "auth.password.signup.decodeJSON", err)
		return
	}
	payload := map[string]any{
		"email":    strings.TrimSpace(in.Email),
		"password": in.Password,
	}
	var out map[string]any
	if err := s.authRequest(http.MethodPost, "/signup", payload, &out); err != nil {
		writeErrorWithOp(w, "auth.password.signup.supabase", err)
		return
	}
	writeJSON(w, http.StatusOK, out)
}

func (s *server) handleAuthPasswordSignin(w http.ResponseWriter, r *http.Request) {
	var in struct {
		Email    string `json:"email"`
		Password string `json:"password"`
	}
	if err := decodeJSON(r, &in); err != nil {
		writeErrorWithOp(w, "auth.password.signin.decodeJSON", err)
		return
	}
	payload := map[string]any{
		"email":    strings.TrimSpace(in.Email),
		"password": in.Password,
	}
	var out map[string]any
	if err := s.authRequest(http.MethodPost, "/token?grant_type=password", payload, &out); err != nil {
		writeErrorWithOp(w, "auth.password.signin.supabase", err)
		return
	}
	writeJSON(w, http.StatusOK, out)
}

func (s *server) handleAuthGoogleStart(w http.ResponseWriter, r *http.Request) {
	redirectTo := strings.TrimSpace(r.URL.Query().Get("redirect_to"))
	if redirectTo == "" {
		redirectTo = strings.TrimSuffix(r.Referer(), "#")
	}
	if redirectTo == "" {
		writeErrorWithOp(w, "auth.google.start.missingRedirect", &appError{
			Status:  http.StatusBadRequest,
			Code:    "missing_redirect_to",
			Message: "redirect_to is required",
		})
		return
	}
	u := s.cfg.SupabaseURL + "/auth/v1/authorize?provider=google&redirect_to=" + url.QueryEscape(redirectTo)
	http.Redirect(w, r, u, http.StatusFound)
}
