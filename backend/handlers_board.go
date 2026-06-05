package main

import (
	"net/http"
	"strings"
)

func (s *server) handleBoardPosts(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		order := "desc"
		if r.URL.Query().Get("sort") == "oldest" {
			order = "asc"
		}
		var rows []boardPost
		err := s.supabase.request(http.MethodGet, "board_posts", map[string]string{
			"select": "id,url,title,personal_best,question,user_id,user_name,created_at,thumbnail_url",
			"order":  "created_at." + order,
		}, nil, &rows)
		if err != nil {
			writeErrorWithOp(w, "board.posts.list.supabaseSelect", err)
			return
		}
		writeJSON(w, http.StatusOK, rows)
	case http.MethodPost:
		u, err := s.mustUser(r)
		if err != nil {
			writeErrorWithOp(w, "board.posts.create.mustUser", err)
			return
		}
		var in boardPost
		if err := decodeJSON(r, &in); err != nil {
			writeErrorWithOp(w, "board.posts.create.decodeJSON", err)
			return
		}
		in.UserID = u.ID
		var out []boardPost
		if err := s.supabase.request(http.MethodPost, "board_posts", nil, []boardPost{in}, &out); err != nil {
			writeErrorWithOp(w, "board.posts.create.supabaseInsert", err)
			return
		}
		if len(out) == 0 {
			writeErrorWithOp(w, "board.posts.create.emptyInsert", &appError{Status: http.StatusInternalServerError, Code: "empty_insert", Message: "post create failed"})
			return
		}
		writeJSON(w, http.StatusCreated, out[0])
	}
}

func (s *server) handleBoardPostByID(w http.ResponseWriter, r *http.Request) {
	path := strings.TrimPrefix(r.URL.Path, "/api/board/posts/")
	parts := strings.Split(strings.Trim(path, "/"), "/")
	if len(parts) == 0 || parts[0] == "" {
		writeErrorWithOp(w, "board.posts.route.missingID", &appError{Status: http.StatusBadRequest, Code: "missing_id", Message: "missing post id"})
		return
	}
	postID := parts[0]
	if len(parts) == 1 && r.Method == http.MethodDelete {
		u, err := s.mustUser(r)
		if err != nil {
			writeErrorWithOp(w, "board.posts.delete.mustUser", err)
			return
		}
		err = s.supabase.request(http.MethodDelete, "board_posts", map[string]string{
			"id":      "eq." + postID,
			"user_id": "eq." + u.ID,
		}, nil, nil)
		if err != nil {
			writeErrorWithOp(w, "board.posts.delete.supabaseDelete", err)
			return
		}
		writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
		return
	}
	if len(parts) >= 2 && parts[1] == "comments" {
		s.handleComments(w, r, postID, parts[2:])
		return
	}
	if len(parts) >= 2 && parts[1] == "reports" && r.Method == http.MethodPost {
		u, err := s.mustUser(r)
		if err != nil {
			writeErrorWithOp(w, "board.posts.report.mustUser", err)
			return
		}
		var in struct {
			Reason string `json:"reason"`
		}
		if err := decodeJSON(r, &in); err != nil {
			writeErrorWithOp(w, "board.posts.report.decodeJSON", err)
			return
		}
		body := []map[string]any{{
			"post_id":     postID,
			"reason":      in.Reason,
			"status":      "pending",
			"reporter_id": u.ID,
		}}
		if err := s.supabase.request(http.MethodPost, "board_video_reports", nil, body, nil); err != nil {
			writeErrorWithOp(w, "board.posts.report.supabaseInsert", err)
			return
		}
		writeJSON(w, http.StatusCreated, map[string]bool{"ok": true})
		return
	}
	writeErrorWithOp(w, "board.posts.route.notFound", &appError{Status: http.StatusNotFound, Code: "not_found", Message: "unknown board route"})
}

