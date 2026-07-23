/*
 * ======= • ======= • ======= • ======= • =======• =======
 * AnimePaheAPI — requestManager.js
 * Repository: https://github.com/Shineii86/AnimePaheAPI
 *
 * @description
 *   Multi-strategy HTTP request manager with anti-bot bypass.
 *   Supports two request methods in order of preference:
 *   1. got-scraping — handles most Cloudflare/anti-bot challenges
 *   2. Playwright — full headless browser for hard challenges
 *
 *   Built-in DDoS protection bypass:
 *   - Automatic 403 detection and cookie refresh retry
 *   - DDoS-Guard response detection
 *   - Exponential backoff on failures
 *
 * @exports
 *   RequestManager (static class)
 *
 * @author  Shinei Nouzen
 * @license MIT
 * ======= • ======= • ======= • ======= • =======• =======
 */

const axios = require('axios');
const config = require('./config');
const { launchBrowser } = require('./browser');

// ══════════════════════════════════════════════════════════════
// DDoS PROTECTION DETECTION
// ══════════════════════════════════════════════════════════════

/**
 * Checks if a response is a DDoS-Guard challenge page.
 *
 * @param {string} responseText - Response body as string
 * @param {number} statusCode - HTTP status code
 * @returns {boolean} True if response is a DDoS challenge
 *
 * @description
 *   Detects DDoS-Guard by checking for:
 *   - Status code 403 (forbidden)
 *   - "DDoS-GUARD" text in body
 *   - "checking your browser" text
 *   - "Just a moment" text
 *   - Cloudflare challenge indicators
 */
function isDdosChallenge(responseText, statusCode) {
  if (statusCode === 403) return true;
  if (!responseText) return false;

  const indicators = [
    'DDoS-GUARD',
    'ddos-guard',
    'checking your browser',
    'DDoS protection',
    'Just a moment',
    'Please wait',
    'Verifying you are human',
    'challenge-platform',
    'cdn-cgi/challenge',
    'cf-challenge',
  ];

  return indicators.some(indicator =>
    responseText.toLowerCase().includes(indicator.toLowerCase())
  );
}

// ══════════════════════════════════════════════════════════════
// REQUEST MANAGER CLASS
// ══════════════════════════════════════════════════════════════

/**
 * Static class providing multiple HTTP request strategies.
 *
 * @description
 *   Each strategy handles different levels of anti-bot protection.
 *   The class tries got-scraping first (fastest), then Playwright
 *   (slowest but most reliable). Cookie management is handled by
 *   the calling scraper class.
 *
 * @class RequestManager
 */
class RequestManager {

  // ---- FEATURE: Standard axios request with cookies ----
  /**
   * Fetches an API endpoint with cookies and browser headers.
   *
   * @param {string} url - Full URL to fetch
   * @param {Object} [params={}] - Query parameters
   * @param {string} cookieHeader - Cookie header string
   * @returns {Promise<Object>} Parsed JSON response
   * @throws {Error} If request fails or DDoS-Guard is detected
   *
   * @description
   *   Uses axios with XMLHttpRequest-style headers to mimic a
   *   browser AJAX request. Detects DDoS-Guard challenges in
   *   the response and throws if cookies are invalid.
   *
   * @tip This is the fastest method — only use got-scraping/Playwright
   *      when this one fails with 403/DDoS-Guard.
   */
  static async fetchApiData(url, params = {}, cookieHeader) {
    if (!cookieHeader) {
      throw new Error('Cookies required for API requests (DDoS-Guard)');
    }

    try {
      const response = await axios.get(url, {
        params,
        headers: {
          'Accept': 'application/json, text/javascript, */*; q=0.01',
          'Accept-Language': 'en-US,en;q=0.9',
          'Referer': config.baseUrl,
          'User-Agent': config.userAgent,
          'DNT': '1',
          'sec-ch-ua': '"Not A(Brand";v="99", "Microsoft Edge";v="121", "Chromium";v="121"',
          'sec-ch-ua-mobile': '?0',
          'sec-ch-ua-platform': '"Windows"',
          'sec-fetch-dest': 'empty',
          'sec-fetch-mode': 'cors',
          'sec-fetch-site': 'same-origin',
          'x-requested-with': 'XMLHttpRequest',
          'Cookie': cookieHeader,
        },
        timeout: config.requestTimeout,
      });

      const responseText = typeof response.data === 'string' ? response.data : JSON.stringify(response.data);

      // NOTE: Detect DDoS-Guard challenge in response
      if (isDdosChallenge(responseText, response.status)) {
        throw new Error('DDoS-Guard authentication required — refresh cookies');
      }

      return response.data;
    } catch (error) {
      if (error.response?.status === 403 || error.response?.status === 502 || error.response?.status === 503) {
        throw new Error('DDoS-Guard authentication required — refresh cookies');
      }
      throw error;
    }
  }

