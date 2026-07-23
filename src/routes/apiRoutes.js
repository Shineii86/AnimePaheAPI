/*
 * ======= • ======= • ======= • ======= • =======• =======
 * AnimePaheAPI — apiRoutes.js
 * Repository: https://github.com/Shineii86/AnimePaheAPI
 *
 * @description
 *   Central API router that maps all Express GET endpoints to their
 *   corresponding handler functions. Each route wraps its handler
 *   in try/catch for consistent error handling. Includes search,
 *   browse, details, streaming, and utility endpoints.
 *
 * @exports
 *   router - Express router with all API routes
 *
 * @author  Shinei Nouzen
 * @license MIT
 * ======= • ======= • ======= • ======= • =======• =======
 */

const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const { BASE_URL, URLS } = require('../configs/dataUrl');
const { headers } = require('../configs/header.config');
const { cache, CACHE_TTL } = require('../helper/cache.helper');
const { extractHome } = require('../extractors/home.extractor');
const { searchSuggestions, extractSearch } = require('../extractors/search.extractor');
const { extractInfo } = require('../extractors/info.extractor');
const { fetchEpisodes } = require('../extractors/episodes.extractor');
const { extractSeries } = require('../extractors/series.extractor');
const animepahe = require('../scrapers/animepahe');
const PlayModel = require('../models/playModel');
const config = require('../utils/config');

const router = express.Router();

// ══════════════════════════════════════════════════════════════
// UTILITY HELPERS
// ══════════════════════════════════════════════════════════════

// ---- FEATURE: Input sanitization helpers ----
/**
 * Sanitizes user input by removing special characters and trimming.
 *
 * @param {string} input - Raw user input
 * @returns {string} Sanitized string safe for use in URLs and queries
 *
 * @description
 *   Removes characters that could break URL construction or cause
 *   injection issues. Only allows alphanumeric, hyphens, and spaces.
 */
function sanitizeInput(input) {
  if (typeof input !== 'string') return '';
  return input.replace(/[^a-zA-Z0-9\s\-]/g, '').trim();
}

/**
 * Fetches an HTML page and returns a Cheerio instance.
 *
 * @param {string} url - Full URL to fetch
 * @returns {Promise<CheerioStatic>} Loaded Cheerio instance
 *
 * @description
 *   Wraps axios + cheerio loading into a single call. Adds browser
 *   headers automatically. Throws on network errors for upstream
 *   error handling in route handlers.
 */
async function fetchPage(url) {
  const { data } = await axios.get(url, { headers, timeout: 15000 });
  return cheerio.load(data);
}

// ══════════════════════════════════════════════════════════════
// ROUTE REGISTRATION
// ══════════════════════════════════════════════════════════════

/**
 * Helper to wrap async route handlers with error handling.
 *
 * @param {Function} handler - Async route handler function
 * @returns {Function} Express-compatible middleware with try/catch
 *
 * @description
 *   Eliminates repetitive try/catch blocks in every route.
 *   Catches errors and returns a consistent error response.
 */
const asyncHandler = (handler) => async (req, res) => {
  try {
    await handler(req, res);
  } catch (error) {
    console.error(`[Route Error] ${req.method} ${req.originalUrl}:`, error.message);
    res.status(500).json({
      success: false,
      message: error.message || 'Internal server error',
    });
  }
};

// ══════════════════════════════════════════════════════════════
// HOME & LANDING
// ══════════════════════════════════════════════════════════════

// ---- FEATURE: Home page data (latest, trending, popular) ----
/**
 * GET /api
 * Returns homepage data: latest releases, trending, and popular anime.
 *
 * @description
 *   Fetches the animepahe.ch homepage and extracts three sections.
 *   Results are cached for 2 minutes to reduce server load.
 */
router.get('/', asyncHandler(async (req, res) => {
  const cacheKey = 'home';
  const cached = cache.get(cacheKey);
  if (cached) return res.json({ success: true, results: cached });

  const $ = await fetchPage(URLS.home);
  const data = extractHome($);

  cache.set(cacheKey, data, CACHE_TTL.home);
  res.json({ success: true, results: data });
}));

// ══════════════════════════════════════════════════════════════
// SEARCH & DISCOVERY
// ══════════════════════════════════════════════════════════════

