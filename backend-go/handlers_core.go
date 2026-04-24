package main

import "net/http"

func (s *server) handleHealth(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

func (s *server) handleReady(w http.ResponseWriter, _ *http.Request) {
	if s.cfg.SupabaseService == "" {
		writeErrorWithOp(w, "core.ready.missingServiceKey", &appError{Status: http.StatusServiceUnavailable, Code: "not_ready", Message: "service key missing"})
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "ready"})
}

func (s *server) handleMe(w http.ResponseWriter, r *http.Request) {
	u, ok := userFromContext(r.Context())
	if !ok {
		writeErrorWithOp(w, "core.me.missingUserContext", &appError{Status: http.StatusUnauthorized, Code: "missing_user", Message: "missing user context"})
		return
	}
	writeJSON(w, http.StatusOK, u)
}
