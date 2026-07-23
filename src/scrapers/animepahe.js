/*
 * ======= • ======= • ======= • ======= • =======• =======
 * AnimePaheAPI — animepahe.js
 * Repository: https://github.com/Shineii86/AnimePaheAPI
 *
 * @description
 *   Core scraper for animepahe.ch with automatic cookie management,
 *   DDoS-Guard bypass, and multi-strategy request handling.
 *   Manages the full lifecycle: cookie refresh, API requests,
 *   HTML scraping, iframe extraction, and download links.
 *
 * @exports
 *   animepahe (singleton instance)
 *
 * @author  Shinei Nouzen
 * @license MIT
 * ======= • ======= • ======= • ======= • =======• =======
 */

const fs = require('fs').promises;
const path = require('path');
const config = require('../utils/config');
const RequestManager = require('../utils/requestManager');
const { launchBrowser } = require('../utils/browser');
const { CustomError } = require('../helper/error.helper');

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// ══════════════════════════════════════════════════════════════
// ANIMEPAHE SCRAPER CLASS
// ══════════════════════════════════════════════════════════════

/**
 * Core scraper for animepahe.ch with cookie lifecycle management.
 *
 * @description
 *   Handles the complete scraping workflow:
 *   1. Launch Playwright browser to solve Cloudflare/DDoS-Guard
 *   2. Extract cookies from the browser session
 *   3. Cache cookies to /tmp/cookies.json (survives warm invocations)
 *   4. Use cached cookies for subsequent API requests
 *   5. Auto-refresh cookies when they expire (14-day TTL)
 *   6. Fall back to Playwright for iframe/CDN extraction
 *
 * @class Animepahe
 */
class Animepahe {
  constructor() {
    /** @type {string} Path to cached cookies file */
    this.cookiesPath = path.join('/tmp', 'cookies.json');

    /** @type {number} Cookie TTL in ms (14 days) */
    this.cookiesRefreshInterval = 14 * 24 * 60 * 60 * 1000;

    /** @type {boolean} Lock to prevent concurrent cookie refreshes */
    this.isRefreshingCookies = false;

    /** @type {Browser|null} Active Playwright browser instance */
    this.activeBrowser = null;

    /** @type {Object|null} Cloudflare session cookies */
    this.cloudflareSessionCookies = null;
  }

  // ══════════════════════════════════════════════════════════════
  // COOKIE MANAGEMENT
  // ══════════════════════════════════════════════════════════════

  // ---- FEATURE: Initialize scraper and refresh cookies if needed ----
  /**
   * Initializes the scraper by checking and refreshing cookies.
   *
   * @description
   *   Should be called once at server startup. Checks if cached
   *   cookies exist and are still valid. If not, launches a browser
   *   to solve Cloudflare and extract fresh cookies.
   *
   * @returns {Promise<boolean>} True if initialization succeeded
   */
  async initialize() {
    const needsRefresh = await this.needsCookieRefresh();
    if (needsRefresh) {
      await this.refreshCookies();
    }
    return true;
  }

  // ---- FEATURE: Check if cookies need refresh ----
  /**
   * Checks if cached cookies are expired or missing.
   *
   * @returns {boolean} True if cookies need refreshing
   */
  async needsCookieRefresh() {
    try {
      const cookieData = JSON.parse(await fs.readFile(this.cookiesPath, 'utf8'));
      if (cookieData?.timestamp) {
        const ageInMs = Date.now() - cookieData.timestamp;
        return ageInMs > this.cookiesRefreshInterval;
      }
      return true;
    } catch (error) {
      return true;
    }
  }