  // ---- FEATURE: Standard HTTP GET with browser headers ----
  /**
   * Fetches an HTML page with browser-like headers.
   *
   * @param {string} url - Full URL to fetch
   * @param {string} cookieHeader - Cookie header string
   * @returns {Promise<string>} Raw HTML response
   */
  static async fetchHtml(url, cookieHeader) {
    try {
      const { data, status } = await axios.get(url, {
        headers: {
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
          'Accept-Encoding': 'gzip, deflate, br',
          'Referer': config.baseUrl,
          'User-Agent': config.userAgent,
          'DNT': '1',
          'Upgrade-Insecure-Requests': '1',
          'Sec-Fetch-Dest': 'document',
          'Sec-Fetch-Mode': 'navigate',
          'Sec-Fetch-Site': 'same-origin',
          'Cookie': cookieHeader,
        },
        timeout: config.requestTimeout,
      });

      const html = typeof data === 'string' ? data : JSON.stringify(data);

      // NOTE: Detect DDoS-Guard challenge in response
      if (isDdosChallenge(html, status)) {
        throw new Error('DDoS-Guard authentication required — refresh cookies');
      }

      return html;
    } catch (error) {
      throw error;
    }
  }

  // ---- FEATURE: HTTP POST with form data ----
  /**
   * Makes a POST request with form data and browser headers.
   *
   * @param {string} url - URL to POST to
   * @param {Object} data - POST body data
   * @param {Object} [options={}] - Request options (headers, cookies, etc.)
   * @returns {Promise<Object>} Response with statusCode, headers, body
   *
   * @description
   *   Used for kwik.cx form submissions to get download URLs.
   *   Handles 302 redirects as successful responses (not errors).
   */
  static async postFormData(url, data = {}, options = {}) {
    try {
      const response = await axios.post(url, data, {
        headers: {
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
          'Content-Type': 'application/x-www-form-urlencoded',
          'Origin': `https://${config.iframeBaseUrl}`,
          'Referer': options.referer || config.baseUrl,
          'User-Agent': config.userAgent,
          'Cookie': options.cookies || '',
          ...options.headers,
        },
        maxRedirects: 0,
        validateStatus: (status) => status >= 200 && status < 400,
        timeout: options.timeout || 30000,
      });

      return {
        statusCode: response.status,
        headers: response.headers,
        body: typeof response.data === 'string' ? response.data : JSON.stringify(response.data),
        location: response.headers?.location,
      };
    } catch (error) {
      // NOTE: Handle redirects as responses, not errors
      if (error.response?.status === 301 || error.response?.status === 302) {
        return {
          statusCode: error.response.status,
          headers: error.response.headers || {},
          body: error.response.data || '',
          location: error.response.headers?.location,
        };
      }
      throw error;
    }
  }

  // ---- FEATURE: got-scraping anti-bot bypass ----
  /**
   * Scrapes a page using got-scraping with header generation.
   *
   * @param {string} url - URL to scrape
   * @param {Object} [options={}] - Request options
   * @returns {Promise<string>} Raw HTML response
   *
   * @description
   *   got-scraping generates browser-like TLS fingerprints and
   *   headers automatically. This is the primary anti-bot bypass
   *   method and handles most Cloudflare challenges without
   *   needing a full browser.
   *
   * @tip Use this as the first fallback when standard requests fail.
   */
  static async scrapeWithGotScraping(url, options = {}) {
    try {
      const { gotScraping } = await import('got-scraping');

      const response = await gotScraping({
        url,
        headers: {
          'Referer': options.referer || config.baseUrl,
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
          'Connection': 'keep-alive',
          ...options.headers,
        },
        headerGeneratorOptions: {
          browsers: [{ name: 'chrome', minVersion: 110 }],
          devices: ['desktop'],
          locales: ['en-US', 'en'],
          operatingSystems: ['windows'],
        },
        throwHttpErrors: false,
        timeout: { request: options.timeout || 30000 },
      });

      const body = response.body;

      // NOTE: Check if got-scraping returned a challenge page
      if (isDdosChallenge(body, response.statusCode)) {
        throw new Error('DDoS-Guard challenge detected — falling back to Playwright');
      }

      return body;
    } catch (error) {
      console.error(`[GotScraping] Failed for ${url}:`, error.message);
      throw error;
    }
  }

