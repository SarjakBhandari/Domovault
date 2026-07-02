const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');

// Same rationale as jwt.test.js/mfa.test.js: env vars set directly, not
// loaded from a .env file, so this suite is deterministic. Unlike those
// pure-unit files, this one needs a reachable MongoDB - see the dbAvailable
// check below, which skips every test gracefully if one isn't running
// (e.g. `docker compose up -d mongo` first, or set TEST_MONGODB_URI).
process.env.NODE_ENV = 'test';
process.env.PORT = '4000';
process.env.MONGODB_URI =
  process.env.TEST_MONGODB_URI || 'mongodb://127.0.0.1:27017/domovault-integration-test';
process.env.CORS_ORIGIN = 'http://localhost:3000';
process.env.JWT_ALGORITHM = 'HS256';
process.env.JWT_ACCESS_SECRET = 'test-access-secret-at-least-32-bytes-long';
process.env.JWT_ACCESS_EXPIRES_IN = '15m';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-at-least-32-bytes-long';
process.env.JWT_REFRESH_EXPIRES_IN = '15d';
process.env.JWT_MFA_SECRET = 'test-mfa-secret-at-least-32-bytes-long-too';
process.env.JWT_MFA_EXPIRES_IN = '5m';
process.env.PII_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString('base64');
// "test" provider treats the literal token "test-pass" as valid and
// everything else as invalid - deterministic, no network call. env.js
// refuses this provider whenever NODE_ENV=production.
process.env.CAPTCHA_PROVIDER = 'test';
process.env.CAPTCHA_TRIGGER_THRESHOLD = '3';

const mongoose = require('mongoose');
const request = require('supertest');
const { generate } = require('otplib');
const app = require('../src/app');
const User = require('../src/models/User');

let dbAvailable = false;

before(async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 2000 });
    await User.deleteMany({});
    dbAvailable = true;
  } catch {
    dbAvailable = false;
  }
});

after(async () => {
  if (dbAvailable) {
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  }
});

function skipIfNoDb(t) {
  if (!dbAvailable) {
    t.skip(`MongoDB not reachable at ${process.env.MONGODB_URI} - skipping integration test`);
    return true;
  }
  return false;
}

async function getCsrf(agent) {
  const res = await agent.get('/api/auth/csrf-token');
  return res.body.csrfToken;
}

test('register, login, refresh, logout, then refresh fails', async (t) => {
  if (skipIfNoDb(t)) return;

  const agent = request.agent(app);
  const csrf1 = await getCsrf(agent);

  const registerRes = await agent
    .post('/api/auth/register')
    .set('x-csrf-token', csrf1)
    .send({
      fullName: 'Integration User',
      email: 'integration@example.com',
      password: 'SuperSecret123!',
    });
  assert.equal(registerRes.status, 201);
  assert.equal(registerRes.body.user.role, 'applicant');
  assert.equal(registerRes.body.user.passwordHash, undefined);

  const csrf2 = await getCsrf(agent);
  const loginRes = await agent
    .post('/api/auth/login')
    .set('x-csrf-token', csrf2)
    .send({ email: 'integration@example.com', password: 'SuperSecret123!' });
  assert.equal(loginRes.status, 200);
  assert.ok(loginRes.body.accessToken);
  const refreshCookieAfterLogin = loginRes.headers['set-cookie'].find((c) =>
    c.startsWith('refreshToken=')
  );

  const csrf3 = await getCsrf(agent);
  const refreshRes = await agent.post('/api/auth/refresh').set('x-csrf-token', csrf3);
  assert.equal(refreshRes.status, 200);
  assert.ok(refreshRes.body.accessToken);
  // Two tokens signed with identical claims in the same second are
  // legitimately identical, so the access token itself isn't a useful
  // rotation signal - what actually has to change on every refresh is the
  // refresh token cookie.
  const refreshCookieAfterRefresh = refreshRes.headers['set-cookie'].find((c) =>
    c.startsWith('refreshToken=')
  );
  assert.notEqual(refreshCookieAfterRefresh, refreshCookieAfterLogin);

  const csrf4 = await getCsrf(agent);
  const logoutRes = await agent.post('/api/auth/logout').set('x-csrf-token', csrf4);
  assert.equal(logoutRes.status, 204);

  const csrf5 = await getCsrf(agent);
  const refreshAfterLogout = await agent.post('/api/auth/refresh').set('x-csrf-token', csrf5);
  assert.equal(refreshAfterLogout.status, 401);
});

test('registration rejects a role/isVerified injection attempt', async (t) => {
  if (skipIfNoDb(t)) return;

  const agent = request.agent(app);
  const csrf = await getCsrf(agent);
  const res = await agent
    .post('/api/auth/register')
    .set('x-csrf-token', csrf)
    .send({
      fullName: 'Hacker',
      email: 'hacker@example.com',
      password: 'SuperSecret123!',
      role: 'admin',
      isVerified: true,
    });
  assert.equal(res.status, 400);
});

test('login without a CSRF token is rejected', async (t) => {
  if (skipIfNoDb(t)) return;

  const agent = request.agent(app);
  await getCsrf(agent); // sets the cookie; header deliberately omitted below
  const res = await agent
    .post('/api/auth/login')
    .send({ email: 'nobody@example.com', password: 'whatever12345' });
  assert.equal(res.status, 403);
});

