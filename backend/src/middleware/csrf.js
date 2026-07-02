const crypto = require('crypto');
const env = require('../config/env');

const COOKIE_NAME = 'csrfToken';
const HEADER_NAME = 'x-csrf-token';
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

// Double-submit cookie pattern, applied to every mutating route including
// login/register/refresh/logout - not just the "later" forms. A cross-site
// page can make the browser send the cookie automatically, but it cannot
// read the cookie's value (blocked by same-origin policy) to put it in the
// X-CSRF-Token header, so a forged request fails this check even though the
// browser attaches the session cookie.
function issueCsrfToken(req, res) {
  const token = crypto.randomBytes(32).toString('hex');

  res.cookie(COOKIE_NAME, token, {
    httpOnly: false,
    secure: env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 60 * 60 * 1000,
  });

  res.json({ csrfToken: token });
}

function verifyCsrfToken(req, res, next) {
  if (SAFE_METHODS.has(req.method)) {
    return next();
  }

  const cookieToken = req.cookies?.[COOKIE_NAME];
  const headerToken = req.get(HEADER_NAME);

  if (!cookieToken || !headerToken || cookieToken !== headerToken) {
    return res.status(403).json({ error: 'Invalid or missing CSRF token' });
  }

  next();
}

module.exports = { issueCsrfToken, verifyCsrfToken, COOKIE_NAME, HEADER_NAME };
