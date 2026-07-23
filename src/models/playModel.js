/*
 * ======= • ======= • ======= • ======= • =======• =======
 * AnimePaheAPI — playModel.js
 * Repository: https://github.com/Shineii86/AnimePaheAPI
 *
 * @description
 *   Extracts streaming links (m3u8/mp4), resolution options, and
 *   download URLs from animepahe.ch episode pages. Handles multiple
 *   video hosts: turbovidhls (direct MP4), kwik.cx (m3u8 via VM),
 *   and Blogger (iframe URL passthrough).
 *
 * @exports
 *   PlayModel (static class)
 *
 * @author  Shinei Nouzen
 * @license MIT
 * ======= • ======= • ======= • ======= • =======• =======
 */

const cheerio = require('cheerio');
const vm = require('vm');
const { JSDOM } = require('jsdom');
const axios = require('axios');
const config = require('../utils/config');
const { headers } = require('../configs/header.config');
const { CustomError } = require('../helper/error.helper');

// ══════════════════════════════════════════════════════════════
// PLAY MODEL CLASS
// ══════════════════════════════════════════════════════════════

class PlayModel {

  // ---- FEATURE: Get streaming links for an episode by slug ----
  /**
   * Fetches streaming links for a specific episode.
   *
   * @param {string} slug - Episode slug (e.g., "one-piece-episode-1170-english-subbed")
   * @param {boolean} [includeDownloads=true] - Whether to resolve download links
   * @returns {Promise<Object>} Play info with sources and metadata
   *
   * @description
   *   New flow for animepahe.ch (2025+):
   *   1. Fetch episode page HTML (no cookies needed for HTML pages)
   *   2. Extract iframe URL from the page
   *   3. Fetch iframe HTML
   *   4. Detect host (turbovidhls, kwik, blogger, etc.)
   *   5. Extract video URL based on host type
   *   6. Return organized streaming data
   */
  static async getStreamingLinks(slug, includeDownloads = true) {
    if (!slug) throw new CustomError('Episode slug is required', 400);

    // ---- FEATURE: Fetch episode page HTML ----
    const pageUrl = `${config.baseUrl}/${slug}/`;
    let pageHtml;
    try {
      const res = await axios.get(pageUrl, { headers, timeout: 15000 });
      pageHtml = res.data;
    } catch (error) {
      if (error.response?.status === 404) {
        throw new CustomError('Episode not found', 404);
      }
      throw new CustomError('Failed to fetch episode page', 503);
    }

    const $ = cheerio.load(pageHtml);

    // ---- FEATURE: Extract metadata from page ----
    const animeTitle = $('h1').text().trim()
      .replace(/^Watch\s+/i, '')
      .replace(/\s*English Subbed$/i, '')
      .replace(/\s*English Dubbed$/i, '')
      || $('meta[property="og:title"]').attr('content')?.split('|')?.[0]?.trim()
      || slug.replace(/-episode-\d+.*/, '').replace(/-/g, ' ');

    const episodeMatch = slug.match(/episode-(\d+)/i);
    const episodeNumber = episodeMatch ? episodeMatch[1] : '';

    const playInfo = {
      slug,
      anime_title: animeTitle,
      episode: episodeNumber,
      ids: {
        animepahe_id: $('meta[name="id"]').attr('content') || null,
        mal_id: $('meta[name="mal"]').attr('content') || null,
        anilist_id: $('meta[name="anilist"]').attr('content') || null,
      },
      sources: [],
      downloads: [],
    };

    // ---- FEATURE: Extract iframe URL ----
    const iframeSrc = $('iframe').first().attr('src');
    if (!iframeSrc) {
      throw new CustomError('No video source found for this episode', 404);
    }

    // ---- FEATURE: Detect host and extract video URL ----
    const host = new URL(iframeSrc).hostname;
    console.log(`[PlayModel] Detected host: ${host}`);

    let sources = [];

    if (host.includes('turbovid') || host.includes('etvp')) {
      // ---- turbovidhls: direct MP4 extraction ----
      sources = await this.extractTurbovidSources(iframeSrc);
    } else if (host.includes('kwik') || host.includes('kwik')) {
      // ---- kwik.cx: m3u8 extraction via VM sandbox ----
      sources = await this.extractKwikSources(iframeSrc);
    } else if (host.includes('blogger')) {
      // ---- Blogger: return iframe URL (needs Playwright for full extraction) ----
      sources = this.extractBloggerSources(iframeSrc);
    } else {
      // ---- Unknown host: try generic extraction ----
      sources = await this.extractGenericSources(iframeSrc);
    }

    playInfo.sources = sources;

    return playInfo;
  }

