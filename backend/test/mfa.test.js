const test = require('node:test');
const assert = require('node:assert/strict');
const { generateSecret, generate, verify } = require('otplib');

// Same rationale as jwt.test.js: env vars set directly so this test is
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
process.env.JWT_MFA_SECRET = 'test-mfa-secret-at-least-32-bytes-long-too';
process.env.JWT_MFA_EXPIRES_IN = '5m';
process.env.PII_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString('base64');

const User = require('../src/models/User');
const { signMfaChallengeToken, verifyMfaChallengeToken } = require('../src/utils/jwt');

test('a code generated from a secret verifies against that same secret', async () => {
  const secret = generateSecret();
  const code = await generate({ secret });
  const result = await verify({ secret, token: code });
  assert.equal(result.valid, true);
});

test('a code generated from a different secret does not verify', async () => {
  const secretA = generateSecret();
  const secretB = generateSecret();
  const code = await generate({ secret: secretA });
  const result = await verify({ secret: secretB, token: code });
  assert.equal(result.valid, false);
});

test('enrollment stays pending until activateMfa is called', () => {
  const user = new User({ fullName: 'Test', email: 'mfa@example.com', passwordHash: 'x' });
  const secret = generateSecret();

  user.setPendingMfaSecret(secret);
  assert.equal(user.mfaEnabled, false);
  assert.equal(user.readPendingMfaSecret(), secret);

  user.activateMfa();
  assert.equal(user.mfaEnabled, true);
  assert.equal(user.readMfaSecret(), secret);
  assert.equal(user.mfaPendingSecretEncrypted, null);
});

test('disableMfa clears the secret and backup codes', () => {
  const user = new User({ fullName: 'Test', email: 'mfa2@example.com', passwordHash: 'x' });
  user.setPendingMfaSecret(generateSecret());
  user.activateMfa();
  user.setBackupCodes(['aaaa1111', 'bbbb2222']);

  user.disableMfa();

  assert.equal(user.mfaEnabled, false);
  assert.equal(user.mfaSecretEncrypted, null);
  assert.equal(user.mfaBackupCodes.length, 0);
});

test('a backup code can only be consumed once', () => {
  const user = new User({ fullName: 'Test', email: 'mfa3@example.com', passwordHash: 'x' });
  user.setBackupCodes(['code1111', 'code2222']);

  assert.equal(user.consumeBackupCode('code1111'), true);
  assert.equal(user.consumeBackupCode('code1111'), false);
  assert.equal(user.consumeBackupCode('code2222'), true);
  assert.equal(user.consumeBackupCode('does-not-exist'), false);
});

test('mfa challenge token is signed and verified on its own secret', () => {
  const token = signMfaChallengeToken({ sub: 'user-1' });
  const payload = verifyMfaChallengeToken(token);
  assert.equal(payload.sub, 'user-1');
});

test('mfa challenge token is rejected by the access-token verifier', () => {
  const { verifyAccessToken } = require('../src/utils/jwt');
  const token = signMfaChallengeToken({ sub: 'user-1' });
  assert.throws(() => verifyAccessToken(token));
});
