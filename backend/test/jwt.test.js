const test = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');

// Env vars are set directly (not loaded from a .env file) so this test is
// deterministic in CI and doesn't depend on a local, gitignored .env.
process.env.NODE_ENV = 'test';
process.env.PORT = '4000';
process.env.MONGODB_URI = 'mongodb://127.0.0.1:27017/domovault-test';
process.env.CORS_ORIGIN = 'http://localhost:3000';
process.env.JWT_ALGORITHM = 'HS256';
process.env.JWT_ACCESS_SECRET = 'test-access-secret-at-least-32-bytes-long';
process.env.JWT_ACCESS_EXPIRES_IN = '15m';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-at-least-32-bytes-long';
process.env.JWT_REFRESH_EXPIRES_IN = '15d';
process.env.PII_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString('base64');

const { verifyAccessToken, signAccessToken, ALGORITHM } = require('../src/utils/jwt');

test('verifyAccessToken accepts a token signed with the configured algorithm', () => {
  const token = signAccessToken({ sub: 'user-1' });
  const payload = verifyAccessToken(token);
  assert.equal(payload.sub, 'user-1');
});

test('verifyAccessToken rejects a token signed with a different algorithm', () => {
  const token = jwt.sign({ sub: 'user-1' }, process.env.JWT_ACCESS_SECRET, {
    algorithm: 'HS384',
  });

  assert.throws(() => verifyAccessToken(token));
});

test('verifyAccessToken rejects an unsigned "alg: none" token', () => {
  const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString(
    'base64url'
  );
  const payload = Buffer.from(JSON.stringify({ sub: 'user-1' })).toString('base64url');
  const noneToken = `${header}.${payload}.`;

  assert.throws(() => verifyAccessToken(noneToken));
});

test('verifyAccessToken rejects a token with a tampered signature', () => {
  const token = signAccessToken({ sub: 'user-1' });
  const [header, payload, signature] = token.split('.');
  const tamperedSignature = signature.slice(0, -2) + (signature.slice(-2) === 'AA' ? 'BB' : 'AA');
  const tamperedToken = `${header}.${payload}.${tamperedSignature}`;

  assert.throws(() => verifyAccessToken(tamperedToken));
});

test('verifyAccessToken rejects a token with a tampered payload', () => {
  const token = signAccessToken({ sub: 'user-1', role: 'applicant' });
  const [header, , signature] = token.split('.');
  const forgedPayload = Buffer.from(JSON.stringify({ sub: 'user-1', role: 'admin' })).toString(
    'base64url'
  );
  const forgedToken = `${header}.${forgedPayload}.${signature}`;

  assert.throws(() => verifyAccessToken(forgedToken));
});

test('ALGORITHM is fixed to HS256', () => {
  assert.equal(ALGORITHM, 'HS256');
});
