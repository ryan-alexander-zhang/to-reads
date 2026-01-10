package main

import (
	"database/sql"
	"fmt"
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
	ID        string    `json:"id"`
	Name      string    `json:"name"`
	CreatedAt time.Time `json:"created_at"`
}

type Feed struct {
	ID            string     `json:"id"`
	Name          string     `json:"name"`
	URL           string     `json:"url"`
	CategoryID    *string    `json:"category_id"`
	FetchInterval int        `json:"fetch_interval_minutes"`
	LastFetchedAt *time.Time `json:"last_fetched_at"`
	LastStatus    *string    `json:"last_status"`
	LastError     *string    `json:"last_error"`
	CategoryName  *string    `json:"category_name"`
}

type TransferPayload struct {
	Categories []TransferCategory `json:"categories"`
	Feeds      []TransferFeed     `json:"feeds"`
}

type TransferCategory struct {
	ID   string `json:"id"`
	Name string `json:"name"`
}

type TransferFeed struct {
	ID           string  `json:"id"`
	Name         string  `json:"name"`
	URL          string  `json:"url"`
	CategoryID   *string `json:"category_id"`
	CategoryName *string `json:"category_name"`
}

type Item struct {
	ID          string     `json:"id"`
	FeedID      string     `json:"feed_id"`
	FeedName    string     `json:"feed_name"`
	CategoryID  *string    `json:"category_id"`
	Category    *string    `json:"category"`
	Title       string     `json:"title"`
	Link        string     `json:"link"`
	Summary     string     `json:"summary"`
	PublishedAt *time.Time `json:"published_at"`
	IsRead      bool       `json:"is_read"`
	IsFavorite  bool       `json:"is_favorite"`
}

type ReadLaterEntry struct {
	ID          string     `json:"id"`
	ItemID      string     `json:"item_id"`
	FeedID      string     `json:"feed_id"`
	FeedName    string     `json:"feed_name"`
	CategoryID  *string    `json:"category_id"`
	Category    *string    `json:"category"`
	Title       string     `json:"title"`
	Link        string     `json:"link"`
	Summary     string     `json:"summary"`
	PublishedAt *time.Time `json:"published_at"`
	SavedAt     time.Time  `json:"saved_at"`
}

type createCategoryRequest struct {
	Name string `json:"name"`
}

type createFeedRequest struct {
	Name       string  `json:"name"`
	URL        string  `json:"url"`
	CategoryID *string `json:"category_id"`
}

type createReadLaterRequest struct {
	ItemID string `json:"item_id"`
}

type updateItemReadRequest struct {
	Read bool `json:"read"`
}

type batchReadRequest struct {
	ItemIDs []string `json:"item_ids"`
	Read    bool     `json:"read"`
}

type updateItemFavoriteRequest struct {
	Favorite bool `json:"favorite"`
}

type updateFeedRequest struct {
	Name       *string `json:"name"`
	CategoryID *string `json:"category_id"`
}

type ItemsResponse struct {
	Items    []Item `json:"items"`
	Total    int    `json:"total"`
	Page     int    `json:"page"`
	PageSize int    `json:"page_size"`
}

func (s *Server) routes() http.Handler {
	router := gin.New()
	router.Use(gin.Logger(), gin.Recovery(), corsMiddleware(), responseMiddleware())

	api := router.Group("/api")
	api.GET("/health", s.handleHealth)
	api.GET("/categories", s.handleListCategories)
	api.POST("/categories", s.handleCreateCategory)
	api.DELETE("/categories/:id", s.handleDeleteCategory)
	api.GET("/feeds", s.handleListFeeds)
	api.POST("/feeds", s.handleCreateFeed)
	api.PATCH("/feeds/:id", s.handleUpdateFeed)
	api.DELETE("/feeds/:id", s.handleDeleteFeed)
	api.POST("/feeds/:id/refresh", s.handleRefreshFeed)
	api.GET("/items", s.handleListItems)
	api.GET("/items/unread-count", s.handleUnreadCount)
	api.PATCH("/items/:id/read", s.handleUpdateItemRead)
	api.POST("/items/read-batch", s.handleBatchRead)
	api.PATCH("/items/:id/favorite", s.handleUpdateItemFavorite)
	api.POST("/refresh", s.handleRefreshAll)
	api.GET("/export", s.handleExportData)
	api.POST("/import", s.handleImportData)
	api.GET("/read-later", s.handleListReadLater)
	api.POST("/read-later", s.handleCreateReadLater)
	api.DELETE("/read-later/:itemID", s.handleDeleteReadLater)

	return router
}

