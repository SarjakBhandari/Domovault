const jwt = require('jsonwebtoken');
const env = require('../config/env');

// Exactly one algorithm, hard-coded. Every sign/verify call below references
// this constant - it is never read from input, a header, or config, so there
// is no path through this codebase that accepts a second algorithm.
const ALGORITHM = 'HS256';

function signAccessToken(payload) {
  return jwt.sign(payload, env.JWT_ACCESS_SECRET, {
    algorithm: ALGORITHM,
    expiresIn: env.JWT_ACCESS_EXPIRES_IN,
  });
}

function signRefreshToken(payload) {
  return jwt.sign(payload, env.JWT_REFRESH_SECRET, {
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

module.exports = {
  ALGORITHM,
  signAccessToken,
  signRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
};
