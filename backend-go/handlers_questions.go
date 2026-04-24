package main

import (
	"net/http"
	"strings"
)

func (s *server) handleQuestions(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		query := map[string]string{
			"select": "*",
			"order":  "created_at.desc",
		}
		if uid := r.URL.Query().Get("questioner_uid"); uid != "" {
			query["questioner_uid"] = "eq." + uid
		}
		if limit := r.URL.Query().Get("limit"); limit != "" {
			query["limit"] = limit
		}
		var rows []questionRow
		if err := s.supabase.request(http.MethodGet, "questions", query, nil, &rows); err != nil {
			writeErrorWithOp(w, "questions.list.supabaseSelect", err)
			return
		}
		writeJSON(w, http.StatusOK, rows)
	case http.MethodPost:
		if _, err := s.mustUser(r); err != nil {
			writeErrorWithOp(w, "questions.create.mustUser", err)
			return
		}
		var in questionRow
		if err := decodeJSON(r, &in); err != nil {
			writeErrorWithOp(w, "questions.create.decodeJSON", err)
			return
		}
		var out []questionRow
		if err := s.supabase.request(http.MethodPost, "questions", nil, []questionRow{in}, &out); err != nil {
			writeErrorWithOp(w, "questions.create.supabaseInsert", err)
			return
		}
		if len(out) == 0 {
			writeErrorWithOp(w, "questions.create.emptyInsert", &appError{Status: http.StatusInternalServerError, Code: "empty_insert", Message: "question create failed"})
			return
		}
		writeJSON(w, http.StatusCreated, out[0])
	}
}

func (s *server) handleQuestionByID(w http.ResponseWriter, r *http.Request) {
	id := strings.Trim(strings.TrimPrefix(r.URL.Path, "/api/questions/"), "/")
	if id == "" {
		writeErrorWithOp(w, "questions.update.missingID", &appError{Status: http.StatusBadRequest, Code: "missing_id", Message: "question id missing"})
		return
	}
	if _, err := s.mustUser(r); err != nil {
		writeErrorWithOp(w, "questions.update.mustUser", err)
		return
	}
	var in map[string]any
	if err := decodeJSON(r, &in); err != nil {
		writeErrorWithOp(w, "questions.update.decodeJSON", err)
		return
	}
	if err := s.supabase.request(http.MethodPatch, "questions", map[string]string{"id": "eq." + id}, in, nil); err != nil {
		writeErrorWithOp(w, "questions.update.supabasePatch", err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
}
