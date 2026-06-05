package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"
)

type supabaseClient struct {
	baseURL string
	key     string
	httpc   *http.Client
}

func newSupabaseClient(baseURL string, key string) *supabaseClient {
	return &supabaseClient{
		baseURL: strings.TrimRight(baseURL, "/"),
		key:     key,
		httpc:   &http.Client{Timeout: 15 * time.Second},
	}
}

func (s *supabaseClient) request(method, table string, query map[string]string, body any, out any) error {
	if s.key == "" {
		return &appError{Status: http.StatusInternalServerError, Code: "missing_supabase_key", Message: "supabase service key is not configured"}
	}
	u, _ := url.Parse(s.baseURL + "/rest/v1/" + table)
	q := u.Query()
	for k, v := range query {
		q.Set(k, v)
	}
	u.RawQuery = q.Encode()

	var payload io.Reader
	if body != nil {
		raw, err := json.Marshal(body)
		if err != nil {
			return err
		}
		payload = bytes.NewReader(raw)
	}
	req, _ := http.NewRequest(method, u.String(), payload)
	req.Header.Set("apikey", s.key)
	req.Header.Set("Authorization", "Bearer "+s.key)
	req.Header.Set("Content-Type", "application/json")
	if method == http.MethodPost || method == http.MethodPatch {
		req.Header.Set("Prefer", "return=representation")
	}
	resp, err := s.httpc.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	raw, _ := io.ReadAll(resp.Body)
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return &appError{
			Status:  resp.StatusCode,
			Code:    "supabase_error",
			Message: fmt.Sprintf("supabase %s %s failed: %s", method, table, string(raw)),
		}
	}
	if out == nil || len(raw) == 0 {
		return nil
	}
	return json.Unmarshal(raw, out)
}
