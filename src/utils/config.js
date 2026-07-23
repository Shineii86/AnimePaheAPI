/*
 * ======= • ======= • ======= • ======= • =======• =======
 * AnimePaheAPI — config.js
 * Repository: https://github.com/Shineii86/AnimePaheAPI
 *
 * @description
 *   Centralized configuration management for the API.
 *   Loads environment variables, manages cookies, proxies,
 *   and provides URL construction helpers. Supports both
 *   serverless (Vercel) and local development environments.
 *
 * @exports
 *   config (singleton Config instance)
 *
 * @author  Shinei Nouzen
 * @license MIT
 * ======= • ======= • ======= • ======= • =======• =======
 */

const dotenv = require('dotenv');
dotenv.config();

// ══════════════════════════════════════════════════════════════
// CONFIG CLASS
// ══════════════════════════════════════════════════════════════

/**
 * Centralized configuration manager.
 *
 * @description
 *   Holds all configuration values including base URL, user agent,
 *   cookies, proxies, and environment-specific settings. Provides
 *   URL construction helpers and cookie management.
 *
 * @class Config
 */
class Config {
  constructor() {
    /** @type {string} Full host URL (set on first request) */
    this.hostUrl = '';

    /** @type {string} Base URL for animepahe.ch */
    this.baseUrl = 'https://animepahe.ch';

    /** @type {string} iframe base URL for streaming (kwik.cx or kwik.si) */
    this.iframeBaseUrl = 'kwik.cx';

    /** @type {string} Browser user agent string */
    this.userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

    /** @type {string} Cookie header string for requests */
    this.cookies = '';

    /** @type {number} Cookie refresh interval in ms (14 days) */
    this.cookiesRefreshInterval = 14 * 24 * 60 * 60 * 1000;

    /** @type {string[]} Proxy URLs */
    this.proxies = [];

    /** @type {boolean} Whether proxy usage is enabled */
    this.proxyEnabled = false;

    // NOTE: Detect serverless environment for reduced timeouts/retries
    this.isServerless = !!(process.env.VERCEL || process.env.NETLIFY || process.env.AWS_LAMBDA_FUNCTION_NAME);
    this.maxRetries = this.isServerless ? 1 : 3;
    this.requestTimeout = this.isServerless ? 10000 : 30000;
    this.challengeTimeout = this.isServerless ? 10000 : 30000;
  }

  // ---- FEATURE: Set host URL from first request ----
  /**
   * Sets the host URL from the first incoming request.
   *
   * @param {string} protocol - HTTP protocol (http or https)
   * @param {string} host - Host header value
   */
  setHostUrl(protocol, host) {
    if (!this.hostUrl && protocol && host) {
      this.hostUrl = `${protocol}://${host}`;
    }
  }

  // ---- FEATURE: Cookie management ----
  /**
   * Sets the cookie header string for all requests.
   *
   * @param {string} cookieHeader - Cookie string (e.g., "name1=val1; name2=val2")
   * @returns {boolean} True if cookies were set successfully
   *
   * @description
   *   Validates the cookie format before setting. Cookies are
   *   required for all API requests to bypass DDoS-Guard protection.
   */
  setCookies(cookieHeader) {
    if (!cookieHeader) return false;
    if (typeof cookieHeader === 'string' && cookieHeader.includes('=')) {
      this.cookies = cookieHeader;
      return true;
    }
    return false;
  }

  // ---- FEATURE: Proxy management ----
  /**
   * Sets a single proxy for requests.
   *
   * @param {string} proxyString - Proxy URL (e.g., "http://user:pass@host:port")
   * @returns {boolean} True if proxy is valid
   */
  setProxy(proxyString) {
    if (!proxyString) return false;
    try {
      const proxyUrl = new URL(proxyString.startsWith('http') ? proxyString : `http://${proxyString}`);
      return !!proxyUrl.hostname;
    } catch (error) {
      return false;
    }
  }

  /**
   * Returns a random proxy from the pool.
   *
   * @returns {string|null} Random proxy URL or null if none configured
   */
  getRandomProxy() {
    if (this.proxies.length === 0) return null;
    return this.proxies[Math.floor(Math.random() * this.proxies.length)];
  }

  /**
   * Updates the proxy pool.
   *
   * @param {string[]} newProxies - Array of proxy URLs
   */
  updateProxies(newProxies) {
    this.proxies = newProxies;
  }

  // ---- FEATURE: URL construction ----
  /**
   * Constructs a full URL for a given section.
   *
   * @param {string} section - Section name (home, queue, animeInfo, animeList, play)
   * @param {string} [primary=''] - Primary parameter (anime ID, tag, etc.)
   * @param {string} [secondary=''] - Secondary parameter (tag2, episode ID)
   * @returns {string} Full URL
   *
   * @example
   *   config.getUrl('home')                      → "https://animepahe.ch/"
   *   config.getUrl('animeInfo', 'one-piece')     → "https://animepahe.ch/anime/one-piece"
   *   config.getUrl('play', 'abc123', 'def456')   → "https://animepahe.ch/play/abc123/def456"
   */
  getUrl(section, primary = '', secondary = '') {
    const paths = {
      home: '/',
      queue: '/queue',
      animeInfo: `/anime/${primary}`,
      animeList: primary && secondary ? `/anime/${primary}/${secondary}` : '/anime',
      play: `/play/${primary}/${secondary}`,
    };
    if (!paths[section]) throw new Error(`Invalid URL section: ${section}`);
    return `${this.baseUrl}${paths[section]}`;
  }

  // ---- FEATURE: Environment variable loading ----
  /**
   * Loads configuration from environment variables.
   *
   * @description
   *   Reads BASE_URL, USER_AGENT, COOKIES, PROXIES, USE_PROXY,
   *   IFRAME_BASE_URL, and HOST_URL from .env file.
   */
  loadFromEnv() {
    if (process.env.BASE_URL) this.baseUrl = process.env.BASE_URL;
    if (process.env.USER_AGENT) this.userAgent = process.env.USER_AGENT;
    if (process.env.HOST_URL) this.hostUrl = process.env.HOST_URL;
    if (process.env.IFRAME_BASE_URL) this.iframeBaseUrl = process.env.IFRAME_BASE_URL;

    // NOTE: Parse cookies from environment
    if (process.env.COOKIES) {
      this.setCookies(process.env.COOKIES.trim());
    }

    // NOTE: Parse proxy list from environment
    if (process.env.PROXIES) {
      try {
        const proxyList = process.env.PROXIES.split(',').map(p => p.trim());
        const validProxies = proxyList.filter(p => this.setProxy(p));
        this.proxies = validProxies;
      } catch (error) {
        this.proxies = [];
      }
    }

    this.proxyEnabled = process.env.USE_PROXY === 'true';
  }

  /**
   * Validates that required configuration values are present.
   * @throws {Error} If baseUrl or userAgent is missing
   */
  validate() {
    if (!this.baseUrl) throw new Error('BASE_URL is required');
    if (!this.userAgent) throw new Error('USER_AGENT is required');
  }
}

// ══════════════════════════════════════════════════════════════
// SINGLETON INSTANCE
// ══════════════════════════════════════════════════════════════

const config = new Config();

module.exports = config;

// ══════════════════════════════════════════════════════════════ END: config.js
