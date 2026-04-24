package main

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"log"
	"net/http"
	"strings"
)

type contextKey string

const userContextKey contextKey = "user"

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}

func writeError(w http.ResponseWriter, err error) {
	if err == nil {
		log.Printf("error op=unknown code=internal_error message=%q", "internal error")
		writeJSON(w, http.StatusInternalServerError, map[string]string{"code": "internal_error", "message": "internal error"})
		return
	}
	var appErr *appError
	if errors.As(err, &appErr) {
		log.Printf("error op=unknown code=%s status=%d message=%q", appErr.Code, appErr.Status, appErr.Message)
		writeJSON(w, appErr.Status, map[string]string{"code": appErr.Code, "message": appErr.Message})
		return
	}
	log.Printf("error op=unknown code=internal_error message=%q", err.Error())
	writeJSON(w, http.StatusInternalServerError, map[string]string{"code": "internal_error", "message": err.Error()})
}

func writeErrorWithOp(w http.ResponseWriter, op string, err error) {
	if err == nil {
		log.Printf("error op=%s code=internal_error message=%q", op, "internal error")
		writeJSON(w, http.StatusInternalServerError, map[string]string{"code": "internal_error", "message": "internal error"})
		return
	}
	var appErr *appError
	if errors.As(err, &appErr) {
		log.Printf("error op=%s code=%s status=%d message=%q", op, appErr.Code, appErr.Status, appErr.Message)
		writeJSON(w, appErr.Status, map[string]string{"code": appErr.Code, "message": appErr.Message})
		return
	}
	log.Printf("error op=%s code=internal_error message=%q", op, err.Error())
	writeJSON(w, http.StatusInternalServerError, map[string]string{"code": "internal_error", "message": err.Error()})
}

func decodeJSON(r *http.Request, dst any) error {
	body, err := io.ReadAll(io.LimitReader(r.Body, 2*1024*1024))
	if err != nil {
		return &appError{Status: http.StatusBadRequest, Code: "invalid_body", Message: "failed to read request body"}
	}
	if err := json.Unmarshal(body, dst); err != nil {
		return &appError{Status: http.StatusBadRequest, Code: "invalid_json", Message: "invalid json body"}
	}
	return nil
}

func userFromContext(ctx context.Context) (authedUser, bool) {
	v := ctx.Value(userContextKey)
	u, ok := v.(authedUser)
	return u, ok
}

func authToken(r *http.Request) string {
	raw := r.Header.Get("Authorization")
	if !strings.HasPrefix(raw, "Bearer ") {
		return ""
	}
	return strings.TrimPrefix(raw, "Bearer ")
}