  // ---- FEATURE: Refresh cookies via Playwright ----
  /**
   * Launches a browser to solve DDoS-Guard and extract fresh cookies.
   *
   * @description
   *   This is the core DDoS protection bypass mechanism:
   *   1. Launch Playwright with stealth flags
   *   2. Navigate to animepahe.ch homepage
   *   3. Detect DDoS-Guard challenge page
   *   4. Wait for challenge to resolve (click consent, solve captcha, etc.)
   *   5. Extract all cookies from the browser context
   *   6. Save cookies to /tmp/cookies.json for reuse (14 days)
   *
   * @tip Cookies are cached for 14 days. The browser is only
   *      launched when cookies expire or are missing.
   *
   * @throws {CustomError} If browser fails to launch or no cookies found
   */
  async refreshCookies() {
    if (this.isRefreshingCookies) return;
    this.isRefreshingCookies = true;

    let browser = this.activeBrowser;

    try {
      if (!browser) {
        browser = await launchBrowser();
        this.activeBrowser = browser;
      }

      const context = await browser.newContext();
      const page = await context.newPage();

      // ---- FEATURE: Comprehensive stealth overrides ----
      /**
       * Overrides navigator properties to avoid bot detection.
       * These are the key properties that Cloudflare/DDoS-Guard check:
       * - webdriver: should be false (Playwright sets it to true by default)
       * - plugins: should look like a real browser (not empty)
       * - languages: should match the Accept-Language header
       * - permissions.query: should work normally for notifications
       */
      await context.addInitScript(() => {
        // Override webdriver flag
        Object.defineProperty(navigator, 'webdriver', { get: () => false });

        // Override plugins to look like real Chrome
        Object.defineProperty(navigator, 'plugins', {
          get: () => [1, 2, 3, 4, 5],
        });

        // Override languages
        Object.defineProperty(navigator, 'languages', {
          get: () => ['en-US', 'en'],
        });

        // Mock chrome object (some detectors check this)
        window.chrome = {
          runtime: {},
          loadTimes: function() {},
          csi: function() {},
          app: {},
        };

        // Override permissions.query to not reveal automation
        const originalQuery = window.navigator.permissions.query;
        window.navigator.permissions.query = (parameters) =>
          parameters.name === 'notifications'
            ? Promise.resolve({ state: Notification.permission })
            : originalQuery(parameters);
      });

      console.log('[Scraper] Navigating to animepahe.ch...');
      await page.goto(config.getUrl('home'), {
        waitUntil: 'networkidle',
        timeout: 30000,
      });

      // ---- FEATURE: DDoS-Guard challenge detection ----
      /**
       * Waits for the DDoS-Guard challenge to resolve.
       *
       * @description
       *   DDoS-Guard presents a challenge page before allowing access.
       *   We detect this by checking for specific DOM elements:
       *   - #ddg-cookie — the cookie consent challenge
       *   - #challenge-running — Cloudflare challenge
       *   - .cf-challenge-form — Cloudflare form challenge
       *   - [data-ray] — Cloudflare Ray ID
       *   - Title containing "Just a moment" or "DDoS protection"
       *
       *   The challenge resolves when these elements disappear or
       *   the page navigates to the actual content.
       */
      await page.waitForTimeout(3000);

      // Check for DDoS-Guard challenge indicators
      const challengeSelectors = [
        '#ddg-cookie',
        '#challenge-running',
        '.cf-challenge-form',
        '[data-ray]',
      ];

      let challengeFound = false;
      for (const selector of challengeSelectors) {
        try {
          const element = await page.$(selector);
          if (element) {
            challengeFound = true;
            console.log(`[Scraper] DDoS-Guard challenge detected: ${selector}`);
            break;
          }
        } catch (e) {}
      }

      // Also check page title for challenge indicators
      const title = await page.title();
      if (title.toLowerCase().includes('just a moment') ||
          title.toLowerCase().includes('ddos protection') ||
          title.toLowerCase().includes('checking your browser')) {
        challengeFound = true;
        console.log('[Scraper] DDoS-Guard challenge detected in page title');
      }

      if (challengeFound) {
        console.log('[Scraper] Waiting for DDoS-Guard challenge to resolve...');

        // Wait for challenge to disappear (up to 30 seconds)
        try {
          await page.waitForFunction(() => {
            const title = document.title.toLowerCase();
            const url = window.location.href;
            const bodyText = document.body.textContent.toLowerCase();

            return !title.includes('just a moment') &&
                   !title.includes('please wait') &&
                   !title.includes('ddos protection') &&
                   !title.includes('checking your browser') &&
                   !url.includes('cdn-cgi/challenge') &&
                   !bodyText.includes('checking your browser') &&
                   !bodyText.includes('ddos protection');
          }, { timeout: 30000 });

          // Additional wait for page to fully load after challenge
          await page.waitForTimeout(2000);
          console.log('[Scraper] DDoS-Guard challenge resolved');
        } catch (timeoutError) {
          console.warn('[Scraper] Challenge resolution timeout — proceeding anyway');
        }
      } else {
        console.log('[Scraper] No DDoS-Guard challenge detected');
      }

      // ---- FEATURE: Extract cookies from browser session ----
      const cookies = await context.cookies();
      if (!cookies || cookies.length === 0) {
        throw new CustomError('No cookies found after page load', 503);
      }

      const cookieData = {
        timestamp: Date.now(),
        cookies,
      };

      await fs.mkdir(path.dirname(this.cookiesPath), { recursive: true });
      await fs.writeFile(this.cookiesPath, JSON.stringify(cookieData, null, 2));

      console.log(`[Scraper] Cookies refreshed successfully (${cookies.length} cookies)`);
    } catch (error) {
      console.error('[Scraper] Cookie refresh error:', error.message);
      throw new CustomError(`Failed to refresh cookies: ${error.message}`, 503);
    } finally {
      this.isRefreshingCookies = false;
    }
  }

