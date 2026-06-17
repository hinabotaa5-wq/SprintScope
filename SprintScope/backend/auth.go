package main

import (
	"context"
	"encoding/json"
	"io"
	"log"
	"net/http"
	"strings"
	"time"

	"github.com/MicahParks/keyfunc"
	"github.com/golang-jwt/jwt/v4"
)

type authVerifier struct {
	jwks        *keyfunc.JWKS
	supabaseURL string
	anonKey     string
	httpc       *http.Client
}

func newAuthVerifier(jwksURL string, supabaseURL string, anonKey string) (*authVerifier, error) {
	jwks, err := keyfunc.Get(jwksURL, keyfunc.Options{})
	if err != nil {
		log.Printf("warning: jwks fetch failed, fallback to auth user endpoint: %v", err)
		jwks = nil
	}
	return &authVerifier{
		jwks:        jwks,
		supabaseURL: strings.TrimRight(supabaseURL, "/"),
		anonKey:     anonKey,
		httpc:       &http.Client{Timeout: 10 * time.Second},
	}, nil
}

func (a *authVerifier) parse(token string) (authedUser, error) {
	if a.jwks == nil {
		return a.parseViaUserEndpoint(token)
	}
	parsed, err := jwt.Parse(token, a.jwks.Keyfunc)
	if err != nil || !parsed.Valid {
		return authedUser{}, &appError{Status: http.StatusUnauthorized, Code: "invalid_token", Message: "invalid token"}
	}
	claims, ok := parsed.Claims.(jwt.MapClaims)
	if !ok {
		return authedUser{}, &appError{Status: http.StatusUnauthorized, Code: "invalid_claims", Message: "invalid token claims"}
	}
	sub, _ := claims["sub"].(string)
	if sub == "" {
		return authedUser{}, &appError{Status: http.StatusUnauthorized, Code: "missing_sub", Message: "token subject missing"}
	}
	email, _ := claims["email"].(string)
	role, _ := claims["role"].(string)
	return authedUser{ID: sub, Email: email, Role: role}, nil
}

func (a *authVerifier) parseViaUserEndpoint(token string) (authedUser, error) {
	if a.supabaseURL == "" || a.anonKey == "" {
		return authedUser{}, &appError{Status: http.StatusUnauthorized, Code: "invalid_token", Message: "cannot validate token"}
	}
	req, err := http.NewRequest(http.MethodGet, a.supabaseURL+"/auth/v1/user", nil)
	if err != nil {
		return authedUser{}, err
	}
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("apikey", a.anonKey)
	resp, err := a.httpc.Do(req)
	if err != nil {
		return authedUser{}, err
	}
	defer resp.Body.Close()
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return authedUser{}, &appError{Status: http.StatusUnauthorized, Code: "invalid_token", Message: "invalid token"}
	}
	raw, _ := io.ReadAll(resp.Body)
	var user struct {
		ID    string `json:"id"`
		Email string `json:"email"`
		Role  string `json:"role"`
	}
	if err := json.Unmarshal(raw, &user); err != nil {
		return authedUser{}, err
	}
	if user.ID == "" {
		return authedUser{}, &appError{Status: http.StatusUnauthorized, Code: "invalid_token", Message: "invalid token"}
	}
	return authedUser{ID: user.ID, Email: user.Email, Role: user.Role}, nil
}

func requireAuth(verifier *authVerifier, next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		token := authToken(r)
		if token == "" {
			writeErrorWithOp(w, "auth.requireAuth.missingToken", &appError{Status: http.StatusUnauthorized, Code: "missing_token", Message: "missing bearer token"})
			return
		}
		user, err := verifier.parse(token)
		if err != nil {
			writeErrorWithOp(w, "auth.requireAuth.parseToken", err)
			return
		}
		ctx := r.Context()
		ctx = contextWithUser(ctx, user)
		next(w, r.WithContext(ctx))
	}
}

func contextWithUser(ctx context.Context, user authedUser) context.Context {
	return context.WithValue(ctx, userContextKey, user)
}
