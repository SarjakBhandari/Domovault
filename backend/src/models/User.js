const crypto = require('crypto');
const mongoose = require('mongoose');
const argon2 = require('argon2');
const { encrypt, decrypt, hmacField } = require('../utils/crypto');

const ROLES = ['applicant', 'tenant', 'admin'];

const userSchema = new mongoose.Schema(
  {
    fullName: { type: String, required: true, trim: true, maxlength: 100 },
    phone: { type: String, trim: true, maxlength: 30, default: null },
    bio: { type: String, trim: true, maxlength: 500, default: null },
    avatarStoredName: { type: String, default: null },
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
    // Not required for OAuth accounts (oauthProvider is set instead).
    passwordHash: {
      type: String,
      select: false,
      required: function () { return !this.oauthProvider; },
    },
    // OAuth identity  -  set only for accounts created/linked via Google sign-in.
    // oauthIdEncrypted stores the provider's user ID under AES-256-GCM (PII).
    // oauthIdHash is an HMAC-SHA256 of (provider:rawId) keyed with PII_ENCRYPTION_KEY
    // so lookups can use an indexed, deterministic value without storing plaintext.
    oauthProvider:    { type: String, enum: ['google', null], default: null },
    oauthIdHash:      { type: String, default: null, select: false },
    oauthIdEncrypted: { type: String, default: null, select: false },
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
    // TOTP secret, encrypted at rest with the same AES-256-GCM utility as
    // other PII. Only set once enrollment is confirmed with a valid code.
    mfaEnabled: { type: Boolean, default: false },
    mfaSecretEncrypted: { type: String, default: null, select: false },
    // Holds the candidate secret between "start enrollment" and "confirm
    // enrollment" - never activates MFA on its own, so a half-finished
    // enrollment can't lock an account out.
    mfaPendingSecretEncrypted: { type: String, default: null, select: false },
    // Backup codes are stored as SHA-256 hashes, never plaintext. Each is
    // single-use, tracked via usedAt rather than deleting on use so a user
    // can see which codes are spent.
    mfaBackupCodes: {
      type: [
        {
          codeHash: { type: String, required: true },
          usedAt: { type: Date, default: null },
        },
      ],
      default: [],
      select: false,
    },
    // SHA-256 hash of the single-use password-reset token. Never the raw token.
    // The raw token is returned once to the caller and included in the reset URL.
    // Expires after 1 hour; consuming it nulls both fields.
    passwordResetTokenHash: { type: String, default: null, select: false },
    passwordResetExpiry: { type: Date, default: null, select: false },
    // SHA-256 hash of the 6-digit OTP sent on registration. Expires in 10 minutes.
    emailOtpHash: { type: String, default: null, select: false },
    emailOtpExpiry: { type: Date, default: null, select: false },
  },
  { timestamps: true }
);

// Sparse unique index on the HMAC hash  -  allows null (local-only accounts) but
// prevents two OAuth accounts from mapping to the same provider identity.
userSchema.index({ oauthIdHash: 1 }, { unique: true, sparse: true });

// Store the provider's user ID: HMAC hash for indexed lookup, AES-256-GCM
// ciphertext for the value itself. Never store or compare the raw ID directly.
userSchema.methods.setOauthId = function setOauthId(provider, rawId) {
  this.oauthProvider    = provider;
  this.oauthIdHash      = hmacField(`${provider}:${rawId}`);
  this.oauthIdEncrypted = encrypt(rawId);
};

// Lookup helper  -  finds a user by provider + raw ID using the stored HMAC hash.
userSchema.statics.findByOauthId = function findByOauthId(provider, rawId) {
  const hash = hmacField(`${provider}:${rawId}`);
  return this.findOne({ oauthProvider: provider, oauthIdHash: hash });
};

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

// Returns the plaintext token (included once in the reset link URL).
// Stores only the SHA-256 hash + a 1-hour expiry so a DB leak cannot
// be used directly to reset passwords.
userSchema.methods.setPasswordResetToken = function setPasswordResetToken() {
  const rawToken = crypto.randomBytes(32).toString('hex');
  this.passwordResetTokenHash = hashToken(rawToken);
  this.passwordResetExpiry = new Date(Date.now() + 60 * 60 * 1000);
  return rawToken;
};

