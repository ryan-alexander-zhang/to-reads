package main

import (
	"database/sql"
	"encoding/json"
	"net/http"
	"strconv"
	"time"
)

type Server struct {
	db     *sql.DB
	config Config
}

type Category struct {
	ID        int       `json:"id"`
	Name      string    `json:"name"`
	CreatedAt time.Time `json:"created_at"`
}

type Feed struct {
	ID            int        `json:"id"`
	Name          string     `json:"name"`
	URL           string     `json:"url"`
	CategoryID    *int       `json:"category_id"`
	FetchInterval int        `json:"fetch_interval_minutes"`
	LastFetchedAt *time.Time `json:"last_fetched_at"`
	LastStatus    *string    `json:"last_status"`
	LastError     *string    `json:"last_error"`
	CategoryName  *string    `json:"category_name"`
}

type Item struct {
	ID          int        `json:"id"`
	FeedID      int        `json:"feed_id"`
	FeedName    string     `json:"feed_name"`
	CategoryID  *int       `json:"category_id"`
	Category    *string    `json:"category"`
	Title       string     `json:"title"`
	Link        string     `json:"link"`
	Summary     string     `json:"summary"`
	PublishedAt *time.Time `json:"published_at"`
}

type createCategoryRequest struct {
	Name string `json:"name"`
}

type createFeedRequest struct {
	Name       string `json:"name"`
	URL        string `json:"url"`
	CategoryID *int   `json:"category_id"`
}

func (s *Server) routes() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("/api/health", s.handleHealth)
	mux.HandleFunc("/api/categories", s.handleCategories)
	mux.HandleFunc("/api/feeds", s.handleFeeds)
	mux.HandleFunc("/api/items", s.handleItems)

	return corsMiddleware(jsonMiddleware(mux))
}

func (s *Server) handleHealth(w http.ResponseWriter, r *http.Request) {
	respondJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

func (s *Server) handleCategories(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		s.handleListCategories(w, r)
	case http.MethodPost:
		s.handleCreateCategory(w, r)
	default:
		respondJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
	}
}

func (s *Server) handleFeeds(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		s.handleListFeeds(w, r)
	case http.MethodPost:
		s.handleCreateFeed(w, r)
	default:
		respondJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
	}
}

func (s *Server) handleItems(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		respondJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}
	s.handleListItems(w, r)
}

func (s *Server) handleListCategories(w http.ResponseWriter, r *http.Request) {
	rows, err := s.db.Query(`SELECT id, name, created_at FROM categories ORDER BY name ASC`)
	if err != nil {
		respondError(w, http.StatusInternalServerError, err)
		return
	}
	defer rows.Close()

	var categories []Category
	for rows.Next() {
		var category Category
		if err := rows.Scan(&category.ID, &category.Name, &category.CreatedAt); err != nil {
			respondError(w, http.StatusInternalServerError, err)
			return
		}
		categories = append(categories, category)
	}
	respondJSON(w, http.StatusOK, categories)
}

func (s *Server) handleCreateCategory(w http.ResponseWriter, r *http.Request) {
	var req createCategoryRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, err)
		return
	}
	if req.Name == "" {
		respondJSON(w, http.StatusBadRequest, map[string]string{"error": "name is required"})
		return
	}

	var category Category
	query := `INSERT INTO categories (name) VALUES ($1)
		ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
		RETURNING id, name, created_at`
	if err := s.db.QueryRow(query, req.Name).Scan(&category.ID, &category.Name, &category.CreatedAt); err != nil {
		respondError(w, http.StatusInternalServerError, err)
		return
	}

	respondJSON(w, http.StatusCreated, category)
}

func (s *Server) handleListFeeds(w http.ResponseWriter, r *http.Request) {
	categoryID := r.URL.Query().Get("category_id")
	var rows *sql.Rows
	var err error
	if categoryID != "" {
		rows, err = s.db.Query(`
			SELECT f.id, f.name, f.url, f.category_id, f.fetch_interval_minutes, f.last_fetched_at, f.last_status, f.last_error,
				c.name
			FROM feeds f
			LEFT JOIN categories c ON c.id = f.category_id
			WHERE f.category_id = $1
			ORDER BY f.name ASC
		`, categoryID)
	} else {
		rows, err = s.db.Query(`
			SELECT f.id, f.name, f.url, f.category_id, f.fetch_interval_minutes, f.last_fetched_at, f.last_status, f.last_error,
				c.name
			FROM feeds f
			LEFT JOIN categories c ON c.id = f.category_id
			ORDER BY f.name ASC
		`)
	}
	if err != nil {
		respondError(w, http.StatusInternalServerError, err)
		return
	}
	defer rows.Close()

	var feeds []Feed
	for rows.Next() {
		var feed Feed
		if err := rows.Scan(
			&feed.ID,
			&feed.Name,
			&feed.URL,
			&feed.CategoryID,
			&feed.FetchInterval,
			&feed.LastFetchedAt,
			&feed.LastStatus,
			&feed.LastError,
			&feed.CategoryName,
		); err != nil {
			respondError(w, http.StatusInternalServerError, err)
			return
		}
		feeds = append(feeds, feed)
	}

	respondJSON(w, http.StatusOK, feeds)
}

