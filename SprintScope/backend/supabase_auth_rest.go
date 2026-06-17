package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
)

func (s *server) authRequest(method, path string, body any, out any) error {
	if s.cfg.SupabaseAnonKey == "" {
		return &appError{
			Status:  http.StatusInternalServerError,
			Code:    "missing_supabase_anon_key",
			Message: "supabase anon key is not configured",
		}
	}

	var payload io.Reader
	if body != nil {
		raw, err := json.Marshal(body)
		if err != nil {
			return err
		}
		payload = bytes.NewReader(raw)
	}
	authURL := strings.TrimRight(s.cfg.SupabaseURL, "/") + "/auth/v1" + path
	req, err := http.NewRequest(method, authURL, payload)
	if err != nil {
		return err
	}
	req.Header.Set("apikey", s.cfg.SupabaseAnonKey)
	req.Header.Set("Content-Type", "application/json")

	client := &http.Client{Timeout: 20 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	raw, _ := io.ReadAll(resp.Body)
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return &appError{
			Status:  resp.StatusCode,
			Code:    "supabase_auth_error",
			Message: fmt.Sprintf("supabase auth failed: %s", string(raw)),
		}
	}
	if out == nil {
		return nil
	}
	if len(raw) == 0 {
		return nil
	}
	return json.Unmarshal(raw, out)
}
