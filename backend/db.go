package main

import (
	"context"
	"database/sql"
	"fmt"
	"time"

	_ "github.com/lib/pq"
)

func OpenDB(databaseURL string) (*sql.DB, error) {
	db, err := sql.Open("postgres", databaseURL)
	if err != nil {
		return nil, err
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	if err := db.PingContext(ctx); err != nil {
		return nil, err
	}

	if err := migrate(db); err != nil {
		return nil, err
	}

	return db, nil
}

func migrate(db *sql.DB) error {
	statements := []string{
		`CREATE TABLE IF NOT EXISTS categories (
			id SERIAL PRIMARY KEY,
			name TEXT NOT NULL UNIQUE,
			created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
		)`,
		`CREATE TABLE IF NOT EXISTS feeds (
			id SERIAL PRIMARY KEY,
			name TEXT NOT NULL,
			url TEXT NOT NULL UNIQUE,
			category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
			fetch_interval_minutes INTEGER NOT NULL DEFAULT 60,
			last_fetched_at TIMESTAMPTZ,
			last_status TEXT,
			last_error TEXT,
			created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
		)`,
		`CREATE TABLE IF NOT EXISTS items (
			id SERIAL PRIMARY KEY,
			feed_id INTEGER NOT NULL REFERENCES feeds(id) ON DELETE CASCADE,
			title TEXT NOT NULL,
			link TEXT NOT NULL,
			summary TEXT,
			guid TEXT NOT NULL,
			published_at TIMESTAMPTZ,
			created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
			UNIQUE(feed_id, guid)
		)`,
		`CREATE TABLE IF NOT EXISTS read_later (
			id SERIAL PRIMARY KEY,
			item_id INTEGER NOT NULL UNIQUE REFERENCES items(id) ON DELETE CASCADE,
			created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
		)`,
		`CREATE TABLE IF NOT EXISTS favorites (
			id SERIAL PRIMARY KEY,
			item_id INTEGER NOT NULL UNIQUE REFERENCES items(id) ON DELETE CASCADE,
			tags TEXT[] NOT NULL DEFAULT '{}',
			created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
		)`,
		`CREATE INDEX IF NOT EXISTS idx_items_published_at ON items(published_at DESC)`,
		`CREATE INDEX IF NOT EXISTS idx_items_feed_id ON items(feed_id)`,
		`CREATE INDEX IF NOT EXISTS idx_favorites_tags ON favorites USING GIN(tags)`,
	}

	for _, statement := range statements {
		if _, err := db.Exec(statement); err != nil {
			return fmt.Errorf("migrate: %w", err)
		}
	}
	return nil
}
