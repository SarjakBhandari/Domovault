const ms = require('ms');
const User = require('../models/User');
const env = require('../config/env');
const {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
  signMfaChallengeToken,
} = require('../utils/jwt');
const { recordFailedAttempt } = require('../utils/lockout');
const { sendOtpEmail, sendPasswordResetEmail } = require('../utils/mailer');

const REFRESH_COOKIE_NAME = 'refreshToken';

function setRefreshCookie(res, token, persist = true) {
  const opts = {
    httpOnly: true,            // JS cannot read it, so XSS on the frontend cannot steal the token
    secure: env.NODE_ENV === 'production',
    sameSite: 'strict',        // browser never sends it on cross-site requests (CSRF layer 1)
  };
  // persist=true: cookie survives browser restarts (maxAge set).
  // persist=false: session cookie - deleted when browser closes.
  if (persist) opts.maxAge = ms(env.JWT_REFRESH_EXPIRES_IN);
  res.cookie(REFRESH_COOKIE_NAME, token, opts);
}

function clearRefreshCookie(res) {
  res.clearCookie(REFRESH_COOKIE_NAME, {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'strict',
  });
}

// The only two paths that produce a real session: successful login (no MFA) and
// successful MFA verification. Keeping session issuance in one place means
// there is no forgotten code path that skips token signing or cookie setup.
async function issueSession(res, user, rememberMe = true) {
  const accessToken = signAccessToken({ sub: user._id.toString(), role: user.role });
  const refreshToken = signRefreshToken({ sub: user._id.toString() });
  user.setRefreshToken(refreshToken);
  await user.save();
  setRefreshCookie(res, refreshToken, rememberMe);
  return accessToken;
}

// Mass assignment prevention: req.body is already stripped to {fullName, email, password}
// by the Zod validator before reaching here. role and isVerified are hard-coded
// below and never read from the request body.
async function register(req, res, next) {
  try {
    const { fullName, email, password } = req.body;

    const existing = await User.findOne({ email });
    if (existing) {
      return res.status(409).json({ error: 'An account with this email already exists' });
    }

    const user = new User({ fullName, email, role: 'applicant', isVerified: false });
    await user.setPassword(password);
    const otp = user.setEmailOtp();
    await user.save();

    sendOtpEmail(email, otp).catch((err) => {
      console.error('[mailer] Failed to send OTP email:', err.message);
    });

    return res.status(201).json({ message: 'Registration successful. Enter the 6-digit code sent to your email.' });
  } catch (err) {
    next(err);
  }
}

async function verifyEmail(req, res, next) {
  try {
    const { email, otp } = req.body;

    const user = await User.findOne({ email }).select('+emailOtpHash +emailOtpExpiry');

    if (!user || user.isVerified) {
      return res.status(400).json({ error: 'Invalid or expired verification code.' });
    }

    if (!user.verifyEmailOtp(otp)) {
      return res.status(400).json({ error: 'Invalid or expired verification code.' });
    }

    user.isVerified = true;
    user.clearEmailOtp();
    await user.save();

    return res.json({ message: 'Email verified. You can now log in.' });
  } catch (err) {
    next(err);
  }
}

async function resendOtp(req, res, next) {
  try {
    const { email } = req.body;

    const user = await User.findOne({ email }).select('+emailOtpHash +emailOtpExpiry');

    if (user && !user.isVerified) {
      const otp = user.setEmailOtp();
      await user.save();
      sendOtpEmail(email, otp).catch((err) => {
        console.error('[mailer] Failed to resend OTP:', err.message);
      });
    }

    return res.json({ message: 'If your email is registered and unverified, a new code has been sent.' });
  } catch (err) {
    next(err);
  }
}

async function login(req, res, next) {
  try {
    const { email, password, rememberMe = false } = req.body;

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
      await recordFailedAttempt(User, user._id);
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    if (!user.isVerified) {
      return res.status(403).json({ error: 'EMAIL_NOT_VERIFIED' });
    }

    user.failedLoginAttempts = 0;
    user.lockUntil = null;

    if (user.mfaEnabled) {
      await user.save();
      // MFA challenge token is signed on its own secret (JWT_MFA_SECRET) so it
      // cannot be mistaken for or reused as a real access token even if leaked.
      const mfaToken = signMfaChallengeToken({ sub: user._id.toString() });
      return res.json({ mfaRequired: true, mfaToken });
    }

    const accessToken = await issueSession(res, user, rememberMe);
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
      // Token does not match the one we last issued: it is either a stale rotated
      // token or a stolen one being replayed. Revoke the stored token immediately
      // so the real user is also forced to re-login.
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
        // ignore  -  token already invalid
      }
    }

    clearRefreshCookie(res);
    return res.status(204).end();
  } catch (err) {
    next(err);
  }
}

// Host-header attack prevention: the reset link is built from APP_URL (a fixed
// environment variable), never from req.headers.host.
// Always returns 200 regardless of whether the email exists to prevent user enumeration.
async function forgotPassword(req, res, next) {
  try {
    const { email } = req.body;

    const user = await User.findOne({ email }).select('+passwordResetTokenHash +passwordResetExpiry');

    if (user) {
      const rawToken = user.setPasswordResetToken();
      await user.save();
      sendPasswordResetEmail(email, rawToken).catch((err) => {
        console.error('[mailer] Failed to send password reset email:', err.message);
      });
    }

    return res.json({ message: 'If that email is registered, a reset link has been sent.' });
  } catch (err) {
    next(err);
  }
}

// Single-use token: cleared immediately on use so it cannot be replayed.
// All active sessions are also killed so a password change ends every device session.
async function resetPassword(req, res, next) {
  try {
    const { email, token, password } = req.body;

    const user = await User.findOne({ email }).select(
      '+passwordHash +passwordResetTokenHash +passwordResetExpiry'
    );

    if (!user || !user.verifyPasswordResetToken(token)) {
      return res.status(400).json({ error: 'Invalid or expired password reset link.' });
    }

    await user.setPassword(password);
    user.clearPasswordResetToken();
    user.setRefreshToken(null);
    await user.save();

    clearRefreshCookie(res);
    return res.json({ message: 'Password updated. Please log in with your new password.' });
  } catch (err) {
    next(err);
  }
}

module.exports = { register, verifyEmail, resendOtp, login, refresh, logout, issueSession, forgotPassword, resetPassword };