func (s *server) handleComments(w http.ResponseWriter, r *http.Request, postID string, suffix []string) {
	if len(suffix) == 0 || suffix[0] == "" {
		if r.Method == http.MethodGet {
			var rows []boardComment
			err := s.supabase.request(http.MethodGet, "board_comments", map[string]string{
				"select":  "*",
				"post_id": "eq." + postID,
				"order":   "created_at.desc",
			}, nil, &rows)
			if err != nil {
				writeErrorWithOp(w, "board.comments.list.supabaseSelect", err)
				return
			}
			writeJSON(w, http.StatusOK, rows)
			return
		}
		if r.Method == http.MethodPost {
			u, err := s.mustUser(r)
			if err != nil {
				writeErrorWithOp(w, "board.comments.create.mustUser", err)
				return
			}
			var in boardComment
			if err := decodeJSON(r, &in); err != nil {
				writeErrorWithOp(w, "board.comments.create.decodeJSON", err)
				return
			}
			in.PostID = postID
			in.UserID = u.ID
			var out []boardComment
			err = s.supabase.request(http.MethodPost, "board_comments", nil, []boardComment{in}, &out)
			if err != nil {
				writeErrorWithOp(w, "board.comments.create.supabaseInsert", err)
				return
			}
			writeJSON(w, http.StatusCreated, out)
			return
		}
	}
	commentID := suffix[0]
	if len(suffix) == 1 && r.Method == http.MethodDelete {
		u, err := s.mustUser(r)
		if err != nil {
			writeErrorWithOp(w, "board.comments.delete.mustUser", err)
			return
		}
		err = s.supabase.request(http.MethodDelete, "board_comments", map[string]string{
			"id":      "eq." + commentID,
			"post_id": "eq." + postID,
			"user_id": "eq." + u.ID,
		}, nil, nil)
		if err != nil {
			writeErrorWithOp(w, "board.comments.delete.supabaseDelete", err)
			return
		}
		writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
		return
	}
	if len(suffix) == 1 && r.Method == http.MethodPatch {
		u, err := s.mustUser(r)
		if err != nil {
			writeErrorWithOp(w, "board.comments.update.mustUser", err)
			return
		}
		var in struct {
			Text      string `json:"text"`
			UpdatedAt string `json:"updated_at"`
		}
		if err := decodeJSON(r, &in); err != nil {
			writeErrorWithOp(w, "board.comments.update.decodeJSON", err)
			return
		}
		err = s.supabase.request(http.MethodPatch, "board_comments", map[string]string{
			"id":      "eq." + commentID,
			"post_id": "eq." + postID,
			"user_id": "eq." + u.ID,
		}, map[string]any{"text": in.Text, "updated_at": in.UpdatedAt}, nil)
		if err != nil {
			writeErrorWithOp(w, "board.comments.update.supabasePatch", err)
			return
		}
		writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
		return
	}
	if len(suffix) == 2 && suffix[1] == "report" && r.Method == http.MethodPost {
		u, err := s.mustUser(r)
		if err != nil {
			writeErrorWithOp(w, "board.comments.report.mustUser", err)
			return
		}
		var in struct {
			Reason      string `json:"reason"`
			CommentText string `json:"comment_text"`
		}
		if err := decodeJSON(r, &in); err != nil {
			writeErrorWithOp(w, "board.comments.report.decodeJSON", err)
			return
		}
		body := []map[string]any{{
			"post_id":      postID,
			"comment_id":   commentID,
			"comment_text": in.CommentText,
			"reason":       in.Reason,
			"status":       "pending",
			"reporter_id":  u.ID,
		}}
		if err := s.supabase.request(http.MethodPost, "board_comment_reports", nil, body, nil); err != nil {
			writeErrorWithOp(w, "board.comments.report.supabaseInsert", err)
			return
		}
		writeJSON(w, http.StatusCreated, map[string]bool{"ok": true})
		return
	}
	writeErrorWithOp(w, "board.comments.route.notFound", &appError{Status: http.StatusNotFound, Code: "not_found", Message: "unknown comment route"})
}

func (s *server) handleBoardInquiries(w http.ResponseWriter, r *http.Request) {
	u, err := s.mustUser(r)
	if err != nil {
		writeErrorWithOp(w, "board.inquiries.create.mustUser", err)
		return
	}
	var in struct {
		Text     string `json:"text"`
		UserName string `json:"user_name"`
	}
	if err := decodeJSON(r, &in); err != nil {
		writeErrorWithOp(w, "board.inquiries.create.decodeJSON", err)
		return
	}
	body := []map[string]any{{
		"text":      in.Text,
		"user_id":   u.ID,
		"user_name": in.UserName,
		"status":    "pending",
	}}
	if err := s.supabase.request(http.MethodPost, "board_inquiries", nil, body, nil); err != nil {
		writeErrorWithOp(w, "board.inquiries.create.supabaseInsert", err)
		return
	}
	writeJSON(w, http.StatusCreated, map[string]bool{"ok": true})
}

func (s *server) mustUser(r *http.Request) (authedUser, error) {
	u, ok := userFromContext(r.Context())
	if ok {
		return u, nil
	}
	token := authToken(r)
	if token == "" {
		return authedUser{}, &appError{Status: http.StatusUnauthorized, Code: "missing_token", Message: "missing bearer token"}
	}
	return s.auth.parse(token)
}
