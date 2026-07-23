/*
 * ======= • ======= • ======= • ======= • =======• =======
 * AnimePaheAPI — jsParser.js
 * Repository: https://github.com/Shineii86/AnimePaheAPI
 *
 * @description
 *   Parses JavaScript variables from HTML page source.
 *   Extracts session IDs, provider names, and other values
 *   embedded in <script> tags by animepahe.ch.
 *
 * @exports
 *   getJsVariable
 *
 * @author  Shinei Nouzen
 * @license MIT
 * ======= • ======= • ======= • ======= • =======• =======
 */

// ══════════════════════════════════════════════════════════════
// JS VARIABLE PARSER
// ══════════════════════════════════════════════════════════════

// ---- FEATURE: Extract JavaScript variable from HTML ----
/**
 * Extracts a JavaScript variable value from inline script tags.
 *
 * @param {string} html - Raw HTML page source
 * @param {string} varName - Variable name to extract (e.g., "session", "provider")
 * @returns {string|null} Variable value or null if not found
 *
 * @description
 *   Searches for patterns like `var session = 'abc123';` or
 *   `const provider = "kwik";` in the page's inline scripts.
 *   Uses regex matching for speed — does not execute the scripts.
 *
 * @tip Works for both single-quoted and double-quoted string values.
 *
 * @example
 *   const html = '<script>var session = "abc123";</script>';
 *   getJsVariable(html, 'session'); // => "abc123"
 */
function getJsVariable(html, varName) {
  if (!html || !varName) return null;

  // NOTE: Match patterns like: var session = 'value'; const provider = "value";
  const patterns = [
    new RegExp(`var\\s+${varName}\\s*=\\s*['"]([^'"]+)['"]`, 'i'),
    new RegExp(`const\\s+${varName}\\s*=\\s*['"]([^'"]+)['"]`, 'i'),
    new RegExp(`let\\s+${varName}\\s*=\\s*['"]([^'"]+)['"]`, 'i'),
    new RegExp(`${varName}\\s*:\\s*['"]([^'"]+)['"]`, 'i'),
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match && match[1]) {
      return match[1];
    }
  }

  return null;
}

// ══════════════════════════════════════════════════════════════
// EXPORTS
// ══════════════════════════════════════════════════════════════

module.exports = { getJsVariable };

// ══════════════════════════════════════════════════════════════ END: jsParser.js
