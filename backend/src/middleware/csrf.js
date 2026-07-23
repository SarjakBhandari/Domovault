const crypto = require('crypto');
const env = require('../config/env');

// The name of the request header the client must send with every mutating request.
const HEADER_NAME = 'x-csrf-token';

// GET, HEAD, and OPTIONS cannot change server state so they are exempt from CSRF checks.
// POST, PUT, PATCH, DELETE all require a valid token.
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

// The dot is used to separate the random token from its HMAC signature when
// both are packed into a single header value: "randomtoken.hmachex"
const SEP = '.';

// CSRF tokens are signed with a dedicated secret, not the JWT secret.
// This means rotating JWT secrets never breaks outstanding CSRF tokens,
// and a leaked JWT key cannot be used to forge a CSRF token.
function sign(token) {
  return crypto
    .createHmac('sha256', env.CSRF_SECRET) // CSRF_SECRET is separate from JWT_ACCESS_SECRET
    .update(token)                          // sign the raw random token
    .digest('hex');                         // return the signature as a hex string
}

function issueCsrfToken(req, res) {
  // Generate 32 random bytes (256 bits of entropy) - impossible to guess
  const token = crypto.randomBytes(32).toString('hex');
  // Send "token.signature" back to the client. The client stores this and
  // re-sends the full string in the x-csrf-token header on every mutating request.
  res.json({ csrfToken: token + SEP + sign(token) });
}

function verifyCsrfToken(req, res, next) {
  // Safe methods (GET etc.) are read-only - no state change, no CSRF risk
  if (SAFE_METHODS.has(req.method)) return next();

  // Read the x-csrf-token header that the client must include
  const header = req.get(HEADER_NAME) || '';

  // The header value should be "token.signature" - find the separator
  const dot = header.lastIndexOf(SEP);
  if (dot === -1) {
    // No dot means the client did not send a token at all - block the request
    return res.status(403).json({ error: 'Missing CSRF token' });
  }

  // Split the header back into its two parts
  const token = header.slice(0, dot);    // the original random token
  const sig = header.slice(dot + 1);    // the signature the client claims is valid

  // Re-compute what the correct signature should be using our secret key
  const expected = sign(token);

  let valid = false;
  try {
    // timingSafeEqual compares both buffers in constant time.
    // A regular string comparison (===) leaks information through timing:
    // it stops at the first mismatch, letting an attacker measure how many
    // characters matched. timingSafeEqual always takes the same amount of time.
    valid = crypto.timingSafeEqual(
      Buffer.from(sig, 'hex'),       // what the client sent
      Buffer.from(expected, 'hex')   // what we calculated
    );
  } catch {
    // Buffer lengths differ (malformed hex) - treat as invalid, never crash
    valid = false;
  }

  if (!valid) {
    // Signature does not match - this is either a cross-site request or a tampered token
    return res.status(403).json({ error: 'Invalid CSRF token' });
  }

  // Token is genuine - allow the request to continue to the controller
  next();
}

module.exports = { issueCsrfToken, verifyCsrfToken };
