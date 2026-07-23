const Property = require('../models/Property');
const Application = require('../models/Application');
const Lease = require('../models/Lease');
const User = require('../models/User');
const { writeAuditLog, ACTIONS } = require('../utils/audit');
const { serveUploadedFile, SUBDIR_BY_CATEGORY } = require('../middleware/upload');
const { generateBillingCycleForLease } = require('./billing.controller');

// Applicant: submit a new application for a property.
async function createApplication(req, res, next) {
  try {
    const { propertyId, notes } = req.body;

    const property = await Property.findById(propertyId);
    if (!property || property.status !== 'available') {
      return res.status(404).json({ error: 'Property not found or not available' });
    }

    const application = await Application.create({
      propertyId,
      applicantId: req.user.sub,
      notes,
    });

    return res.status(201).json(application);
  } catch (err) {
    // Duplicate key: applicant already has a pending/approved application.
    if (err.code === 11000) {
      return res.status(409).json({ error: 'You have already applied for this property' });
    }
    next(err);
  }
}

// Applicant: list their own applications.
// Admin: list applications for properties they own.
async function listApplications(req, res, next) {
  try {
    let filter;

    if (req.user.role === 'admin') {
      const ownedProperties = await Property.find({ ownerId: req.user.sub }).select('_id');
      const propertyIds = ownedProperties.map((p) => p._id);
      filter = { propertyId: { $in: propertyIds } };
    } else {
      filter = { applicantId: req.user.sub };
    }

    const applications = await Application.find(filter)
      .populate('propertyId', 'title city address rentPerMonth')
      .populate('applicantId', 'fullName email')
      .sort({ createdAt: -1 })
      .lean();

    return res.json(applications);
  } catch (err) {
    next(err);
  }
}

// Applicant/Admin: get a single application.
// Returns 404 if the application doesn't exist or the caller doesn't own it
// (IDOR prevention - doesn't distinguish "not found" from "not yours").
async function getApplication(req, res, next) {
  try {
    const application = await Application.findById(req.params.id)
      .populate('propertyId', 'title city address rentPerMonth ownerId')
      .populate('applicantId', 'fullName email')
      .lean();

    if (!application) {
      return res.status(404).json({ error: 'Application not found' });
    }

    const isApplicant = application.applicantId._id.toString() === req.user.sub;
    const isOwner = application.propertyId.ownerId.toString() === req.user.sub;

    if (!isApplicant && !isOwner) {
      // 404, not 403, to prevent confirming that the application exists.
      return res.status(404).json({ error: 'Application not found' });
    }

    return res.json(application);
  } catch (err) {
    next(err);
  }
}

