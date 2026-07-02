const Lease = require('../models/Lease');
const MaintenanceRequest = require('../models/MaintenanceRequest');
const { sanitize, sanitizePlainText } = require('../utils/sanitize');
const { serveUploadedFile, SUBDIR_BY_CATEGORY } = require('../middleware/upload');

// Tenant-only: submit a maintenance request. Requires an active lease.
async function createRequest(req, res, next) {
  try {
    const { description } = req.body;

    const lease = await Lease.findOne({ tenantId: req.user.sub, status: 'active' });
    if (!lease) {
      return res.status(403).json({ error: 'No active lease found. Maintenance requests require an active lease.' });
    }

    const request = await MaintenanceRequest.create({
      leaseId: lease._id,
      propertyId: lease.propertyId,
      tenantId: req.user.sub,
      ownerId: lease.ownerId,
      // Sanitized with sanitize-html on save (XSS prevention).
      description: sanitize(description),
    });

    return res.status(201).json(request);
  } catch (err) {
    next(err);
  }
}

// Tenant: list their own requests. Admin: list requests for owned properties.
async function listRequests(req, res, next) {
  try {
    const filter =
      req.user.role === 'admin'
        ? { ownerId: req.user.sub }
        : { tenantId: req.user.sub };

    const requests = await MaintenanceRequest.find(filter)
      .select('-photos.storedName')
      .sort({ createdAt: -1 })
      .lean();

    return res.json(requests);
  } catch (err) {
    next(err);
  }
}

// Get a single request. Returns 404 if not owned (IDOR prevention).
async function getRequest(req, res, next) {
  try {
    const request = await MaintenanceRequest.findById(req.params.id).lean();
    if (!request) {
      return res.status(404).json({ error: 'Request not found' });
    }

    const isTenant = request.tenantId.toString() === req.user.sub;
    const isOwner = request.ownerId.toString() === req.user.sub;

    if (!isTenant && !isOwner) {
      return res.status(404).json({ error: 'Request not found' });
    }

    // Never expose storedName in the response - clients use the photo download
    // endpoint with the document index, not a raw filename.
    const safeRequest = { ...request };
    if (safeRequest.photos) {
      safeRequest.photos = safeRequest.photos.map(({ mimeType, sizeBytes, uploadedAt }, i) => ({
        index: i,
        mimeType,
        sizeBytes,
        uploadedAt,
      }));
    }

    return res.json(safeRequest);
  } catch (err) {
    next(err);
  }
}

// Admin-only: update status and/or add notes.
async function updateStatus(req, res, next) {
  try {
    const { status, ownerNotes } = req.body;

    const request = await MaintenanceRequest.findOne({ _id: req.params.id, ownerId: req.user.sub });
    if (!request) {
      return res.status(404).json({ error: 'Request not found' });
    }

    request.status = status;
    if (ownerNotes !== undefined) {
      // Owner notes sanitized on save in case they are later rendered in HTML.
      request.ownerNotes = sanitizePlainText(ownerNotes);
    }
    await request.save();

    return res.json(request);
  } catch (err) {
    next(err);
  }
}

// Tenant-only: attach a photo to an existing request.
async function addPhoto(req, res, next) {
  try {
    const request = await MaintenanceRequest.findOne({ _id: req.params.id, tenantId: req.user.sub });
    if (!request) {
      return res.status(404).json({ error: 'Request not found' });
    }

    if (!req.uploadedFile) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    request.photos.push(req.uploadedFile);
    await request.save();

    return res.json({
      photos: request.photos.map(({ mimeType, sizeBytes, uploadedAt }, i) => ({
        index: i,
        mimeType,
        sizeBytes,
        uploadedAt,
      })),
    });
  } catch (err) {
    next(err);
  }
}

// Tenant or owner: download a photo. Path is constructed server-side from the
// DB record; the client supplies only a numeric index, never a filename.
async function downloadPhoto(req, res, next) {
  try {
    const request = await MaintenanceRequest.findById(req.params.id);
    if (!request) {
      return res.status(404).json({ error: 'Request not found' });
    }

    const isTenant = request.tenantId.toString() === req.user.sub;
    const isOwner = request.ownerId.toString() === req.user.sub;
    if (!isTenant && !isOwner) {
      return res.status(404).json({ error: 'Photo not found' });
    }

    const photoIndex = parseInt(req.params.photoIndex, 10);
    const photo = request.photos[photoIndex];
    if (!photo) {
      return res.status(404).json({ error: 'Photo not found' });
    }

    await serveUploadedFile(res, photo.storedName, SUBDIR_BY_CATEGORY.photo, photo.mimeType);
  } catch (err) {
    next(err);
  }
}

module.exports = { createRequest, listRequests, getRequest, updateStatus, addPhoto, downloadPhoto };
