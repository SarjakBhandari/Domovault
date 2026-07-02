const rateLimit = require('express-rate-limit');
const env = require('../config/env');

// Network-level throttle, independent of the per-account lockout in
// User.failedLoginAttempts. This catches a single IP hammering many
// different accounts; the per-account counter catches credential stuffing
// against one account from many IPs. Neither alone is sufficient.
//
// Skipped only in NODE_ENV=test: the integration suite drives dozens of
// requests from one loopback IP to exercise account-level lockout/CAPTCHA
// precisely, and would otherwise trip this IP-level limiter first. Never
// skipped in development or production.
const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => env.NODE_ENV === 'test',
  message: { error: 'Too many requests. Please try again later.' },
});

module.exports = { authRateLimiter };