// Admin-only: approve or reject an application. On approval, a Lease is
// created atomically using findOneAndUpdate to prevent two simultaneous
// approvals from double-leasing a unit (race condition prevention).
async function reviewApplication(req, res, next) {
  try {
    const { status, notes } = req.body;

    const application = await Application.findById(req.params.id).populate('propertyId');
    if (!application) {
      return res.status(404).json({ error: 'Application not found' });
    }

    if (application.propertyId.ownerId.toString() !== req.user.sub) {
      return res.status(404).json({ error: 'Application not found' });
    }

    if (application.status !== 'pending') {
      return res.status(409).json({ error: 'Application has already been reviewed' });
    }

    if (status === 'approved') {
      // Atomically transition the property from 'available' to 'leased'.
      // If another approval sneaks in simultaneously and wins, this update
      // returns null and we abort cleanly.
      const property = await Property.findOneAndUpdate(
        { _id: application.propertyId._id, status: 'available' },
        { $set: { status: 'leased' } },
        { new: true }
      );

      if (!property) {
        return res.status(409).json({
          error: 'This property is no longer available. Another application may have been approved.',
        });
      }

      // Create the lease with rent copied from the property at this moment.
      // This amount cannot be retroactively changed by the owner.
      const lease = await Lease.create({
        applicationId: application._id,
        propertyId: property._id,
        tenantId: application.applicantId,
        ownerId: req.user.sub,
        rentAmount: property.rentPerMonth,
        startDate: new Date(),
      });

      // Immediately generate the first billing cycle (due 1st of next month).
      await generateBillingCycleForLease(lease);

      // Promote the applicant to 'tenant' role.
      await User.updateOne({ _id: application.applicantId }, { $set: { role: 'tenant' } });

      // Auto-reject all other pending applications for the same property.
      await Application.updateMany(
        { propertyId: property._id, _id: { $ne: application._id }, status: 'pending' },
        { $set: { status: 'rejected', reviewedAt: new Date(), reviewedBy: req.user.sub, notes: 'Unit has been leased to another applicant' } }
      );

      application.status = 'approved';
      application.reviewedAt = new Date();
      application.reviewedBy = req.user.sub;
      application.notes = notes || '';
      await application.save();

      await writeAuditLog({
        actorId: req.user.sub,
        action: ACTIONS.APPLICATION_APPROVED,
        targetType: 'Application',
        targetId: application._id,
        metadata: { propertyId: property._id, tenantId: application.applicantId, leaseId: lease._id },
      });

      await writeAuditLog({
        actorId: req.user.sub,
        action: ACTIONS.LEASE_CREATED,
        targetType: 'Lease',
        targetId: lease._id,
        metadata: { propertyId: property._id, rentAmount: property.rentPerMonth },
      });

      return res.json({ application, lease });
    }

    // Rejection path: simpler, no atomic property update needed.
    application.status = 'rejected';
    application.reviewedAt = new Date();
    application.reviewedBy = req.user.sub;
    application.notes = notes || '';
    await application.save();

    await writeAuditLog({
      actorId: req.user.sub,
      action: ACTIONS.APPLICATION_REJECTED,
      targetType: 'Application',
      targetId: application._id,
      metadata: { propertyId: application.propertyId._id },
    });

    return res.json({ application });
  } catch (err) {
    next(err);
  }
}

// Applicant: upload documents to an existing application (ID, income proof).
// Documents accumulate; the applicant cannot delete or replace them.
async function uploadDocument(req, res, next) {
  try {
    const application = await Application.findOne({
      _id: req.params.id,
      applicantId: req.user.sub,
    });

    if (!application) {
      return res.status(404).json({ error: 'Application not found' });
    }

    if (application.status !== 'pending') {
      return res.status(409).json({ error: 'Cannot upload documents to a reviewed application' });
    }

    if (!req.uploadedFile) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    application.documents.push(req.uploadedFile);
    await application.save();

    return res.json({ documents: application.documents });
  } catch (err) {
    next(err);
  }
}

// Applicant or the property's admin: download a document.
async function downloadDocument(req, res, next) {
  try {
    const application = await Application.findById(req.params.id).populate('propertyId', 'ownerId');
    if (!application) {
      return res.status(404).json({ error: 'Application not found' });
    }

    const isApplicant = application.applicantId.toString() === req.user.sub;
    const isOwner = application.propertyId.ownerId.toString() === req.user.sub;

    if (!isApplicant && !isOwner) {
      return res.status(404).json({ error: 'Document not found' });
    }

    const doc = application.documents.id(req.params.docId);
    if (!doc) {
      return res.status(404).json({ error: 'Document not found' });
    }

    await writeAuditLog({
      actorId: req.user.sub,
      action: ACTIONS.DOCUMENT_DOWNLOADED,
      targetType: 'Application',
      targetId: application._id,
      metadata: { docId: req.params.docId },
    });

    await serveUploadedFile(res, doc.storedName, SUBDIR_BY_CATEGORY.document, doc.mimeType);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  createApplication,
  listApplications,
  getApplication,
  reviewApplication,
  uploadDocument,
  downloadDocument,
};
