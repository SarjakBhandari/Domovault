const crypto = require('crypto');
const env = require('../config/env');

// AES-256-GCM: 256-bit key, Galois/Counter Mode.
// GCM is an authenticated encryption mode - it produces both ciphertext
// and an authentication tag. If anyone tampers with the stored ciphertext,
// the tag check fails on decrypt and we get an error instead of garbage data.
const ALGORITHM = 'aes-256-gcm';

// GCM initialization vectors should be 12 bytes (96 bits).
// This is the size recommended by NIST for GCM and produces the best performance.
const IV_LENGTH = 12;

// The encryption key is stored in the environment as a base64 string and
// decoded to a raw 32-byte buffer here. 32 bytes = 256 bits = AES-256.
const KEY = Buffer.from(env.PII_ENCRYPTION_KEY, 'base64');

// All PII encryption in the app goes through this one function.
// This ensures IV generation and auth-tag handling are never accidentally skipped.
function encrypt(plaintext) {
  // Nothing to encrypt - pass null through unchanged
  if (plaintext === null || plaintext === undefined) {
    return null;
  }

  // Generate a fresh random IV for every single encryption.
  // Reusing an IV with the same key in GCM would be catastrophic:
  // an attacker could XOR two ciphertexts and recover the plaintext.
  // A new random IV every time makes each encryption independent.
  const iv = crypto.randomBytes(IV_LENGTH);

  const cipher = crypto.createCipheriv(ALGORITHM, KEY, iv);

  // Encrypt the plaintext - update() handles the bulk, final() flushes the last block
  const ciphertext = Buffer.concat([cipher.update(String(plaintext), 'utf8'), cipher.final()]);

  // The authentication tag is produced by GCM after encryption.
  // It is a 16-byte checksum that covers both the ciphertext and the IV.
  // On decryption, GCM re-computes this tag and compares it - any tampering is caught.
  const authTag = cipher.getAuthTag();

  // Store all three parts together as "iv.authTag.ciphertext" (all base64 encoded).
  // All three are required to decrypt. The key never appears in the database.
  return [iv.toString('base64'), authTag.toString('base64'), ciphertext.toString('base64')].join(
    '.'
  );
}

function decrypt(payload) {
  // Nothing to decrypt - pass null through unchanged
  if (payload === null || payload === undefined) {
    return null;
  }

  // Split the stored string back into the three base64 parts
  const [ivB64, authTagB64, ciphertextB64] = payload.split('.');
  if (!ivB64 || !authTagB64 || !ciphertextB64) {
    // The stored value is not in the expected format - refuse to proceed
    throw new Error('Malformed encrypted payload');
  }

  // Decode each part from base64 back to binary
  const iv = Buffer.from(ivB64, 'base64');
  const authTag = Buffer.from(authTagB64, 'base64');
  const ciphertext = Buffer.from(ciphertextB64, 'base64');

  const decipher = crypto.createDecipheriv(ALGORITHM, KEY, iv);

  // Hand the authentication tag to the decipher before we decrypt.
  // When decipher.final() runs below, GCM re-computes the expected tag
  // and compares it to what we provide here.
  // If they differ (ciphertext was modified, IV was changed, or authTag was corrupted),
  // decipher.final() throws an error and we never return any data.
  decipher.setAuthTag(authTag);

  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);

  return plaintext.toString('utf8');
}

module.exports = { encrypt, decrypt };
