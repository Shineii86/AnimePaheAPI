/*
 * ======= • ======= • ======= • ======= • =======• =======
 * AnimePaheAPI — dataUrl.js
 * Repository: https://github.com/Shineii86/AnimePaheAPI
 *
 * @description
 *   Centralized URL pattern definitions for all animepahe.ch pages.
 *   Every endpoint URL is constructed from these templates to avoid
 *   hardcoded strings scattered across extractors and routes.
 *
 * @exports
 *   BASE_URL, URLS
 *
 * @author  Shineii86
 * @license MIT
 * ======= • ======= • ======= • ======= • =======• =======
 */

// ══════════════════════════════════════════════════════════════
// BASE URL
// ══════════════════════════════════════════════════════════════

/**
 * The primary domain for animepahe.ch.
 *
 * @description
 *   All requests are made to this domain. If the domain changes,
 *   only this constant needs to be updated. The site is WordPress-based
 *   and uses Cloudflare protection — requests must include browser-like
 *   headers to avoid 403 responses.
 *
 * @type {string}
 * @constant
 */
const BASE_URL = 'https://animepahe.ch';

// ══════════════════════════════════════════════════════════════
// URL PATTERNS
// ══════════════════════════════════════════════════════════════

/**
 * URL templates for every page type on animepahe.ch.
 *
 * @description
 *   Each property is either a static URL or a function that accepts
 *   a parameter and returns a complete URL string. All URLs are
 *   constructed relative to the BASE_URL constant above.
 *
 * @object {Object} URLS
 */
const URLS = {

  // ---- FEATURE: Home page URL ----
  /** @description Home page — latest releases, trending, popular */
  home: `${BASE_URL}/`,

  // ---- FEATURE: Search page URL ----
  /** @description Search page — accepts ?search=query parameter */
  search: `${BASE_URL}/`,

  // ---- FEATURE: Series browsing URL ----
  /** @description Series browsing page — full anime catalog */
  series: `${BASE_URL}/series/`,

  // ---- FEATURE: A-Z listing URL ----
  /** @description A-Z alphabetical listing */
  azList: `${BASE_URL}/az-list/`,

  // ---- FEATURE: Season index URL ----
  /** @description Season index page — lists all available seasons */
  season: `${BASE_URL}/season/`,

  // ---- FEATURE: Genre filter URL ----
  /**
   * Genre filter page.
   *
   * @param {string} name - Genre slug (e.g., "action", "fantasy")
   * @returns {string} Full URL for the genre page
   *
   * @example
   *   URLS.genre('action') // => "https://animepahe.ch/genres/action/"
   */
  genre: (name) => `${BASE_URL}/genres/${name}/`,

  // ---- FEATURE: Individual anime URL ----
  /**
   * Individual anime detail page.
   *
   * @param {string} slug - Anime slug (e.g., "one-piece", "naruto")
   * @returns {string} Full URL for the anime info page
   *
   * @example
   *   URLS.info('one-piece') // => "https://animepahe.ch/series/one-piece/"
   */
  info: (slug) => `${BASE_URL}/series/${slug}/`,

  // ---- FEATURE: Episode list URL ----
  /**
   * Episode list page (same as info, episodes are on the series page).
   *
   * @param {string} slug - Anime slug
   * @returns {string} Full URL for the episode list
   */
  episodes: (slug) => `${BASE_URL}/series/${slug}/`,

  // ---- FEATURE: Watch page URL ----
  /**
   * Watch/episode page.
   *
   * @param {string} slug - Episode slug (e.g., "one-piece-episode-1170-english-subbed")
   * @returns {string} Full URL for the watch page
   *
   * @example
   *   URLS.watch('one-piece-episode-1170-english-subbed')
   *   // => "https://animepahe.ch/one-piece-episode-1170-english-subbed/"
   */
  watch: (slug) => `${BASE_URL}/${slug}/`,

  // ---- FEATURE: Category filter URL ----
  /**
   * Category filter page.
   *
   * @param {string} name - Category name
   * @returns {string} Full URL for the category page
   */
  category: (name) => `${BASE_URL}/category/${name}/`,

  // ---- FEATURE: Studio filter URL ----
  /**
   * Studio filter page.
   *
   * @param {string} name - Studio slug (e.g., "toei-animation")
   * @returns {string} Full URL for the studio page
   */
  studio: (name) => `${BASE_URL}/studio/${name}/`,

  // ---- FEATURE: Tag filter URL ----
  /**
   * Tag filter page.
   *
   * @param {string} name - Tag name
   * @returns {string} Full URL for the tag page
   */
  tag: (name) => `${BASE_URL}/tag/${name}/`,
};

// ══════════════════════════════════════════════════════════════
// EXPORTS
// ══════════════════════════════════════════════════════════════

module.exports = { BASE_URL, URLS };

// ══════════════════════════════════════════════════════════════ END: dataUrl.js
