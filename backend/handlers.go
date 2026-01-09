package main

import (
	"database/sql"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/lib/pq"
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

type ReadLaterEntry struct {
	ID          int        `json:"id"`
	ItemID      int        `json:"item_id"`
	FeedID      int        `json:"feed_id"`
	FeedName    string     `json:"feed_name"`
	CategoryID  *int       `json:"category_id"`
	Category    *string    `json:"category"`
	Title       string     `json:"title"`
	Link        string     `json:"link"`
	Summary     string     `json:"summary"`
	PublishedAt *time.Time `json:"published_at"`
	SavedAt     time.Time  `json:"saved_at"`
}

type FavoriteEntry struct {
	ID          int        `json:"id"`
	ItemID      int        `json:"item_id"`
	FeedID      int        `json:"feed_id"`
	FeedName    string     `json:"feed_name"`
	CategoryID  *int       `json:"category_id"`
	Category    *string    `json:"category"`
	Title       string     `json:"title"`
	Link        string     `json:"link"`
	Summary     string     `json:"summary"`
	PublishedAt *time.Time `json:"published_at"`
	Tags        []string   `json:"tags"`
	SavedAt     time.Time  `json:"saved_at"`
}

type createCategoryRequest struct {
	Name string `json:"name"`
}

type createFeedRequest struct {
	Name       string `json:"name"`
	URL        string `json:"url"`
	CategoryID *int   `json:"category_id"`
}

type createReadLaterRequest struct {
	ItemID int `json:"item_id"`
}

type createFavoriteRequest struct {
	ItemID int      `json:"item_id"`
	Tags   []string `json:"tags"`
}

type updateFavoriteRequest struct {
	Tags []string `json:"tags"`
}

type ItemsResponse struct {
	Items    []Item `json:"items"`
	Total    int    `json:"total"`
	Page     int    `json:"page"`
	PageSize int    `json:"page_size"`
}

func (s *Server) routes() http.Handler {
	router := gin.New()
	router.Use(gin.Logger(), gin.Recovery(), corsMiddleware())

	api := router.Group("/api")
	api.GET("/health", s.handleHealth)
	api.GET("/categories", s.handleListCategories)
	api.POST("/categories", s.handleCreateCategory)
	api.GET("/feeds", s.handleListFeeds)
	api.POST("/feeds", s.handleCreateFeed)
	api.POST("/feeds/:id/refresh", s.handleRefreshFeed)
	api.GET("/items", s.handleListItems)
	api.POST("/refresh", s.handleRefreshAll)
	api.GET("/read-later", s.handleListReadLater)
	api.POST("/read-later", s.handleCreateReadLater)
	api.DELETE("/read-later/:itemID", s.handleDeleteReadLater)
	api.GET("/favorites", s.handleListFavorites)
	api.POST("/favorites", s.handleCreateFavorite)
	api.PATCH("/favorites/:itemID", s.handleUpdateFavorite)
	api.DELETE("/favorites/:itemID", s.handleDeleteFavorite)

	return router
}

func (s *Server) handleHealth(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{"status": "ok"})
}

func (s *Server) handleListCategories(c *gin.Context) {
	rows, err := s.db.Query(`SELECT id, name, created_at FROM categories ORDER BY name ASC`)
	if err != nil {
		respondError(c, http.StatusInternalServerError, err)
		return
	}
	defer rows.Close()

	var categories []Category
	for rows.Next() {
		var category Category
		if err := rows.Scan(&category.ID, &category.Name, &category.CreatedAt); err != nil {
			respondError(c, http.StatusInternalServerError, err)
			return
		}
		categories = append(categories, category)
	}
	c.JSON(http.StatusOK, categories)
}

func (s *Server) handleCreateCategory(c *gin.Context) {
	var req createCategoryRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondError(c, http.StatusBadRequest, err)
		return
	}
	if strings.TrimSpace(req.Name) == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "name is required"})
		return
	}

	var category Category
	query := `INSERT INTO categories (name) VALUES ($1)
		ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
		RETURNING id, name, created_at`
	if err := s.db.QueryRow(query, strings.TrimSpace(req.Name)).Scan(&category.ID, &category.Name, &category.CreatedAt); err != nil {
		respondError(c, http.StatusInternalServerError, err)
		return
	}

	c.JSON(http.StatusCreated, category)
}

func (s *Server) handleListFeeds(c *gin.Context) {
	categoryID := c.Query("category_id")
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
		respondError(c, http.StatusInternalServerError, err)
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
			respondError(c, http.StatusInternalServerError, err)
			return
		}
		feeds = append(feeds, feed)
	}

	c.JSON(http.StatusOK, feeds)
}

