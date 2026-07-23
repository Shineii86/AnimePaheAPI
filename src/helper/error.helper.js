/*
 * ======= • ======= • ======= • ======= • =======• =======
 * AnimePaheAPI — error.helper.js
 * Repository: https://github.com/Shineii86/AnimePaheAPI
 *
 * @description
 *   Custom error class and Express error handler middleware.
 *   Provides consistent error responses across all API endpoints.
 *
 * @exports
 *   CustomError, errorHandler
 *
 * @author  Shinei Nouzen
 * @license MIT
 * ======= • ======= • ======= • ======= • =======• =======
 */

// ══════════════════════════════════════════════════════════════
// CUSTOM ERROR CLASS
// ══════════════════════════════════════════════════════════════

// ---- FEATURE: Custom error with HTTP status code ----
/**
 * Custom error class that includes an HTTP status code.
 *
 * @param {string} message - Error message
 * @param {number} [statusCode=500] - HTTP status code
 *
 * @example
 *   throw new CustomError('Anime not found', 404);
 */
class CustomError extends Error {
  constructor(message, statusCode = 500) {
    super(message);
    this.statusCode = statusCode;
  }
}

// ══════════════════════════════════════════════════════════════
// ERROR HANDLER MIDDLEWARE
// ══════════════════════════════════════════════════════════════

// ---- FEATURE: Global Express error handler ----
/**
 * Express error handler middleware.
 *
 * @description
 *   Catches all unhandled errors and returns a consistent
 *   JSON error response. Logs errors to console for debugging.
 *   Includes stack trace in development mode only.
 */
const errorHandler = (err, req, res, next) => {
  const statusCode = err.response?.status || err.statusCode || 500;
  const message = err.message || 'Something went wrong';

  if (statusCode !== 404 || !message.includes('Route not found')) {
    console.error(`[Error] ${message} (${statusCode})`);
  }

  const response = {
    success: false,
    status: statusCode,
    message,
  };

  if (process.env.NODE_ENV === 'development') {
    response.stack = err.stack;
  }

  res.status(statusCode).json(response);
};

// ══════════════════════════════════════════════════════════════
// EXPORTS
// ══════════════════════════════════════════════════════════════

module.exports = { CustomError, errorHandler };

// ══════════════════════════════════════════════════════════════ END: error.helper.js
