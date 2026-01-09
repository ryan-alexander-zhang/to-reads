package main

import (
	"os"
	"strconv"
)

type Config struct {
	DatabaseURL          string
	Port                 string
	FetchIntervalMinutes int
}

func LoadConfig() Config {
	fetchInterval := 60
	if value := os.Getenv("FETCH_INTERVAL_MINUTES"); value != "" {
		if parsed, err := strconv.Atoi(value); err == nil && parsed > 0 {
			fetchInterval = parsed
		}
	}

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	databaseURL := os.Getenv("DATABASE_URL")
	if databaseURL == "" {
		databaseURL = "postgres://postgres:postgres@localhost:5432/rss?sslmode=disable"
	}

	return Config{
		DatabaseURL:          databaseURL,
		Port:                 port,
		FetchIntervalMinutes: fetchInterval,
	}
}
