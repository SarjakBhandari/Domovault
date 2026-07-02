require('dotenv').config();

const fs = require('fs').promises;
const path = require('path');
const env = require('./config/env');
const connectDB = require('./config/db');
const app = require('./app');

// Create the upload directory tree at startup so the first file write doesn't
// fail because the parent directory is missing.
async function initUploadDirs() {
  const subdirs = ['documents', 'photos', 'qrcodes', 'proofs'];
  for (const sub of subdirs) {
    await fs.mkdir(path.join(env.UPLOAD_DIR, sub), { recursive: true });
  }
}

async function start() {
  await initUploadDirs();
  await connectDB();

  // Seed a default admin user in non-production environments if the env
  // variables are provided. This is purely a development convenience - the
  // check at runtime ensures it never runs in production.
  if (env.NODE_ENV !== 'production' && env.ADMIN_SEED_EMAIL && env.ADMIN_SEED_PASSWORD) {
    const { seedAdmin } = require('./config/seed');
    await seedAdmin();
  }

  app.listen(env.PORT, () => {
    console.log(`Domovault API listening on port ${env.PORT} [${env.NODE_ENV}]`);
  });
}

start().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