  // ---- FEATURE: Get valid cookies (with proactive refresh) ----
  /**
   * Returns a valid cookie header string, refreshing if necessary.
   *
   * @description
   *   Smart cookie retrieval:
   *   - If user provides cookies, use those directly
   *   - If cached cookies exist and are fresh, use them
   *   - If cookies are older than 13 days, refresh in background
   *   - If cookies are expired, refresh synchronously (blocks)
   *
   * @param {string|null} userProvidedCookies - Optional user cookies
   * @returns {Promise<string>} Cookie header string
   */
  async getCookies(userProvidedCookies = null) {
    // NOTE: Use user-provided cookies if given
    if (userProvidedCookies && typeof userProvidedCookies === 'string' && userProvidedCookies.trim()) {
      config.setCookies(userProvidedCookies.trim());
      return userProvidedCookies.trim();
    }

    let cookieData;
    try {
      cookieData = JSON.parse(await fs.readFile(this.cookiesPath, 'utf8'));
    } catch (error) {
      // No cached cookies — must block and refresh
      await this.refreshCookies();
      cookieData = JSON.parse(await fs.readFile(this.cookiesPath, 'utf8'));
    }

    // NOTE: Proactive background refresh if cookies are older than 13 days
    const ageInMs = Date.now() - cookieData.timestamp;
    if (ageInMs > (this.cookiesRefreshInterval - 24 * 60 * 60 * 1000) && !this.isRefreshingCookies) {
      this.isRefreshingCookies = true;
      this.refreshCookies()
        .catch(err => console.error('[Scraper] Background cookie refresh failed:', err.message))
        .finally(() => { this.isRefreshingCookies = false; });
    }

    const cookieHeader = cookieData.cookies
      .map(cookie => `${cookie.name}=${cookie.value}`)
      .join('; ');
    config.setCookies(cookieHeader);
    return cookieHeader;
  }

  // ══════════════════════════════════════════════════════════════
  // API REQUESTS (with automatic cookie retry)
  // ══════════════════════════════════════════════════════════════

