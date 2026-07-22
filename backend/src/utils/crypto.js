const crypto = require('crypto');
const env = require('../config/env');

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const KEY = Buffer.from(env.PII_ENCRYPTION_KEY, 'base64');

// Single utility for every sensitive PII field (national ID, income details,
// etc). Never call crypto.createCipheriv directly anywhere else - that would
// create a second place to get the IV/auth-tag handling wrong.
function encrypt(plaintext) {
  if (plaintext === null || plaintext === undefined) {
    return null;
  }

  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, KEY, iv);
  const ciphertext = Buffer.concat([cipher.update(String(plaintext), 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return [iv.toString('base64'), authTag.toString('base64'), ciphertext.toString('base64')].join(
    '.'
  );
}

function decrypt(payload) {
  if (payload === null || payload === undefined) {
    return null;
  }

  const [ivB64, authTagB64, ciphertextB64] = payload.split('.');
  if (!ivB64 || !authTagB64 || !ciphertextB64) {
    throw new Error('Malformed encrypted payload');
  }

  const iv = Buffer.from(ivB64, 'base64');
  const authTag = Buffer.from(authTagB64, 'base64');
  const ciphertext = Buffer.from(ciphertextB64, 'base64');

  const decipher = crypto.createDecipheriv(ALGORITHM, KEY, iv);
  decipher.setAuthTag(authTag);
  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);

  return plaintext.toString('utf8');
}

// Deterministic HMAC-SHA256 keyed with the PII encryption key.
// Used to create indexed lookup hashes for encrypted fields (e.g. OAuth provider ID)
// without storing the plaintext. Random-IV AES-GCM cannot be used for lookups
// because the same input produces a different ciphertext each time.
function hmacField(value) {
  return crypto
    .createHmac('sha256', KEY)
    .update(String(value))
    .digest('hex');
}

module.exports = { encrypt, decrypt, hmacField };
