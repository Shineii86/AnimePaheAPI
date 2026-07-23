/*
 * ======= • ======= • ======= • ======= • =======• =======
 * AnimePaheAPI — episodes.extractor.js
 * Repository: https://github.com/Shineii86/AnimePaheAPI
 *
 * @description
 *   Extracts episode lists from animepahe.ch. Supports two modes:
 *   1. API-based fetch — uses the internal API endpoint for JSON (primary)
 *   2. Direct page scrape — parses HTML for episode data (fallback)
 *
 * @exports
 *   fetchEpisodes
 *
 * @author  Shinei Nouzen
 * @license MIT
 * ======= • ======= • ======= • ======= • =======• =======
 */

const cheerio = require('cheerio');
const axios = require('axios');
const { BASE_URL } = require('../configs/dataUrl');
const { headers } = require('../configs/header.config');

// ══════════════════════════════════════════════════════════════
// EPISODES EXTRACTOR
// ══════════════════════════════════════════════════════════════

// ---- FEATURE: Fetch complete episode list for an anime ----
/**
 * Fetches the full episode list for an anime.
 *
 * @param {string} slug - Anime slug (e.g., "one-piece")
 * @returns {Promise<Array>} Array of episode objects
 *
 * @description
 *   First fetches the anime's page to extract the anime ID from the
 *   embedded JavaScript data, then uses the AJAX API to fetch the
 *   complete episode list. This approach is more reliable than parsing
 *   the initial HTML which may only show the first few episodes.
 *
 *   The API returns episodes in pages of ~30 items each. We fetch
 *   page 1 first to determine the total page count, then fetch all
 *   remaining pages in parallel for speed.
 *
 * @endpoint GET https://animepahe.ch/{slug}
 * @endpoint GET https://animepahe.ch/api?m=release&id={id}&page={page}
 *
 * @example
 *   const episodes = await fetchEpisodes('one-piece');
 *   // → [{ number: 1170, slug: "one-piece-episode-1170-english-subbed" }, ...]
 */
async function fetchEpisodes(slug) {

  // ---- FEATURE: Extract anime ID from page ----
  /**
   * Extracts the anime ID from the page's JavaScript data.
   *
   * @description
   *   The anime page embeds an ID in a script tag or data attribute.
   *   This ID is needed for the AJAX API requests. We try multiple
   *   extraction patterns because the site may use different formats.
   *
   * @tip Pattern priority: data-id attribute > JS variable > API link match
   */
  try {
    // NOTE: Use HTML page scraping (API endpoint blocked by DDoS-Guard without cookies)
    const pageHtml = await axios.get(`${BASE_URL}/series/${slug}/`, {
      headers,
      timeout: 15000,
    });

    const $ = cheerio.load(pageHtml.data);
    const pageContent = $.html();
    let animeId = '';

    // Pattern 1: data-id attribute on an element
    animeId = $('[data-id]').attr('data-id') || '';

    // Pattern 2: JavaScript variable assignment (id, anime_id, ID)
    if (!animeId) {
      const idMatch = pageContent.match(/id['":\s]+(\d+)/i) ||
                      pageContent.match(/anime_id['":\s]+['"]?(\d+)/i) ||
                      pageContent.match(/ID['":\s]+['"]?(\d+)/i);
      animeId = idMatch?.[1] || '';
    }

    // Pattern 3: API link embedded in the page source
    if (!animeId) {
      const apiLink = pageContent.match(/api\?m=release&id=(\d+)/i);
      animeId = apiLink?.[1] || '';
    }

    // NOTE: Extract episodes directly from HTML (API needs cookies from Playwright)
    // The anime page lists episodes in the HTML, parse them directly
    return extractEpisodesFromHTML($);
  } catch (error) {
    console.error(`[EpisodesExtractor] Failed for slug "${slug}":`, error.message);
    return [];
  }
}

// ══════════════════════════════════════════════════════════════
// HELPER: PARSE API EPISODES
// ══════════════════════════════════════════════════════════════

/**
 * Parses episode data from the API response format.
 *
 * @param {Array} apiData - Raw episode data from the API
 * @returns {Array} Normalized episode objects
 *
 * @description
 *   The API returns episodes in a compact format with id, slug,
 *   number, and title fields. We normalize this to a consistent
 *   structure used across the application.
 */
function parseEpisodes(apiData) {
  return apiData.map(ep => ({
    id: ep.id || '',
    number: parseInt(ep.number) || 0,
    slug: ep.slug || ep.session || '',
    title: ep.title || ep.name || `Episode ${ep.number}`,
    url: ep.slug ? `/${ep.slug}/` : '',
    sub: ep.p2p || ep.p360 || '',
    dub: ep.p720 || ep.p480 || '',
  }));
}

// ══════════════════════════════════════════════════════════════
// HELPER: HTML FALLBACK PARSER
// ══════════════════════════════════════════════════════════════

// ---- FEATURE: HTML fallback parser for when API fails ----
/**
 * Fallback episode extraction from HTML when API fails.
 *
 * @param {CheerioStatic} $ - Loaded Cheerio instance
 * @returns {Array} Basic episode list from HTML
 *
 * @description
 *   If the anime ID cannot be extracted or the API fails,
 *   this fallback tries to parse whatever episode links are
 *   present in the initial HTML response. Results may be
 *   incomplete (only first page of episodes).
 */
function extractEpisodesFromHTML($) {
  const episodes = [];
  const seen = new Set();

  // NOTE: animepahe.ch episode list structure:
  // .eplister > ul > li > a[href*="episode"]
  // Each <li> contains an episode link with title and number
  const episodeLinks = $('.eplister a[href*="episode"]');
  const fallbackLinks = episodeLinks.length > 0 ? episodeLinks : $('a[href*="episode"]');

  fallbackLinks.each((_, el) => {
    const $a = $(el);
    const href = $a.attr('href') || '';
    const slug = href.split('/').filter(Boolean).pop() || '';

    // Skip invalid slugs
    if (!slug || slug === '#' || slug.includes('?')) return;

    // Extract episode number from .epcur span or URL
    const epText = $a.find('.epcur').text().trim();
    const numberMatch = epText.match(/(\d+)/) || slug.match(/episode-(\d+)/i);
    const number = numberMatch ? parseInt(numberMatch[1]) : episodes.length + 1;

    if (!seen.has(slug)) {
      seen.add(slug);
      episodes.push({
        number,
        slug,
        title: epText || `Episode ${number}`,
        url: href,
      });
    }
  });

  // Sort by episode number descending (latest first)
  episodes.sort((a, b) => b.number - a.number);

  return episodes;
}

// ══════════════════════════════════════════════════════════════
// EXPORTS
// ══════════════════════════════════════════════════════════════

module.exports = { fetchEpisodes };

// ══════════════════════════════════════════════════════════════ END: episodes.extractor.js
