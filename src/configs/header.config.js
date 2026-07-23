/*
 * ======= • ======= • ======= • ======= • =======• =======
 * AnimePaheAPI — header.config.js
 * Repository: https://github.com/Shineii86/AnimePaheAPI
 *
 * @description
 *   Browser-like request headers to avoid being blocked by Cloudflare
 *   or other anti-bot protections on animepahe.ch. These headers mimic
 *   a real Chrome browser request to pass basic fingerprint checks.
 *
 * @exports
 *   headers
 *
 * @author  Shineii86
 * @license MIT
 * ======= • ======= • ======= • ======= • =======• =======
 */

// ══════════════════════════════════════════════════════════════
// REQUEST HEADERS
// ══════════════════════════════════════════════════════════════

/**
 * Standard browser request headers.
 *
 * @description
 *   These headers make our axios requests look like they come from a
 *   real Chrome browser on Windows. This is necessary because animepahe.ch
 *   uses Cloudflare which blocks requests missing browser fingerprint headers.
 *   Without these, all requests return 403 Forbidden.
 *
 * @type {Object}
 * @constant
 *
 * @header User-Agent
 *   Chrome 131 on Windows 10 — recent enough to not be flagged.
 *
 * @header Accept
 *   Tells the server we accept HTML, XML, images, and webp.
 *   The star-slash-star fallback ensures we always get a response.
 *
 * @header Accept-Language
 *   English-US preferred. Some sites serve different content per locale.
 *
 * @header Accept-Encoding
 *   gzip, deflate, br — enables compressed responses from the server.
 *   Combined with Express compression middleware, this reduces bandwidth.
 *
 * @header Sec-Fetch-*
 *   Modern browser security headers. Cloudflare checks these to
 *   distinguish real browsers from scripts/bots. Missing these = 403.
 *
 * @header Cache-Control
 *   max-age=0 tells the server we want fresh content, not a cached copy.
 *
 * @example
 *   const { headers } = require('../configs/header.config');
 *   axios.get(url, { headers }); // Looks like a real browser
 */
const headers = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/57.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
  'Accept-Encoding': 'gzip, deflate, br',
  'Connection': 'keep-alive',
  'Upgrade-Insecure-Requests': '1',
  'Sec-Fetch-Dest': 'document',
  'Sec-Fetch-Mode': 'navigate',
  'Sec-Fetch-Site': 'none',
  'Sec-Fetch-User': '?1',
  'Cache-Control': 'max-age=0',
};

// ══════════════════════════════════════════════════════════════
// EXPORTS
// ══════════════════════════════════════════════════════════════

module.exports = { headers };

// ══════════════════════════════════════════════════════════════ END: header.config.js
