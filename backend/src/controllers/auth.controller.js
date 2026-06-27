const ms = require('ms');
const User = require('../models/User');
const env = require('../config/env');
const { signAccessToken, signRefreshToken, verifyRefreshToken } = require('../utils/jwt');
const { FAILED_ATTEMPT_THRESHOLD, cooldownMsForLevel } = require('../utils/lockout');

const REFRESH_COOKIE_NAME = 'refreshToken';

function setRefreshCookie(res, token) {
  res.cookie(REFRESH_COOKIE_NAME, token, {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: ms(env.JWT_REFRESH_EXPIRES_IN),
  });
}

function clearRefreshCookie(res) {
  res.clearCookie(REFRESH_COOKIE_NAME, {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'strict',
  });
}

// Body is already Zod-validated and stripped to {fullName, email, password}
// by validateBody(registerSchema) - role and isVerified are never read from
// req.body at all, here or anywhere else; they are hard-coded below.
async function register(req, res, next) {
  try {
    const { fullName, email, password } = req.body;

    const existing = await User.findOne({ email });
    if (existing) {
      return res.status(409).json({ error: 'An account with this email already exists' });
    }

    const user = new User({ fullName, email, role: 'applicant', isVerified: false });
    await user.setPassword(password);
    await user.save();

    return res.status(201).json({ user: user.toJSON() });
  } catch (err) {
    next(err);
  }
}

async function login(req, res, next) {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email }).select('+passwordHash');
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    if (user.isLocked()) {
      const retryAfterSeconds = Math.ceil((user.lockUntil.getTime() - Date.now()) / 1000);
      res.set('Retry-After', String(retryAfterSeconds));
      return res.status(423).json({
        error: 'Account temporarily locked due to repeated failed attempts',
        retryAfterSeconds,
      });
    }

    const passwordValid = await user.verifyPassword(password);
    if (!passwordValid) {
      // Atomic increment so two concurrent failed attempts can't both read
      // the same pre-increment count and both miss the threshold.
      const updated = await User.findByIdAndUpdate(
        user._id,
        { $inc: { failedLoginAttempts: 1 } },
        { new: true }
      );

      if (updated.failedLoginAttempts >= FAILED_ATTEMPT_THRESHOLD) {
        const cooldownMs = cooldownMsForLevel(updated.lockLevel);
        await User.updateOne(
          { _id: user._id },
          {
            $set: { lockUntil: new Date(Date.now() + cooldownMs), failedLoginAttempts: 0 },
            $inc: { lockLevel: 1 },
          }
        );
      }

      return res.status(401).json({ error: 'Invalid email or password' });
    }

    user.failedLoginAttempts = 0;
    user.lockUntil = null;

    const accessToken = signAccessToken({ sub: user._id.toString(), role: user.role });
    const refreshToken = signRefreshToken({ sub: user._id.toString() });
    user.setRefreshToken(refreshToken);
    await user.save();

    setRefreshCookie(res, refreshToken);
    return res.json({ accessToken, user: user.toJSON() });
  } catch (err) {
    next(err);
  }
}

async function refresh(req, res, next) {
  try {
    const token = req.cookies?.[REFRESH_COOKIE_NAME];
    if (!token) {
      return res.status(401).json({ error: 'Missing refresh token' });
    }

    let payload;
    try {
      payload = verifyRefreshToken(token);
    } catch {
      return res.status(401).json({ error: 'Invalid or expired refresh token' });
    }

    const user = await User.findById(payload.sub).select('+refreshTokenHash');
    if (!user || !user.matchesRefreshToken(token)) {
      // The presented token doesn't match the one we last issued - either
      // it's stale (already rotated past) or it was stolen and replayed.
      // Revoke the stored token so a leaked token can't be used again either.
      if (user) {
        user.setRefreshToken(null);
        await user.save();
      }
      clearRefreshCookie(res);
      return res.status(401).json({ error: 'Refresh token reuse detected, please log in again' });
    }

    const newAccessToken = signAccessToken({ sub: user._id.toString(), role: user.role });
    const newRefreshToken = signRefreshToken({ sub: user._id.toString() });
    user.setRefreshToken(newRefreshToken);
    await user.save();

    setRefreshCookie(res, newRefreshToken);
    return res.json({ accessToken: newAccessToken });
  } catch (err) {
    next(err);
  }
}

async function logout(req, res, next) {
  try {
    const token = req.cookies?.[REFRESH_COOKIE_NAME];

    if (token) {
      try {
        const payload = verifyRefreshToken(token);
        await User.updateOne({ _id: payload.sub }, { $set: { refreshTokenHash: null } });
      } catch {
        // Already invalid/expired - nothing left to revoke server-side.
      }
    }

    clearRefreshCookie(res);
    return res.status(204).end();
  } catch (err) {
    next(err);
  }
}

module.exports = { register, login, refresh, logout };