func (s *Server) handleCreateFeed(w http.ResponseWriter, r *http.Request) {
	var req createFeedRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, err)
		return
	}
	if req.Name == "" || req.URL == "" {
		respondJSON(w, http.StatusBadRequest, map[string]string{"error": "name and url are required"})
		return
	}

	var feed Feed
	query := `
		INSERT INTO feeds (name, url, category_id, fetch_interval_minutes)
		VALUES ($1, $2, $3, $4)
		ON CONFLICT (url) DO UPDATE SET name = EXCLUDED.name, category_id = EXCLUDED.category_id
		RETURNING id, name, url, category_id, fetch_interval_minutes, last_fetched_at, last_status, last_error
	`
	if err := s.db.QueryRow(query, req.Name, req.URL, req.CategoryID, s.config.FetchIntervalMinutes).Scan(
		&feed.ID,
		&feed.Name,
		&feed.URL,
		&feed.CategoryID,
		&feed.FetchInterval,
		&feed.LastFetchedAt,
		&feed.LastStatus,
		&feed.LastError,
	); err != nil {
		respondError(w, http.StatusInternalServerError, err)
		return
	}

	go func(feedID int) {
		_ = s.fetchFeedByID(r.Context(), feedID)
	}(feed.ID)

	respondJSON(w, http.StatusCreated, feed)
}

func (s *Server) handleListItems(w http.ResponseWriter, r *http.Request) {
	categoryID := r.URL.Query().Get("category_id")
	limit := 200
	if value := r.URL.Query().Get("limit"); value != "" {
		if parsed, err := strconv.Atoi(value); err == nil && parsed > 0 {
			limit = parsed
		}
	}

	var rows *sql.Rows
	var err error
	if categoryID != "" {
		rows, err = s.db.Query(`
			SELECT i.id, i.feed_id, f.name, f.category_id, c.name, i.title, i.link, COALESCE(i.summary, ''), i.published_at
			FROM items i
			JOIN feeds f ON f.id = i.feed_id
			LEFT JOIN categories c ON c.id = f.category_id
			WHERE f.category_id = $1
			ORDER BY i.published_at DESC NULLS LAST, i.created_at DESC
			LIMIT $2
		`, categoryID, limit)
	} else {
		rows, err = s.db.Query(`
			SELECT i.id, i.feed_id, f.name, f.category_id, c.name, i.title, i.link, COALESCE(i.summary, ''), i.published_at
			FROM items i
			JOIN feeds f ON f.id = i.feed_id
			LEFT JOIN categories c ON c.id = f.category_id
			ORDER BY i.published_at DESC NULLS LAST, i.created_at DESC
			LIMIT $1
		`, limit)
	}
	if err != nil {
		respondError(w, http.StatusInternalServerError, err)
		return
	}
	defer rows.Close()

	var items []Item
	for rows.Next() {
		var item Item
		if err := rows.Scan(
			&item.ID,
			&item.FeedID,
			&item.FeedName,
			&item.CategoryID,
			&item.Category,
			&item.Title,
			&item.Link,
			&item.Summary,
			&item.PublishedAt,
		); err != nil {
			respondError(w, http.StatusInternalServerError, err)
			return
		}
		items = append(items, item)
	}

	respondJSON(w, http.StatusOK, items)
}

func jsonMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		next.ServeHTTP(w, r)
	})
}

func corsMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(w, r)
	})
}

func respondJSON(w http.ResponseWriter, status int, payload interface{}) {
	w.WriteHeader(status)
	if payload == nil {
		return
	}
	_ = json.NewEncoder(w).Encode(payload)
}

func respondError(w http.ResponseWriter, status int, err error) {
	respondJSON(w, status, map[string]string{"error": err.Error()})
}