// ---- FEATURE: Lightweight autocomplete suggestions (max 8) ----
/**
 * GET /api/suggestions?q={query}
 * Returns quick search suggestions for autocomplete dropdowns.
 *
 * @description
 *   Uses the internal API endpoint for fast JSON responses.
 *   Returns minimal data (id, title, slug, poster, type, episodes).
 *   Cached for 30 seconds to balance freshness and performance.
 */
router.get('/suggestions', asyncHandler(async (req, res) => {
  const { q } = req.query;
  if (!q || q.length < 2) return res.json({ success: true, results: [] });

  const query = sanitizeInput(q);
  const cacheKey = `suggestions:${query}`;
  const cached = cache.get(cacheKey);
  if (cached) return res.json({ success: true, results: cached });

  // NOTE: Use HTML search page scraping (API endpoint blocked by DDoS-Guard without cookies)
  const $ = await fetchPage(`${BASE_URL}/?s=${encodeURIComponent(query)}`);
  const data = extractSearch($);

  cache.set(cacheKey, data.results || [], CACHE_TTL.suggestions);
  res.json({ success: true, results: data.results || [] });
}));

// ---- FEATURE: Full-text anime search with pagination ----
/**
 * GET /api/search?q={query}&page={page}
 * Returns paginated search results from animepahe.ch.
 *
 * @description
 *   Scrapes the search page HTML for detailed results including
 *   episode counts, types, and posters. Supports pagination.
 */
router.get('/search', asyncHandler(async (req, res) => {
  const { q, page = 1 } = req.query;
  if (!q) return res.status(400).json({ success: false, message: 'Query parameter "q" is required' });

  const query = sanitizeInput(q);
  const cacheKey = `search:${query}:${page}`;
  const cached = cache.get(cacheKey);
  if (cached) return res.json({ success: true, results: cached });

  // NOTE: Use HTML search page scraping (API endpoint blocked by DDoS-Guard without cookies)
  const $ = await fetchPage(`${BASE_URL}/?s=${encodeURIComponent(query)}&page=${page}`);
  const data = extractSearch($);

  cache.set(cacheKey, data, CACHE_TTL.search);
  res.json({ success: true, results: data });
}));

// ══════════════════════════════════════════════════════════════
// ANIME DETAILS
// ══════════════════════════════════════════════════════════════

// ---- FEATURE: Complete anime info by slug ----
/**
 * GET /api/info/{slug}
 * Returns detailed anime information including metadata, episodes, and related.
 *
 * @description
 *   Fetches the anime's dedicated page and extracts all available
 *   metadata: title, synopsis, genres, episodes, status, studio, etc.
 *   Cached for 5 minutes since anime details rarely change.
 *
 * @param {string} slug - Anime slug from the URL path
 *
 * @example
 *   GET /api/info/one-piece
 *   // => { title: "One Piece", genres: ["Action", "Adventure"], episodes: [...] }
 */
router.get('/info/:slug', asyncHandler(async (req, res) => {
  const { slug } = req.params;
  const cacheKey = `info:${slug}`;
  const cached = cache.get(cacheKey);
  if (cached) return res.json({ success: true, results: cached });

  const $ = await fetchPage(URLS.info(slug));
  const data = extractInfo($, slug);

  cache.set(cacheKey, data, CACHE_TTL.info);
  res.json({ success: true, results: data });
}));

// ---- FEATURE: Episode list from all providers ----
/**
 * GET /api/episodes/{slug}
 * Returns the full episode list for an anime.
 *
 * @description
 *   Uses the API-based extractor to fetch all episodes across
 *   multiple pages. Returns episode numbers, slugs, and URLs.
 *   Cached for 1 minute since new episodes drop frequently.
 *
 * @param {string} slug - Anime slug
 */
router.get('/episodes/:slug', asyncHandler(async (req, res) => {
  const { slug } = req.params;
  const cacheKey = `episodes:${slug}`;
  const cached = cache.get(cacheKey);
  if (cached) return res.json({ success: true, results: cached });

  const data = await fetchEpisodes(slug);

  cache.set(cacheKey, data, CACHE_TTL.episodes);
  res.json({ success: true, results: data });
}));

// ══════════════════════════════════════════════════════════════
// BROWSE & FILTER
// ══════════════════════════════════════════════════════════════