func (s *Server) handleHealth(c *gin.Context) {
	respondSuccess(c, http.StatusOK, gin.H{"status": "ok"})
}

func (s *Server) handleListCategories(c *gin.Context) {
	rows, err := s.db.Query(`SELECT id, name, created_at FROM categories ORDER BY name ASC`)
	if err != nil {
		respondError(c, http.StatusInternalServerError, err)
		return
	}
	defer rows.Close()

	categories := make([]Category, 0)
	for rows.Next() {
		var category Category
		var categoryID int64
		if err := rows.Scan(&categoryID, &category.Name, &category.CreatedAt); err != nil {
			respondError(c, http.StatusInternalServerError, err)
			return
		}
		category.ID = formatID(categoryID)
		categories = append(categories, category)
	}
	respondSuccess(c, http.StatusOK, categories)
}

func (s *Server) handleCreateCategory(c *gin.Context) {
	var req createCategoryRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondError(c, http.StatusBadRequest, err)
		return
	}
	if strings.TrimSpace(req.Name) == "" {
		respondErrorMessage(c, http.StatusBadRequest, "name is required")
		return
	}

	var category Category
	query := `INSERT INTO categories (name) VALUES ($1)
		ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
		RETURNING id, name, created_at`
	var categoryID int64
	if err := s.db.QueryRow(query, strings.TrimSpace(req.Name)).Scan(&categoryID, &category.Name, &category.CreatedAt); err != nil {
		respondError(c, http.StatusInternalServerError, err)
		return
	}
	category.ID = formatID(categoryID)

	respondSuccess(c, http.StatusCreated, category)
}

func (s *Server) handleDeleteCategory(c *gin.Context) {
	categoryID, err := parseIDParam(c.Param("id"))
	if err != nil {
		respondErrorMessage(c, http.StatusBadRequest, "invalid category id")
		return
	}

	result, err := s.db.Exec(`DELETE FROM categories WHERE id = $1`, categoryID)
	if err != nil {
		respondError(c, http.StatusInternalServerError, err)
		return
	}
	if count, _ := result.RowsAffected(); count == 0 {
		respondErrorMessage(c, http.StatusNotFound, "not found")
		return
	}

	respondSuccess(c, http.StatusOK, gin.H{"status": "ok"})
}

