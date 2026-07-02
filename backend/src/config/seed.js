const User = require('../models/User');
const env = require('./env');

// Creates one admin user if the configured email doesn't already exist.
// Never called when NODE_ENV=production (enforced in server.js).
async function seedAdmin() {
  const existing = await User.findOne({ email: env.ADMIN_SEED_EMAIL });
  if (existing) {
    return;
  }

  const admin = new User({
    fullName: 'Admin',
    email: env.ADMIN_SEED_EMAIL,
    role: 'admin',
    isVerified: true,
  });
  await admin.setPassword(env.ADMIN_SEED_PASSWORD);
  await admin.save();

  console.log(`[seed] Admin user created: ${env.ADMIN_SEED_EMAIL}`);
}

module.exports = { seedAdmin };
