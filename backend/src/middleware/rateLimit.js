const rateLimit = require('express-rate-limit');

// Network-level throttle, independent of the per-account lockout in
// User.failedLoginAttempts. This catches a single IP hammering many
// different accounts; the per-account counter catches credential stuffing
// against one account from many IPs. Neither alone is sufficient.
const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Please try again later.' },
});

module.exports = { authRateLimiter };