func (s *Server) handleListFeeds(c *gin.Context) {
	categoryIDParam := c.Query("category_id")
	var rows *sql.Rows
	var err error
	if categoryIDParam != "" {
		categoryID, err := parseIDParam(categoryIDParam)
		if err != nil {
			respondErrorMessage(c, http.StatusBadRequest, "invalid category id")
			return
		}
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

	feeds := make([]Feed, 0)
	for rows.Next() {
		var feed Feed
		var feedID int64
		var categoryID sql.NullInt64
		if err := rows.Scan(
			&feedID,
			&feed.Name,
			&feed.URL,
			&categoryID,
			&feed.FetchInterval,
			&feed.LastFetchedAt,
			&feed.LastStatus,
			&feed.LastError,
			&feed.CategoryName,
		); err != nil {
			respondError(c, http.StatusInternalServerError, err)
			return
		}
		feed.ID = formatID(feedID)
		feed.CategoryID = formatNullableID(categoryID)
		feeds = append(feeds, feed)
	}

	respondSuccess(c, http.StatusOK, feeds)
}

func (s *Server) handleCreateFeed(c *gin.Context) {
	var req createFeedRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondError(c, http.StatusBadRequest, err)
		return
	}
	if strings.TrimSpace(req.Name) == "" || strings.TrimSpace(req.URL) == "" {
		respondErrorMessage(c, http.StatusBadRequest, "name and url are required")
		return
	}

	categoryID, err := parseOptionalID(req.CategoryID)
	if err != nil {
		respondErrorMessage(c, http.StatusBadRequest, "invalid category id")
		return
	}

	var feed Feed
	query := `
		INSERT INTO feeds (name, url, category_id, fetch_interval_minutes)
		VALUES ($1, $2, $3, $4)
		ON CONFLICT (url) DO UPDATE SET name = EXCLUDED.name, category_id = EXCLUDED.category_id
		RETURNING id, name, url, category_id, fetch_interval_minutes, last_fetched_at, last_status, last_error
	`
	var feedID int64
	var scannedCategoryID sql.NullInt64
	if err := s.db.QueryRow(query, strings.TrimSpace(req.Name), strings.TrimSpace(req.URL), categoryID, s.config.FetchIntervalMinutes).Scan(
		&feedID,
		&feed.Name,
		&feed.URL,
		&scannedCategoryID,
		&feed.FetchInterval,
		&feed.LastFetchedAt,
		&feed.LastStatus,
		&feed.LastError,
	); err != nil {
		respondError(c, http.StatusInternalServerError, err)
		return
	}
	feed.ID = formatID(feedID)
	feed.CategoryID = formatNullableID(scannedCategoryID)

	go func(feedID int64) {
		_ = s.fetchFeedByID(c.Request.Context(), feedID)
	}(feedID)

	respondSuccess(c, http.StatusCreated, feed)
}

func (s *Server) handleUpdateFeed(c *gin.Context) {
	feedID, err := parseIDParam(c.Param("id"))
	if err != nil {
		respondErrorMessage(c, http.StatusBadRequest, "invalid feed id")
		return
	}

	var req updateFeedRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondError(c, http.StatusBadRequest, err)
		return
	}

	setClauses := []string{}
	args := []interface{}{}
	argIndex := 1

	if req.Name != nil {
		trimmed := strings.TrimSpace(*req.Name)
		if trimmed == "" {
			respondErrorMessage(c, http.StatusBadRequest, "name cannot be empty")
			return
		}
		setClauses = append(setClauses, "name = $"+strconv.Itoa(argIndex))
		args = append(args, trimmed)
		argIndex++
	}

	if req.CategoryID != nil {
		categoryID, err := parseOptionalID(req.CategoryID)
		if err != nil {
			respondErrorMessage(c, http.StatusBadRequest, "invalid category id")
			return
		}
		if categoryID == nil || *categoryID == 0 {
			setClauses = append(setClauses, "category_id = NULL")
		} else {
			setClauses = append(setClauses, "category_id = $"+strconv.Itoa(argIndex))
			args = append(args, *categoryID)
			argIndex++
		}
	}

	if len(setClauses) == 0 {
		respondErrorMessage(c, http.StatusBadRequest, "no fields to update")
		return
	}

	args = append(args, feedID)
	query := `UPDATE feeds SET ` + strings.Join(setClauses, ", ") + ` WHERE id = $` + strconv.Itoa(argIndex) + ` RETURNING id, name, url, category_id, fetch_interval_minutes, last_fetched_at, last_status, last_error`

	var feed Feed
	var updatedFeedID int64
	var categoryID sql.NullInt64
	if err := s.db.QueryRow(query, args...).Scan(
		&updatedFeedID,
		&feed.Name,
		&feed.URL,
		&categoryID,
		&feed.FetchInterval,
		&feed.LastFetchedAt,
		&feed.LastStatus,
		&feed.LastError,
	); err != nil {
		respondError(c, http.StatusInternalServerError, err)
		return
	}
	feed.ID = formatID(updatedFeedID)
	feed.CategoryID = formatNullableID(categoryID)

	respondSuccess(c, http.StatusOK, feed)
}