// ---- FEATURE: Browse anime by category ----
/**
 * GET /api/category/{name}
 * Returns anime in a specific category.
 *
 * @param {string} name - Category name (e.g., "one-piece")
 */
router.get('/category/:name', asyncHandler(async (req, res) => {
  const { name } = req.params;
  const cacheKey = `category:${name}`;
  const cached = cache.get(cacheKey);
  if (cached) return res.json({ success: true, results: cached });

  const $ = await fetchPage(URLS.category(name));
  const data = extractSeries($);

  cache.set(cacheKey, data, CACHE_TTL.filter);
  res.json({ success: true, results: data });
}));

// ---- FEATURE: Browse anime by genre ----
/**
 * GET /api/genre/{name}
 * Returns anime in a specific genre.
 *
 * @param {string} name - Genre slug (e.g., "action", "fantasy")
 */
router.get('/genre/:name', asyncHandler(async (req, res) => {
  const { name } = req.params;
  const cacheKey = `genre:${name}`;
  const cached = cache.get(cacheKey);
  if (cached) return res.json({ success: true, results: cached });

  const $ = await fetchPage(URLS.genre(name));
  const data = extractSeries($);

  cache.set(cacheKey, data, CACHE_TTL.genre);
  res.json({ success: true, results: data });
}));

// ---- FEATURE: Browse anime by studio ----
/**
 * GET /api/studio/{name}
 * Returns anime by a specific studio.
 *
 * @param {string} name - Studio slug (e.g., "toei-animation")
 */
router.get('/studio/:name', asyncHandler(async (req, res) => {
  const { name } = req.params;
  const cacheKey = `studio:${name}`;
  const cached = cache.get(cacheKey);
  if (cached) return res.json({ success: true, results: cached });

  const $ = await fetchPage(URLS.studio(name));
  const data = extractSeries($);

  cache.set(cacheKey, data, CACHE_TTL.filter);
  res.json({ success: true, results: data });
}));

// ---- FEATURE: Browse anime by tag ----
/**
 * GET /api/tag/{name}
 * Returns anime with a specific tag.
 *
 * @param {string} name - Tag name
 */
router.get('/tag/:name', asyncHandler(async (req, res) => {
  const { name } = req.params;
  const cacheKey = `tag:${name}`;
  const cached = cache.get(cacheKey);
  if (cached) return res.json({ success: true, results: cached });

  const $ = await fetchPage(URLS.tag(name));
  const data = extractSeries($);

  cache.set(cacheKey, data, CACHE_TTL.filter);
  res.json({ success: true, results: data });
}));

// ---- FEATURE: A-Z alphabetical listing ----
/**
 * GET /api/az-list
 * Returns the A-Z alphabetical listing of all anime.
 */
router.get('/az-list', asyncHandler(async (req, res) => {
  const cacheKey = 'azList';
  const cached = cache.get(cacheKey);
  if (cached) return res.json({ success: true, results: cached });

  const $ = await fetchPage(URLS.azList);
  const data = extractSeries($);

  cache.set(cacheKey, data, CACHE_TTL.azList);
  res.json({ success: true, results: data });
}));

// ---- FEATURE: Season anime listing ----
/**
 * GET /api/season
 * Returns the season index page with all available seasons.
 */
router.get('/season', asyncHandler(async (req, res) => {
  const cacheKey = 'season';
  const cached = cache.get(cacheKey);
  if (cached) return res.json({ success: true, results: cached });

  const $ = await fetchPage(URLS.season);
  const data = extractSeries($);

  cache.set(cacheKey, data, CACHE_TTL.season);
  res.json({ success: true, results: data });
}));

// ---- FEATURE: Series browsing page ----
/**
 * GET /api/series
 * Returns the full anime series catalog.
 */
router.get('/series', asyncHandler(async (req, res) => {
  const cacheKey = 'series';
  const cached = cache.get(cacheKey);
  if (cached) return res.json({ success: true, results: cached });

  const $ = await fetchPage(URLS.series);
  const data = extractSeries($);

  cache.set(cacheKey, data, CACHE_TTL.filter);
  res.json({ success: true, results: data });
}));

// ══════════════════════════════════════════════════════════════
// STREAMING & DOWNLOADS
// ══════════════════════════════════════════════════════════════

