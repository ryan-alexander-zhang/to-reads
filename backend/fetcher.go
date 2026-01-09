package main

import (
	"context"
	"database/sql"
	"fmt"
	"io"
	"log"
	"net/http"
	"strings"
	"time"
)

func (s *Server) startFetcher(ctx context.Context) {
	ticker := time.NewTicker(time.Duration(s.config.FetchIntervalMinutes) * time.Minute)
	defer ticker.Stop()

	s.fetchDueFeeds(ctx)

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			s.fetchDueFeeds(ctx)
		}
	}
}

func (s *Server) fetchDueFeeds(ctx context.Context) {
	rows, err := s.db.QueryContext(ctx, `
		SELECT id
		FROM feeds
		WHERE last_fetched_at IS NULL
		   OR last_fetched_at <= NOW() - (fetch_interval_minutes || ' minutes')::interval
	`)
	if err != nil {
		log.Printf("fetch due feeds: %v", err)
		return
	}
	defer rows.Close()

	var ids []int
	for rows.Next() {
		var id int
		if err := rows.Scan(&id); err == nil {
			ids = append(ids, id)
		}
	}

	for _, id := range ids {
		if err := s.fetchFeedByID(ctx, id); err != nil {
			log.Printf("fetch feed %d: %v", id, err)
		}
	}
}

func (s *Server) fetchAllFeeds(ctx context.Context) error {
	rows, err := s.db.QueryContext(ctx, `SELECT id FROM feeds`)
	if err != nil {
		return err
	}
	defer rows.Close()

	var ids []int
	for rows.Next() {
		var id int
		if err := rows.Scan(&id); err != nil {
			return err
		}
		ids = append(ids, id)
	}
	if err := rows.Err(); err != nil {
		return err
	}

	for _, id := range ids {
		if err := s.fetchFeedByID(ctx, id); err != nil {
			log.Printf("fetch feed %d: %v", id, err)
		}
	}
	return nil
}

func (s *Server) fetchFeedByID(ctx context.Context, id int) error {
	var feedURL string
	query := `SELECT url FROM feeds WHERE id = $1`
	if err := s.db.QueryRowContext(ctx, query, id).Scan(&feedURL); err != nil {
		return err
	}

	request, err := http.NewRequestWithContext(ctx, http.MethodGet, feedURL, nil)
	if err != nil {
		return s.updateFeedStatus(ctx, id, "error", err)
	}

	client := &http.Client{Timeout: 15 * time.Second}
	response, err := client.Do(request)
	if err != nil {
		return s.updateFeedStatus(ctx, id, "error", err)
	}
	defer response.Body.Close()

	if response.StatusCode < 200 || response.StatusCode >= 300 {
		return s.updateFeedStatus(ctx, id, "error", fmt.Errorf("feed status: %s", response.Status))
	}

	body, err := io.ReadAll(response.Body)
	if err != nil {
		return s.updateFeedStatus(ctx, id, "error", err)
	}

	items, err := parseFeed(body)
	if err != nil {
		return s.updateFeedStatus(ctx, id, "error", err)
	}

	if err := s.storeItems(ctx, id, items); err != nil {
		return s.updateFeedStatus(ctx, id, "error", err)
	}

	return s.updateFeedStatus(ctx, id, "success", nil)
}

func (s *Server) storeItems(ctx context.Context, feedID int, items []ParsedItem) error {
	if len(items) == 0 {
		return nil
	}

	stmt, err := s.db.PrepareContext(ctx, `
		INSERT INTO items (feed_id, title, link, summary, guid, published_at)
		VALUES ($1, $2, $3, $4, $5, $6)
		ON CONFLICT (feed_id, guid) DO NOTHING
	`)
	if err != nil {
		return err
	}
	defer stmt.Close()

	for _, item := range items {
		guid := strings.TrimSpace(item.GUID)
		if guid == "" {
			guid = strings.TrimSpace(item.Link)
		}
		if guid == "" {
			guid = fmt.Sprintf("%s-%v", strings.TrimSpace(item.Title), item.Published)
		}

		summary := strings.TrimSpace(item.Summary)
		if _, err := stmt.ExecContext(ctx, feedID, item.Title, item.Link, summary, guid, item.Published); err != nil {
			return err
		}
	}
	return nil
}

func (s *Server) updateFeedStatus(ctx context.Context, id int, status string, fetchErr error) error {
	var errMessage sql.NullString
	if fetchErr != nil {
		errMessage = sql.NullString{String: fetchErr.Error(), Valid: true}
	}
	_, err := s.db.ExecContext(ctx, `
		UPDATE feeds
		SET last_fetched_at = NOW(), last_status = $2, last_error = $3
		WHERE id = $1
	`, id, status, errMessage)
	return err
}
