# Changelog

All notable changes to the AnimePaheAPI project will be documented in this file.

## [1.0.0] - 2026-07-23

### Initial Release

#### Core Features
- Express.js RESTful API server with 18+ endpoints
- DDoS-Guard bypass system using cached cookies + Playwright fallback
- Multi-strategy HTTP client (got-scraping, axios, Playwright)
- HTML scraping fallback when API endpoints are blocked
- In-memory caching with configurable TTL per endpoint type

#### Endpoints
- `GET /api` - Homepage (latest releases, trending, popular)
- `GET /api/search?q=` - Full-text anime search with pagination
- `GET /api/suggestions?q=` - Autocomplete search suggestions
- `GET /api/info/:slug` - Detailed anime information
- `GET /api/episodes/:slug` - Full episode list
- `GET /api/play/:slug` - Streaming video URLs (MP4/m3u8)
- `GET /api/category/:name` - Browse by category
- `GET /api/genre/:name` - Browse by genre
- `GET /api/studio/:name` - Browse by studio
- `GET /api/tag/:name` - Browse by tag
- `GET /api/az-list` - Alphabetical listing
- `GET /api/season` - Seasonal anime
- `GET /api/series` - Series listing
- `GET /api/airing` - Currently airing (requires Playwright)
- `GET /api/queue` - Encoding queue (requires Playwright)
- `GET /api/scraper-status` - Scraper status info
- `GET /api/health` - Health check
- `GET /api/stats` - Server statistics
- `GET /api/docs` - API documentation

#### Streaming Support
- turbovidhls/etvp: Direct MP4 extraction from iframe HTML
- kwik.cx: m3u8 extraction via VM sandbox with mock Hls/Plyr
- Blogger: Embed URL passthrough (needs Playwright for direct MP4)
- Generic fallback: Regex-based video URL extraction

#### Architecture
- Modular file structure: configs/, extractors/, helpers/, middleware/, models/, routes/, scrapers/, utils/
- Centralized config management with env var support
- Custom error handling with CustomError class
- Creator attribution middleware (Shinei Nouzen)
- Request logging with response time tracking
- Rate limiting (100 req/min per IP)
- CORS and compression middleware

#### Anti-Bot Bypass
- Cookie caching for 14 days with proactive refresh at 13 days
- DDoS-Guard challenge detection (5+ patterns)
- got-scraping TLS fingerprint spoofing
- Playwright stealth mode (navigator.webdriver, plugins, languages)
- Automatic retry on 403 with fresh cookies

#### Bug Fixes
- Fixed duplicate `const scripts` declaration in animepahe.js
- Fixed `window.location` undefined in info.extractor.js
- Fixed JSDoc comment syntax error (`*/` inside comment)
- Fixed Playwright crash on Android (lazy-load)
- Fixed search URL pattern (`?search=` → `?s=`)
- Fixed search extractor picking sidebar items instead of results
- Fixed home extractor trending/popular selectors
- Fixed title duplication in home/search extractors
- Fixed episodes extractor wrong container (`.eplister`)
- Removed dead `cloudscraper` dependency

#### Dependencies
- express, cors, compression (server)
- axios, got-scraping (HTTP clients)
- cheerio (HTML parsing)
- playwright, playwright-core, @sparticuz/chromium (browser automation)
- jsdom, vm (JavaScript execution)
- dotenv (environment config)

#### Documentation
- Comprehensive README.md with endpoint documentation
- MiruroAPI-style box comments throughout codebase
- Inline JSDoc documentation for all functions
- Environment variable configuration guide
