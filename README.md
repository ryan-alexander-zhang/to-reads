# To-Reads RSS Reader

A lightweight RSS reader that supports RSS, Atom, and JSON Feed, with category management and cached fetching. The frontend offers site and article summary browsing, and you can open the original article by clicking the title.

```HTML
<video width="320" height="240" controls>
    <source src="demo/to-reads-reader-demo-compressed.mp4" type="video/mp4">
</video>
```

## Features

- Parse RSS, Atom, and JSON Feed formats
- Auto fetch every 1 hour, recording fetch time and status
- Choose a category when adding a site
- Show site name, title, time, and summary by category, sorted by publish time (newest first)
- Tech stack: Golang + PostgreSQL + React + TailwindCSS + shadcn-ui style components

## Project Structure

```
.
├── backend         # Go API service
├── frontend        # React frontend
```

## Quick Start (Docker Compose)

Make sure Docker and Docker Compose are installed, then run:

```bash
docker-compose up -d --build
```

Service URLs:

- Frontend: <http://localhost:3002>
- Backend: <http://localhost:8080>
- PostgreSQL: localhost:5432 (database: rss)

> The frontend container proxies `/api` to the backend through Nginx, so the browser does not need CORS configuration.

## Usage

1. Open <http://localhost:3002>
2. Add categories in the "Categories" section
3. In the "Add Site" section, enter the site name and Feed URL (RSS / Atom / JSON), then choose a category
4. The system fetches immediately and refreshes every 1 hour
5. Check titles, summaries, and publish times in "Latest Summaries", and click a title to open the original article

## API Overview

| Method | Path | Description |
| --- | --- | --- |
| GET | `/api/health` | Health check |
| GET | `/api/categories` | List categories |
| POST | `/api/categories` | Create category |
| GET | `/api/feeds` | List sites |
| POST | `/api/feeds` | Create site |
| GET | `/api/items` | List articles (sorted by publish time desc) |

## Database Tables

- `categories`: category data
- `feeds`: site data, includes `last_fetched_at` / `last_status` / `last_error`
- `items`: article entries, deduplicated by `feed_id + guid`

## Runtime Configuration

The backend supports the following environment variables:

| Variable | Default | Description |
| --- | --- | --- |
| `DATABASE_URL` | `postgres://postgres:postgres@localhost:5432/rss?sslmode=disable` | Database connection string |
| `PORT` | `8080` | Backend port |
| `FETCH_INTERVAL_MINUTES` | `60` | Auto fetch interval (minutes) |

## Local Development (Optional)

### Backend

```bash
cd backend

go mod tidy

go run .
```

### Frontend

```bash
cd frontend

pnpm install
pnpm dev
```

Make sure local PostgreSQL is running, and `DATABASE_URL` points to the correct database address.