func (s *Server) handleDeleteFeed(c *gin.Context) {
	feedID, err := parseIDParam(c.Param("id"))
	if err != nil {
		respondErrorMessage(c, http.StatusBadRequest, "invalid feed id")
		return
	}

	result, err := s.db.Exec(`DELETE FROM feeds WHERE id = $1`, feedID)
	if err != nil {
		respondError(c, http.StatusInternalServerError, err)
		return
	}
	if count, _ := result.RowsAffected(); count == 0 {
		respondErrorMessage(c, http.StatusNotFound, "not found")
		return
	}

	respondSuccess(c, http.StatusOK, gin.H{"status": "ok"})
}

func (s *Server) handleRefreshFeed(c *gin.Context) {
	feedID, err := parseIDParam(c.Param("id"))
	if err != nil {
		respondErrorMessage(c, http.StatusBadRequest, "invalid feed id")
		return
	}

	if err := s.fetchFeedByID(c.Request.Context(), feedID); err != nil {
		respondError(c, http.StatusInternalServerError, err)
		return
	}

	respondSuccess(c, http.StatusOK, gin.H{"status": "ok"})
}

func (s *Server) handleRefreshAll(c *gin.Context) {
	if err := s.fetchAllFeeds(c.Request.Context()); err != nil {
		respondError(c, http.StatusInternalServerError, err)
		return
	}
	respondSuccess(c, http.StatusOK, gin.H{"status": "ok"})
}

func (s *Server) handleExportData(c *gin.Context) {
	categoryRows, err := s.db.Query(`SELECT id, name FROM categories ORDER BY name ASC`)
	if err != nil {
		respondError(c, http.StatusInternalServerError, err)
		return
	}
	defer categoryRows.Close()

	categories := make([]TransferCategory, 0)
	for categoryRows.Next() {
		var category TransferCategory
		var categoryID int64
		if err := categoryRows.Scan(&categoryID, &category.Name); err != nil {
			respondError(c, http.StatusInternalServerError, err)
			return
		}
		category.ID = formatID(categoryID)
		categories = append(categories, category)
	}

	feedRows, err := s.db.Query(`
		SELECT f.id, f.name, f.url, f.category_id, c.name
		FROM feeds f
		LEFT JOIN categories c ON c.id = f.category_id
		ORDER BY f.name ASC
	`)
	if err != nil {
		respondError(c, http.StatusInternalServerError, err)
		return
	}
	defer feedRows.Close()

	feeds := make([]TransferFeed, 0)
	for feedRows.Next() {
		var feed TransferFeed
		var feedID int64
		var categoryID sql.NullInt64
		if err := feedRows.Scan(&feedID, &feed.Name, &feed.URL, &categoryID, &feed.CategoryName); err != nil {
			respondError(c, http.StatusInternalServerError, err)
			return
		}
		feed.ID = formatID(feedID)
		feed.CategoryID = formatNullableID(categoryID)
		feeds = append(feeds, feed)
	}

	respondSuccess(c, http.StatusOK, TransferPayload{Categories: categories, Feeds: feeds})
}

