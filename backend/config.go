package main

import (
	"log"
	"os"
	"strings"
)

type config struct {
	Port               string
	PublicBaseURL      string
	FrontendReturnURL  string
	SupabaseURL        string
	SupabaseAnonKey    string
	SupabaseService    string
	AllowedOrigins     []string
	CloudName          string
	CloudPreset        string
	KomojuSecretKey    string
	KomojuWebhookSecret string
}

func loadConfig() config {
	port := getenv("PORT", "8080")
	supabaseURL := getenv("SUPABASE_URL", "https://wircqvnrumxbmnzonrxe.supabase.co")
	publicBaseURL := strings.TrimRight(getenv("PUBLIC_BASE_URL", "http://localhost:"+port), "/")
	cfg := config{
		Port:                port,
		PublicBaseURL:       publicBaseURL,
		FrontendReturnURL:   os.Getenv("FRONTEND_RETURN_URL"),
		SupabaseURL:         supabaseURL,
		SupabaseAnonKey:     os.Getenv("SUPABASE_ANON_KEY"),
		SupabaseService:     os.Getenv("SUPABASE_SERVICE_ROLE_KEY"),
		AllowedOrigins:      parseCSV(getenv("ALLOWED_ORIGINS", "*")),
		CloudName:           getenv("CLOUDINARY_CLOUD_NAME", "doipeut1j"),
		CloudPreset:         getenv("CLOUDINARY_UPLOAD_PRESET", "sprint_preset"),
		KomojuSecretKey:     os.Getenv("KOMOJU_SECRET_KEY"),
		KomojuWebhookSecret: os.Getenv("KOMOJU_WEBHOOK_SECRET"),
	}
	if cfg.FrontendReturnURL == "" {
		log.Println("warning: FRONTEND_RETURN_URL is empty; checkout return redirects will fail")
	}
	if cfg.KomojuSecretKey == "" {
		log.Println("warning: KOMOJU_SECRET_KEY is empty; checkout endpoints will fail")
	}
	if cfg.SupabaseService == "" {
		log.Println("warning: SUPABASE_SERVICE_ROLE_KEY is empty; write endpoints will fail")
	}
	return cfg
}

func (c config) jwksURL() string {
	return c.SupabaseURL + "/auth/v1/keys"
}

func getenv(key string, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func parseCSV(v string) []string {
	parts := strings.Split(v, ",")
	out := make([]string, 0, len(parts))
	for _, p := range parts {
		s := strings.TrimSpace(p)
		if s != "" {
			out = append(out, s)
		}
	}
	if len(out) == 0 {
		return []string{"*"}
	}
	return out
}
