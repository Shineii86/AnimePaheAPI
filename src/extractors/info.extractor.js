/*
 * ======= • ======= • ======= • ======= • =======• =======
 * AnimePaheAPI — info.extractor.js
 * Repository: https://github.com/Shineii86/AnimePaheAPI
 *
 * @description
 *   Extracts detailed information about a specific anime from its
 *   dedicated page on animepahe.ch. This includes metadata like
 *   title, synopsis, genres, episodes, and related anime.
 *
 * @exports
 *   extractInfo
 *
 * @author  Shinei Nouzen
 * @license MIT
 * ======= • ======= • ======= • ======= • =======• =======
 */

const cheerio = require('cheerio');

// ══════════════════════════════════════════════════════════════
// INFO EXTRACTOR
// ══════════════════════════════════════════════════════════════

// ---- FEATURE: Complete anime info by slug ----
/**
 * Extracts detailed anime information from its page.
 *
 * @param {CheerioStatic} $ - Loaded Cheerio instance of the anime page
 * @returns {Object} Detailed anime information
 *
 * @description
 *   Parses the full anime detail page to extract all available metadata.
 *   The page is divided into sections: poster/title area, info panel,
 *   episode list, and related anime. Each section is extracted independently
 *   and compiled into a single response object.
 *
 * @example
 *   const $ = await fetchPage(URLS.info('one-piece'));
 *   const info = extractInfo($);
 *   // info.title       → "One Piece"
 *   // info.synopsis    → "Gol D. Roger was known as..."
 *   // info.episodes    → [{ number: 1, slug: "one-piece-episode-1-english-subbed" }]
 *   // info.genres      → ["Action", "Adventure", "Comedy"]
 */
function extractInfo($, slug = '') {

  // ---- FEATURE: Title and poster extraction ----
  /**
   * Extracts the main title and poster image.
   *
   * @description
   *   Title is found in the h1 element or meta tags.
   *   Poster is typically in the main image element.
   *   Falls back to Open Graph meta tags for reliability.
   */
  const title = $('h1, .title h1, .anime-title').text().trim() ||
                $('meta[property="og:title"]').attr('content') || '';

  const resolvedSlug = $('meta[property="og:url"]').attr('content')?.split('/series/')[1]?.replace(/\/$/, '') || slug;

  const poster = $('img.poster, .anime-poster img, .thumb img').attr('src') ||
                 $('meta[property="og:image"]').attr('content') || '';

  const banner = $('img.banner, .banner img').attr('src') || '';

  // ---- FEATURE: Synopsis extraction ----
  /**
   * Extracts the anime synopsis/description.
   *
   * @description
   *   The synopsis is typically in a div with class "synopsis" or "description".
   *   We also check meta tags as a fallback. HTML tags are stripped to get
   *   clean text suitable for display.
   */
  const synopsis = $('.synopsis, .description, .anime-desc, .story')
    .text().trim() ||
    $('meta[property="og:description"]').attr('content') || '';

  // ---- FEATURE: Metadata extraction ----
  /**
   * Extracts metadata from the info panel.
   *
   * @description
   *   The info panel contains key-value pairs like Status, Type,
   *   Episodes, Duration, etc. We iterate through each row and
   *   extract the label-value pairs into a flat object.
   *
   * @note We normalize labels to lowercase for consistent access.
   */
  const metadata = {};
  const infoRows = ['.info .row', '.anime-info .row', '.content-wrapper .row', '.info-content .row'];

  for (const selector of infoRows) {
    $(selector).each((_, el) => {
      const $row = $(el);
      const label = $row.find('.label, .labelx, dt, strong').text().trim().replace(':', '').toLowerCase();
      const value = $row.find('.value, .val, dd, span').text().trim();
      if (label && value) {
        metadata[label] = value;
      }
    });
    if (Object.keys(metadata).length > 0) break;
  }

  // ---- FEATURE: Genre extraction ----
  /**
   * Extracts genre tags from the page.
   *
   * @description
   *   Genres are usually displayed as links in a dedicated section.
   *   We collect all genre links and normalize them to a deduplicated array.
   */
  const genres = [];
  const genreSelectors = ['.genre a, .genres a, .tag a, .anime-genres a'];

  for (const selector of genreSelectors) {
    $(selector).each((_, el) => {
      const genre = $(el).text().trim();
      // NOTE: Deduplicate genres to avoid repeated entries
      if (genre && !genres.includes(genre)) {
        genres.push(genre);
      }
    });
    if (genres.length > 0) break;
  }

  // ---- FEATURE: Episode list extraction ----
  /**
   * Extracts the episode list from the page.
   *
   * @description
   *   Episodes are displayed in a list or grid format, each with
   *   a link to the watch page and an episode number. The slug is
   *   extracted from the URL path for routing.
   */
  const episodes = [];
  const episodeSelectors = [
    '.episode-list a, .episodes a, .ep-list a',
    '.episode-item a, .ep-item a',
  ];

  for (const selector of episodeSelectors) {
    $(selector).each((_, el) => {
      const $ep = $(el);
      const epSlug = $ep.attr('href')?.split('/').filter(Boolean).pop() || '';
      const epNumber = $ep.find('.ep-number, .ep-num, .episode-number').text().trim() ||
                       $ep.text().match(/Ep(?:isode)?\s*(\d+)/i)?.[1] || '';

      if (epSlug) {
        episodes.push({
          number: parseInt(epNumber) || episodes.length + 1,
          slug: epSlug,
          url: $ep.attr('href') || '',
        });
      }
    });
    if (episodes.length > 0) break;
  }

  // ---- FEATURE: Related anime extraction ----
  /**
   * Extracts related/similar anime recommendations.
   *
   * @description
   *   The related section shows anime that are similar in genre,
   *   sequel/prequel relationships, or from the same studio.
   */
  const related = [];
  const relatedSelectors = [
    '.related .anime-card, .similar .anime-card',
    '.related-list .item, .similar-list .item',
  ];

  for (const selector of relatedSelectors) {
    $(selector).each((_, el) => {
      const $item = $(el);
      const link = $item.find('a').first();
      const href = link.attr('href') || '';
      const relSlug = href.split('/series/')[1]?.replace(/\/$/, '') || '';
      const relTitle = $item.find('.tt, h2.title').text().trim() || link.attr('title') || '';

      if (relSlug && relTitle) {
        related.push({ slug: relSlug, title: relTitle, url: href });
      }
    });
    if (related.length > 0) break;
  }

  // ---- FEATURE: Compile final result ----
  /**
   * Compiles all extracted data into a single info object.
   *
   * @description
   *   Combines metadata from the info panel with extracted genres,
   *   episodes, and related anime into a clean response object.
   *   Full metadata is included for advanced consumers who need
   *   raw key-value pairs.
   */
  return {
    title,
    slug: resolvedSlug,
    poster,
    banner,
    synopsis,
    genres,
    episodes,
    related,
    status: metadata.status || '',
    type: metadata.type || '',
    duration: metadata.duration || '',
    rating: metadata.rating || '',
    released: metadata.released || metadata.aired || '',
    studio: metadata.studio || '',
    source: metadata.source || '',
    metadata,
  };
}

// ══════════════════════════════════════════════════════════════
// EXPORTS
// ══════════════════════════════════════════════════════════════

module.exports = { extractInfo };

// ══════════════════════════════════════════════════════════════ END: info.extractor.js
