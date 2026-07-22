const crypto = require('crypto');
const env = require('../config/env');

const HEADER_NAME = 'x-csrf-token';
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
const SEP = '.';

function sign(token) {
  return crypto
    .createHmac('sha256', env.JWT_ACCESS_SECRET)
    .update(token)
    .digest('hex');
}

function issueCsrfToken(req, res) {
  const token = crypto.randomBytes(32).toString('hex');
  res.json({ csrfToken: token + SEP + sign(token) });
}

function verifyCsrfToken(req, res, next) {
  if (SAFE_METHODS.has(req.method)) return next();

  const header = req.get(HEADER_NAME) || '';
  const dot = header.lastIndexOf(SEP);
  if (dot === -1) {
    return res.status(403).json({ error: 'Missing CSRF token' });
  }

  const token = header.slice(0, dot);
  const sig = header.slice(dot + 1);
  const expected = sign(token);

  let valid = false;
  try {
    valid = crypto.timingSafeEqual(
      Buffer.from(sig, 'hex'),
      Buffer.from(expected, 'hex')
    );
  } catch {
    valid = false;
  }

  if (!valid) {
    return res.status(403).json({ error: 'Invalid CSRF token' });
  }

  next();
}

module.exports = { issueCsrfToken, verifyCsrfToken };