test('GET on a POST-only route returns 405 with an Allow header', async (t) => {
  if (skipIfNoDb(t)) return;

  const res = await request(app).get('/api/auth/login');
  assert.equal(res.status, 405);
  assert.equal(res.headers.allow, 'POST');
});

test('15 failed logins lock the account on the 16th attempt', async (t) => {
  if (skipIfNoDb(t)) return;

  const agent = request.agent(app);
  const csrf = await getCsrf(agent);
  await agent
    .post('/api/auth/register')
    .set('x-csrf-token', csrf)
    .send({ fullName: 'Lockout User', email: 'lockout@example.com', password: 'SuperSecret123!' });

  for (let i = 0; i < 15; i += 1) {
    const c = await getCsrf(agent);
    const res = await agent
      .post('/api/auth/login')
      .set('x-csrf-token', c)
      .send({
        email: 'lockout@example.com',
        password: 'wrong-password',
        captchaToken: 'test-pass',
      });
    assert.equal(res.status, 401);
  }

  const finalCsrf = await getCsrf(agent);
  const lockedRes = await agent
    .post('/api/auth/login')
    .set('x-csrf-token', finalCsrf)
    .send({ email: 'lockout@example.com', password: 'wrong-password', captchaToken: 'test-pass' });
  assert.equal(lockedRes.status, 423);
  assert.ok(lockedRes.body.retryAfterSeconds > 0);
});

test('CAPTCHA is required once the failed-login threshold is hit', async (t) => {
  if (skipIfNoDb(t)) return;

  const agent = request.agent(app);
  const csrf = await getCsrf(agent);
  await agent
    .post('/api/auth/register')
    .set('x-csrf-token', csrf)
    .send({ fullName: 'Captcha User', email: 'captcha@example.com', password: 'SuperSecret123!' });

  // CAPTCHA_TRIGGER_THRESHOLD is set to 3 above.
  for (let i = 0; i < 3; i += 1) {
    const c = await getCsrf(agent);
    await agent
      .post('/api/auth/login')
      .set('x-csrf-token', c)
      .send({
        email: 'captcha@example.com',
        password: 'wrong-password',
        captchaToken: 'test-pass',
      });
  }

  const withoutCaptcha = await getCsrf(agent);
  const blockedRes = await agent
    .post('/api/auth/login')
    .set('x-csrf-token', withoutCaptcha)
    .send({ email: 'captcha@example.com', password: 'SuperSecret123!' });
  assert.equal(blockedRes.status, 400);
  assert.equal(blockedRes.body.captchaRequired, true);

  const withCaptcha = await getCsrf(agent);
  const okRes = await agent
    .post('/api/auth/login')
    .set('x-csrf-token', withCaptcha)
    .send({ email: 'captcha@example.com', password: 'SuperSecret123!', captchaToken: 'test-pass' });
  assert.equal(okRes.status, 200);
});

test('full MFA cycle: enroll, enable, login requires MFA, verify with a backup code', async (t) => {
  if (skipIfNoDb(t)) return;

  const agent = request.agent(app);
  const csrf1 = await getCsrf(agent);
  await agent
    .post('/api/auth/register')
    .set('x-csrf-token', csrf1)
    .send({
      fullName: 'MFA Integration',
      email: 'mfa-integration@example.com',
      password: 'SuperSecret123!',
    });

  const csrf2 = await getCsrf(agent);
  const loginRes = await agent
    .post('/api/auth/login')
    .set('x-csrf-token', csrf2)
    .send({ email: 'mfa-integration@example.com', password: 'SuperSecret123!' });
  const accessToken = loginRes.body.accessToken;

  const csrf3 = await getCsrf(agent);
  const setupRes = await agent
    .post('/api/mfa/setup')
    .set('Authorization', `Bearer ${accessToken}`)
    .set('x-csrf-token', csrf3);
  assert.equal(setupRes.status, 200);
  assert.ok(setupRes.body.secret);
  assert.ok(setupRes.body.qrCodeDataUrl.startsWith('data:image/png;base64,'));

  const code = await generate({ secret: setupRes.body.secret });
  const csrf4 = await getCsrf(agent);
  const enableRes = await agent
    .post('/api/mfa/enable')
    .set('Authorization', `Bearer ${accessToken}`)
    .set('x-csrf-token', csrf4)
    .send({ code });
  assert.equal(enableRes.status, 200);
  assert.equal(enableRes.body.backupCodes.length, 10);

  const csrf5 = await getCsrf(agent);
  const secondLogin = await agent
    .post('/api/auth/login')
    .set('x-csrf-token', csrf5)
    .send({ email: 'mfa-integration@example.com', password: 'SuperSecret123!' });
  assert.equal(secondLogin.status, 200);
  assert.equal(secondLogin.body.mfaRequired, true);
  assert.equal(secondLogin.body.accessToken, undefined);

  const backupCode = enableRes.body.backupCodes[0];
  const csrf6 = await getCsrf(agent);
  const verifyRes = await agent
    .post('/api/mfa/verify')
    .set('x-csrf-token', csrf6)
    .send({ mfaToken: secondLogin.body.mfaToken, code: backupCode });
  assert.equal(verifyRes.status, 200);
  assert.ok(verifyRes.body.accessToken);
});
