/*
 * ======= • ======= • ======= • ======= • =======• =======
 * AnimePaheAPI — home.extractor.js
 * Repository: https://github.com/Shineii86/AnimePaheAPI
 *
 * @description
 *   Parses the animepahe.ch homepage to extract three data sections:
 *   latest releases, trending anime, and popular anime. The homepage
 *   contains multiple widget sections that we scrape independently.
 *
 * @exports
 *   extractHome
 *
 * @author  Shinei Nouzen
 * @license MIT
 * ======= • ======= • ======= • ======= • =======• =======
 */

const cheerio = require('cheerio');

// ══════════════════════════════════════════════════════════════
// HOME EXTRACTOR
// ══════════════════════════════════════════════════════════════

/**
 * Extracts latest releases, trending, and popular anime from the homepage.
 *
 * @param {CheerioStatic} $ - Loaded Cheerio instance of the homepage HTML
 * @returns {Object} Home data object
 * @returns {Array} return.latestReleases - Recently released episodes
 * @returns {Array} return.trending - Currently trending anime
 * @returns {Array} return.popular - Most popular anime
 *
 * @example
 *   const $ = await fetchPage(URLS.home);
 *   const data = extractHome($);
 *   // data.latestReleases → [{ slug, title, poster, episode, type }]
 *   // data.trending       → [{ slug, title, poster, episode }]
 *   // data.popular        → [{ slug, title, poster, rating }]
 */
function extractHome($) {

  // ---- FEATURE: Latest releases section ----
  /**
   * Extracts the "Latest Release" section from the homepage.
   *
   * @description
   *   The latest releases section shows recently aired episodes with
   *   their anime titles, posters, and episode numbers. We try multiple
   *   CSS selectors because the theme may use different class names.
   *   Multiple selector patterns are attempted for resilience against
   *   theme changes.
   */
  const latestReleases = [];

  const latestSelectors = [
    '.latest .anime-list .anime-card',
    '.post-body .anime-list .anime-card',
    '.listupd .bs',
    '.bsx',
    '.anime-list .anime-card',
  ];

  for (const selector of latestSelectors) {
    $(selector).each((_, el) => {
      const $el = $(el);
      const card = extractCard($, $el);
      if (card.slug && card.title) {
        latestReleases.push(card);
      }
    });
    // NOTE: Stop trying selectors once we find results
    if (latestReleases.length > 0) break;
  }

  // ---- FEATURE: Trending section ----
  /**
   * Extracts the "Trending" section from the homepage.
   *
   * @description
   *   Trending anime are in .listupd .tab-pane .bs (tab widget).
   *   Each tab represents a different time period (daily, weekly, etc).
   */
  const trending = [];

  const trendingSelectors = [
    '.listupd .tab-pane .bs',
    '.trending .anime-card',
    '.slider .item',
    '.swiper-slide',
    '.trending .bsx',
  ];

  for (const selector of trendingSelectors) {
    $(selector).each((_, el) => {
      const $el = $(el);
      const card = extractCard($, $el);
      if (card.slug && card.title) {
        trending.push(card);
      }
    });
    if (trending.length > 0) break;
  }

  // ---- FEATURE: Popular section ----
  /**
   * Extracts the "Popular" section from the homepage.
   *
   * @description
   *   Popular anime are in the second .listupd's tab panes.
   *   Falls back to other selectors if the primary one doesn't match.
   */
  const popular = [];

  const popularSelectors = [
    '.listupd .tab-pane .bs',
    '.popular .anime-card',
    '.widget .anime-card',
    '.top .item',
    '.popular .bsx',
  ];

  for (const selector of popularSelectors) {
    $(selector).each((_, el) => {
      const $el = $(el);
      const card = extractCard($, $el);
      card.rating = $el.find('.rating, .num').text().trim() || card.rating;
      if (card.slug && card.title) {
        popular.push(card);
      }
    });
    if (popular.length > 0) break;
  }

  return { latestReleases, trending, popular };
}

// ══════════════════════════════════════════════════════════════
// HELPER: CARD EXTRACTOR
// ══════════════════════════════════════════════════════════════

/**
 * Extracts data from a single anime card element.
 *
 * @param {CheerioStatic} $ - Cheerio instance
 * @param {CheerioElement} $el - The card element to extract from
 * @returns {Object} Card data with slug, title, poster, episode, type, url
 *
 * @description
 *   This is a shared helper used by all three extraction sections.
 *   It normalizes the data extraction across different card layouts.
 *
 * @tip The slug is extracted by splitting the URL on "/series/" and
 *      taking the last segment. This works for most URL patterns but
 *      may need adjustment for special characters in slugs.
 */
function extractCard($, $el) {
  const link = $el.find('a').first();
  const href = link.attr('href') || '';

  // NOTE: Extract slug from URL path — pattern: /series/one-piece/ → "one-piece"
  const slug = href.split('/series/')[1]?.replace(/\/$/, '') ||
               href.split('/').filter(Boolean).pop() || '';

  // NOTE: .tt contains short name + <h2> full title — use h2 or a[title] for clean title
  const title = $el.find('.tt h2').text().trim() ||
                link.attr('title') ||
                $el.find('.tt').children('h2').text().trim() || '';
  const poster = $el.find('img').attr('src') ||
                 $el.find('img').attr('data-src') || '';
  const episode = $el.find('.ep, .epx, .badge').text().trim() || '';
  const type = $el.find('.type, .typez').text().trim() || '';
  const rating = $el.find('.rating, .num').text().trim() || '';

  return { slug, title, poster, episode, type, rating, url: href };
}

// ══════════════════════════════════════════════════════════════
// EXPORTS
// ══════════════════════════════════════════════════════════════

module.exports = { extractHome };

// ══════════════════════════════════════════════════════════════ END: home.extractor.js
