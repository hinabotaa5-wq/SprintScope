package main

import (
	"log"
	"net/http"
	"time"
)

func main() {
	cfg := loadConfig()
	verifier, err := newAuthVerifier(cfg.jwksURL(), cfg.SupabaseURL, cfg.SupabaseAnonKey)
	if err != nil {
		log.Fatal(err)
	}
	srv := newServer(cfg, verifier)
	server := &http.Server{
		Addr:         ":" + cfg.Port,
		Handler:      srv.routes(),
		ReadTimeout:  10 * time.Second,
		WriteTimeout: 15 * time.Second,
	}
	log.Printf("server started at :%s", cfg.Port)
	log.Fatal(server.ListenAndServe())
}
