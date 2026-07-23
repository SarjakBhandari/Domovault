const User = require('../models/User');
const Application = require('../models/Application');
const Lease = require('../models/Lease');
const BillingCycle = require('../models/BillingCycle');
const MaintenanceRequest = require('../models/MaintenanceRequest');
const { writeAuditLog, ACTIONS } = require('../utils/audit');
const { serveUploadedFile, SUBDIR_BY_CATEGORY } = require('../middleware/upload');

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

// Any logged-in user: export their own data as JSON.
// Only includes records that belong to the requesting user - never includes
// other users' data (information disclosure prevention).
// The export intentionally omits passwordHash, MFA secrets, refresh token
// hash, and all other server-internal security fields via the toJSON transform.
async function exportData(req, res, next) {
  try {
    const userId = req.user.sub;

    const [user, applications, leases, billingCycles, maintenanceRequests] = await Promise.all([
      User.findById(userId),
      Application.find({ applicantId: userId }).lean(),
      Lease.find({ tenantId: userId }).lean(),
      BillingCycle.find({ tenantId: userId }).select('-paymentProof.storedName').lean(),
      MaintenanceRequest.find({ tenantId: userId }).select('-photos.storedName').lean(),
    ]);

    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }

    await writeAuditLog({
      actorId: userId,
      action: ACTIONS.DATA_EXPORTED,
      targetType: 'User',
      targetId: userId,
      metadata: {},
    });

    const exportPayload = {
      exportedAt: new Date().toISOString(),
      profile: user.toJSON(),
      applications,
      leases,
      billingCycles,
      maintenanceRequests,
    };

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', 'attachment; filename="domovault-export.json"');
    return res.json(exportPayload);
  } catch (err) {
    next(err);
  }
}

// Any logged-in user: upload their own profile picture.
async function uploadAvatar(req, res, next) {
  try {
    if (!req.uploadedFile) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    const user = await User.findById(req.user.sub);
    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }
    user.avatarStoredName = req.uploadedFile.storedName;
    await user.save();
    return res.json({ message: 'Avatar updated' });
  } catch (err) {
    next(err);
  }
}

// Public: serve a user's avatar by userId. No auth needed  -  profile pictures
// are not sensitive and browser <img> tags cannot send Bearer headers.
async function serveAvatar(req, res, next) {
  try {
    const userId = req.params.userId;
    if (!userId) {
      return res.status(404).json({ error: 'Avatar not found' });
    }
    const user = await User.findById(userId);
    if (!user || !user.avatarStoredName) {
      return res.status(404).json({ error: 'Avatar not found' });
    }
    await serveUploadedFile(res, user.avatarStoredName, SUBDIR_BY_CATEGORY.avatar);
  } catch (err) {
    next(err);
  }
}

// Any logged-in user: delete their own account. Requires password as proof of
// identity  -  a stolen access token alone cannot delete the account.
// Ends active leases and nullifies related records before removing the user document.
async function deleteAccount(req, res, next) {
  try {
    const { password } = req.body;
    const userId = req.user.sub;

    const user = await User.findById(userId).select('+passwordHash');
    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }

    const valid = await user.verifyPassword(password);
    if (!valid) {
      return res.status(401).json({ error: 'Password is incorrect' });
    }

    // End any active leases before deleting the account.
    await Lease.updateMany({ tenantId: userId, status: 'active' }, { status: 'ended', endDate: new Date() });

    await writeAuditLog({
      actorId: userId,
      action: ACTIONS.ACCOUNT_DELETED,
      targetType: 'User',
      targetId: userId,
      metadata: { role: user.role },
    });

    await User.deleteOne({ _id: userId });

    return res.status(204).end();
  } catch (err) {
    next(err);
  }
}

module.exports = { getProfile, updateProfile, changePassword, exportData, uploadAvatar, serveAvatar, deleteAccount };