func (s *Server) handleImportData(c *gin.Context) {
	var payload TransferPayload
	if err := c.ShouldBindJSON(&payload); err != nil {
		respondError(c, http.StatusBadRequest, err)
		return
	}

	tx, err := s.db.BeginTx(c.Request.Context(), nil)
	if err != nil {
		respondError(c, http.StatusInternalServerError, err)
		return
	}

	rollback := func() {
		_ = tx.Rollback()
	}

	categoryNameByID := make(map[string]string)
	for _, category := range payload.Categories {
		if strings.TrimSpace(category.ID) == "" {
			continue
		}
		categoryNameByID[strings.TrimSpace(category.ID)] = strings.TrimSpace(category.Name)
	}

	categoryIDByName := make(map[string]int64)
	for _, category := range payload.Categories {
		name := strings.TrimSpace(category.Name)
		if name == "" {
			rollback()
			respondErrorMessage(c, http.StatusBadRequest, "category name is required")
			return
		}
		var categoryID int64
		if err := tx.QueryRow(
			`INSERT INTO categories (name) VALUES ($1)
			ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
			RETURNING id`,
			name,
		).Scan(&categoryID); err != nil {
			rollback()
			respondError(c, http.StatusInternalServerError, err)
			return
		}
		categoryIDByName[name] = categoryID
	}

	importedFeeds := 0
	for _, feed := range payload.Feeds {
		name := strings.TrimSpace(feed.Name)
		url := strings.TrimSpace(feed.URL)
		if name == "" || url == "" {
			rollback()
			respondErrorMessage(c, http.StatusBadRequest, "feed name and url are required")
			return
		}

		categoryName := ""
		if feed.CategoryName != nil {
			categoryName = strings.TrimSpace(*feed.CategoryName)
		}
		if categoryName == "" && feed.CategoryID != nil {
			if mappedName, ok := categoryNameByID[strings.TrimSpace(*feed.CategoryID)]; ok {
				categoryName = strings.TrimSpace(mappedName)
			}
		}

		var categoryID *int64
		if categoryName != "" {
			if existingID, ok := categoryIDByName[categoryName]; ok {
				categoryID = &existingID
			} else {
				var newCategoryID int64
				if err := tx.QueryRow(
					`INSERT INTO categories (name) VALUES ($1)
					ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
					RETURNING id`,
					categoryName,
				).Scan(&newCategoryID); err != nil {
					rollback()
					respondError(c, http.StatusInternalServerError, err)
					return
				}
				categoryIDByName[categoryName] = newCategoryID
				categoryID = &newCategoryID
			}
		}

		var feedID int64
		if err := tx.QueryRow(
			`INSERT INTO feeds (name, url, category_id, fetch_interval_minutes)
			VALUES ($1, $2, $3, $4)
			ON CONFLICT (url) DO UPDATE SET name = EXCLUDED.name, category_id = EXCLUDED.category_id
			RETURNING id`,
			name,
			url,
			categoryID,
			s.config.FetchIntervalMinutes,
		).Scan(&feedID); err != nil {
			rollback()
			respondError(c, http.StatusInternalServerError, err)
			return
		}
		importedFeeds++
	}

	if err := tx.Commit(); err != nil {
		rollback()
		respondError(c, http.StatusInternalServerError, err)
		return
	}

	respondSuccess(c, http.StatusOK, gin.H{
		"categories": len(payload.Categories),
		"feeds":      importedFeeds,
	})
}

