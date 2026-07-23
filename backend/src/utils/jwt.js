const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const env = require('../config/env');

// HS256 is the only algorithm this application ever uses.
// It is a constant here so there is no way for a request, config file, or
// environment variable to change it to something else at runtime.
// This closes the "algorithm confusion" attack where an attacker tricks the
// server into accepting a token signed with alg:none or a weaker algorithm.
const ALGORITHM = 'HS256';

// Every token we issue gets a unique random ID (jti = JWT ID).
// Without this, two tokens issued for the same user at the same moment would
// be byte-for-byte identical, which makes them harder to track individually
// and harder to revoke one without revoking the other.
function withJti(payload) {
  return { ...payload, jti: crypto.randomUUID() }; // attach a fresh UUID to every token
}

// Signs a short-lived access token (default 15 minutes).
// The access token is what the client sends in the Authorization header
// on every API request to prove who they are.
function signAccessToken(payload) {
  return jwt.sign(withJti(payload), env.JWT_ACCESS_SECRET, {
    algorithm: ALGORITHM,          // pin the algorithm so it cannot be overridden
    expiresIn: env.JWT_ACCESS_EXPIRES_IN, // short lifetime limits damage if stolen
  });
}

// Signs a long-lived refresh token (default 30 days).
// The refresh token lives in an httpOnly cookie and is only used to
// get a new access token - it never grants access to API routes directly.
function signRefreshToken(payload) {
  return jwt.sign(withJti(payload), env.JWT_REFRESH_SECRET, {
    algorithm: ALGORITHM,                  // separate secret from access token
    expiresIn: env.JWT_REFRESH_EXPIRES_IN, // longer lifetime is OK because it rotates on every use
  });
}

// Verifies an access token and returns its payload (sub, role, jti, exp).
// Using jwt.verify() instead of jwt.decode() is critical - verify() checks
// the signature and expiry. decode() skips that and would accept any token.
// The algorithms array is explicit - if omitted, the library trusts the
// token's own "alg" header, which an attacker could set to "none".
function verifyAccessToken(token) {
  return jwt.verify(token, env.JWT_ACCESS_SECRET, { algorithms: [ALGORITHM] });
}

// Same as verifyAccessToken but uses the refresh secret.
// A refresh token cannot be used where an access token is expected and vice versa
// because they are signed with different keys.
function verifyRefreshToken(token) {
  return jwt.verify(token, env.JWT_REFRESH_SECRET, { algorithms: [ALGORITHM] });
}

// The MFA challenge token is a special intermediate token issued after the
// password check passes but before the TOTP code is verified.
// It is signed with a third separate secret (JWT_MFA_SECRET) so that:
// - A stolen MFA token cannot be used as a session (requireAuth rejects it)
// - A stolen access token cannot be used to skip MFA
// It has a very short expiry (default 5 minutes) because it is only needed
// for the brief window while the user types their TOTP code.
function signMfaChallengeToken(payload) {
  return jwt.sign(withJti(payload), env.JWT_MFA_SECRET, {
    algorithm: ALGORITHM,
    expiresIn: env.JWT_MFA_EXPIRES_IN,
  });
}

// Verifies an MFA challenge token. Only the /api/auth/mfa/verify route calls this.
function verifyMfaChallengeToken(token) {
  return jwt.verify(token, env.JWT_MFA_SECRET, { algorithms: [ALGORITHM] });
}

module.exports = {
  ALGORITHM,
  signAccessToken,
  signRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  signMfaChallengeToken,
  verifyMfaChallengeToken,
};
