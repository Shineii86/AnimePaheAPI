/*
 * ======= • ======= • ======= • ======= • =======• =======
 * AnimePaheAPI — dataProcessor.js
 * Repository: https://github.com/Shineii86/AnimePaheAPI
 *
 * @description
 *   Processes and normalizes raw API responses from animepahe.ch.
 *   Converts the site's internal data format into clean, consistent
 *   JSON structures for the API consumers.
 *
 * @exports
 *   DataProcessor (static class)
 *
 * @author  Shinei Nouzen
 * @license MIT
 * ======= • ======= • ======= • ======= • =======• =======
 */

// ══════════════════════════════════════════════════════════════
// DATA PROCESSOR CLASS
// ══════════════════════════════════════════════════════════════

/**
 * Static class for processing raw animepahe API data.
 *
 * @class DataProcessor
 */
class DataProcessor {

  // ---- FEATURE: Process API response data ----
  /**
   * Processes raw API data into a normalized format.
   *
   * @param {Object} data - Raw API response with { data: [...], total, current_page, last_page }
   * @param {string} [type='default'] - Data type (default, search, releases)
   * @returns {Object} Processed data with metadata
   *
   * @description
   *   Normalizes the animepahe API response format into a consistent
   *   structure with pagination info and processed items.
   */
  static processApiData(data, type = 'default') {
    if (!data || !data.data) {
      return {
        data: [],
        pagination: { total: 0, currentPage: 1, totalPages: 1, hasNextPage: false },
      };
    }

    const processedItems = data.data.map(item => {
      switch (type) {
        case 'search':
          return this.processSearchItem(item);
        case 'releases':
          return this.processReleaseItem(item);
        default:
          return this.processDefaultItem(item);
      }
    });

    return {
      data: processedItems,
      pagination: {
        total: data.total || 0,
        currentPage: data.current_page || 1,
        totalPages: data.last_page || 1,
        hasNextPage: (data.current_page || 1) < (data.last_page || 1),
      },
      _id: data._id || null,
    };
  }

  // ---- FEATURE: Process search result item ----
  /**
   * Processes a single search result item.
   *
   * @param {Object} item - Raw search item from API
   * @returns {Object} Normalized search item
   */
  static processSearchItem(item) {
    return {
      id: item.id || null,
      title: item.title || item.name || '',
      slug: item.session || item.slug || '',
      poster: item.image ? this.normalizeImageUrl(item.image) : null,
      type: item.type || '',
      episodes: {
        total: item.episodes || 0,
        sub: item.episodes_sub || 0,
        dub: item.episodes_dub || 0,
      },
      status: item.status || '',
    };
  }

  // ---- FEATURE: Process release/episode item ----
  /**
   * Processes a single release/episode item.
   *
   * @param {Object} item - Raw release item from API
   * @returns {Object} Normalized episode item
   */
  static processReleaseItem(item) {
    return {
      id: item.id || null,
      number: parseInt(item.number) || 0,
      title: item.title || `Episode ${item.number}`,
      slug: item.session || item.slug || '',
      snapshot: item.snapshot ? this.normalizeImageUrl(item.snapshot) : null,
      duration: item.duration || '',
      uploaded: item.uploaded_at || '',
    };
  }

  // ---- FEATURE: Process default/homepage item ----
  /**
   * Processes a single homepage/airing item.
   *
   * @param {Object} item - Raw airing item from API
   * @returns {Object} Normalized airing item
   */
  static processDefaultItem(item) {
    return {
      id: item.id || null,
      title: item.title || item.name || '',
      slug: item.session || item.slug || '',
      poster: item.image ? this.normalizeImageUrl(item.image) : null,
      episode: item.episode || '',
      type: item.type || '',
      rating: item.rating || '',
    };
  }

  // ---- FEATURE: URL normalization ----
  /**
   * Normalizes an image URL to ensure it has a valid protocol.
   *
   * @param {string} url - Raw URL (may be protocol-relative)
   * @returns {string} Normalized URL with https:// prefix
   */
  static normalizeImageUrl(url) {
    if (!url) return '';
    if (url.startsWith('//')) return `https:${url}`;
    if (url.startsWith('http://')) return url.replace('http://', 'https://');
    return url;
  }
}

// ══════════════════════════════════════════════════════════════
// EXPORTS
// ══════════════════════════════════════════════════════════════

module.exports = DataProcessor;

// ══════════════════════════════════════════════════════════════ END: dataProcessor.js