func (s *Server) handleListItems(c *gin.Context) {
	categoryIDParam := c.Query("category_id")
	feedIDParam := c.Query("feed_id")
	searchQuery := strings.TrimSpace(c.Query("q"))
	unreadOnly := c.Query("unread") == "true"
	favoriteOnly := c.Query("favorite") == "true"
	page := parsePositiveInt(c.Query("page"), 1)
	pageSize := parsePositiveInt(c.Query("page_size"), 20)
	offset := (page - 1) * pageSize

	conditions := []string{}
	args := []interface{}{}
	argIndex := 1
	if categoryIDParam != "" {
		categoryID, err := parseIDParam(categoryIDParam)
		if err != nil {
			respondErrorMessage(c, http.StatusBadRequest, "invalid category id")
			return
		}
		conditions = append(conditions, "f.category_id = $"+strconv.Itoa(argIndex))
		args = append(args, categoryID)
		argIndex++
	}
	if feedIDParam != "" {
		feedID, err := parseIDParam(feedIDParam)
		if err != nil {
			respondErrorMessage(c, http.StatusBadRequest, "invalid feed id")
			return
		}
		conditions = append(conditions, "i.feed_id = $"+strconv.Itoa(argIndex))
		args = append(args, feedID)
		argIndex++
	}
	if searchQuery != "" {
		conditions = append(conditions, "(i.title ILIKE $"+strconv.Itoa(argIndex)+" OR i.summary ILIKE $"+strconv.Itoa(argIndex)+")")
		args = append(args, "%"+searchQuery+"%")
		argIndex++
	}
	if unreadOnly {
		conditions = append(conditions, "i.is_read = FALSE")
	}
	if favoriteOnly {
		conditions = append(conditions, "i.is_favorite = TRUE")
	}

	whereClause := ""
	if len(conditions) > 0 {
		whereClause = "WHERE " + strings.Join(conditions, " AND ")
	}

	var total int
	countQuery := `SELECT COUNT(*) FROM items i JOIN feeds f ON f.id = i.feed_id ` + whereClause
	if err := s.db.QueryRow(countQuery, args...).Scan(&total); err != nil {
		respondError(c, http.StatusInternalServerError, err)
		return
	}

	var rows *sql.Rows
	var err error
	listArgs := append([]interface{}{}, args...)
	listArgs = append(listArgs, pageSize, offset)
	limitIndex := argIndex
	offsetIndex := argIndex + 1
	rows, err = s.db.Query(`
		SELECT i.id, i.feed_id, f.name, f.category_id, c.name, i.title, i.link, COALESCE(i.summary, ''), i.published_at, i.is_read, i.is_favorite
		FROM items i
		JOIN feeds f ON f.id = i.feed_id
		LEFT JOIN categories c ON c.id = f.category_id
		`+whereClause+`
		ORDER BY i.published_at DESC NULLS LAST, i.created_at DESC
		LIMIT $`+strconv.Itoa(limitIndex)+` OFFSET $`+strconv.Itoa(offsetIndex)+`
	`, listArgs...)
	if err != nil {
		respondError(c, http.StatusInternalServerError, err)
		return
	}
	defer rows.Close()

	items := make([]Item, 0)
	for rows.Next() {
		var item Item
		var itemID int64
		var feedID int64
		var categoryID sql.NullInt64
		if err := rows.Scan(
			&itemID,
			&feedID,
			&item.FeedName,
			&categoryID,
			&item.Category,
			&item.Title,
			&item.Link,
			&item.Summary,
			&item.PublishedAt,
			&item.IsRead,
			&item.IsFavorite,
		); err != nil {
			respondError(c, http.StatusInternalServerError, err)
			return
		}
		item.ID = formatID(itemID)
		item.FeedID = formatID(feedID)
		item.CategoryID = formatNullableID(categoryID)
		items = append(items, item)
	}

	respondSuccess(c, http.StatusOK, ItemsResponse{Items: items, Total: total, Page: page, PageSize: pageSize})
}

func (s *Server) handleUnreadCount(c *gin.Context) {
	categoryIDParam := c.Query("category_id")
	feedIDParam := c.Query("feed_id")
	conditions := []string{"i.is_read = FALSE"}
	args := []interface{}{}
	argIndex := 1

	if categoryIDParam != "" {
		categoryID, err := parseIDParam(categoryIDParam)
		if err != nil {
			respondErrorMessage(c, http.StatusBadRequest, "invalid category id")
			return
		}
		conditions = append(conditions, "f.category_id = $"+strconv.Itoa(argIndex))
		args = append(args, categoryID)
		argIndex++
	}
	if feedIDParam != "" {
		feedID, err := parseIDParam(feedIDParam)
		if err != nil {
			respondErrorMessage(c, http.StatusBadRequest, "invalid feed id")
			return
		}
		conditions = append(conditions, "i.feed_id = $"+strconv.Itoa(argIndex))
		args = append(args, feedID)
		argIndex++
	}

	whereClause := "WHERE " + strings.Join(conditions, " AND ")
	query := `SELECT COUNT(*) FROM items i JOIN feeds f ON f.id = i.feed_id ` + whereClause
	var count int
	if err := s.db.QueryRow(query, args...).Scan(&count); err != nil {
		respondError(c, http.StatusInternalServerError, err)
		return
	}
	respondSuccess(c, http.StatusOK, gin.H{"unread": count})
}

