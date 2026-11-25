package config

import (
	"os"
	"strconv"
)

type Config struct {
	Port        string
	DatabaseURL string
}

func Load() Config {
	cfg := Config{
		Port:        getenv("PORT", "8080"),
		DatabaseURL: getenv("DATABASE_URL", "postgres://stockflow:stockflow@localhost:5432/stockflow?sslmode=disable"),
	}
	return cfg
}

func getenv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func atoi(s string, fallback int) int {
	n, err := strconv.Atoi(s)
	if err != nil {
		return fallback
	}
	return n
}