  // ---- FEATURE: Fetch API data with auto-retry on 403 ----
  /**
   * Makes an API request with automatic cookie refresh on failure.
   *
   * @param {string} endpoint - API endpoint path (e.g., "/api")
   * @param {Object} [params={}] - Query parameters
   * @param {string|null} [userProvidedCookies=null] - Optional cookies
   * @returns {Promise<Object>} API response data
   *
   * @description
   *   First tries the request with current cookies. If it fails with
   *   401/403 (expired cookies), refreshes cookies and retries once.
   */
  async fetchApiData(endpoint, params = {}, userProvidedCookies = null) {
    try {
      const cookieHeader = await this.getCookies(userProvidedCookies);
      const url = new URL(endpoint, config.baseUrl).toString();
      return await RequestManager.fetchApiData(url, params, cookieHeader);
    } catch (error) {
      // NOTE: Only retry with automatic cookie refresh if user didn't provide cookies
      if (!userProvidedCookies && (error.response?.status === 401 || error.response?.status === 403 || error.message?.includes('DDoS-Guard'))) {
        await this.refreshCookies();
        return this.fetchApiData(endpoint, params, userProvidedCookies);
      }
      throw new CustomError(error.message || 'Failed to fetch API data', error.response?.status || 503);
    }
  }

  // ---- FEATURE: Fetch airing anime ----
  /**
   * Fetches currently airing anime from the API.
   *
   * @param {number} [page=1] - Page number
   * @returns {Promise<Object>} Airing anime data
   */
  async fetchAiringData(page = 1) {
    return this.fetchApiData('/api', { m: 'airing', page });
  }

  // ---- FEATURE: Fetch search results ----
  /**
   * Searches animepahe.ch for anime matching the query.
   *
   * @param {string} query - Search query
   * @param {number} page - Page number
   * @returns {Promise<Object>} Search results
   */
  async fetchSearchData(query, page) {
    if (!query) throw new CustomError('Search query is required', 400);
    return this.fetchApiData('/api', { m: 'search', q: query, page });
  }

  // ---- FEATURE: Fetch queue data ----
  /**
   * Fetches the encoding queue status.
   * @returns {Promise<Object>} Queue data
   */
  async fetchQueueData() {
    return this.fetchApiData('/api', { m: 'queue' });
  }

  // ---- FEATURE: Fetch episode releases ----
  /**
   * Fetches episode releases for an anime.
   *
   * @param {string} id - Anime ID/session
   * @param {string} sort - Sort order (e.g., "episode_desc")
   * @param {number} page - Page number
   * @returns {Promise<Object>} Episode release data
   */
  async fetchAnimeRelease(id, sort, page) {
    if (!id) throw new CustomError('Anime ID is required', 400);
    return this.fetchApiData('/api', { m: 'release', id, sort, page });
  }

  // ══════════════════════════════════════════════════════════════
  // HTML SCRAPING (with cookie-based requests)
  // ══════════════════════════════════════════════════════════════

  // ---- FEATURE: Scrape anime info page ----
  /**
   * Fetches and returns raw HTML for an anime info page.
   *
   * @param {string} animeId - Anime ID/session
   * @returns {Promise<string>} Raw HTML content
   */
  async scrapeAnimeInfo(animeId) {
    if (!animeId) throw new CustomError('Anime ID is required', 400);
    const url = `${config.getUrl('animeInfo')}${animeId}`;
    const cookieHeader = await this.getCookies();
    const html = await RequestManager.fetchHtml(url, cookieHeader);
    if (!html) throw new CustomError('Failed to fetch anime info', 503);
    return html;
  }

  // ---- FEATURE: Scrape anime list page ----
  /**
   * Fetches and returns raw HTML for an anime list page.
   *
   * @param {string} tag1 - First tag filter
   * @param {string} tag2 - Second tag filter
   * @returns {Promise<string>} Raw HTML content
   */
  async scrapeAnimeList(tag1, tag2) {
    const url = tag1 || tag2
      ? config.getUrl('animeList', tag1, tag2)
      : config.getUrl('animeList');
    const cookieHeader = await this.getCookies();
    const html = await RequestManager.fetchHtml(url, cookieHeader);
    if (!html) throw new CustomError('Failed to fetch anime list', 503);
    return html;
  }

