const Lease = require('../models/Lease');
const BillingCycle = require('../models/BillingCycle');
const { writeAuditLog, ACTIONS } = require('../utils/audit');
const { serveUploadedFile, SUBDIR_BY_CATEGORY } = require('../middleware/upload');

// Tenant: list their billing cycles. Admin: list billing cycles for owned properties.
async function listBillingCycles(req, res, next) {
  try {
    const filter =
      req.user.role === 'admin'
        ? { ownerId: req.user.sub }
        : { tenantId: req.user.sub };

    const cycles = await BillingCycle.find(filter)
      .select('-paymentProof.storedName')
      .sort({ dueDate: -1 })
      .lean();

    return res.json(cycles);
  } catch (err) {
    next(err);
  }
}

// Get a single billing cycle. 404 if not owned (IDOR prevention).
async function getBillingCycle(req, res, next) {
  try {
    const cycle = await BillingCycle.findById(req.params.id).select('-paymentProof.storedName').lean();
    if (!cycle) {
      return res.status(404).json({ error: 'Billing cycle not found' });
    }

    const isTenant = cycle.tenantId.toString() === req.user.sub;
    const isOwner = cycle.ownerId.toString() === req.user.sub;

    if (!isTenant && !isOwner) {
      return res.status(404).json({ error: 'Billing cycle not found' });
    }

    return res.json(cycle);
  } catch (err) {
    next(err);
  }
}

// Tenant-only: upload payment proof for a billing cycle.
// Duplicate submission guard: only pending_proof or rejected cycles accept a
// new upload - an already-submitted or confirmed cycle is blocked.
async function uploadPaymentProof(req, res, next) {
  try {
    const cycle = await BillingCycle.findOne({ _id: req.params.id, tenantId: req.user.sub });
    if (!cycle) {
      return res.status(404).json({ error: 'Billing cycle not found' });
    }

    if (!['pending_proof', 'rejected'].includes(cycle.status)) {
      return res.status(409).json({
        error: 'Payment proof cannot be submitted for a cycle that is already under review or confirmed.',
      });
    }

    if (!req.uploadedFile) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    cycle.paymentProof = req.uploadedFile;
    cycle.status = 'proof_submitted';
    await cycle.save();

    await writeAuditLog({
      actorId: req.user.sub,
      action: ACTIONS.PAYMENT_PROOF_UPLOADED,
      targetType: 'BillingCycle',
      targetId: cycle._id,
      metadata: { leaseId: cycle.leaseId, amount: cycle.amount, dueDate: cycle.dueDate },
    });

    return res.json({ status: cycle.status });
  } catch (err) {
    next(err);
  }
}

// Admin-only: confirm or reject a payment proof. Restricted to the property's
// owner - a tenant who happens to know the billing cycle ID cannot self-confirm.
async function confirmPayment(req, res, next) {
  try {
    const { decision, rejectionReason } = req.body;

    const cycle = await BillingCycle.findOne({ _id: req.params.id, ownerId: req.user.sub });
    if (!cycle) {
      return res.status(404).json({ error: 'Billing cycle not found' });
    }

    if (cycle.status !== 'proof_submitted') {
      return res.status(409).json({
        error: 'Only cycles with a submitted proof can be confirmed or rejected.',
      });
    }

    if (decision === 'confirmed') {
      cycle.status = 'confirmed';
      cycle.confirmedAt = new Date();
      cycle.confirmedBy = req.user.sub;

      await cycle.save();

      await writeAuditLog({
        actorId: req.user.sub,
        action: ACTIONS.PAYMENT_CONFIRMED,
        targetType: 'BillingCycle',
        targetId: cycle._id,
        metadata: {
          leaseId: cycle.leaseId,
          propertyId: cycle.propertyId,
          tenantId: cycle.tenantId,
          amount: cycle.amount,
          dueDate: cycle.dueDate,
        },
      });
    } else {
      cycle.status = 'rejected';
      cycle.confirmedAt = new Date();
      cycle.confirmedBy = req.user.sub;
      cycle.rejectionReason = rejectionReason || null;

      await cycle.save();

      await writeAuditLog({
        actorId: req.user.sub,
        action: ACTIONS.PAYMENT_REJECTED,
        targetType: 'BillingCycle',
        targetId: cycle._id,
        metadata: {
          leaseId: cycle.leaseId,
          propertyId: cycle.propertyId,
          tenantId: cycle.tenantId,
          amount: cycle.amount,
          dueDate: cycle.dueDate,
          rejectionReason: cycle.rejectionReason,
        },
      });
    }

    return res.json({ status: cycle.status, confirmedAt: cycle.confirmedAt });
  } catch (err) {
    next(err);
  }
}

// Tenant-only: download the payment proof they uploaded. Only the tenant who
// submitted it can download their own proof.
async function downloadProof(req, res, next) {
  try {
    const cycle = await BillingCycle.findOne({ _id: req.params.id, tenantId: req.user.sub });
    if (!cycle || !cycle.paymentProof || !cycle.paymentProof.storedName) {
      return res.status(404).json({ error: 'Payment proof not found' });
    }

    await serveUploadedFile(res, cycle.paymentProof.storedName, SUBDIR_BY_CATEGORY.proof, cycle.paymentProof.mimeType);
  } catch (err) {
    next(err);
  }
}

// Internal: create the next billing cycle for an active lease. Called on
// lease activation and by a scheduled job. Not exposed as a route directly.
async function generateBillingCycleForLease(lease) {
  const dueDate = new Date();
  dueDate.setMonth(dueDate.getMonth() + 1);
  dueDate.setDate(1);
  dueDate.setHours(0, 0, 0, 0);

  // Unique index on (leaseId, dueDate) prevents duplicate cycles for the
  // same month even if this function is called twice (idempotency).
  await BillingCycle.findOneAndUpdate(
    { leaseId: lease._id, dueDate },
    {
      $setOnInsert: {
        leaseId: lease._id,
        propertyId: lease.propertyId,
        tenantId: lease.tenantId,
        ownerId: lease.ownerId,
        dueDate,
        // Amount is read from the lease (which copied from the property).
        // Never accepts client input at this point.
        amount: lease.rentAmount,
        status: 'pending_proof',
      },
    },
    { upsert: true, new: true }
  );
}

module.exports = {
  listBillingCycles,
  getBillingCycle,
  uploadPaymentProof,
  confirmPayment,
  downloadProof,
  generateBillingCycleForLease,
};
