const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const env = require('../config/env');

// Exactly one algorithm, hard-coded. Every sign/verify call below references
// this constant - it is never read from input, a header, or config, so there
// is no path through this codebase that accepts a second algorithm.
const ALGORITHM = 'HS256';

// Every token gets a random jti, distinct from the rest of the claims. Two
// tokens issued with identical claims in the same second would otherwise be
// byte-for-byte identical - this also gives every issued token a stable,
// unique identifier for future revocation/audit-log correlation.
function withJti(payload) {
  return { ...payload, jti: crypto.randomUUID() };
}

function signAccessToken(payload) {
  return jwt.sign(withJti(payload), env.JWT_ACCESS_SECRET, {
    algorithm: ALGORITHM,
    expiresIn: env.JWT_ACCESS_EXPIRES_IN,
  });
}

function signRefreshToken(payload) {
  return jwt.sign(withJti(payload), env.JWT_REFRESH_SECRET, {
    algorithm: ALGORITHM,
    expiresIn: env.JWT_REFRESH_EXPIRES_IN,
  });
}

// Always jwt.verify() with an explicit algorithms allow-list, never
// jwt.decode(). A token signed with any other algorithm, an unsigned
// "alg: none" token, or a tampered signature all throw here and are rejected.
function verifyAccessToken(token) {
  return jwt.verify(token, env.JWT_ACCESS_SECRET, { algorithms: [ALGORITHM] });
}

function verifyRefreshToken(token) {
  return jwt.verify(token, env.JWT_REFRESH_SECRET, { algorithms: [ALGORITHM] });
}

// Issued after password is verified but before MFA is, on a separate secret
// with a very short expiry. Carries no role/permissions - it is only ever
// accepted by POST /api/auth/mfa/verify, never by requireAuth.
function signMfaChallengeToken(payload) {
  return jwt.sign(withJti(payload), env.JWT_MFA_SECRET, {
    algorithm: ALGORITHM,
    expiresIn: env.JWT_MFA_EXPIRES_IN,
  });
}

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