userSchema.methods.verifyPasswordResetToken = function verifyPasswordResetToken(rawToken) {
  if (!this.passwordResetTokenHash || !this.passwordResetExpiry) return false;
  if (this.passwordResetExpiry < new Date()) return false;
  return this.passwordResetTokenHash === hashToken(rawToken);
};

userSchema.methods.clearPasswordResetToken = function clearPasswordResetToken() {
  this.passwordResetTokenHash = null;
  this.passwordResetExpiry = null;
};

userSchema.methods.setEmailOtp = function setEmailOtp() {
  const otp = crypto.randomInt(100000, 1000000).toString();
  this.emailOtpHash = hashToken(otp);
  this.emailOtpExpiry = new Date(Date.now() + 10 * 60 * 1000);
  return otp;
};

userSchema.methods.verifyEmailOtp = function verifyEmailOtp(otp) {
  if (!this.emailOtpHash || !this.emailOtpExpiry) return false;
  if (this.emailOtpExpiry < new Date()) return false;
  return this.emailOtpHash === hashToken(otp);
};

userSchema.methods.clearEmailOtp = function clearEmailOtp() {
  this.emailOtpHash = null;
  this.emailOtpExpiry = null;
};

userSchema.methods.isLocked = function isLocked() {
  return Boolean(this.lockUntil && this.lockUntil.getTime() > Date.now());
};

userSchema.methods.setPendingMfaSecret = function setPendingMfaSecret(secret) {
  this.mfaPendingSecretEncrypted = encrypt(secret);
};

userSchema.methods.readPendingMfaSecret = function readPendingMfaSecret() {
  return decrypt(this.mfaPendingSecretEncrypted);
};

userSchema.methods.readMfaSecret = function readMfaSecret() {
  return decrypt(this.mfaSecretEncrypted);
};

userSchema.methods.activateMfa = function activateMfa() {
  this.mfaSecretEncrypted = this.mfaPendingSecretEncrypted;
  this.mfaPendingSecretEncrypted = null;
  this.mfaEnabled = true;
};

userSchema.methods.disableMfa = function disableMfa() {
  this.mfaEnabled = false;
  this.mfaSecretEncrypted = null;
  this.mfaPendingSecretEncrypted = null;
  this.mfaBackupCodes = [];
};

function hashBackupCode(code) {
  return crypto.createHash('sha256').update(code).digest('hex');
}

// Backup codes carry enough entropy on their own (10 random bytes, base32)
// that a fast hash is an acceptable tradeoff for a single-use, short-lived
// secondary credential - unlike the password, there's no reuse-across-sites
// risk and no need for Argon2's deliberate slowness here.
userSchema.methods.setBackupCodes = function setBackupCodes(plainCodes) {
  this.mfaBackupCodes = plainCodes.map((code) => ({ codeHash: hashBackupCode(code), usedAt: null }));
};

// Returns true and marks the matching code used on success; false if the
// code doesn't match any stored hash or has already been spent.
userSchema.methods.consumeBackupCode = function consumeBackupCode(plainCode) {
  const targetHash = hashBackupCode(plainCode);
  const match = this.mfaBackupCodes.find(
    (entry) => entry.codeHash === targetHash && !entry.usedAt
  );

  if (!match) {
    return false;
  }

  match.usedAt = new Date();
  return true;
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
  delete ret.mfaSecretEncrypted;
  delete ret.mfaPendingSecretEncrypted;
  delete ret.mfaBackupCodes;
  delete ret.passwordResetTokenHash;
  delete ret.passwordResetExpiry;
  delete ret.emailOtpHash;
  delete ret.emailOtpExpiry;
  delete ret.oauthIdHash;      // internal HMAC  -  not needed by any client
  delete ret.oauthIdEncrypted; // encrypted provider ID  -  PII, never exposed
  delete ret.__v;
  return ret;
};

userSchema.set('toJSON', { transform: stripSensitiveFields });
userSchema.set('toObject', { transform: stripSensitiveFields });

const User = mongoose.model('User', userSchema);

module.exports = User;
module.exports.ROLES = ROLES;
