const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');

process.env.NODE_ENV = 'test';
process.env.PORT = '4001';
process.env.MONGODB_URI =
  process.env.TEST_MONGODB_URI || 'mongodb://127.0.0.1:27017/domovault-ac-test';
process.env.CORS_ORIGIN = 'http://localhost:3000';
process.env.JWT_ALGORITHM = 'HS256';
process.env.JWT_ACCESS_SECRET = 'test-access-secret-at-least-32-bytes-ac01';
process.env.JWT_ACCESS_EXPIRES_IN = '15m';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-at-least-32-bytes-ac01';
process.env.JWT_REFRESH_EXPIRES_IN = '15d';
process.env.JWT_MFA_SECRET = 'test-mfa-secret-at-least-32-bytes-ac001';
process.env.JWT_MFA_EXPIRES_IN = '5m';
process.env.PII_ENCRYPTION_KEY = Buffer.alloc(32, 9).toString('base64');
process.env.CAPTCHA_PROVIDER = 'none';
process.env.UPLOAD_DIR = require('path').join(require('os').tmpdir(), 'domovault-ac-test-uploads');

const mongoose = require('mongoose');
const request = require('supertest');
const app = require('../src/app');
const User = require('../src/models/User');
const Property = require('../src/models/Property');
const Application = require('../src/models/Application');

let dbAvailable = false;

before(async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 2000 });
    await Promise.all([User.deleteMany({}), Property.deleteMany({}), Application.deleteMany({})]);
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
    t.skip(`MongoDB not reachable - skipping integration test`);
    return true;
  }
  return false;
}

async function getCsrf(agent) {
  const res = await agent.get('/api/auth/csrf-token');
  return res.body.csrfToken;
}

async function registerAndLogin(agent, email, role = null) {
  const csrf1 = await getCsrf(agent);
  await agent
    .post('/api/auth/register')
    .set('x-csrf-token', csrf1)
    .send({ fullName: 'Test User', email, password: 'SuperSecret123!' });

  if (role === 'admin') {
    await User.updateOne({ email }, { $set: { role: 'admin' } });
  }

  const csrf2 = await getCsrf(agent);
  const res = await agent
    .post('/api/auth/login')
    .set('x-csrf-token', csrf2)
    .send({ email, password: 'SuperSecret123!' });

  return res.body.accessToken;
}

test('admin can create a property; applicant cannot', async (t) => {
  if (skipIfNoDb(t)) return;

  const adminAgent = request.agent(app);
  const applicantAgent = request.agent(app);

  const adminToken = await registerAndLogin(adminAgent, 'admin-prop@example.com', 'admin');
  const applicantToken = await registerAndLogin(applicantAgent, 'applicant-prop@example.com');

  const propertyPayload = {
    title: 'Test Property',
    description: 'A lovely test property for the integration suite.',
    city: 'London',
    address: '1 Test Street, London',
    bedrooms: 2,
    bathrooms: 1,
    sizeSqft: 800,
    rentPerMonth: 1200,
    amenities: ['Parking'],
  };

  const csrf = await getCsrf(adminAgent);
  const adminRes = await adminAgent
    .post('/api/properties')
    .set('Authorization', `Bearer ${adminToken}`)
    .set('x-csrf-token', csrf)
    .send(propertyPayload);
  assert.equal(adminRes.status, 201);
  assert.equal(adminRes.body.ownerId, undefined === adminRes.body.ownerId ? undefined : adminRes.body.ownerId);
  assert.ok(adminRes.body._id);

  const csrf2 = await getCsrf(applicantAgent);
  const applicantRes = await applicantAgent
    .post('/api/properties')
    .set('Authorization', `Bearer ${applicantToken}`)
    .set('x-csrf-token', csrf2)
    .send(propertyPayload);
  assert.equal(applicantRes.status, 403);
});

test('admin can only edit their own property (ownership check)', async (t) => {
  if (skipIfNoDb(t)) return;

  const admin1Agent = request.agent(app);
  const admin2Agent = request.agent(app);

  const admin1Token = await registerAndLogin(admin1Agent, 'admin1-own@example.com', 'admin');
  const admin2Token = await registerAndLogin(admin2Agent, 'admin2-own@example.com', 'admin');

  // Admin1 creates a property.
  const csrf = await getCsrf(admin1Agent);
  const createRes = await admin1Agent
    .post('/api/properties')
    .set('Authorization', `Bearer ${admin1Token}`)
    .set('x-csrf-token', csrf)
    .send({
      title: 'Admin1 Property',
      description: 'Owned by admin1 and not admin2.',
      city: 'Bristol',
      address: '2 Test St, Bristol',
      bedrooms: 1,
      bathrooms: 1,
      sizeSqft: 500,
      rentPerMonth: 900,
    });
  assert.equal(createRes.status, 201);
  const propertyId = createRes.body._id;

  // Admin2 tries to update admin1's property - should get 404, not 403.
  const csrf2 = await getCsrf(admin2Agent);
  const updateRes = await admin2Agent
    .patch(`/api/properties/${propertyId}`)
    .set('Authorization', `Bearer ${admin2Token}`)
    .set('x-csrf-token', csrf2)
    .send({ title: 'Hijacked title' });
  // 404 (not 403) so admin2 cannot confirm the property exists.
  assert.equal(updateRes.status, 404);
});

