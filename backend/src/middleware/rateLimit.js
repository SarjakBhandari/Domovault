const rateLimit = require('express-rate-limit');
const env = require('../config/env');

// General IP-level throttle applied to all API routes.
// Complements per-account lockout in User.failedLoginAttempts:
//   - this catches one IP hammering many accounts
//   - per-account counters catch credential stuffing from many IPs
// Tune via RATE_LIMIT_WINDOW_MS / RATE_LIMIT_MAX env vars.
// Skipped in NODE_ENV=test so integration suites don't trip it.
const generalRateLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  limit: env.RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => env.NODE_ENV === 'test',
  message: { error: 'Too many requests. Please try again later.' },
});

// Tighter limiter for auth endpoints (login, register, password reset).
// Separate from the general limiter so auth paths have stricter defaults
// without affecting normal API traffic. Tune via RATE_LIMIT_AUTH_* env vars.
const authRateLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_AUTH_WINDOW_MS,
  limit: env.RATE_LIMIT_AUTH_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => env.NODE_ENV === 'test',
  message: { error: 'Too many requests. Please try again later.' },
});

module.exports = { authRateLimiter, generalRateLimiter };
