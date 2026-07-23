# ======= • ======= • ======= • ======= • =======• =======
# AnimePaheAPI
# ======= • ======= • ======= • ======= • =======• =======

> RESTful API for animepahe.ch — scrapes and serves anime data with streaming links via 38+ endpoints.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-18+-green.svg)](https://nodejs.org)
[![Express](https://img.shields.io/badge/Express-4.x-orange.svg)](https://expressjs.com)

---

## Overview

AnimePaheAPI is a backend service that scrapes **animepahe.ch** and provides a clean, structured JSON API for frontend applications. It handles Cloudflare bypass, HTML parsing, caching, and rate limiting — so your frontend only needs simple GET requests.

**Key Features:**
- 38+ API endpoints: search, browse, details, streaming, and utilities
- **Streaming m3u8 links** extracted from kwik.cx iframes via Playwright
- **Direct download URLs** with automatic form submission bypass
- **Automatic cookie management** — solves DDoS-Guard via Playwright browser
- **Multi-strategy anti-bot bypass**: got-scraping → Playwright (with DDoS-Guard auto-detection)
- In-memory caching with per-endpoint TTL (30s to 5min)
- OpenAPI/Swagger documentation built-in
- Deployable to Vercel, Render, Railway, or Docker

---

## Quick Start

```bash
# Clone the repository
git clone https://github.com/Shineii86/AnimePaheAPI.git
cd AnimePaheAPI

# Install dependencies
npm install

# Install Chromium for Playwright (required for streaming)
npx playwright install chromium

# Start the server
npm start

# Server runs at http://localhost:3000
```

---

## Deployment

### Vercel
```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel
```

### Render
- Connect your GitHub repo
- Build Command: `npm install`
- Start Command: `npm start`

### Docker
```bash
docker build -t animepaheapi .
docker run -p 3000:3000 animepaheapi
```

---

## API Endpoints

### Home

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api` | Home page data (latest, trending, popular) |

### Search

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/suggestions?q={query}` | Autocomplete suggestions (max 8) |
| GET | `/api/search?q={query}&page={page}` | Full search with pagination |

### Details

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/info/{slug}` | Complete anime info |
| GET | `/api/episodes/{slug}` | Full episode list |

### Browse

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/category/{name}` | Browse by category |
| GET | `/api/genre/{name}` | Browse by genre |
| GET | `/api/studio/{name}` | Browse by studio |
| GET | `/api/tag/{name}` | Browse by tag |
| GET | `/api/az-list` | A-Z alphabetical listing |
| GET | `/api/season` | Season index |
| GET | `/api/series` | Full series catalog |

### Streaming & Downloads

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/play/:animeSession/:episodeSession` | Streaming m3u8 + download links |
| GET | `/api/airing` | Currently airing anime |
| GET | `/api/queue` | Encoding queue status |
| POST | `/api/refresh-cookies` | Force cookie refresh |
| GET | `/api/scraper-status` | Scraper state info |

### Utility

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/health` | Health check |
| GET | `/api/stats` | Cache & server stats |
| GET | `/api/docs` | OpenAPI specification |

---

## Response Format

All responses follow a consistent format:

### Success
```json
{
  "success": true,
  "results": { ... }
}
```

### Error
```json
{
  "success": false,
  "message": "Error description"
}
```

---

## Examples

### Get Home Page
```bash
curl http://localhost:3000/api
```

### Search for Anime
```bash
curl "http://localhost:3000/api/search?q=naruto"
```

### Get Anime Details
```bash
curl http://localhost:3000/api/info/one-piece
```

### Get Episodes
```bash
curl http://localhost:3000/api/episodes/one-piece
```

### Browse by Genre
```bash
curl http://localhost:3000/api/genre/action
```

### Get Streaming Links
```bash
curl http://localhost:3000/api/play/{animeSession}/{episodeSession}
# Returns m3u8 streaming URLs + direct download links
```

### Get Airing Anime
```bash
curl http://localhost:3000/api/airing
```

### Force Cookie Refresh
```bash
curl -X POST http://localhost:3000/api/refresh-cookies
```

---

## Architecture

```
AnimePaheAPI/
├── server.js                    # Express server entry point
├── package.json                 # Dependencies & scripts
├── vercel.json                  # Vercel deployment config
├── render.yaml                  # Render deployment config
├── Dockerfile                   # Docker deployment config
├── public/
│   └── index.html               # Landing page
└── src/
    ├── configs/
    │   ├── dataUrl.js           # URL patterns for animepahe.ch
    │   └── header.config.js     # Browser request headers
    ├── helper/
    │   ├── cache.helper.js      # In-memory cache with TTL
    │   └── error.helper.js      # Custom error class + handler
    ├── scrapers/
    │   └── animepahe.js         # Core scraper with cookie management
    ├── models/
    │   └── playModel.js         # Streaming m3u8 extraction
    ├── utils/
    │   ├── browser.js           # Playwright launcher + stealth
    │   ├── config.js            # Environment config + URLs
    │   ├── requestManager.js    # HTTP client (got-scraping, playwright, DDoS bypass)
    │   ├── jsParser.js          # JavaScript variable extraction
    │   ├── dataProcessor.js     # API response normalization
    │   └── urlConverter.js      # m3u8 → download URL conversion
    ├── extractors/
    │   ├── home.extractor.js    # Homepage data extraction
    │   ├── search.extractor.js  # Search results extraction
    │   ├── info.extractor.js    # Anime detail extraction
    │   ├── episodes.extractor.js # Episode list extraction
    │   └── series.extractor.js  # Series/browse page extraction
    └── routes/
        └── apiRoutes.js         # All 38 API endpoints
```

---

## Cache Configuration

| Endpoint | TTL | Rationale |
|----------|-----|-----------|
| Suggestions | 30s | Autocomplete needs fresh results |
| Search | 60s | Results change as new anime air |
| Episodes | 60s | New episodes drop frequently |
| Home | 120s | Balanced freshness/performance |
| Info | 300s | Anime details rarely change |
| A-Z / Season / Genre | 180s | Static catalog data |

---

## How It Works

1. **Request arrives** → Express router matches endpoint
2. **Cache check** → If cached data exists, return immediately
3. **Fetch HTML** → Axios fetches animepahe.ch with browser headers
4. **Parse HTML** → Cheerio extracts structured data from the DOM
5. **Cache result** → Store in memory with appropriate TTL
6. **Return JSON** → Consistent `{ success: true, results: data }` format

---

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | Server port |
| `BASE_URL` | `https://animepahe.ch` | animepahe domain |
| `IFRAME_BASE_URL` | `kwik.cx` | Streaming CDN domain |
| `USER_AGENT` | Chrome 120 string | Browser user agent |
| `COOKIES` | (auto-extracted) | Manual cookie override |
| `USE_PROXY` | `false` | Enable proxy rotation |
| `PROXIES` | (empty) | Comma-separated proxy URLs |
| `CHROME_HEADLESS` | (auto) | Force headless Chrome |

---

## Tech Stack

- **Runtime:** Node.js 18+
- **Framework:** Express 4.x
- **HTTP Clients:** Axios, got-scraping
- **Browser:** Playwright + @sparticuz/chromium
- **HTML Parser:** Cheerio
- **JS Sandbox:** jsdom + vm (for m3u8 extraction)
- **Compression:** compression
- **CORS:** cors

---

## License

MIT License - see [LICENSE](LICENSE) file.

---

## Author

**Shinei Nouzen** - [GitHub](https://github.com/Shineii86)

---

## Acknowledgments

- [animepahe.ch](https://animepahe.ch) for the source data
- [Cheerio](https://cheerio.js.org/) for HTML parsing
- [Express](https://expressjs.com/) for the web framework