func (s *Server) handleUpdateItemRead(c *gin.Context) {
	itemID, err := parseIDParam(c.Param("id"))
	if err != nil {
		respondErrorMessage(c, http.StatusBadRequest, "invalid item id")
		return
	}

	var req updateItemReadRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondError(c, http.StatusBadRequest, err)
		return
	}

	result, err := s.db.Exec(`UPDATE items SET is_read = $1 WHERE id = $2`, req.Read, itemID)
	if err != nil {
		respondError(c, http.StatusInternalServerError, err)
		return
	}
	if count, _ := result.RowsAffected(); count == 0 {
		respondErrorMessage(c, http.StatusNotFound, "not found")
		return
	}

	respondSuccess(c, http.StatusOK, gin.H{"status": "ok"})
}

func (s *Server) handleBatchRead(c *gin.Context) {
	var req batchReadRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondError(c, http.StatusBadRequest, err)
		return
	}
	if len(req.ItemIDs) == 0 {
		respondErrorMessage(c, http.StatusBadRequest, "item_ids is required")
		return
	}

	itemIDs, err := parseIDSlice(req.ItemIDs)
	if err != nil {
		respondErrorMessage(c, http.StatusBadRequest, "invalid item ids")
		return
	}

	query := `UPDATE items SET is_read = $1 WHERE id = ANY($2)`
	if _, err := s.db.Exec(query, req.Read, pqArray(itemIDs)); err != nil {
		respondError(c, http.StatusInternalServerError, err)
		return
	}
	respondSuccess(c, http.StatusOK, gin.H{"status": "ok"})
}

func (s *Server) handleUpdateItemFavorite(c *gin.Context) {
	itemID, err := parseIDParam(c.Param("id"))
	if err != nil {
		respondErrorMessage(c, http.StatusBadRequest, "invalid item id")
		return
	}

	var req updateItemFavoriteRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondError(c, http.StatusBadRequest, err)
		return
	}

	result, err := s.db.Exec(`UPDATE items SET is_favorite = $1 WHERE id = $2`, req.Favorite, itemID)
	if err != nil {
		respondError(c, http.StatusInternalServerError, err)
		return
	}
	if count, _ := result.RowsAffected(); count == 0 {
		respondErrorMessage(c, http.StatusNotFound, "not found")
		return
	}

	respondSuccess(c, http.StatusOK, gin.H{"status": "ok"})
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

	entries := make([]ReadLaterEntry, 0)
	for rows.Next() {
		var entry ReadLaterEntry
		var entryID int64
		var itemID int64
		var feedID int64
		var categoryID sql.NullInt64
		if err := rows.Scan(
			&entryID,
			&itemID,
			&entry.SavedAt,
			&feedID,
			&entry.FeedName,
			&categoryID,
			&entry.Category,
			&entry.Title,
			&entry.Link,
			&entry.Summary,
			&entry.PublishedAt,
		); err != nil {
			respondError(c, http.StatusInternalServerError, err)
			return
		}
		entry.ID = formatID(entryID)
		entry.ItemID = formatID(itemID)
		entry.FeedID = formatID(feedID)
		entry.CategoryID = formatNullableID(categoryID)
		entries = append(entries, entry)
	}
	respondSuccess(c, http.StatusOK, entries)
}

