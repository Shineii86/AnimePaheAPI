/*
 * ======= • ======= • ======= • ======= • =======• =======
 * AnimePaheAPI — cache.helper.js
 * Repository: https://github.com/Shineii86/AnimePaheAPI
 *
 * @description
 *   In-memory caching utility for storing and retrieving scraped data.
 *   Implements TTL-based cache invalidation to prevent stale responses
 *   while reducing unnecessary requests to animepahe.ch backends.
 *   Uses per-key TTL profiles for different endpoint types.
 *
 * @exports
 *   cache, CACHE_TTL
 *
 * @author  Shineii86
 * @license MIT
 * ======= • ======= • ======= • ======= • =======• =======
 */

// ══════════════════════════════════════════════════════════════
// CACHE CLASS
// ══════════════════════════════════════════════════════════════

/**
 * In-memory key-value cache with TTL support.
 *
 * @description
 *   Stores values in a Map with associated expiration timestamps.
 *   Expired entries are lazily evicted on access (not background).
 *   This keeps the implementation simple and avoids timer overhead.
 *   In Vercel serverless, cache survives warm invocations but is
 *   lost on cold starts — this is expected and acceptable.
 *
 * @class Cache
 */
class Cache {
  constructor() {

    // ---- FEATURE: In-memory Map-based cache storage ----
    /** @type {Map<string, *>} Actual data storage */
    this.store = new Map();

    /** @type {Map<string, number>} Expiration timestamps (Date.now + ttl) */
    this.ttls = new Map();
  }

  /**
   * Stores data in cache with TTL-based expiry.
   *
   * @param {string} key - The cache key to store under
   * @param {*} value - Any JavaScript value to cache
   * @param {number} [ttlSeconds=60] - Time-to-live in seconds
   * @returns {void}
   *
   * @description
   *   Overwrites any existing value for the same key. The TTL timer
   *   resets on every set, not from the original insertion time.
   *
   * @example
   *   cache.set('search:naruto:1', results, 60); // TTL: 60 seconds
   */
  set(key, value, ttlSeconds = 60) {

    // NOTE: Overwriting existing keys resets the TTL timer
    this.store.set(key, value);
    this.ttls.set(key, Date.now() + ttlSeconds * 1000);
  }

  /**
   * Retrieves data from cache if it exists and hasn't expired.
   * Automatically removes stale entries on access (lazy eviction).
   *
   * @param {string} key - The cache key to lookup
   * @returns {*} Cached data if valid, null if expired or missing
   *
   * @example
   *   const data = cache.get("search:naruto:1");
   *   if (data) {
   *     // Use cached data
   *   }
   */
  get(key) {
    if (!this.store.has(key)) return null;

    // NOTE: Lazy eviction — delete stale entries on access
    if (Date.now() > this.ttls.get(key)) {
      this.store.delete(key);
      this.ttls.delete(key);
      return null;
    }

    return this.store.get(key);
  }

  /**
   * Checks if a key exists and is not expired.
   *
   * @param {string} key - Cache key to check
   * @returns {boolean} True if the key exists and is valid
   *
   * @example
   *   if (cache.has('home')) {
   *     return cache.get('home');
   *   }
   */
  has(key) {
    return this.get(key) !== null;
  }

  /**
   * Clears all cached entries from memory. Use when:
   * - Memory cleanup is needed
   * - Force-refreshing all data
   * - Application restart/reset
   *
   * @returns {void}
   */
  clear() {
    this.store.clear();
    this.ttls.clear();
  }

  /**
   * Returns the current number of entries in the cache.
   *
   * @returns {number} Current cache size
   */
  size() {
    return this.store.size;
  }
}

// ══════════════════════════════════════════════════════════════
// SINGLETON INSTANCE
// ══════════════════════════════════════════════════════════════

// ---- FEATURE: Global shared cache instance ----
/**
 * Global cache instance shared across all route handlers.
 *
 * @description
 *   A single Cache instance is created and exported. All routes
 *   import and use this same instance, ensuring cache coherence
 *   across requests within the same serverless invocation.
 */
const cache = new Cache();

// ══════════════════════════════════════════════════════════════
// CACHE TTL CONFIGURATION
// ══════════════════════════════════════════════════════════════

// ---- FEATURE: Per-endpoint cache duration configuration ----
/**
 * Per-endpoint cache duration configuration (in seconds).
 *
 * @description
 *   Different endpoints have different freshness requirements:
 *   - Search: 60s (results change frequently)
 *   - Info: 300s (anime details rarely change)
 *   - Home: 120s (balanced between freshness and performance)
 *   - Suggestions: 30s (autocomplete needs to be responsive)
 *
 * @object {Object} CACHE_TTL
 *
 * @example
 *   cache.set(key, data, CACHE_TTL.search);   // 60 seconds
 *   cache.set(key, data, CACHE_TTL.info);      // 300 seconds
 */
const CACHE_TTL = {

  /** @description Home page — latest releases, trending, popular. 2 min. */
  home: 120,

  /** @description Search results — changes as new anime air. 1 min. */
  search: 60,

  /** @description Autocomplete suggestions — needs fast updates. 30 sec. */
  suggestions: 30,

  /** @description Anime detail pages — rarely change. 5 min. */
  info: 300,

  /** @description Episode lists — update when new eps drop. 1 min. */
  episodes: 60,

  /** @description Filter/browse results — moderate freshness. 2 min. */
  filter: 120,

  /** @description Trending section — changes hourly. 2 min. */
  trending: 120,

  /** @description Popular section — changes slowly. 2 min. */
  popular: 120,

  /** @description Recent releases — new episodes are time-sensitive. 1 min. */
  recent: 60,

  /** @description A-Z list — static catalog, rarely changes. 3 min. */
  azList: 180,

  /** @description Season pages — static, seasonal data. 3 min. */
  season: 180,

  /** @description Genre pages — static category data. 3 min. */
  genre: 180,
};

// ══════════════════════════════════════════════════════════════
// EXPORTS
// ══════════════════════════════════════════════════════════════

module.exports = { cache, CACHE_TTL };

// ══════════════════════════════════════════════════════════════ END: cache.helper.js