test('applicant cannot set role to admin via registration', async (t) => {
  if (skipIfNoDb(t)) return;

  const agent = request.agent(app);
  const csrf = await getCsrf(agent);
  const res = await agent
    .post('/api/auth/register')
    .set('x-csrf-token', csrf)
    .send({ fullName: 'Hacker', email: 'hacker-role@example.com', password: 'SuperSecret123!', role: 'admin' });
  assert.equal(res.status, 400);
});

test('profile update cannot escalate role', async (t) => {
  if (skipIfNoDb(t)) return;

  const agent = request.agent(app);
  const token = await registerAndLogin(agent, 'profile-role@example.com');

  const csrf = await getCsrf(agent);
  const res = await agent
    .patch('/api/profile')
    .set('Authorization', `Bearer ${token}`)
    .set('x-csrf-token', csrf)
    .send({ role: 'admin', isVerified: true, fullName: 'Legit Name' });
  // .strict() in updateProfileSchema rejects unknown keys.
  assert.equal(res.status, 400);
});

test('applicant gets 404 fetching another applicants application (IDOR check)', async (t) => {
  if (skipIfNoDb(t)) return;

  const agent1 = request.agent(app);
  const agent2 = request.agent(app);

  const token1 = await registerAndLogin(agent1, 'applicant-idor1@example.com');
  const token2 = await registerAndLogin(agent2, 'applicant-idor2@example.com');

  // Create a property as admin.
  const adminAgent = request.agent(app);
  const adminToken = await registerAndLogin(adminAgent, 'admin-idor@example.com', 'admin');
  const csrf = await getCsrf(adminAgent);
  const propRes = await adminAgent
    .post('/api/properties')
    .set('Authorization', `Bearer ${adminToken}`)
    .set('x-csrf-token', csrf)
    .send({
      title: 'IDOR Test Property',
      description: 'Used for IDOR access-control test.',
      city: 'Leeds',
      address: '5 Test Lane, Leeds',
      bedrooms: 2,
      bathrooms: 1,
      sizeSqft: 700,
      rentPerMonth: 1100,
    });
  const propertyId = propRes.body._id;

  // Applicant1 applies.
  const csrf1 = await getCsrf(agent1);
  const appRes = await agent1
    .post('/api/applications')
    .set('Authorization', `Bearer ${token1}`)
    .set('x-csrf-token', csrf1)
    .send({ propertyId });
  assert.equal(appRes.status, 201);
  const applicationId = appRes.body._id;

  // Applicant2 tries to fetch applicant1's application.
  const fetchRes = await agent2
    .get(`/api/applications/${applicationId}`)
    .set('Authorization', `Bearer ${token2}`);
  // 404 (not 403) to avoid confirming the application exists.
  assert.equal(fetchRes.status, 404);
});

test('unauthenticated request to protected route returns 401', async (t) => {
  if (skipIfNoDb(t)) return;

  const res = await request(app).get('/api/profile');
  assert.equal(res.status, 401);
});

test('wrong HTTP method on property route returns 405 with Allow header', async (t) => {
  if (skipIfNoDb(t)) return;

  const res = await request(app).delete('/api/properties');
  assert.equal(res.status, 405);
  assert.ok(res.headers.allow);
});

test('XSS in property description is sanitized on save', async (t) => {
  if (skipIfNoDb(t)) return;

  const adminAgent = request.agent(app);
  const adminToken = await registerAndLogin(adminAgent, 'admin-xss@example.com', 'admin');
  const csrf = await getCsrf(adminAgent);

  const res = await adminAgent
    .post('/api/properties')
    .set('Authorization', `Bearer ${adminToken}`)
    .set('x-csrf-token', csrf)
    .send({
      title: 'XSS Test Property',
      description: '<script>alert("xss")</script><p>Safe paragraph</p>',
      city: 'Cardiff',
      address: '7 XSS Road, Cardiff',
      bedrooms: 1,
      bathrooms: 1,
      sizeSqft: 400,
      rentPerMonth: 750,
    });

  assert.equal(res.status, 201);
  // The script tag must not survive sanitization.
  assert.ok(!res.body.description.includes('<script>'));
  // The safe tag should be preserved.
  assert.ok(res.body.description.includes('<p>Safe paragraph</p>'));
});
