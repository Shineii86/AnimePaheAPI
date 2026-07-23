/*
 * ======= • ======= • ======= • ======= • =======• =======
 * AnimePaheAPI — server.js
 * Repository: https://github.com/Shineii86/AnimePaheAPI
 *
 * @description
 *   Main entry point for the AnimePaheAPI Express server.
 *   Configures CORS, compression, logging, security headers,
 *   rate limiting, API routes, and 404 handling.
 *
 * @exports
 *   None (side-effect: starts Express server)
 *
 * @author  Shinei Nouzen
 * @license MIT
 * ======= • ======= • ======= • ======= • =======• =======
 */

const express = require('express');
const cors = require('cors');
const compression = require('compression');
const apiRoutes = require('./src/routes/apiRoutes');
const { addCreatorInfo } = require('./src/middleware/creatorInfo');

const app = express();
const PORT = process.env.PORT || 3000;

// ══════════════════════════════════════════════════════════════
// SERVER CONFIGURATION
// ══════════════════════════════════════════════════════════════

/**
 * Express server configuration.
 *
 * @description
 *   Sets up the Express app with trust proxy enabled (for rate limiting
 *   behind reverse proxies), disables the X-Powered-By header (security),
 *   and sets the JSON response limit to 10mb for large API responses.
 */
app.set('trust proxy', 1);
app.disable('x-powered-by');
app.use(express.json({ limit: '10mb' }));

// ══════════════════════════════════════════════════════════════
// COMPRESSION
// ══════════════════════════════════════════════════════════════

// ---- FEATURE: Gzip compression — reduces response size by 30-70% ----
/**
 * Enables gzip compression for all responses.
 *
 * @description
 *   Compression middleware reduces bandwidth usage and improves
 *   response times. Only compresses responses larger than 1KB
 *   to avoid overhead on small payloads.
 */
app.use(compression({
  threshold: 1024,
  level: 6,
}));

// ══════════════════════════════════════════════════════════════
// REQUEST LOGGING
// ══════════════════════════════════════════════════════════════

// ---- FEATURE: Request logging — method, path, status, response time ----
/**
 * Logs incoming requests with method, path, status code, and response time.
 *
 * @description
 *   Only logs API requests (skips static files). Provides visibility
 *   into server activity and helps debug slow responses.
 */
app.use((req, res, next) => {
  const start = Date.now();
  const { method, path: reqPath } = req;

  // NOTE: Only log API requests, skip static files
  if (!reqPath.startsWith('/api')) return next();

  res.on('finish', () => {
    const duration = Date.now() - start;
    const status = res.statusCode;
    const color = status >= 400 ? '\x1b[31m' : status >= 300 ? '\x1b[33m' : '\x1b[32m';
    console.log(`${color}${method} ${reqPath} ${status}\x1b[0m — ${duration}ms`);
  });

  next();
});

// ══════════════════════════════════════════════════════════════
// CORS MIDDLEWARE
// ══════════════════════════════════════════════════════════════

// ---- FEATURE: Unified CORS middleware with preflight handling ----
/**
 * Configures Cross-Origin Resource Sharing (CORS).
 *
 * @description
 *   Allows all origins (*) for maximum compatibility. Handles
 *   preflight OPTIONS requests automatically. Allows common
 *   headers and methods used by frontend applications.
 */
app.use(cors({
  origin: '*',
  methods: ['GET', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  preflightContinue: false,
  optionsSuccessStatus: 204,
}));

// ══════════════════════════════════════════════════════════════
// SECURITY HEADERS
// ══════════════════════════════════════════════════════════════

// ---- FEATURE: Security headers ----
/**
 * Adds security headers to all responses.
 *
 * @description
 *   Sets X-Content-Type-Options to prevent MIME sniffing,
 *   X-Frame-Options to prevent clickjacking, and
 *   Referrer-Policy for privacy protection.
 */
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  next();
});

// ══════════════════════════════════════════════════════════════
// CACHE HEADERS
// ══════════════════════════════════════════════════════════════

// ---- FEATURE: Cache-Control headers for API responses ----
/**
 * Sets Cache-Control headers based on endpoint type.
 *
 * @description
 *   Different endpoints have different caching strategies.
 *   Static pages get longer cache times, search gets shorter.
 *   This helps CDN and browser caching work efficiently.
 *
 * @note Different cache durations based on endpoint type
 */
app.use('/api', (req, res, next) => {
  const path = req.path;

  // NOTE: Different cache durations based on endpoint type
  if (path.includes('/suggestions')) {
    res.setHeader('Cache-Control', 'public, max-age=30');
  } else if (path.includes('/search')) {
    res.setHeader('Cache-Control', 'public, max-age=60');
  } else if (path.includes('/info')) {
    res.setHeader('Cache-Control', 'public, max-age=300');
  } else {
    res.setHeader('Cache-Control', 'public, max-age=120');
  }

  next();
});

// ══════════════════════════════════════════════════════════════
// RESPONSE HELPERS
// ══════════════════════════════════════════════════════════════

// ---- FEATURE: Response helper — wrap data in standard success format ----
/**
 * Wraps data in the standard API success response format.
 * All successful responses follow: { success: true, results: data }
 *
 * @param {import('express').Response} res - Express response object
 * @param {any} data - The data to wrap
 * @param {number} [status=200] - HTTP status code
 * @returns {import('express').Response} Express response with JSON body
 *
 * @example
 *   jsonResponse(res, { anime: [...] });
 *   // => { "success": true, "results": { "anime": [...] } }
 */
