const Lease = require('../models/Lease');
const BillingCycle = require('../models/BillingCycle');
const BillRequest = require('../models/BillRequest');
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

// Tenant: list their own active leases. Scoped strictly to tenantId = caller.
// Admin: list leases for properties they own.
async function listLeases(req, res, next) {
  try {
    const filter = req.user.role === 'admin'
      ? { ownerId: req.user.sub }
      : { tenantId: req.user.sub };

    const leases = await Lease.find(filter)
      .populate('propertyId', 'title address city')
      .populate('tenantId', 'fullName email')
      .populate('ownerId', 'fullName email _id')
      .sort({ createdAt: -1 })
      .lean();
    return res.json(leases);
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

// Tenant: create a bill request for their active lease.
// ownerId is derived server-side from the lease  -  never from client input.
async function createBillRequest(req, res, next) {
  try {
    const { message } = req.body;

    const lease = await Lease.findOne({ tenantId: req.user.sub, status: 'active' });
    if (!lease) {
      return res.status(404).json({ error: 'No active lease found' });
    }

    const request = await BillRequest.create({
      tenantId: req.user.sub,
      leaseId: lease._id,
      propertyId: lease.propertyId,
      ownerId: lease.ownerId,
      message: message || '',
      status: 'pending',
    });

    await writeAuditLog({
      actorId: req.user.sub,
      action: ACTIONS.BILL_REQUESTED,
      targetType: 'BillRequest',
      targetId: request._id,
      metadata: { leaseId: lease._id },
    });

    return res.status(201).json({ _id: request._id, status: request.status });
  } catch (err) {
    next(err);
  }
}

// Tenant: list their own bill requests. Admin: list requests for owned properties.
async function listBillRequests(req, res, next) {
  try {
    const filter = req.user.role === 'admin'
      ? { ownerId: req.user.sub }
      : { tenantId: req.user.sub };

    const requests = await BillRequest.find(filter)
      .populate('tenantId', 'fullName email')
      .populate('propertyId', 'title address')
      .sort({ createdAt: -1 })
      .lean();

    return res.json(requests);
  } catch (err) {
    next(err);
  }
}

// Admin-only: mark a bill request as sent. Ownership enforced  -  only the
// property's owner can update the request.
async function sendBillRequest(req, res, next) {
  try {
    const request = await BillRequest.findOne({ _id: req.params.id, ownerId: req.user.sub });
    if (!request) {
      return res.status(404).json({ error: 'Bill request not found' });
    }

    if (request.status === 'sent') {
      return res.status(409).json({ error: 'Bill request already marked as sent' });
    }

    request.status = 'sent';
    await request.save();

    await writeAuditLog({
      actorId: req.user.sub,
      action: ACTIONS.BILL_REQUEST_SENT,
      targetType: 'BillRequest',
      targetId: request._id,
      metadata: { tenantId: request.tenantId, leaseId: request.leaseId },
    });

    return res.json({ status: request.status });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  listBillingCycles,
  getBillingCycle,
  uploadPaymentProof,
  confirmPayment,
  downloadProof,
  listLeases,
  generateBillingCycleForLease,
  createBillRequest,
  listBillRequests,
  sendBillRequest,
};