func (s *Server) handleCreateFeed(c *gin.Context) {
	var req createFeedRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondError(c, http.StatusBadRequest, err)
		return
	}
	if strings.TrimSpace(req.Name) == "" || strings.TrimSpace(req.URL) == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "name and url are required"})
		return
	}

	var feed Feed
	query := `
		INSERT INTO feeds (name, url, category_id, fetch_interval_minutes)
		VALUES ($1, $2, $3, $4)
		ON CONFLICT (url) DO UPDATE SET name = EXCLUDED.name, category_id = EXCLUDED.category_id
		RETURNING id, name, url, category_id, fetch_interval_minutes, last_fetched_at, last_status, last_error
	`
	if err := s.db.QueryRow(query, strings.TrimSpace(req.Name), strings.TrimSpace(req.URL), req.CategoryID, s.config.FetchIntervalMinutes).Scan(
		&feed.ID,
		&feed.Name,
		&feed.URL,
		&feed.CategoryID,
		&feed.FetchInterval,
		&feed.LastFetchedAt,
		&feed.LastStatus,
		&feed.LastError,
	); err != nil {
		respondError(c, http.StatusInternalServerError, err)
		return
	}

	go func(feedID int) {
		_ = s.fetchFeedByID(c.Request.Context(), feedID)
	}(feed.ID)

	c.JSON(http.StatusCreated, feed)
}

func (s *Server) handleRefreshFeed(c *gin.Context) {
	feedID, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid feed id"})
		return
	}

	if err := s.fetchFeedByID(c.Request.Context(), feedID); err != nil {
		respondError(c, http.StatusInternalServerError, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{"status": "ok"})
}

func (s *Server) handleRefreshAll(c *gin.Context) {
	if err := s.fetchAllFeeds(c.Request.Context()); err != nil {
		respondError(c, http.StatusInternalServerError, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"status": "ok"})
}

