const crypto = require('crypto');
const mongoose = require('mongoose');
const argon2 = require('argon2');
const { encrypt, decrypt } = require('../utils/crypto');

const ROLES = ['applicant', 'tenant', 'admin'];

const userSchema = new mongoose.Schema(
  {
    fullName: { type: String, required: true, trim: true, maxlength: 100 },
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
      maxlength: 254,
    },
    // Never returned by any query by default; controllers must opt in with
    // .select('+passwordHash') and the toJSON transform below strips it again
    // before any response leaves the process.
    passwordHash: { type: String, required: true, select: false },
    // Server-controlled only. No route ever assigns these from request input.
    role: { type: String, enum: ROLES, default: 'applicant' },
    isVerified: { type: Boolean, default: false },
    // Encrypted at rest with AES-256-GCM (see utils/crypto.js). Stored as
    // ciphertext; only readNationalId()/setNationalId() below touch the key.
    nationalIdEncrypted: { type: String, select: false },
    failedLoginAttempts: { type: Number, default: 0 },
    lockUntil: { type: Date, default: null },
    lockLevel: { type: Number, default: 0 },
    // Hash of the current refresh token, never the token itself. Rotated on
    // every successful refresh; a presented token that doesn't match this
    // hash is treated as reuse of a stale/stolen token.
    refreshTokenHash: { type: String, default: null, select: false },
  },
  { timestamps: true }
);

userSchema.methods.setPassword = async function setPassword(plainPassword) {
  this.passwordHash = await argon2.hash(plainPassword, { type: argon2.argon2id });
};

userSchema.methods.verifyPassword = function verifyPassword(plainPassword) {
  return argon2.verify(this.passwordHash, plainPassword);
};

userSchema.methods.setNationalId = function setNationalId(plainValue) {
  this.nationalIdEncrypted = encrypt(plainValue);
};

userSchema.methods.readNationalId = function readNationalId() {
  return decrypt(this.nationalIdEncrypted);
};

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

userSchema.methods.setRefreshToken = function setRefreshToken(token) {
  this.refreshTokenHash = token ? hashToken(token) : null;
};

userSchema.methods.matchesRefreshToken = function matchesRefreshToken(token) {
  return Boolean(this.refreshTokenHash) && this.refreshTokenHash === hashToken(token);
};

userSchema.methods.isLocked = function isLocked() {
  return Boolean(this.lockUntil && this.lockUntil.getTime() > Date.now());
};

// toJSON/toObject transforms are the last line of defense: even if a
// controller forgets to .select() correctly, these fields never reach a
// response body.
const stripSensitiveFields = (doc, ret) => {
  delete ret.passwordHash;
  delete ret.nationalIdEncrypted;
  delete ret.refreshTokenHash;
  delete ret.failedLoginAttempts;
  delete ret.lockUntil;
  delete ret.lockLevel;
  delete ret.__v;
  return ret;
};

userSchema.set('toJSON', { transform: stripSensitiveFields });
userSchema.set('toObject', { transform: stripSensitiveFields });

const User = mongoose.model('User', userSchema);

module.exports = User;
module.exports.ROLES = ROLES;
