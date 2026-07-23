/*
 * ======= • ======= • ======= • ======= • =======• =======
 * AnimePaheAPI — creatorInfo.js
 * Repository: https://github.com/Shineii86/AnimePaheAPI
 *
 * @description
 *   Express middleware that injects creator attribution metadata
 *   into every JSON API response. Overrides res.json() to append
 *   author details and a server-side timestamp, unless the
 *   response already contains creator information.
 *
 * @exports
 *   addCreatorInfo — Express middleware function
 *   creatorInfo    — Static creator metadata object
 *
 * @author  Shinei Nouzen
 * @license MIT
 * ======= • ======= • ======= • ======= • =======• =======
 */

// ══════════════════════════════════════════════════════════════
// CREATOR METADATA
// ══════════════════════════════════════════════════════════════

// NOTE: Injected into every response unless `data.creator` already exists
const creatorInfo = {
  creator: "Shinei Nouzen",
  github: "https://github.com/Shineii86",
  telegram: "https://telegram.me/Shineii86",
  message: "Build with ❤️ by Shinei Nouzen",
};

// ══════════════════════════════════════════════════════════════
// MIDDLEWARE
// ══════════════════════════════════════════════════════════════

/**
 * Express middleware that enriches every JSON response with
 * creator attribution and an IN-formatted timestamp.
 *
 * @param {import('express').Request}  req  - Express request object
 * @param {import('express').Response} res  - Express response object
 * @param {import('express').NextFunction} next - Passes control forward
 * @returns {void}
 *
 * @example
 *   app.use(addCreatorInfo);
 *   res.json({ anime: [...] });
 *   // Response includes creator, github, telegram, message, and timestamp
 */
const addCreatorInfo = (req, res, next) => {
  // NOTE: Preserve the original json method so we can wrap it
  const originalJson = res.json.bind(res);

  // NOTE: Monkey-patch res.json to inject creator info
  res.json = (data) => {
    // NOTE: Only inject if data is a plain object and missing creator field
    if (typeof data === "object" && data !== null && !data.creator) {
      data = {
        ...data,
        creator: creatorInfo.creator,
        github: creatorInfo.github,
        telegram: creatorInfo.telegram,
        timestamp: new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata", hour12: true }),
      };
    }
    return originalJson(data);
  };

  next();
};

module.exports = { addCreatorInfo, creatorInfo };

// ══════════════════════════════════════════════════════════════ END: creatorInfo.js
