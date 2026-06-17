package main

import (
	"log"
	"net/http"
	"strings"
	"time"
)

type server struct {
	cfg      config
	auth     *authVerifier
	supabase *supabaseClient
	komoju   *komojuClient
}

func newServer(cfg config, auth *authVerifier) *server {
	return &server{
		cfg:      cfg,
		auth:     auth,
		supabase: newSupabaseClient(cfg.SupabaseURL, cfg.SupabaseService),
		komoju:   newKomojuClient(cfg),
	}
}

func (s *server) routes() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("/healthz", s.handleHealth)
	mux.HandleFunc("/readyz", s.handleReady)
	mux.HandleFunc("/api/me", requireAuth(s.auth, s.handleMe))

	mux.HandleFunc("/api/board/posts", withMethods(s.handleBoardPosts, http.MethodGet, http.MethodPost, http.MethodOptions))
	mux.HandleFunc("/api/board/posts/", withMethods(s.handleBoardPostByID, http.MethodDelete, http.MethodGet, http.MethodPost, http.MethodPatch, http.MethodOptions))
	mux.HandleFunc("/api/board/inquiries", withMethods(s.handleBoardInquiries, http.MethodPost, http.MethodOptions))
	mux.HandleFunc("/api/questions", withMethods(s.handleQuestions, http.MethodGet, http.MethodPost, http.MethodOptions))
	mux.HandleFunc("/api/questions/", withMethods(s.handleQuestionByID, http.MethodPatch, http.MethodOptions))
	mux.HandleFunc("/api/uploads/video", withMethods(s.handleVideoUpload, http.MethodPost, http.MethodOptions))
	mux.HandleFunc("/api/auth/otp/send", withMethods(s.handleAuthOtpSend, http.MethodPost, http.MethodOptions))
	mux.HandleFunc("/api/auth/otp/verify", withMethods(s.handleAuthOtpVerify, http.MethodPost, http.MethodOptions))
	mux.HandleFunc("/api/auth/password/signup", withMethods(s.handleAuthPasswordSignup, http.MethodPost, http.MethodOptions))
	mux.HandleFunc("/api/auth/password/signin", withMethods(s.handleAuthPasswordSignin, http.MethodPost, http.MethodOptions))
	mux.HandleFunc("/api/auth/google/start", withMethods(s.handleAuthGoogleStart, http.MethodGet, http.MethodOptions))
	mux.HandleFunc("/api/checkout/komoju", withMethods(s.handleKomojuCheckout, http.MethodGet, http.MethodOptions))
	mux.HandleFunc("/api/checkout/return", withMethods(s.handleCheckoutReturn, http.MethodGet, http.MethodOptions))
	mux.HandleFunc("/api/webhooks/komoju", withMethods(s.handleKomojuWebhook, http.MethodPost, http.MethodOptions))
	return s.withMiddleware(mux)
}

func (s *server) withMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		s.applyCORS(w, r)
		userID := "anonymous"
		if token := authToken(r); token != "" {
			if u, err := s.auth.parse(token); err == nil && u.ID != "" {
				userID = u.ID
			}
		}
		log.Printf("request method=%s path=%s userID=%s", r.Method, r.URL.Path, userID)
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(w, r)
		log.Printf("request_done method=%s path=%s userID=%s duration=%s", r.Method, r.URL.Path, userID, time.Since(start))
	})
}

func (s *server) applyCORS(w http.ResponseWriter, r *http.Request) {
	origin := r.Header.Get("Origin")
	allowed := "*"
	for _, o := range s.cfg.AllowedOrigins {
		if o == "*" || o == origin {
			allowed = o
			break
		}
	}
	w.Header().Set("Access-Control-Allow-Origin", allowed)
	w.Header().Set("Vary", "Origin")
	w.Header().Set("Access-Control-Allow-Headers", "Authorization, Content-Type")
	w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PATCH, DELETE, OPTIONS")
}

func withMethods(next http.HandlerFunc, methods ...string) http.HandlerFunc {
	allow := map[string]bool{}
	for _, m := range methods {
		allow[m] = true
	}
	return func(w http.ResponseWriter, r *http.Request) {
		if !allow[r.Method] {
			writeErrorWithOp(w, "router.withMethods.methodNotAllowed", &appError{Status: http.StatusMethodNotAllowed, Code: "method_not_allowed", Message: "method not allowed"})
			return
		}
		next(w, r)
	}
}

func trimPrefix(path, prefix string) string {
	return strings.TrimPrefix(strings.Trim(path, "/"), strings.Trim(prefix, "/"))
}