  // ---- FEATURE: Scrape play page ----
  /**
   * Fetches and returns raw HTML for a play/watch page.
   *
   * @param {string} id - Anime ID/session
   * @param {string} episodeId - Episode ID/session
   * @returns {Promise<string>} Raw HTML content
   *
   * @description
   *   The play page contains the video player, resolution options,
   *   and download links. HTML is parsed by the playModel to extract
   *   streaming URLs.
   */
  async scrapePlayPage(id, episodeId) {
    if (!id || !episodeId) throw new CustomError('Both ID and episode ID are required', 400);

    const url = config.getUrl('play', id, episodeId);
    let cookieHeader = await this.getCookies();

    try {
      const html = await RequestManager.fetchHtml(url, cookieHeader);
      if (!html) throw new CustomError('Failed to fetch play page', 503);
      return html;
    } catch (error) {
      // NOTE: Retry with fresh cookies on 403/DDoS-Guard
      if (error.response?.status === 403 || error.message?.includes('DDoS-Guard')) {
        await this.refreshCookies();
        cookieHeader = await this.getCookies();
        const html = await RequestManager.fetchHtml(url, cookieHeader);
        if (!html) throw new CustomError('Failed to fetch play page after cookie refresh', 503);
        return html;
      }
      if (error.response?.status === 404) {
        throw new CustomError('Anime or episode not found', 404);
      }
      throw error;
    }
  }

  // ══════════════════════════════════════════════════════════════
  // IFRAME & STREAMING EXTRACTION
  // ══════════════════════════════════════════════════════════════

  // ---- FEATURE: Multi-strategy iframe fetching ----
  /**
   * Fetches iframe HTML using multiple strategies in order.
   *
   * @param {string} url - iframe URL (e.g., kwik.cx/e/...)
   * @returns {Promise<string>} iframe HTML content
   *
   * @description
   *   Tries two strategies:
   *   1. got-scraping (fast, handles most challenges)
   *   2. Playwright (slow, handles all challenges)
   *
   *   Falls through to the next strategy if the current one fails
   *   or returns blocked content (e.g., "Just a moment..." page).
   */
  async fetchIframeHtml(url) {
    if (!url) throw new CustomError('URL is required', 400);

    const strategies = [
      () => this.scrapeIframeLight(url),
      () => this.scrapeIframePlaywright(url),
    ];

    const errors = [];

    for (let i = 0; i < strategies.length; i++) {
      try {
        const result = await strategies[i]();
        if (result && result.length > 100 &&
            !result.toLowerCase().includes('just a moment') &&
            !result.toLowerCase().includes('checking your browser') &&
            !result.toLowerCase().includes('attention required')) {
          return result;
        }
        throw new Error('Blocked or invalid response');
      } catch (error) {
        errors.push(`Strategy ${i + 1}: ${error.message}`);
      }
    }

    throw new CustomError(`All iframe strategies failed: ${errors.join(', ')}`, 503);
  }

  // ---- FEATURE: Lightweight iframe fetch via got-scraping ----
  /**
   * Fetches iframe HTML using got-scraping.
   *
   * @param {string} url - iframe URL
   * @returns {Promise<string>} HTML content
   */
  async scrapeIframeLight(url) {
    const html = await RequestManager.scrapeWithGotScraping(url, {
      referer: config.getUrl('home'),
    });

    if (html && html.length > 100 &&
        !html.toLowerCase().includes('attention required')) {
      return html;
    }
    throw new Error('GotScraping returned blocked content');
  }