// ---- FEATURE: Initialize scraper on startup ----
/**
 * Initializes the animepahe scraper (cookie refresh) on first request.
 *
 * @description
 *   The scraper needs to solve Cloudflare/DDoS-Guard to get cookies.
 *   This is done lazily on the first streaming request, not at startup,
 *   to avoid blocking the server from starting.
 */
let scraperInitialized = false;

async function ensureScraper() {
  if (!scraperInitialized) {
    try {
      await animepahe.initialize();
      scraperInitialized = true;
      console.log('[API] Scraper initialized successfully');
    } catch (error) {
      console.error('[API] Scraper initialization failed:', error.message);
    }
  }
}

// ---- FEATURE: Streaming links endpoint ----
/**
 * GET /api/play/:slug
 * Returns streaming video URLs (m3u8/mp4) and metadata for an episode.
 *
 * @description
 *   The core streaming endpoint. Given an episode slug, it:
 *   1. Fetches the episode page HTML (no cookies needed)
 *   2. Extracts the iframe URL
 *   3. Fetches the iframe and detects the video host
 *   4. Extracts the actual video URL (MP4/m3u8)
 *   5. Returns organized streaming data
 *
 *   Supported video hosts:
 *   - turbovidhls/etvp: Direct MP4 extraction
 *   - kwik.cx: m3u8 via VM sandbox
 *   - Blogger: Embed URL passthrough (needs Playwright for full extraction)
 *
 * @param {string} slug - Episode slug (e.g., "one-piece-episode-1170-english-subbed")
 *
 * @example
 *   GET /api/play/one-piece-episode-1170-english-subbed
 *   // => { sources: [{ url: "https://...mp4", isM3U8: false, ...}] }
 */
router.get('/play/:slug', asyncHandler(async (req, res) => {
  const { slug } = req.params;
  const includeDownloads = req.query.downloads !== 'false';

  const cacheKey = `play:${slug}:${includeDownloads}`;
  const cached = cache.get(cacheKey);
  if (cached) return res.json({ success: true, results: cached });

  const data = await PlayModel.getStreamingLinks(slug, includeDownloads);

  cache.set(cacheKey, data, CACHE_TTL.episodes);
  res.json({ success: true, results: data });
}));

// ---- FEATURE: Airing anime endpoint ----
/**
 * GET /api/airing
 * Returns currently airing anime from the API.
 *
 * @description
 *   Uses the animepahe API endpoint (not HTML scraping) for
 *   fast, structured data. Requires valid cookies.
 *
 * @query {number} page - Page number (default: 1)
 */
router.get('/airing', asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page, 10) || 1;

  await ensureScraper();

  const cacheKey = `airing:${page}`;
  const cached = cache.get(cacheKey);
  if (cached) return res.json({ success: true, results: cached });

  const data = await animepahe.fetchAiringData(page);

  cache.set(cacheKey, data, CACHE_TTL.recent);
  res.json({ success: true, results: data });
}));

// ---- FEATURE: Queue status endpoint ----
/**
 * GET /api/queue
 * Returns the encoding queue status from animepahe.
 */
router.get('/queue', asyncHandler(async (req, res) => {
  await ensureScraper();

  const cacheKey = 'queue';
  const cached = cache.get(cacheKey);
  if (cached) return res.json({ success: true, results: cached });

  const data = await animepahe.fetchQueueData();

  cache.set(cacheKey, data, 30);
  res.json({ success: true, results: data });
}));

// ---- FEATURE: Cookie refresh endpoint ----
/**
 * POST /api/refresh-cookies
 * Force-refreshes the scraper cookies.
 *
 * @description
 *   Manual endpoint to trigger a cookie refresh. Useful when
 *   the scraper's cached cookies have expired or become invalid.
 */
router.post('/refresh-cookies', asyncHandler(async (req, res) => {
  await animepahe.refreshCookies();
  res.json({ success: true, results: { message: 'Cookies refreshed successfully' } });
}));

// ---- FEATURE: Scraper status endpoint ----
/**
 * GET /api/scraper-status
 * Returns the current state of the scraper (cookies, browser, etc.).
 */
