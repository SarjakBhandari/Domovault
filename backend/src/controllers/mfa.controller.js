const crypto = require('crypto');
const QRCode = require('qrcode');
const { generateSecret, generate, verify, generateURI } = require('otplib');
const User = require('../models/User');
const env = require('../config/env');
const { verifyMfaChallengeToken } = require('../utils/jwt');
const { recordFailedAttempt } = require('../utils/lockout');
const { issueSession } = require('./auth.controller');

const BACKUP_CODE_COUNT = 10;

function generateBackupCodes() {
  return Array.from({ length: BACKUP_CODE_COUNT }, () =>
    crypto.randomBytes(5).toString('hex')
  );
}

// Starts enrollment: generates a candidate secret and stores it as "pending"
// only - MFA stays disabled until enable() confirms the user can actually
// produce a valid code with it. Calling this again before enable() just
// overwrites the previous pending secret.
async function startEnrollment(req, res, next) {
  try {
    const user = await User.findById(req.user.sub);
    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }

    const secret = generateSecret();
    user.setPendingMfaSecret(secret);
    await user.save();

    const uri = generateURI({ issuer: 'Domovault', label: user.email, secret });
    const qrCodeDataUrl = await QRCode.toDataURL(uri);

    return res.json({ secret, qrCodeDataUrl });
  } catch (err) {
    next(err);
  }
}

// Confirms enrollment with a code generated from the pending secret. Only
// on success does MFA actually turn on - a wrong code here leaves MFA off.
async function enableMfa(req, res, next) {
  try {
    const { code } = req.body;

    const user = await User.findById(req.user.sub).select(
      '+mfaPendingSecretEncrypted +mfaSecretEncrypted'
    );
    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }

    const pendingSecret = user.readPendingMfaSecret();
    if (!pendingSecret) {
      return res.status(400).json({ error: 'No MFA enrollment in progress' });
    }

    const result = await verify({ secret: pendingSecret, token: code });
    if (!result.valid) {
      return res.status(400).json({ error: 'Invalid code' });
    }

    user.activateMfa();
    const backupCodes = generateBackupCodes();
    user.setBackupCodes(backupCodes);
    await user.save();

    // Backup codes are returned in plaintext exactly once - only their
    // hashes are ever stored, so this is the only chance the user gets to
    // see them.
    return res.json({ backupCodes });
  } catch (err) {
    next(err);
  }
}

// Disabling MFA requires the current password and a valid TOTP/backup code -
// a stolen access token alone is not enough to turn off a victim's MFA.
async function disableMfa(req, res, next) {
  try {
    const { password, code } = req.body;

    const user = await User.findById(req.user.sub).select(
      '+passwordHash +mfaSecretEncrypted +mfaBackupCodes'
    );
    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }

    const passwordValid = await user.verifyPassword(password);
    if (!passwordValid) {
      return res.status(401).json({ error: 'Invalid password' });
    }

    const codeValid = await isValidMfaCode(user, code);
    if (!codeValid) {
      return res.status(400).json({ error: 'Invalid code' });
    }

    user.disableMfa();
    await user.save();

    return res.status(204).end();
  } catch (err) {
    next(err);
  }
}

async function isValidMfaCode(user, code) {
  if (/^\d{6}$/.test(code)) {
    const secret = user.readMfaSecret();
    if (secret) {
      const result = await verify({ secret, token: code });
      if (result.valid) {
        return true;
      }
    }
  }

  return user.consumeBackupCode(code);
}

// Completes login after password has already been verified and the client
// holds a short-lived mfaToken (signed on a separate secret, see utils/jwt.js)
// instead of an access token. A wrong code here counts toward the same
// 15-attempt lockout as a wrong password.
async function verifyMfa(req, res, next) {
  try {
    const { mfaToken, code } = req.body;

    let payload;
    try {
      payload = verifyMfaChallengeToken(mfaToken);
    } catch {
      return res.status(401).json({ error: 'Invalid or expired MFA challenge' });
    }

    const user = await User.findById(payload.sub).select(
      '+mfaSecretEncrypted +mfaBackupCodes'
    );
    if (!user || !user.mfaEnabled) {
      return res.status(401).json({ error: 'Invalid or expired MFA challenge' });
    }

    if (user.isLocked()) {
      const retryAfterSeconds = Math.ceil((user.lockUntil.getTime() - Date.now()) / 1000);
      res.set('Retry-After', String(retryAfterSeconds));
      return res.status(423).json({
        error: 'Account temporarily locked due to repeated failed attempts',
        retryAfterSeconds,
      });
    }

    const codeValid = await isValidMfaCode(user, code);
    if (!codeValid) {
      await recordFailedAttempt(User, user._id);
      return res.status(401).json({ error: 'Invalid code' });
    }

    await user.save();
    const accessToken = await issueSession(res, user);
    return res.json({ accessToken, user: user.toJSON() });
  } catch (err) {
    next(err);
  }
}

module.exports = { startEnrollment, enableMfa, disableMfa, verifyMfa };
