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
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 50));
    const skip = (page - 1) * limit;

    const filter = {};
    if (req.query.action) filter.action = req.query.action;
    if (req.query.actorId) filter.actorId = req.query.actorId;

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

module.exports = { listAuditLogs, getDashboardStats, bulkImportProperties };
