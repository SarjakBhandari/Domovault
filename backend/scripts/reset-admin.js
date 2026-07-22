require('dotenv').config();
const mongoose = require('mongoose');
const env = require('../src/config/env');
const User = require('../src/models/User');

const EMAIL = env.ADMIN_SEED_EMAIL;
const PASSWORD = env.ADMIN_SEED_PASSWORD;

if (!EMAIL || !PASSWORD) {
  console.error('Set ADMIN_SEED_EMAIL and ADMIN_SEED_PASSWORD in .env');
  process.exit(1);
}

async function run() {
  await mongoose.connect(env.MONGODB_URI);
  console.log('Connected to MongoDB');

  let admin = await User.findOne({ email: EMAIL });

  if (admin) {
    await admin.setPassword(PASSWORD);
    admin.isVerified = true;
    admin.role = 'admin';
    admin.failedLoginAttempts = 0;
    admin.lockUntil = null;
    admin.clearPasswordResetToken();
    await admin.save();
    console.log('Admin password reset:', EMAIL);
  } else {
    admin = new User({ fullName: 'Admin', email: EMAIL, role: 'admin', isVerified: true });
    await admin.setPassword(PASSWORD);
    await admin.save();
    console.log('Admin created:', EMAIL);
  }

  await mongoose.disconnect();
}

run().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
