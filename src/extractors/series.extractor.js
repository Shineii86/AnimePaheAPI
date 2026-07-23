/*
 * ======= • ======= • ======= • ======= • =======• =======
 * AnimePaheAPI — series.extractor.js
 * Repository: https://github.com/Shineii86/AnimePaheAPI
 *
 * @description
 *   Extracts anime series listings from category, genre, studio,
 *   tag, and A-Z pages on animepahe.ch. These pages all share
 *   a similar HTML structure but with different filter parameters.
 *
 * @exports
 *   extractSeries
 *
 * @author  Shinei Nouzen
 * @license MIT
 * ======= • ======= • ======= • ======= • =======• =======
 */

const cheerio = require('cheerio');

// ══════════════════════════════════════════════════════════════
// SERIES EXTRACTOR
// ══════════════════════════════════════════════════════════════

// ---- FEATURE: Extract anime listings from category/genre/studio/tag/A-Z pages ----
/**
 * Extracts a list of anime from any series-type page.
 *
 * @param {CheerioStatic} $ - Loaded Cheerio instance of the series page
 * @returns {Object} Series listing with results and pagination
 * @returns {Array} return.results - Array of anime objects
 * @returns {number} return.currentPage - Current page number
 * @returns {boolean} return.hasNextPage - Whether more pages exist
 * @returns {string} return.title - Page title (e.g., "Action", "A-Z")
 *
 * @description
 *   Works for any page that shows a grid/list of anime cards:
 *   category pages, genre pages, studio pages, tag pages, and
 *   A-Z listings. All share the same HTML card structure.
 *
 * @example
 *   const $ = await fetchPage(URLS.genre('action'));
 *   const data = extractSeries($);
 *   // data.results     → [{ slug, title, poster, episode, type }]
 *   // data.currentPage → 1
 *   // data.hasNextPage → true
 */
function extractSeries($) {

  const results = [];

  const selectors = [
    '.anime-list .anime-card',
    '.listupd .bs',
    '.bsx',
    '.series-list .item',
    '.page-item-detail',
  ];

  for (const selector of selectors) {
    $(selector).each((_, el) => {
      const $el = $(el);
      const link = $el.find('a').first();
      const href = link.attr('href') || '';

      // NOTE: Extract slug from URL path — pattern: /series/one-piece/ → "one-piece"
      const slug = href.split('/series/')[1]?.replace(/\/$/, '') ||
                   href.split('/').filter(Boolean).pop() || '';
      const title = $el.find('.tt, .tt h2, h2.title, .nfl, .name').text().trim() ||
                    link.attr('title') || '';
      const poster = $el.find('img').attr('src') ||
                     $el.find('img').attr('data-src') || '';
      const episode = $el.find('.ep, .epx, .badge').text().trim() || '';
      const type = $el.find('.type, .typez').text().trim() || '';

      if (slug && title) {
        results.push({ slug, title, poster, episode, type, url: href });
      }
    });
    if (results.length > 0) break;
  }

  // ---- FEATURE: Page title extraction ----
  /**
   * Extracts the page title (genre name, studio name, etc.).
   *
   * @description
   *   The page title tells us what category/filter is active.
   *   Useful for display purposes and breadcrumbs.
   */
  const title = $('h1, .page-title, .anime-title, .title-bar h2').text().trim() || '';

  // ---- FEATURE: Pagination detection ----
  /**
   * Detects pagination state from the page.
   *
   * @description
   *   Checks the pagination widget for current page and next page
   *   availability. If no widget exists, we assume single page.
   */
  const currentPage = parseInt(
    $('.pagination .active').text().trim() || '1',
    10
  );

  const hasNextPage = $('.pagination .next, .pagination a[rel="next"]').length > 0 ||
                      results.length >= 20;

  return {
    title,
    results,
    currentPage,
    hasNextPage,
  };
}

// ══════════════════════════════════════════════════════════════
// EXPORTS
// ══════════════════════════════════════════════════════════════

module.exports = { extractSeries };

// ══════════════════════════════════════════════════════════════ END: series.extractor.js
