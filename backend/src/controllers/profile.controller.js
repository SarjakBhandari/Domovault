const User = require('../models/User');
const { writeAuditLog, ACTIONS } = require('../utils/audit');

// Any logged-in user: get their own profile.
async function getProfile(req, res, next) {
  try {
    const user = await User.findById(req.user.sub);
    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }
    return res.json(user.toJSON());
  } catch (err) {
    next(err);
  }
}

// Any logged-in user: update their own profile. The Zod schema (applied in
// the route via validateBody) enforces the exact allow-list of updatable
// fields - role, isVerified, and all other server-controlled fields are absent
// from the schema and rejected by .strict() if submitted.
async function updateProfile(req, res, next) {
  try {
    const user = await User.findById(req.user.sub);
    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }

    const { fullName, phone, bio } = req.body;
    if (fullName !== undefined) user.fullName = fullName;
    if (phone !== undefined) user.phone = phone;
    if (bio !== undefined) user.bio = bio;

    await user.save();
    return res.json(user.toJSON());
  } catch (err) {
    next(err);
  }
}

// Any logged-in user: change their own password. Requires the current
// password as proof of identity - a stolen access token alone is not enough.
async function changePassword(req, res, next) {
  try {
    const { currentPassword, newPassword } = req.body;

    const user = await User.findById(req.user.sub).select('+passwordHash');
    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }

    const valid = await user.verifyPassword(currentPassword);
    if (!valid) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }

    if (currentPassword === newPassword) {
      return res.status(400).json({ error: 'New password must differ from the current password' });
    }

    await user.setPassword(newPassword);
    // Invalidate the current refresh token so all existing sessions are ended
    // after a password change - prevents a session that was open before the
    // change from remaining valid.
    user.setRefreshToken(null);
    await user.save();

    await writeAuditLog({
      actorId: req.user.sub,
      action: ACTIONS.PASSWORD_CHANGED,
      targetType: 'User',
      targetId: user._id,
      metadata: {},
    });

    return res.status(204).end();
  } catch (err) {
    next(err);
  }
}

module.exports = { getProfile, updateProfile, changePassword };