  // ---- FEATURE: Heavy iframe fetch via Playwright ----
  /**
   * Fetches iframe HTML using Playwright.
   *
   * @param {string} url - iframe URL
   * @returns {Promise<string>} HTML content
   */
  async scrapeIframePlaywright(url) {
    const html = await RequestManager.scrapeWithPlaywrightPage(url, {
      referer: config.getUrl('home'),
    });

    if (html && html.length > 100 &&
        !html.toLowerCase().includes('attention required')) {
      return html;
    }
    throw new Error('Playwright returned blocked content');
  }

  // ---- FEATURE: Extract download links from kwik pages ----
  /**
   * Extracts direct download URLs from kwik.cx pages.
   *
   * @param {string} url - kwik.cx URL
   * @returns {Promise<Object>} Download info with downloadUrl and filename
   *
   * @description
   *   Two-step process:
   *   1. Fetch the kwik page to find the form action and CSRF token
   *   2. POST the form to get a 302 redirect to the actual mp4 URL
   *
   * @tip The POST must include the Referer header and cookies.
   */
  async scrapeDownloadLinks(url) {
    if (!url) throw new CustomError('URL is required', 400);

    const { kwikUrl: resolvedUrl, filename } = await this.extractKwikUrl(url);
    if (!resolvedUrl) {
      const { downloadUrl, filename: directFilename } = await this.getKwikDownloadUrl(url);
      return { downloadUrl, filename: directFilename, type: 'direct_download' };
    }

    const { downloadUrl, filename: kwikFilename } = await this.getKwikDownloadUrl(resolvedUrl);
    return {
      downloadUrl,
      filename: filename || kwikFilename,
      type: 'redirected_download',
      originalUrl: url,
      resolvedUrl,
    };
  }

  // ---- FEATURE: Extract kwik URL from page ----
  /**
   * Extracts the kwik URL from a download page.
   *
   * @param {string} url - Source URL
   * @returns {Promise<Object>} kwikUrl and filename
   */
  async extractKwikUrl(url) {
    try {
      const html = await RequestManager.scrapeWithGotScraping(url, {
        referer: config.getUrl('home'),
        timeout: 30000,
      });
      const response = { body: html, headers: {} };

      const body = response.body;

      // NOTE: Extract filename from <title> tag
      let filename = null;
      const titleMatch = body.match(/<title>([^<]+)<\/title>/i);
      if (titleMatch?.[1]) {
        filename = titleMatch[1].replace(/\s*::\s*Kwik.*$/i, '').trim();
      }

      // NOTE: Try multiple patterns to find the kwik redirect URL
      const domain = config.iframeBaseUrl.replace('.', '\\.');
      const patterns = [
        new RegExp(`href["']\\s*,\\s*["']([^"']+\\.${domain})[^"']*["']`, 'i'),
        new RegExp(`href\\s*=\\s*["']([^"']*\\b${domain}\\b[^"']*)["']`, 'gi'),
        new RegExp(`["'](https?:\\/\\/[^"']*${domain}[^"']*)["']`, 'i'),
      ];

      for (const pattern of patterns) {
        const match = body.match(pattern);
        if (match?.[1]) {
          let kwikUrl = match[1];
          if (kwikUrl.startsWith('/')) {
            const urlObj = new URL(url);
            kwikUrl = `${urlObj.protocol}//${urlObj.host}${kwikUrl}`;
          } else if (!kwikUrl.startsWith('http')) {
            kwikUrl = `https://${config.iframeBaseUrl}${kwikUrl}`;
          }
          return { kwikUrl, filename };
        }
      }

      return { kwikUrl: null, filename };
    } catch (error) {
      return { kwikUrl: null, filename: null };
    }
  }

  // ---- FEATURE: Get kwik download URL via form POST ----
  /**
   * Extracts the actual mp4 download URL from a kwik page.
   *
   * @param {string} url - kwik page URL
   * @returns {Promise<Object>} downloadUrl and filename
   *
   * @description
   *   The kwik page contains a hidden form with a CSRF token.
   *   We extract the form action and token, then POST to get
   *   a 302 redirect to the actual mp4 file.
   */
  async getKwikDownloadUrl(url) {
    const { JSDOM } = require('jsdom');
    const vm = require('vm');

    // NOTE: Use got-scraping to fetch the kwik page (Cloudflare-protected)
    const body = await RequestManager.scrapeWithGotScraping(url, {
      referer: config.getUrl('home'),
      timeout: 30000,
    });

    // NOTE: Extract cookies from response headers (if available)
    let cookies = '';

    const scripts = [...body.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/gi)].map(m => m[1]);