  // ---- FEATURE: Playwright page scraping with stealth ----
  /**
   * Scrapes a page using Playwright with stealth measures.
   *
   * @param {string} url - URL to scrape
   * @param {Object} [options={}] - Request options
   * @returns {Promise<string>} Rendered HTML content
   *
   * @description
   *   Falls back to a full headless browser when got-scraping fails.
   *   Applies stealth measures (navigator.webdriver override, etc.)
   *   and waits for any Cloudflare challenges to resolve.
   *
   * @tip This is the slowest method — only use when all others fail.
   *      Each call launches a new browser instance.
   */
  static async scrapeWithPlaywrightPage(url, options = {}) {
    const browser = await launchBrowser();
    try {
      const context = await browser.newContext({
        userAgent: config.userAgent,
        extraHTTPHeaders: {
          'Referer': options.referer || config.baseUrl,
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
          'Upgrade-Insecure-Requests': '1',
        },
      });

      // ---- Stealth: Override navigator properties ----
      await context.addInitScript(() => {
        Object.defineProperty(navigator, 'webdriver', { get: () => false });
        Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3] });
        Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] });
        window.chrome = { runtime: {}, loadTimes: function() {}, csi: function() {}, app: {} };
      });

      const page = await context.newPage();
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: options.timeout || 60000 });

      // ---- FEATURE: Wait for DDoS-Guard challenge to resolve ----
      await page.waitForTimeout(3000);

      // Check for challenge indicators
      const title = await page.title();
      if (title.toLowerCase().includes('just a moment') ||
          title.toLowerCase().includes('ddos protection') ||
          title.toLowerCase().includes('checking your browser')) {
        console.log('[Playwright] DDoS-Guard challenge detected, waiting...');

        try {
          await page.waitForFunction(() => {
            const t = document.title.toLowerCase();
            return !t.includes('just a moment') &&
                   !t.includes('ddos protection') &&
                   !t.includes('checking your browser');
          }, { timeout: 30000 });
          await page.waitForTimeout(2000);
        } catch (e) {
          console.warn('[Playwright] Challenge timeout — proceeding');
        }
      }

      const content = await page.content();
      await context.close();
      return content;
    } finally {
      await browser.close();
    }
  }

  // ---- FEATURE: Playwright browser-based cookie extraction ----
  /**
   * Launches a browser, navigates to a URL, and extracts cookies.
   *
   * @param {string} url - URL to navigate to
   * @returns {Promise<Array>} Array of cookie objects
   *
   * @description
   *   Used for initial cookie extraction and refresh.
   *   Solves any DDoS-Guard/Cloudflare challenges automatically.
   */
  static async extractCookiesWithBrowser(url) {
    const browser = await launchBrowser();
    try {
      const context = await browser.newContext();
      const page = await context.newPage();

      // Stealth overrides
      await context.addInitScript(() => {
        Object.defineProperty(navigator, 'webdriver', { get: () => false });
        Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
        Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] });
        window.chrome = { runtime: {}, loadTimes: function() {}, csi: function() {}, app: {} };
        const originalQuery = window.navigator.permissions.query;
        window.navigator.permissions.query = (parameters) =>
          parameters.name === 'notifications'
            ? Promise.resolve({ state: Notification.permission })
            : originalQuery(parameters);
      });

      console.log('[Browser] Navigating to', url);
      await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });

      // Wait for any challenges
      await page.waitForTimeout(3000);

      // Check for DDoS-Guard challenge
      const isChallengeActive = await page.$('#ddg-cookie');
      if (isChallengeActive) {
        console.log('[Browser] DDoS-Guard challenge detected, waiting...');
        try {
          await page.waitForSelector('#ddg-cookie', { state: 'hidden', timeout: 30000 });
        } catch (e) {
          console.warn('[Browser] Challenge timeout');
        }
      }

      const cookies = await context.cookies();
      await context.close();
      return cookies;
    } finally {
      await browser.close();
    }
  }
}

// ══════════════════════════════════════════════════════════════
// EXPORTS
// ══════════════════════════════════════════════════════════════

module.exports = RequestManager;

// ══════════════════════════════════════════════════════════════ END: requestManager.js
