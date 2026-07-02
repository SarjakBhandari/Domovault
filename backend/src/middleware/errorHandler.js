const env = require('../config/env');

// Generic error handler: production responses never leak stack traces or
// internal error details (information disclosure prevention).
function errorHandler(err, req, res, next) {
  const status = err.status || 500;

  if (env.NODE_ENV !== 'production') {
    console.error(err);
  }

  res.status(status).json({
    error: status === 500 ? 'Internal server error' : err.message,
  });
}

module.exports = errorHandler;