func (s *Server) handleCreateReadLater(c *gin.Context) {
	var req createReadLaterRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondError(c, http.StatusBadRequest, err)
		return
	}
	itemID, err := parseIDParam(req.ItemID)
	if err != nil {
		respondErrorMessage(c, http.StatusBadRequest, "invalid item id")
		return
	}
	if itemID == 0 {
		respondErrorMessage(c, http.StatusBadRequest, "item_id is required")
		return
	}

	var entry ReadLaterEntry
	var entryID int64
	var entryItemID int64
	if err := s.db.QueryRow(`
		INSERT INTO read_later (item_id)
		VALUES ($1)
		ON CONFLICT (item_id) DO UPDATE SET item_id = EXCLUDED.item_id
		RETURNING id, item_id, created_at
	`, itemID).Scan(&entryID, &entryItemID, &entry.SavedAt); err != nil {
		respondError(c, http.StatusInternalServerError, err)
		return
	}
	entry.ID = formatID(entryID)
	entry.ItemID = formatID(entryItemID)

	respondSuccess(c, http.StatusCreated, entry)
}

func (s *Server) handleDeleteReadLater(c *gin.Context) {
	itemID, err := parseIDParam(c.Param("itemID"))
	if err != nil {
		respondErrorMessage(c, http.StatusBadRequest, "invalid item id")
		return
	}

	result, err := s.db.Exec(`DELETE FROM read_later WHERE item_id = $1`, itemID)
	if err != nil {
		respondError(c, http.StatusInternalServerError, err)
		return
	}
	if count, _ := result.RowsAffected(); count == 0 {
		respondErrorMessage(c, http.StatusNotFound, "not found")
		return
	}

	respondSuccess(c, http.StatusOK, gin.H{"status": "ok"})
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
	respondErrorMessage(c, status, err.Error())
}

type APIResponse struct {
	Code    int         `json:"code"`
	Message string      `json:"message"`
	Data    interface{} `json:"data"`
}

func responseMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Next()
		if c.Writer.Written() {
			return
		}
		status := c.GetInt("response_status")
		if status == 0 {
			status = http.StatusOK
		}
		data, ok := c.Get("response_data")
		if !ok {
			return
		}
		message := c.GetString("response_message")
		if message == "" {
			message = http.StatusText(status)
		}
		c.JSON(status, APIResponse{Code: status, Message: message, Data: data})
	}
}

func respondSuccess(c *gin.Context, status int, data interface{}) {
	c.Set("response_status", status)
	c.Set("response_message", "ok")
	c.Set("response_data", data)
}

func respondErrorMessage(c *gin.Context, status int, message string) {
	c.Set("response_status", status)
	c.Set("response_message", message)
	c.Set("response_data", nil)
	c.Abort()
}

func formatID(value int64) string {
	return strconv.FormatInt(value, 10)
}

func formatNullableID(value sql.NullInt64) *string {
	if !value.Valid {
		return nil
	}
	formatted := formatID(value.Int64)
	return &formatted
}

func parseIDParam(value string) (int64, error) {
	return strconv.ParseInt(value, 10, 64)
}

func parseOptionalID(value *string) (*int64, error) {
	if value == nil {
		return nil, nil
	}
	trimmed := strings.TrimSpace(*value)
	if trimmed == "" {
		return nil, nil
	}
	parsed, err := strconv.ParseInt(trimmed, 10, 64)
	if err != nil {
		return nil, err
	}
	return &parsed, nil
}

func parseIDSlice(values []string) ([]int64, error) {
	parsed := make([]int64, 0, len(values))
	for _, value := range values {
		if strings.TrimSpace(value) == "" {
			return nil, fmt.Errorf("invalid id")
		}
		id, err := strconv.ParseInt(value, 10, 64)
		if err != nil {
			return nil, err
		}
		parsed = append(parsed, id)
	}
	return parsed, nil
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

func pqArray(values []int64) interface{} {
	return pq.Array(values)
}
