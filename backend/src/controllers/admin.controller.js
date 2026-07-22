const { z } = require('zod');
const AuditLog = require('../models/AuditLog');
const Property = require('../models/Property');
const User = require('../models/User');
const { sanitize } = require('../utils/sanitize');
const { writeAuditLog, ACTIONS } = require('../utils/audit');

// Admin-only: paginated audit log viewer with optional action/actor filters.
// Logs never contain passwords, tokens, or full document content - only the
// actor ID, action string, target reference, and minimal summary metadata.
async function listAuditLogs(req, res, next) {
  try {
    const { page: rawPage, limit: rawLimit, action, actorId } = req.body ?? {};
    const page = Math.max(1, parseInt(rawPage, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(rawLimit, 10) || 50));
    const skip = (page - 1) * limit;

    const filter = {};
    if (action) filter.action = action;
    if (actorId) filter.actorId = actorId;

    const [total, logs] = await Promise.all([
      AuditLog.countDocuments(filter),
      AuditLog.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('actorId', 'fullName email role')
        .lean(),
    ]);

    return res.json({ total, page, limit, logs });
  } catch (err) {
    next(err);
  }
}

// Admin-only: overall dashboard stats.
async function getDashboardStats(req, res, next) {
  try {
    const ownedProperties = await Property.find({ ownerId: req.user.sub }).select('_id status').lean();
    const propertyIds = ownedProperties.map((p) => p._id);

    const Application = require('../models/Application');
    const Lease = require('../models/Lease');
    const BillingCycle = require('../models/BillingCycle');
    const MaintenanceRequest = require('../models/MaintenanceRequest');

    const [pendingApps, activeLeases, pendingProofs, openMaintenance] = await Promise.all([
      Application.countDocuments({ propertyId: { $in: propertyIds }, status: 'pending' }),
      Lease.countDocuments({ propertyId: { $in: propertyIds }, status: 'active' }),
      BillingCycle.countDocuments({ ownerId: req.user.sub, status: 'proof_submitted' }),
      MaintenanceRequest.countDocuments({ propertyId: { $in: propertyIds }, status: { $in: ['open', 'in_progress'] } }),
    ]);

    return res.json({
      properties: { total: ownedProperties.length, available: ownedProperties.filter((p) => p.status === 'available').length },
      pendingApplications: pendingApps,
      activeLeases,
      pendingPaymentProofs: pendingProofs,
      openMaintenanceRequests: openMaintenance,
    });
  } catch (err) {
    next(err);
  }
}

// Schema for a single property row inside a bulk import.
// Identical field allow-list as the manual create endpoint - the same
// mass-assignment protection applies to imported rows (no ownerId/status
// in the schema so they can never be set by the CSV/JSON payload).
const bulkPropertyRowSchema = z.object({
  title: z.string().trim().min(3).max(200),
  description: z.string().trim().min(10).max(5000),
  city: z.string().trim().min(2).max(100),
  address: z.string().trim().min(5).max(300),
  bedrooms: z.coerce.number().int().min(0).max(20),
  bathrooms: z.coerce.number().int().min(0).max(20),
  sizeSqft: z.coerce.number().int().min(0),
  amenities: z.array(z.string().trim().max(100)).max(30).default([]),
  rentPerMonth: z.coerce.number().min(0),
});

// Admin-only: bulk property import from a JSON array.
// Each row is independently schema-validated before anything is written -
// an invalid row fails the entire import (no partial writes) so the caller
// knows exactly what to fix. ownerId is set server-side from the auth token;
// no row in the payload can override it (insecure deserialization prevention).
async function bulkImportProperties(req, res, next) {
  try {
    const { rows } = req.body;

    if (!Array.isArray(rows) || rows.length === 0) {
      return res.status(400).json({ error: 'rows must be a non-empty array' });
    }

    if (rows.length > 100) {
      return res.status(400).json({ error: 'Maximum 100 properties per import batch' });
    }

    // Validate every row up front - fail before touching the database.
    const validated = [];
    const errors = [];

    for (let i = 0; i < rows.length; i++) {
      const result = bulkPropertyRowSchema.safeParse(rows[i]);
      if (result.success) {
        // Sanitize the free-text description on the way in, same as manual create.
        validated.push({
          ...result.data,
          description: sanitize(result.data.description),
          ownerId: req.user.sub,
          status: 'available',
        });
      } else {
        errors.push({ row: i, issues: result.error.flatten().fieldErrors });
      }
    }

    if (errors.length > 0) {
      return res.status(400).json({ error: 'Validation failed', errors });
    }

    const created = await Property.insertMany(validated, { ordered: false });

    await writeAuditLog({
      actorId: req.user.sub,
      action: ACTIONS.PROPERTY_BULK_IMPORTED,
      targetType: 'Property',
      targetId: null,
      metadata: { count: created.length },
    });

    return res.status(201).json({ imported: created.length });
  } catch (err) {
    next(err);
  }
}

// Admin-only: list all non-admin users. Never returns passwordHash or
// other security-sensitive fields (toJSON transform strips them).
async function listUsers(req, res, next) {
  try {
    const users = await User.find({ role: { $in: ['applicant', 'tenant'] } })
      .sort({ createdAt: -1 })
      .lean();
    return res.json(users);
  } catch (err) {
    next(err);
  }
}

// Admin-only: permanently delete a user account. Cannot delete admins.
// Ends the user's active leases before removing the document.
async function deleteUser(req, res, next) {
  try {
    const target = await User.findById(req.params.id);
    if (!target) {
      return res.status(404).json({ error: 'User not found' });
    }
    if (target.role === 'admin') {
      return res.status(403).json({ error: 'Admin accounts cannot be deleted' });
    }

    const Lease = require('../models/Lease');
    await Lease.updateMany({ tenantId: target._id, status: 'active' }, { status: 'ended', endDate: new Date() });

    await writeAuditLog({
      actorId: req.user.sub,
      action: ACTIONS.USER_DELETED,
      targetType: 'User',
      targetId: target._id,
      metadata: { role: target.role, email: target.email },
    });

    await User.deleteOne({ _id: target._id });

    return res.status(204).end();
  } catch (err) {
    next(err);
  }
}

// Admin-only: remove a tenant  -  ends their active lease and downgrades
// their role back to applicant. Does not delete the account.
async function removeTenant(req, res, next) {
  try {
    const Lease = require('../models/Lease');

    const target = await User.findById(req.params.id);
    if (!target) {
      return res.status(404).json({ error: 'User not found' });
    }
    if (target.role !== 'tenant') {
      return res.status(400).json({ error: 'User is not a tenant' });
    }

    // End active leases owned by this admin for this tenant (IDOR: only leases
    // owned by the requesting admin are ended).
    await Lease.updateMany(
      { tenantId: target._id, ownerId: req.user.sub, status: 'active' },
      { status: 'ended', endDate: new Date() }
    );

    target.role = 'applicant';
    await target.save();

    await writeAuditLog({
      actorId: req.user.sub,
      action: ACTIONS.TENANT_REMOVED,
      targetType: 'User',
      targetId: target._id,
      metadata: {},
    });

    return res.json({ role: target.role });
  } catch (err) {
    next(err);
  }
}

module.exports = { listAuditLogs, getDashboardStats, bulkImportProperties, listUsers, deleteUser, removeTenant };
