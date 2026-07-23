/*
 * ======= • ======= • ======= • ======= • =======• =======
 * AnimePaheAPI — search.extractor.js
 * Repository: https://github.com/Shineii86/AnimePaheAPI
 *
 * @description
 *   Handles two types of search operations on animepahe.ch:
 *   1. Full search page (HTML scrape) — returns paginated results
 *   2. Search suggestions (API endpoint) — returns quick autocomplete
 *
 * @exports
 *   searchSuggestions, extractSearch
 *
 * @author  Shinei Nouzen
 * @license MIT
 * ======= • ======= • ======= • ======= • =======• =======
 */

const cheerio = require('cheerio');
const axios = require('axios');
const { headers } = require('../configs/header.config');

// ══════════════════════════════════════════════════════════════
// SEARCH SUGGESTIONS (API-BASED)
// ══════════════════════════════════════════════════════════════

// ---- FEATURE: Lightweight autocomplete suggestions (max 8) ----
/**
 * Fetches autocomplete search suggestions from the API.
 *
 * @param {string} query - Search query string (e.g., "naruto")
 * @returns {Promise<Array>} Array of suggestion objects
 *
 * @description
 *   Uses the internal API endpoint (not HTML scraping) to fetch
 *   fast search suggestions. This is used by the /api/suggestions
 *   endpoint for real-time autocomplete in frontend applications.
 *   Returns minimal data (id, title, slug, poster, type, episodes).
 *
 * @endpoint GET https://animepahe.ch/api?m=search&q={query}
 * @returns {Promise<Array<{id: string, title: string, slug: string, poster: string, type: string, episodes: string}>>}
 *
 * @example
 *   const suggestions = await searchSuggestions('one piece');
 *   // → [{ id: "123", title: "One Piece", slug: "one-piece", ... }]
 */
async function searchSuggestions(query) {
  try {
    const { data } = await axios.get('https://animepahe.ch/api', {
      params: { m: 'search', q: query },
      headers,
      timeout: 10000,
    });

    // NOTE: The API returns { total, data: [...] } or just an array
    const items = data?.data || data || [];

    return items.map(item => ({
      id: item.id || '',
      title: item.title || item.name || '',
      slug: item.slug || '',
      poster: item.poster || item.image || '',
      type: item.type || '',
      episodes: item.episodes || '',
    }));
  } catch (error) {
    console.error(`[SearchExtractor] Suggestion fetch failed for "${query}":`, error.message);
    return [];
  }
}

// ══════════════════════════════════════════════════════════════
// FULL SEARCH RESULTS (HTML-BASED)
// ══════════════════════════════════════════════════════════════

// ---- FEATURE: Full-text anime search with pagination ----
/**
 * Extracts paginated search results from an HTML page.
 *
 * @param {CheerioStatic} $ - Loaded Cheerio instance of the search page
 * @returns {Object} Search results with metadata
 * @returns {Array} return.results - Array of matching anime
 * @returns {number} return.totalResults - Total number of matches
 * @returns {number} return.currentPage - Current page number
 * @returns {boolean} return.hasNextPage - Whether more pages exist
 *
 * @description
 *   Parses the full search results page which shows more details
 *   than the suggestions API, including full descriptions and
 *   episode lists. Supports pagination via the page parameter.
 *
 * @example
 *   const $ = await fetchPage(`${BASE_URL}/?search=naruto`);
 *   const results = extractSearch($);
 *   // results.results       → [{ slug, title, poster, episodes, type }]
 *   // results.totalResults  → 45
 *   // results.currentPage   → 1
 *   // results.hasNextPage   → true
 */
function extractSearch($) {

  const results = [];

  const searchSelectors = [
    '.bixbox .bs',
    '.search .anime-list .anime-card',
    '.search-results .anime-card',
    '.listupd .bs',
    '.bsx',
    '.anime-list .anime-card',
  ];

  for (const selector of searchSelectors) {
    $(selector).each((_, el) => {
      const $el = $(el);
      const link = $el.find('a').first();
      const href = link.attr('href') || '';

      const slug = href.split('/series/')[1]?.replace(/\/$/, '') ||
                   href.split('/').filter(Boolean).pop() || '';
      const title = $el.find('.tt h2').text().trim() ||
                    link.attr('title') ||
                    $el.find('.tt').children('h2').text().trim() || '';
      const poster = $el.find('img').attr('src') ||
                     $el.find('img').attr('data-src') || '';
      const episodes = $el.find('.ep, .epx').text().trim() || '';
      const type = $el.find('.type, .typez').text().trim() || '';

      if (slug && title) {
        results.push({ slug, title, poster, episodes, type, url: href });
      }
    });
    if (results.length > 0) break;
  }

  // ---- FEATURE: Pagination detection ----
  /**
   * Extracts pagination info from the page.
   *
   * @description
   *   The search page may have a pagination widget with page numbers.
   *   We detect the current page from the URL or active class, and
   *   check if there's a "next" link to determine hasNextPage.
   */
  const totalResults = parseInt(
    $('.total, .result-count, .search-count').text().replace(/\D/g, '') || '0',
    10
  );

  const currentPage = parseInt(
    $('.pagination .active').text().trim() || '1',
    10
  );

  const hasNextPage = $('.pagination .next, .pagination a[rel="next"]').length > 0 ||
                      results.length >= 20;

  return {
    results,
    totalResults: totalResults || results.length,
    currentPage,
    hasNextPage,
  };
}

// ══════════════════════════════════════════════════════════════
// EXPORTS
// ══════════════════════════════════════════════════════════════

module.exports = { searchSuggestions, extractSearch };

// ══════════════════════════════════════════════════════════════ END: search.extractor.js