router.get('/scraper-status', asyncHandler(async (req, res) => {
  const hasCookies = await animepahe.needsCookieRefresh().then(needs => !needs);
  res.json({
    success: true,
    results: {
      initialized: scraperInitialized,
      hasCookies,
      isRefreshing: animepahe.isRefreshingCookies,
      cookiesPath: animepahe.cookiesPath,
      baseUrl: config.baseUrl,
      iframeBaseUrl: config.iframeBaseUrl,
    },
  });
}));

// ══════════════════════════════════════════════════════════════
// HEALTH & STATS
// ══════════════════════════════════════════════════════════════

// ---- FEATURE: Health check endpoint ----
/**
 * GET /api/health
 * Returns server health status and uptime.
 *
 * @description
 *   Simple health check for monitoring. Returns status, uptime,
 *   timestamp, and version info. Useful for uptime monitors.
 */
router.get('/health', (req, res) => {
  res.json({
    success: true,
    results: {
      status: 'ok',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      source: 'animepahe.ch',
    },
  });
});

// ---- FEATURE: Cache & API statistics ----
/**
 * GET /api/stats
 * Returns cache statistics and server info.
 *
 * @description
 *   Provides visibility into cache performance and server state.
 *   Shows cache size, memory usage, and endpoint count.
 */
router.get('/stats', (req, res) => {
  res.json({
    success: true,
    results: {
      cache: {
        size: cache.size(),
      },
      server: {
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        nodeVersion: process.version,
      },
      endpoints: 38,
    },
  });
});

// ---- FEATURE: OpenAPI specification ----
/**
 * GET /api/docs
 * Returns the OpenAPI/Swagger specification for all endpoints.
 *
 * @description
 *   Self-documenting API. Returns a complete OpenAPI spec that
 *   can be imported into Swagger UI or Postman for testing.
 */
router.get('/docs', (req, res) => {
  res.json({
    openapi: '3.0.0',
    info: {
      title: 'AnimePaheAPI',
      version: '1.0.0',
      description: 'RESTful API for animepahe.ch — scrapes and serves anime data.',
      author: 'Shinei Nouzen',
      license: 'MIT',
    },
    servers: [
      { url: '/', description: 'Current server' },
    ],
    paths: {
      '/api': { get: { summary: 'Home page data', tags: ['Home'] } },
      '/api/suggestions': { get: { summary: 'Search suggestions', tags: ['Search'] } },
      '/api/search': { get: { summary: 'Full search', tags: ['Search'] } },
      '/api/info/{slug}': { get: { summary: 'Anime details', tags: ['Details'] } },
      '/api/episodes/{slug}': { get: { summary: 'Episode list', tags: ['Details'] } },
      '/api/category/{name}': { get: { summary: 'Category browse', tags: ['Browse'] } },
      '/api/genre/{name}': { get: { summary: 'Genre browse', tags: ['Browse'] } },
      '/api/studio/{name}': { get: { summary: 'Studio browse', tags: ['Browse'] } },
      '/api/tag/{name}': { get: { summary: 'Tag browse', tags: ['Browse'] } },
      '/api/az-list': { get: { summary: 'A-Z listing', tags: ['Browse'] } },
      '/api/season': { get: { summary: 'Season listing', tags: ['Browse'] } },
      '/api/series': { get: { summary: 'Series catalog', tags: ['Browse'] } },
      '/api/play/:animeSession/:episodeSession': { get: { summary: 'Streaming links + downloads', tags: ['Streaming'] } },
      '/api/airing': { get: { summary: 'Currently airing anime', tags: ['Streaming'] } },
      '/api/queue': { get: { summary: 'Encoding queue status', tags: ['Streaming'] } },
      '/api/refresh-cookies': { post: { summary: 'Force cookie refresh', tags: ['Streaming'] } },
      '/api/scraper-status': { get: { summary: 'Scraper state', tags: ['Streaming'] } },
      '/api/health': { get: { summary: 'Health check', tags: ['Utility'] } },
      '/api/stats': { get: { summary: 'Server stats', tags: ['Utility'] } },
      '/api/docs': { get: { summary: 'API documentation', tags: ['Utility'] } },
    },
  });
});

// ══════════════════════════════════════════════════════════════
// EXPORTS
// ══════════════════════════════════════════════════════════════

module.exports = router;

// ══════════════════════════════════════════════════════════════ END: apiRoutes.js
