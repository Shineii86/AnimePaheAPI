/*
 * ======= • ======= • ======= • ======= • =======• =======
 * AnimePaheAPI — browser.js
 * Repository: https://github.com/Shineii86/AnimePaheAPI
 *
 * @description
 *   Playwright browser launcher with stealth capabilities.
 *   Automatically selects @sparticuz/chromium for serverless
 *   environments (Vercel/Netlify/AWS Lambda) and regular
 *   Playwright for local development.
 *
 * @exports
 *   launchBrowser
 *
 * @author  Shinei Nouzen
 * @license MIT
 * ======= • ======= • ======= • ======= • =======• =======
 */

const os = require('os');
const { existsSync } = require('fs');

let chromiumBinary = null;
let chromium = null;
let useServerlessChromium = false;

// ══════════════════════════════════════════════════════════════
// CHROMIUM LOADING
// ══════════════════════════════════════════════════════════════

// ---- FEATURE: Auto-detect serverless vs local environment ----
/**
 * Loads the appropriate Chromium binary and Playwright module.
 *
 * @description
 *   On Linux (serverless), uses @sparticuz/chromium for a lightweight
 *   headless browser. On other OS (local dev), falls back to the
 *   full Playwright package. This ensures the same code works in
 *   both environments without manual configuration.
 */
// NOTE: Chromium is lazy-loaded inside launchBrowser() to avoid
// crashing on unsupported platforms (e.g. Android) at require-time.
// The server starts fine without Playwright; it only fails when
// someone actually calls launchBrowser().

// ══════════════════════════════════════════════════════════════
// BROWSER LAUNCHER
// ══════════════════════════════════════════════════════════════

// ---- FEATURE: Stealth Playwright browser launch ----
/**
 * Launches a Chromium browser with anti-detection measures.
 *
 * @description
 *   Configures the browser with stealth flags to avoid detection
 *   by Cloudflare and other anti-bot systems. Automatically applies
 *   serverless optimizations when running in Vercel/Netlify/AWS.
 *
 * @returns {Promise<Browser>} Playwright Browser instance
 *
 * @tip The --disable-blink-features=AutomationControlled flag is
 *      critical for bypassing navigator.webdriver detection.
 *
 * @example
 *   const browser = await launchBrowser();
 *   const page = await browser.newPage();
 *   await page.goto('https://animepahe.ch');
 */
async function launchBrowser() {
  // ---- Lazy-load Chromium if not already loaded ----
  if (!chromium) {
    try {
      chromiumBinary = require('@sparticuz/chromium');
      chromium = require('playwright-core').chromium;
      if (os.platform() === 'linux') useServerlessChromium = true;
    } catch (e) {
      try {
        chromium = require('playwright').chromium;
      } catch (e2) {
        throw new Error('[Browser] Playwright not available on this platform. Install playwright or use got-scraping only.');
      }
    }
  }

  const isServerless = !!(process.env.VERCEL || process.env.NETLIFY || process.env.AWS_LAMBDA_FUNCTION_NAME);

  // ---- Base Chrome flags for all environments ----
  const baseArgs = [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    '--disable-blink-features=AutomationControlled',
    '--disable-gpu',
    '--disable-background-networking',
    '--disable-default-apps',
    '--disable-extensions',
    '--disable-infobars',
    '--disable-notifications',
    '--disable-offline-sync',
    '--disable-sync',
    '--disable-translate',
    '--no-first-run',
    '--no-zygote',
  ];

  // ---- Serverless-specific optimizations ----
  const serverlessArgs = [
    '--disable-background-timer-throttling',
    '--disable-backgrounding-occluded-windows',
    '--disable-renderer-backgrounding',
    '--disable-features=TranslateUI',
    '--disable-ipc-flooding-protection',
    '--disable-hang-monitor',
    '--disable-prompt-on-repost',
    '--disable-domain-reliability',
    '--disable-component-extensions-with-background-pages',
    '--memory-pressure-off',
    '--max_old_space_size=4096',
  ];

  const headless = isServerless ? true : (process.env.CHROME_HEADLESS === 'true');

  const launchOptions = {
    headless,
    args: isServerless ? [...baseArgs, ...serverlessArgs] : baseArgs,
    timeout: isServerless ? 30000 : 60000,
  };

  // NOTE: Add user agent to launch args for extra realism
  launchOptions.args.push(
    '--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  );

  // ---- FEATURE: Serverless Chromium binary path ----
  if (useServerlessChromium && chromiumBinary) {
    try {
      const executablePath = await chromiumBinary.executablePath();
      if (existsSync(executablePath)) {
        launchOptions.executablePath = executablePath;
        launchOptions.args = [...chromiumBinary.args, ...launchOptions.args];
      }
    } catch (error) {
      console.error('[Browser] Serverless Chromium setup error:', error.message);
    }
  }

  try {
    const browser = await chromium.launch(launchOptions);
    return browser;
  } catch (error) {
    // NOTE: Fallback with minimal args if full config fails
    console.error('[Browser] Launch failed, trying fallback:', error.message);
    const fallbackOptions = {
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    };
    if (useServerlessChromium && chromiumBinary) {
      try {
        fallbackOptions.executablePath = await chromiumBinary.executablePath();
      } catch (e) {}
    }
    return await chromium.launch(fallbackOptions);
  }
}

// ══════════════════════════════════════════════════════════════
// EXPORTS
// ══════════════════════════════════════════════════════════════

module.exports = { launchBrowser };

// ══════════════════════════════════════════════════════════════ END: browser.js
