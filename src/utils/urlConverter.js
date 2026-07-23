/*
 * ======= • ======= • ======= • ======= • =======• =======
 * AnimePaheAPI — urlConverter.js
 * Repository: https://github.com/Shineii86/AnimePaheAPI
 *
 * @description
 *   Converts streaming m3u8 URLs into direct download URLs.
 *   Handles the kwik.cx/kwik.si CDN URL format conversion
 *   for quality-specific download links.
 *
 * @exports
 *   UrlConverter (static class)
 *
 * @author  Shinei Nouzen
 * @license MIT
 * ======= • ======= • ======= • ======= • =======• =======
 */

// ══════════════════════════════════════════════════════════════
// URL CONVERTER CLASS
// ══════════════════════════════════════════════════════════════

/**
 * Static class for converting streaming URLs to download URLs.
 *
 * @class UrlConverter
 */
class UrlConverter {

  // ---- FEATURE: Build download URL from m3u8 ----
  /**
   * Converts an m3u8 streaming URL to a direct download URL.
   *
   * @param {string} m3u8Url - The m3u8 streaming URL
   * @param {string} iframeBaseUrl - The iframe domain (e.g., "kwik.cx")
   * @param {Object} metadata - Anime metadata (title, episode, resolution, etc.)
   * @param {string} [filename] - Optional filename override
   * @returns {string|null} Download URL or null if conversion fails
   *
   * @description
   *   The kwik.cx CDN uses a predictable URL pattern:
   *   - Streaming: https://kwik.cx/e/{id}
   *   - Download: https://kwik.cx/f/{id}
   *
   *   This method extracts the embed ID from the m3u8 URL and
   *   constructs the download page URL.
   *
   * @tip The download URL is a page that requires a POST form submission.
   *      Use scrapeDownloadLinks() to get the actual mp4 URL.
   */
  static buildDownloadUrl(m3u8Url, iframeBaseUrl, metadata = {}, filename = null) {
    if (!m3u8Url) return null;

    try {
      // NOTE: Extract the /e/ embed path and convert to /f/ download path
      const urlObj = new URL(m3u8Url);
      let downloadPath = urlObj.pathname;

      // Convert /e/ to /f/ for download page
      if (downloadPath.includes('/e/')) {
        downloadPath = downloadPath.replace('/e/', '/f/');
      }

      const downloadUrl = `${urlObj.protocol}//${urlObj.host}${downloadPath}`;
      return downloadUrl;
    } catch (error) {
      return null;
    }
  }

  // ---- FEATURE: Extract embed ID from URL ----
  /**
   * Extracts the embed session ID from a streaming URL.
   *
   * @param {string} url - Streaming or embed URL
   * @returns {string|null} Embed ID or null if not found
   */
  static extractEmbedId(url) {
    if (!url) return null;
    const match = url.match(/\/e\/([a-zA-Z0-9]+)/);
    return match ? match[1] : null;
  }

  // ---- FEATURE: Build kwik URL from embed ID ----
  /**
   * Constructs a full kwik URL from an embed ID.
   *
   * @param {string} embedId - The embed session ID
   * @param {string} iframeBaseUrl - The iframe domain
   * @returns {string} Full kwik URL
   */
  static buildKwikUrl(embedId, iframeBaseUrl = 'kwik.cx') {
    return `https://${iframeBaseUrl}/e/${embedId}`;
  }
}

// ══════════════════════════════════════════════════════════════
// EXPORTS
// ══════════════════════════════════════════════════════════════

module.exports = UrlConverter;

// ══════════════════════════════════════════════════════════════ END: urlConverter.js