    let foundAction = null;
    let foundToken = null;

    // ---- Execute JS to extract form data ----
    const dom = new JSDOM(`<!doctype html><body></body>`);
    const $ = (sel) => {
      if (typeof sel === 'function') return $;
      return { html: () => '', attr: () => '', click: () => $, on: () => $, remove: () => $, length: 0 };
    };
    $.ajax = () => {};

    const sandbox = {
      window: dom.window,
      document: dom.window.document,
      console,
      navigator: { userAgent: config.userAgent },
      $,
      setTimeout,
      clearTimeout,
    };

    for (const s of scripts) {
      if (s && s.length > 100) {
        try {
          vm.runInContext(s, vm.createContext(sandbox), { timeout: 4000 });
          // NOTE: Look for form data in the executed script's side effects
          const actionMatch = body.match(/action=["']([^"']+)["']/i);
          const tokenMatch = body.match(/name=["']_token["'][^>]*value=["']([^"']+)["']/i);
          if (actionMatch) foundAction = actionMatch[1];
          if (tokenMatch) foundToken = tokenMatch[1];
          if (foundAction && foundToken) break;
        } catch (e) {}
      }
    }

    // NOTE: Extract from raw HTML if VM execution didn't find them
    if (!foundAction) {
      const actionMatch = body.match(/action=["']([^"']+)["']/i);
      if (actionMatch) foundAction = actionMatch[1];
    }
    if (!foundToken) {
      const tokenMatch = body.match(/name=["']_token["'][^>]*value=["']([^"']+)["']/i);
      if (tokenMatch) foundToken = tokenMatch[1];
    }

    if (!foundAction || !foundToken) {
      throw new Error('Could not extract form action or token from kwik page');
    }

    // NOTE: Extract filename from title
    let filename = null;
    const titleMatch = body.match(/<title>([^<]+)<\/title>/i);
    if (titleMatch?.[1]) {
      filename = titleMatch[1].replace(/\s*::\s*Kwik.*$/i, '').trim();
    }

    // NOTE: Wait 2 seconds before submitting (kwik requires this)
    await sleep(2000);

    // NOTE: POST the form to get the redirect URL
    const postResponse = await RequestManager.postFormData(
      foundAction,
      `_token=${encodeURIComponent(foundToken)}`,
      {
        referer: url,
        cookies,
        timeout: 30000,
      }
    );

    if (postResponse.statusCode === 302 || postResponse.statusCode === 301) {
      const downloadUrl = postResponse.location || postResponse.headers?.location;
      return { downloadUrl, filename };
    }

    // NOTE: Check for meta refresh or JS redirect in 200 response
    if (postResponse.statusCode === 200) {
      const respBody = postResponse.body;
      const metaMatch = respBody.match(/<meta[^>]*http-equiv=["']refresh["'][^>]*content=["'][^"]*url=([^"']+)["']/i);
      if (metaMatch) return { downloadUrl: metaMatch[1], filename };

      const jsMatch = respBody.match(/window\.location(?:\.href)?\s*=\s*["']([^"']+)["']/i);
      if (jsMatch) return { downloadUrl: jsMatch[1], filename };
    }

    throw new Error('Could not extract download URL from kwik page');
  }
}

// ══════════════════════════════════════════════════════════════
// SINGLETON INSTANCE
// ══════════════════════════════════════════════════════════════

const animepahe = new Animepahe();

module.exports = animepahe;

// ══════════════════════════════════════════════════════════════ END: animepahe.js
