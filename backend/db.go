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
			id BIGSERIAL PRIMARY KEY,
			name TEXT NOT NULL UNIQUE,
			created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
		)`,
		`CREATE TABLE IF NOT EXISTS feeds (
			id BIGSERIAL PRIMARY KEY,
			name TEXT NOT NULL,
			url TEXT NOT NULL UNIQUE,
			category_id BIGINT REFERENCES categories(id) ON DELETE SET NULL,
			fetch_interval_minutes INTEGER NOT NULL DEFAULT 60,
			last_fetched_at TIMESTAMPTZ,
			last_status TEXT,
			last_error TEXT,
			created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
		)`,
		`CREATE TABLE IF NOT EXISTS items (
			id BIGSERIAL PRIMARY KEY,
			feed_id BIGINT NOT NULL REFERENCES feeds(id) ON DELETE CASCADE,
			title TEXT NOT NULL,
			link TEXT NOT NULL,
			summary TEXT,
			guid TEXT NOT NULL,
			published_at TIMESTAMPTZ,
			is_read BOOLEAN NOT NULL DEFAULT FALSE,
			is_favorite BOOLEAN NOT NULL DEFAULT FALSE,
			created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
			UNIQUE(feed_id, guid)
		)`,
		`CREATE TABLE IF NOT EXISTS read_later (
			id BIGSERIAL PRIMARY KEY,
			item_id BIGINT NOT NULL UNIQUE REFERENCES items(id) ON DELETE CASCADE,
			created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
		)`,
		`ALTER SEQUENCE IF EXISTS categories_id_seq AS BIGINT`,
		`ALTER SEQUENCE IF EXISTS feeds_id_seq AS BIGINT`,
		`ALTER SEQUENCE IF EXISTS items_id_seq AS BIGINT`,
		`ALTER SEQUENCE IF EXISTS read_later_id_seq AS BIGINT`,
		`ALTER TABLE categories ALTER COLUMN id TYPE BIGINT`,
		`ALTER TABLE feeds ALTER COLUMN id TYPE BIGINT`,
		`ALTER TABLE feeds ALTER COLUMN category_id TYPE BIGINT`,
		`ALTER TABLE items ALTER COLUMN id TYPE BIGINT`,
		`ALTER TABLE items ALTER COLUMN feed_id TYPE BIGINT`,
		`ALTER TABLE read_later ALTER COLUMN id TYPE BIGINT`,
		`ALTER TABLE read_later ALTER COLUMN item_id TYPE BIGINT`,
		`ALTER TABLE items ADD COLUMN IF NOT EXISTS is_read BOOLEAN NOT NULL DEFAULT FALSE`,
		`ALTER TABLE items ADD COLUMN IF NOT EXISTS is_favorite BOOLEAN NOT NULL DEFAULT FALSE`,
		`CREATE INDEX IF NOT EXISTS idx_items_published_at ON items(published_at DESC)`,
		`CREATE INDEX IF NOT EXISTS idx_items_feed_id ON items(feed_id)`,
		`CREATE INDEX IF NOT EXISTS idx_items_is_read ON items(is_read)`,
		`CREATE INDEX IF NOT EXISTS idx_items_is_favorite ON items(is_favorite)`,
		`CREATE INDEX IF NOT EXISTS idx_items_search ON items USING GIN (to_tsvector('simple', title || ' ' || COALESCE(summary, '')))`,
	}

	for _, statement := range statements {
		if _, err := db.Exec(statement); err != nil {
			return fmt.Errorf("migrate: %w", err)
		}
	}
	return nil
}
