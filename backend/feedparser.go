package main

import (
	"bytes"
	"encoding/json"
	"encoding/xml"
	"fmt"
	"strings"
	"time"
)

type ParsedItem struct {
	Title     string
	Link      string
	Summary   string
	GUID      string
	Published *time.Time
}

type RSS struct {
	Channel RSSChannel `xml:"channel"`
}

type RSSChannel struct {
	Items []RSSItem `xml:"item"`
}

type RSSItem struct {
	Title       string `xml:"title"`
	Link        string `xml:"link"`
	Description string `xml:"description"`
	GUID        string `xml:"guid"`
	PubDate     string `xml:"pubDate"`
}

type AtomFeed struct {
	Entries []AtomEntry `xml:"entry"`
}

type AtomEntry struct {
	Title     string     `xml:"title"`
	ID        string     `xml:"id"`
	Summary   string     `xml:"summary"`
	Content   string     `xml:"content"`
	Updated   string     `xml:"updated"`
	Published string     `xml:"published"`
	Links     []AtomLink `xml:"link"`
}

type AtomLink struct {
	Href string `xml:"href,attr"`
	Rel  string `xml:"rel,attr"`
}

type JSONFeed struct {
	Items []JSONFeedItem `json:"items"`
}

type JSONFeedItem struct {
	ID            string `json:"id"`
	Title         string `json:"title"`
	URL           string `json:"url"`
	ExternalURL   string `json:"external_url"`
	Summary       string `json:"summary"`
	ContentText   string `json:"content_text"`
	ContentHTML   string `json:"content_html"`
	DatePublished string `json:"date_published"`
	DateModified  string `json:"date_modified"`
}

func parseFeed(data []byte) ([]ParsedItem, error) {
	trimmed := bytes.TrimSpace(data)
	if len(trimmed) == 0 {
		return nil, fmt.Errorf("empty feed")
	}

	if trimmed[0] == '{' || trimmed[0] == '[' {
		return parseJSONFeed(trimmed)
	}

	decoder := xml.NewDecoder(bytes.NewReader(trimmed))
	for {
		token, err := decoder.Token()
		if err != nil {
			return nil, fmt.Errorf("read xml: %w", err)
		}
		switch element := token.(type) {
		case xml.StartElement:
			switch strings.ToLower(element.Name.Local) {
			case "rss", "rdf", "rdf:rdf":
				return parseRSSFeed(trimmed)
			case "feed":
				return parseAtomFeed(trimmed)
			default:
				return nil, fmt.Errorf("unsupported feed root: %s", element.Name.Local)
			}
		}
	}
}

func parseRSSFeed(data []byte) ([]ParsedItem, error) {
	var rss RSS
	if err := xml.Unmarshal(data, &rss); err != nil {
		return nil, err
	}

	items := make([]ParsedItem, 0, len(rss.Channel.Items))
	for _, item := range rss.Channel.Items {
		published := parseTime(item.PubDate)
		summary := strings.TrimSpace(item.Description)
		guid := strings.TrimSpace(item.GUID)
		if guid == "" {
			guid = strings.TrimSpace(item.Link)
		}
		items = append(items, ParsedItem{
			Title:     strings.TrimSpace(item.Title),
			Link:      strings.TrimSpace(item.Link),
			Summary:   summary,
			GUID:      guid,
			Published: published,
		})
	}
	return items, nil
}

func parseAtomFeed(data []byte) ([]ParsedItem, error) {
	var feed AtomFeed
	if err := xml.Unmarshal(data, &feed); err != nil {
		return nil, err
	}

	items := make([]ParsedItem, 0, len(feed.Entries))
	for _, entry := range feed.Entries {
		link := ""
		for _, atomLink := range entry.Links {
			if atomLink.Rel == "" || atomLink.Rel == "alternate" {
				link = atomLink.Href
				break
			}
		}
		if link == "" {
			link = entry.ID
		}

		summary := strings.TrimSpace(entry.Summary)
		if summary == "" {
			summary = strings.TrimSpace(entry.Content)
		}

		published := parseTime(entry.Published)
		if published == nil {
			published = parseTime(entry.Updated)
		}

		guid := strings.TrimSpace(entry.ID)
		if guid == "" {
			guid = strings.TrimSpace(link)
		}

		items = append(items, ParsedItem{
			Title:     strings.TrimSpace(entry.Title),
			Link:      strings.TrimSpace(link),
			Summary:   summary,
			GUID:      guid,
			Published: published,
		})
	}
	return items, nil
}

func parseJSONFeed(data []byte) ([]ParsedItem, error) {
	var feed JSONFeed
	if err := json.Unmarshal(data, &feed); err != nil {
		return nil, err
	}

	items := make([]ParsedItem, 0, len(feed.Items))
	for _, item := range feed.Items {
		link := strings.TrimSpace(item.URL)
		if link == "" {
			link = strings.TrimSpace(item.ExternalURL)
		}
		summary := strings.TrimSpace(item.Summary)
		if summary == "" {
			summary = strings.TrimSpace(item.ContentText)
		}
		if summary == "" {
			summary = strings.TrimSpace(item.ContentHTML)
		}

		published := parseTime(item.DatePublished)
		if published == nil {
			published = parseTime(item.DateModified)
		}

		guid := strings.TrimSpace(item.ID)
		if guid == "" {
			guid = link
		}

		items = append(items, ParsedItem{
			Title:     strings.TrimSpace(item.Title),
			Link:      link,
			Summary:   summary,
			GUID:      guid,
			Published: published,
		})
	}
	return items, nil
}

func parseTime(value string) *time.Time {
	value = strings.TrimSpace(value)
	if value == "" {
		return nil
	}
	layouts := []string{
		time.RFC3339,
		time.RFC3339Nano,
		time.RFC1123Z,
		time.RFC1123,
		time.RFC822Z,
		time.RFC822,
		time.RFC850,
		"Mon, 2 Jan 2006 15:04:05 -0700",
	}
	for _, layout := range layouts {
		if parsed, err := time.Parse(layout, value); err == nil {
			return &parsed
		}
	}
	return nil
}