func (s *Server) handleListItems(c *gin.Context) {
	categoryID := c.Query("category_id")
	page := parsePositiveInt(c.Query("page"), 1)
	pageSize := parsePositiveInt(c.Query("page_size"), 20)
	offset := (page - 1) * pageSize

	var total int
	var countQuery string
	var countArgs []interface{}
	if categoryID != "" {
		countQuery = `SELECT COUNT(*) FROM items i JOIN feeds f ON f.id = i.feed_id WHERE f.category_id = $1`
		countArgs = append(countArgs, categoryID)
	} else {
		countQuery = `SELECT COUNT(*) FROM items`
	}
	if err := s.db.QueryRow(countQuery, countArgs...).Scan(&total); err != nil {
		respondError(c, http.StatusInternalServerError, err)
		return
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
			LIMIT $2 OFFSET $3
		`, categoryID, pageSize, offset)
	} else {
		rows, err = s.db.Query(`
			SELECT i.id, i.feed_id, f.name, f.category_id, c.name, i.title, i.link, COALESCE(i.summary, ''), i.published_at
			FROM items i
			JOIN feeds f ON f.id = i.feed_id
			LEFT JOIN categories c ON c.id = f.category_id
			ORDER BY i.published_at DESC NULLS LAST, i.created_at DESC
			LIMIT $1 OFFSET $2
		`, pageSize, offset)
	}
	if err != nil {
		respondError(c, http.StatusInternalServerError, err)
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
			respondError(c, http.StatusInternalServerError, err)
			return
		}
		items = append(items, item)
	}

	c.JSON(http.StatusOK, ItemsResponse{Items: items, Total: total, Page: page, PageSize: pageSize})
}

func (s *Server) handleListReadLater(c *gin.Context) {
	rows, err := s.db.Query(`
		SELECT rl.id, rl.item_id, rl.created_at,
			i.feed_id, f.name, f.category_id, c.name, i.title, i.link, COALESCE(i.summary, ''), i.published_at
		FROM read_later rl
		JOIN items i ON i.id = rl.item_id
		JOIN feeds f ON f.id = i.feed_id
		LEFT JOIN categories c ON c.id = f.category_id
		ORDER BY rl.created_at DESC
	`)
	if err != nil {
		respondError(c, http.StatusInternalServerError, err)
		return
	}
	defer rows.Close()

	var entries []ReadLaterEntry
	for rows.Next() {
		var entry ReadLaterEntry
		if err := rows.Scan(
			&entry.ID,
			&entry.ItemID,
			&entry.SavedAt,
			&entry.FeedID,
			&entry.FeedName,
			&entry.CategoryID,
			&entry.Category,
			&entry.Title,
			&entry.Link,
			&entry.Summary,
			&entry.PublishedAt,
		); err != nil {
			respondError(c, http.StatusInternalServerError, err)
			return
		}
		entries = append(entries, entry)
	}
	c.JSON(http.StatusOK, entries)
}

func (s *Server) handleCreateReadLater(c *gin.Context) {
	var req createReadLaterRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondError(c, http.StatusBadRequest, err)
		return
	}
	if req.ItemID == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "item_id is required"})
		return
	}

	var entry ReadLaterEntry
	if err := s.db.QueryRow(`
		INSERT INTO read_later (item_id)
		VALUES ($1)
		ON CONFLICT (item_id) DO UPDATE SET item_id = EXCLUDED.item_id
		RETURNING id, item_id, created_at
	`, req.ItemID).Scan(&entry.ID, &entry.ItemID, &entry.SavedAt); err != nil {
		respondError(c, http.StatusInternalServerError, err)
		return
	}

	c.JSON(http.StatusCreated, entry)
}

func (s *Server) handleDeleteReadLater(c *gin.Context) {
	itemID, err := strconv.Atoi(c.Param("itemID"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid item id"})
		return
	}

	result, err := s.db.Exec(`DELETE FROM read_later WHERE item_id = $1`, itemID)
	if err != nil {
		respondError(c, http.StatusInternalServerError, err)
		return
	}
	if count, _ := result.RowsAffected(); count == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "not found"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"status": "ok"})
}

func (s *Server) handleListFavorites(c *gin.Context) {
	rows, err := s.db.Query(`
		SELECT f.id, f.item_id, f.tags, f.created_at,
			i.feed_id, fd.name, fd.category_id, c.name, i.title, i.link, COALESCE(i.summary, ''), i.published_at
		FROM favorites f
		JOIN items i ON i.id = f.item_id
		JOIN feeds fd ON fd.id = i.feed_id
		LEFT JOIN categories c ON c.id = fd.category_id
		ORDER BY f.created_at DESC
	`)
	if err != nil {
		respondError(c, http.StatusInternalServerError, err)
		return
	}
	defer rows.Close()

	var entries []FavoriteEntry
	for rows.Next() {
		var entry FavoriteEntry
		if err := rows.Scan(
			&entry.ID,
			&entry.ItemID,
			pq.Array(&entry.Tags),
			&entry.SavedAt,
			&entry.FeedID,
			&entry.FeedName,
			&entry.CategoryID,
			&entry.Category,
			&entry.Title,
			&entry.Link,
			&entry.Summary,
			&entry.PublishedAt,
		); err != nil {
			respondError(c, http.StatusInternalServerError, err)
			return
		}
		entries = append(entries, entry)
	}
	c.JSON(http.StatusOK, entries)
}

func (s *Server) handleCreateFavorite(c *gin.Context) {
	var req createFavoriteRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondError(c, http.StatusBadRequest, err)
		return
	}
	if req.ItemID == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "item_id is required"})
		return
	}

	var entry FavoriteEntry
	if err := s.db.QueryRow(`
		INSERT INTO favorites (item_id, tags)
		VALUES ($1, $2)
		ON CONFLICT (item_id) DO UPDATE SET tags = EXCLUDED.tags
		RETURNING id, item_id, tags, created_at
	`, req.ItemID, pq.Array(req.Tags)).Scan(&entry.ID, &entry.ItemID, pq.Array(&entry.Tags), &entry.SavedAt); err != nil {
		respondError(c, http.StatusInternalServerError, err)
		return
	}

	c.JSON(http.StatusCreated, entry)
}

func (s *Server) handleUpdateFavorite(c *gin.Context) {
	itemID, err := strconv.Atoi(c.Param("itemID"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid item id"})
		return
	}

	var req updateFavoriteRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondError(c, http.StatusBadRequest, err)
		return
	}

	var entry FavoriteEntry
	if err := s.db.QueryRow(`
		UPDATE favorites SET tags = $1 WHERE item_id = $2
		RETURNING id, item_id, tags, created_at
	`, pq.Array(req.Tags), itemID).Scan(&entry.ID, &entry.ItemID, pq.Array(&entry.Tags), &entry.SavedAt); err != nil {
		if err == sql.ErrNoRows {
			c.JSON(http.StatusNotFound, gin.H{"error": "not found"})
			return
		}
		respondError(c, http.StatusInternalServerError, err)
		return
	}

	c.JSON(http.StatusOK, entry)
}

func (s *Server) handleDeleteFavorite(c *gin.Context) {
	itemID, err := strconv.Atoi(c.Param("itemID"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid item id"})
		return
	}

	result, err := s.db.Exec(`DELETE FROM favorites WHERE item_id = $1`, itemID)
	if err != nil {
		respondError(c, http.StatusInternalServerError, err)
		return
	}
	if count, _ := result.RowsAffected(); count == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "not found"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"status": "ok"})
}

func corsMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		headers := c.Writer.Header()
		headers.Set("Access-Control-Allow-Origin", "*")
		headers.Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS, PATCH, DELETE")
		headers.Set("Access-Control-Allow-Headers", "Content-Type")
		if c.Request.Method == http.MethodOptions {
			c.AbortWithStatus(http.StatusNoContent)
			return
		}
		c.Next()
	}
}

func respondError(c *gin.Context, status int, err error) {
	c.JSON(status, gin.H{"error": err.Error()})
}

func parsePositiveInt(value string, fallback int) int {
	if value == "" {
		return fallback
	}
	parsed, err := strconv.Atoi(value)
	if err != nil || parsed <= 0 {
		return fallback
	}
	return parsed
}
