const mongoose = require('mongoose');
const Property = require('../models/Property');
const { sanitize } = require('../utils/sanitize');
const { safeFetch } = require('../utils/ssrf');
const { writeAuditLog, ACTIONS } = require('../utils/audit');
const { serveUploadedFile, SUBDIR_BY_CATEGORY } = require('../middleware/upload');

const PAGE_LIMIT_MAX = 50;

// Public: search/filter properties. Uses Zod-coerced query params (never raw
// user strings in Mongoose operators) so there is no NoSQL injection surface.
async function listProperties(req, res, next) {
  try {
    const { city, maxRent, minRent, bedrooms, query, page, limit } = req.query;
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(PAGE_LIMIT_MAX, Math.max(1, parseInt(limit, 10) || 12));
    const skip = (pageNum - 1) * limitNum;

    const filter = { status: 'available' };
    if (city) filter.city = { $regex: new RegExp(`^${escapeRegex(city)}$`, 'i') };
    if (typeof maxRent === 'string') filter.rentPerMonth = { ...filter.rentPerMonth, $lte: Number(maxRent) };
    if (typeof minRent === 'string') filter.rentPerMonth = { ...filter.rentPerMonth, $gte: Number(minRent) };
    if (typeof bedrooms === 'string') filter.bedrooms = Number(bedrooms);
    if (query) {
      const escaped = escapeRegex(query);
      filter.$or = [
        { title: { $regex: escaped, $options: 'i' } },
        { city: { $regex: escaped, $options: 'i' } },
        { address: { $regex: escaped, $options: 'i' } },
      ];
    }

    const [total, items] = await Promise.all([
      Property.countDocuments(filter),
      Property.find(filter)
        .select('-qrCodeStoredName')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
    ]);

    return res.json({ total, page: pageNum, limit: limitNum, items });
  } catch (err) {
    next(err);
  }
}

// Public: single property detail.
async function getProperty(req, res, next) {
  try {
    const property = await Property.findById(req.params.id).select('-qrCodeStoredName').lean();
    if (!property) {
      return res.status(404).json({ error: 'Property not found' });
    }
    return res.json(property);
  } catch (err) {
    next(err);
  }
}

// Admin-only: create a property.
async function createProperty(req, res, next) {
  try {
    const { title, description, city, address, bedrooms, bathrooms, sizeSqft, amenities, rentPerMonth } =
      req.body;

    const property = await Property.create({
      title,
      description: sanitize(description),
      city,
      address,
      bedrooms,
      bathrooms,
      sizeSqft,
      amenities,
      rentPerMonth,
      ownerId: req.user.sub,
    });

    await writeAuditLog({
      actorId: req.user.sub,
      action: ACTIONS.PROPERTY_CREATED,
      targetType: 'Property',
      targetId: property._id,
      metadata: { title, rentPerMonth },
    });

    return res.status(201).json(property);
  } catch (err) {
    next(err);
  }
}

// Admin-only: update own property.
async function updateProperty(req, res, next) {
  try {
    const property = await Property.findOne({ _id: req.params.id, ownerId: req.user.sub });
    // Return 404 (not 403) to avoid confirming that the property exists but is
    // owned by someone else (IDOR enumeration prevention).
    if (!property) {
      return res.status(404).json({ error: 'Property not found' });
    }

    const allowedFields = ['title', 'description', 'city', 'address', 'bedrooms', 'bathrooms', 'sizeSqft', 'amenities', 'rentPerMonth'];
    allowedFields.forEach((field) => {
      if (req.body[field] !== undefined) {
        property[field] = field === 'description' ? sanitize(req.body[field]) : req.body[field];
      }
    });

    await property.save();

    await writeAuditLog({
      actorId: req.user.sub,
      action: ACTIONS.PROPERTY_UPDATED,
      targetType: 'Property',
      targetId: property._id,
      metadata: { updatedFields: Object.keys(req.body) },
    });

    return res.json(property);
  } catch (err) {
    next(err);
  }
}

// Admin-only: delete own property (only if not leased).
async function deleteProperty(req, res, next) {
  try {
    const property = await Property.findOne({ _id: req.params.id, ownerId: req.user.sub });
    if (!property) {
      return res.status(404).json({ error: 'Property not found' });
    }

    if (property.status === 'leased') {
      return res.status(409).json({ error: 'Cannot delete a property with an active lease' });
    }

    await property.deleteOne();

    await writeAuditLog({
      actorId: req.user.sub,
      action: ACTIONS.PROPERTY_DELETED,
      targetType: 'Property',
      targetId: property._id,
      metadata: { title: property.title },
    });

    return res.status(204).end();
  } catch (err) {
    next(err);
  }
}

// Admin-only: import a property photo from a URL. SSRF-prevented: the URL is
// checked against private IP ranges and an optional domain allow-list before
// any outbound HTTP request is made.
async function importPhoto(req, res, next) {
  try {
    const property = await Property.findOne({ _id: req.params.id, ownerId: req.user.sub });
    if (!property) {
      return res.status(404).json({ error: 'Property not found' });
    }

    const { imageUrl } = req.body;

    // safeFetch throws if the URL resolves to a private/reserved IP or is not
    // on the optional domain allow-list. redirect:'error' prevents redirect
    // chains from bypassing the IP check.
    const response = await safeFetch(imageUrl);
    if (!response.ok) {
      return res.status(400).json({ error: 'Could not fetch image from the provided URL' });
    }

    // Only the URL is stored (not the image itself), to keep the upload
    // pipeline simple. Production would download and store the image locally.
    property.imageUrl = imageUrl;
    await property.save();

    return res.json({ imageUrl: property.imageUrl });
  } catch (err) {
    if (err.status === 400) {
      return res.status(400).json({ error: err.message });
    }
    next(err);
  }
}

// Admin-only: upload a payment QR code image for a property.
async function uploadQrCode(req, res, next) {
  try {
    const property = await Property.findOne({ _id: req.params.id, ownerId: req.user.sub });
    if (!property) {
      return res.status(404).json({ error: 'Property not found' });
    }

    if (!req.uploadedFile) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    property.qrCodeStoredName = req.uploadedFile.storedName;
    await property.save();

    return res.json({ message: 'QR code updated' });
  } catch (err) {
    next(err);
  }
}

// Admin-only: list own properties.
async function listOwnProperties(req, res, next) {
  try {
    const properties = await Property.find({ ownerId: req.user.sub }).sort({ createdAt: -1 }).lean();
    return res.json(properties);
  } catch (err) {
    next(err);
  }
}

// Tenant-only: download the QR code for the property they are leasing.
// The caller (route) is responsible for verifying the lease ownership first.
async function getQrCode(req, res, next) {
  try {
    const property = await Property.findById(req.params.id).select('+qrCodeStoredName');
    if (!property || !property.qrCodeStoredName) {
      return res.status(404).json({ error: 'QR code not found' });
    }

    await serveUploadedFile(res, property.qrCodeStoredName, SUBDIR_BY_CATEGORY.qrcode, 'image/jpeg');
  } catch (err) {
    next(err);
  }
}

// Escapes regex special characters so user input used in $regex operators
// cannot alter the query semantics (e.g. inject .* to broaden the match).
function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

module.exports = {
  listProperties,
  getProperty,
  createProperty,
  updateProperty,
  deleteProperty,
  importPhoto,
  uploadQrCode,
  listOwnProperties,
  getQrCode,
};