  // ---- FEATURE: Extract from turbovidhls/etvp iframes ----
  /**
   * Extracts MP4 video URLs from turbovidhls.com iframes.
   *
   * @param {string} iframeUrl - turbovidhls iframe URL
   * @returns {Promise<Array>} Array of source objects
   *
   * @description
   *   turbovidhls hosts embed the MP4 URL directly in the page HTML
   *   as a JavaScript variable. We extract it via regex.
   */
  static async extractTurbovidSources(iframeUrl) {
    try {
      const res = await axios.get(iframeUrl, { headers, timeout: 10000 });
      const html = res.data;

      // Extract MP4 URL from the page
      const mp4Match = html.match(/https?:\/\/[^\s"']+\.mp4[^\s"']*/i);
      const fileVarMatch = html.match(/(?:var|const|let)\s+(?:urlPlay|file|source|videoUrl)\s*=\s*["']([^"']+)/i);

      const videoUrl = mp4Match?.[0] || fileVarMatch?.[1];

      if (!videoUrl) {
        console.warn('[PlayModel] No MP4 URL found in turbovidhls iframe');
        return [{ url: iframeUrl, isM3U8: false, isEmbed: true, resolution: null }];
      }

      // Extract filename from title
      const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
      const filename = titleMatch?.[1]?.trim() || null;

      return [{
        url: videoUrl,
        isM3U8: false,
        isEmbed: false,
        resolution: 'best',
        filename,
      }];
    } catch (error) {
      console.error('[PlayModel] turbovidhls extraction failed:', error.message);
      return [{ url: iframeUrl, isM3U8: false, isEmbed: true, resolution: null }];
    }
  }

  // ---- FEATURE: Extract from kwik.cx iframes (legacy) ----
  /**
   * Extracts m3u8 URLs from kwik.cx iframes using VM sandbox.
   *
   * @param {string} iframeUrl - kwik.cx iframe URL
   * @returns {Promise<Array>} Array of source objects
   */
  static async extractKwikSources(iframeUrl) {
    try {
      const res = await axios.get(iframeUrl, { headers, timeout: 10000 });
      const html = res.data;

      // Try regex extraction first
      const m3u8Match = html.match(/https?:\/\/[^\s"']+\.m3u8[^\s"']*/i);
      if (m3u8Match) {
        return [{ url: m3u8Match[0], isM3U8: true, isEmbed: false, resolution: 'best' }];
      }

      // Try VM execution with mock Hls/Plyr
      const scripts = [...html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/gi)].map(m => m[1]);
      const captured = new Set();

      const dom = new JSDOM('<!DOCTYPE html><video id="player"></video>');
      const Hls = function() {
        return {
          loadSource: (src) => { if (src?.includes('.m3u8')) captured.add(src); },
          attachMedia: () => {},
          on: () => {},
        };
      };
      Hls.isSupported = () => true;

      const Plyr = function(el, opts) {
        if (opts?.sources) {
          for (const s of opts.sources) {
            if (s?.src?.includes('.m3u8')) captured.add(s.src);
          }
        }
        return { on: () => {} };
      };

      const sandbox = {
        console, window: dom.window, document: dom.window.document,
        navigator: { userAgent: config.userAgent },
        location: { href: iframeUrl },
        Hls, Plyr, setTimeout, clearTimeout,
      };
      vm.createContext(sandbox);

      for (const script of scripts) {
        try { vm.runInContext(script, sandbox, { timeout: 2000 }); } catch (e) {}
        const packedMatch = script.match(/eval\((function[\s\S]*?)\)\s*;?/i);
        if (packedMatch?.[1]) {
          try { vm.runInContext(packedMatch[1], sandbox, { timeout: 1500 }); } catch (e) {}
        }
      }

      if (captured.size) {
        return [{ url: [...captured][0], isM3U8: true, isEmbed: false, resolution: 'best' }];
      }
    } catch (error) {
      console.error('[PlayModel] kwik extraction failed:', error.message);
    }

    return [{ url: iframeUrl, isM3U8: false, isEmbed: true, resolution: null }];
  }

  // ---- FEATURE: Extract from Blogger iframes ----
  /**
   * Returns Blogger iframe URL (video URL requires JS execution).
   *
   * @param {string} iframeUrl - Blogger video.g URL
   * @returns {Array} Array with iframe URL as embed source
   *
   * @description
   *   Blogger video pages are JavaScript apps that load the actual
   *   video URL dynamically. Without Playwright, we return the iframe
   *   URL as an embed source. Clients can use a video proxy or
   *   Playwright-enabled backend to resolve the actual MP4 URL.
   */
  static extractBloggerSources(iframeUrl) {
    return [{
      url: iframeUrl,
      isM3U8: false,
      isEmbed: true,
      resolution: 'best',
      note: 'Blogger video requires JavaScript execution. Use embed URL or enable Playwright.',
    }];
  }

  // ---- FEATURE: Generic iframe extraction ----
  /**
   * Attempts generic video URL extraction from any iframe.
   *
   * @param {string} iframeUrl - Any iframe URL
   * @returns {Promise<Array>} Array of source objects
   */
  static async extractGenericSources(iframeUrl) {
    try {
      const res = await axios.get(iframeUrl, { headers, timeout: 10000 });
      const html = res.data;

      // Try m3u8
      const m3u8 = html.match(/https?:\/\/[^\s"']+\.m3u8[^\s"']*/i);
      if (m3u8) return [{ url: m3u8[0], isM3U8: true, isEmbed: false, resolution: 'best' }];

      // Try MP4
      const mp4 = html.match(/https?:\/\/[^\s"']+\.mp4[^\s"']*/i);
      if (mp4) return [{ url: mp4[0], isM3U8: false, isEmbed: false, resolution: 'best' }];

      // Try source tag
      const source = html.match(/<source[^>]+src=["']([^"']+)/i);
      if (source) return [{ url: source[1], isM3U8: false, isEmbed: false, resolution: 'best' }];
    } catch (error) {
      console.error('[PlayModel] Generic extraction failed:', error.message);
    }

    return [{ url: iframeUrl, isM3U8: false, isEmbed: true, resolution: null }];
  }
}

// ══════════════════════════════════════════════════════════════
// EXPORTS
// ══════════════════════════════════════════════════════════════

module.exports = PlayModel;

// ══════════════════════════════════════════════════════════════ END: playModel.js