function jsonResponse(res, data, status = 200) {
  return res.status(status).json({
    success: true,
    results: data,
  });
}

// ---- FEATURE: Error helper — wrap message in standard error format ----
/**
 * Wraps an error message in the standard API error response format.
 * All error responses follow: { success: false, message: "..." }
 *
 * @param {import('express').Response} res - Express response object
 * @param {string} [message="Internal server error"] - Error description
 * @param {number} [status=500] - HTTP status code
 * @returns {import('express').Response} Express response with JSON error body
 *
 * @example
 *   jsonError(res, "Anime not found", 404);
 *   // => { "success": false, "message": "Anime not found" }
 */
function jsonError(res, message = 'Internal server error', status = 500) {
  return res.status(status).json({
    success: false,
    message,
  });
}

// Attach helpers to res for use in route handlers
app.locals.jsonResponse = jsonResponse;
app.locals.jsonError = jsonError;

// ══════════════════════════════════════════════════════════════
// RATE LIMITING
// ══════════════════════════════════════════════════════════════

// ---- FEATURE: Rate limiting (100 requests per minute per IP) ----
/**
 * Simple in-memory rate limiter.
 *
 * @description
 *   Tracks request counts per IP with a sliding window of 1 minute.
 *   Exceeding 100 requests triggers a 429 response with Retry-After.
 *   Automatically cleans up stale entries to prevent memory leaks.
 *
 * @note On Vercel serverless, this resets per invocation. For persistent
 *       rate limiting, use Redis or a dedicated rate limiting service.
 */
const rateLimitMap = new Map();

app.use((req, res, next) => {
  const ip = req.ip || req.connection.remoteAddress;
  const now = Date.now();
  const windowMs = 60 * 1000; // 1 minute
  const maxRequests = 100;

  if (!rateLimitMap.has(ip)) {
    rateLimitMap.set(ip, { count: 1, resetTime: now + windowMs });
    return next();
  }

  const record = rateLimitMap.get(ip);

  // NOTE: Reset window if expired
  if (now > record.resetTime) {
    record.count = 1;
    record.resetTime = now + windowMs;
    return next();
  }

  record.count++;

  // NOTE: Prune old entries every 100 requests to prevent memory leak
  if (record.count % 100 === 0) {
    for (const [key, val] of rateLimitMap) {
      if (now > val.resetTime) rateLimitMap.delete(key);
    }
  }

  if (record.count > maxRequests) {
    const retryAfter = Math.ceil((record.resetTime - now) / 1000);
    res.setHeader('Retry-After', retryAfter);
    return jsonError(res, `Rate limit exceeded. Try again in ${retryAfter}s`, 429);
  }

  next();
});

// ══════════════════════════════════════════════════════════════
// CREATOR INFO MIDDLEWARE
// ══════════════════════════════════════════════════════════════

// ---- FEATURE: Creator attribution in every API response ----
/**
 * Injects creator metadata into all JSON responses.
 *
 * @description
 *   Monkey-patches res.json() to append creator, github, telegram,
 *   and timestamp fields to every API response. This ensures
 *   attribution is always present without modifying route handlers.
 */
app.use('/api', addCreatorInfo);

// ══════════════════════════════════════════════════════════════
// API ROUTES
// ══════════════════════════════════════════════════════════════

/**
 * Mounts all API routes under /api.
 *
 * @description
 *   All API endpoints are defined in apiRoutes.js and mounted here.
 *   The route file handles its own error handling and caching.
 */
app.use('/api', apiRoutes);

// ══════════════════════════════════════════════════════════════
// GLOBAL ERROR HANDLER
// ══════════════════════════════════════════════════════════════

// ---- FEATURE: Global error handler ----
/**
 * Catches unhandled errors and returns a standard error response.
 *
 * @description
 *   This middleware catches any errors that slip through route handlers.
 *   It logs the error for debugging and returns a clean error message
 *   to the client without exposing internal details.
 */
app.use((err, req, res, next) => {
  console.error('[Server] Unhandled error:', err.message);
  jsonError(res, 'Internal server error', 500);
});

// ══════════════════════════════════════════════════════════════
// 404 HANDLER
// ══════════════════════════════════════════════════════════════

// ---- FEATURE: Catch-all 404 handler for undefined routes ----
/**
 * Returns 404 for any request that doesn't match a defined route.
 *
 * @description
 *   Placed after all other middleware and routes. Any request that
 *   reaches this point has no matching handler and should return 404.
 */
app.use((req, res) => {
  jsonError(res, `Route not found: ${req.method} ${req.originalUrl}`, 404);
});

// ══════════════════════════════════════════════════════════════
// SERVER START
// ══════════════════════════════════════════════════════════════

/**
 * Starts the Express server.
 *
 * @description
 *   Listens on the configured port (default: 3000). Logs the URL
 *   for easy access during development.
 */
app.listen(PORT, () => {
  console.log(`\n  AnimePaheAPI server running at http://localhost:${PORT}\n`);
});

module.exports = app;

// ══════════════════════════════════════════════════════════════ END: server.js
