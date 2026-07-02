const express = require('express');
const propertyController = require('../controllers/property.controller');
const {
  createPropertySchema,
  updatePropertySchema,
  importPhotoSchema,
} = require('../validators/property.validators');
const validateBody = require('../middleware/validateBody');
const methodNotAllowed = require('../middleware/methodGuard');
const { verifyCsrfToken } = require('../middleware/csrf');
const requireAuth = require('../middleware/requireAuth');
const requireRole = require('../middleware/requireRole');
const { createUploadMiddleware } = require('../middleware/upload');
const { authRateLimiter } = require('../middleware/rateLimit');

const router = express.Router();

const qrCodeUpload = createUploadMiddleware('qrcode');

// Public: browse + search.
router
  .route('/')
  .get(propertyController.listProperties)
  .post(requireAuth, requireRole('admin'), verifyCsrfToken, validateBody(createPropertySchema), propertyController.createProperty)
  .all(methodNotAllowed(['GET', 'POST']));

// Admin: list own properties (separate path to avoid ambiguity with public listing).
router
  .route('/mine')
  .get(requireAuth, requireRole('admin'), propertyController.listOwnProperties)
  .all(methodNotAllowed(['GET']));

// Public: single property.
router
  .route('/:id')
  .get(propertyController.getProperty)
  .patch(requireAuth, requireRole('admin'), verifyCsrfToken, validateBody(updatePropertySchema), propertyController.updateProperty)
  .delete(requireAuth, requireRole('admin'), verifyCsrfToken, propertyController.deleteProperty)
  .all(methodNotAllowed(['GET', 'PATCH', 'DELETE']));

// Admin: SSRF-safe photo import from URL.
router
  .route('/:id/import-photo')
  .post(requireAuth, requireRole('admin'), verifyCsrfToken, validateBody(importPhotoSchema), propertyController.importPhoto)
  .all(methodNotAllowed(['POST']));

// Admin: upload QR code image.
router
  .route('/:id/qr-code')
  .post(requireAuth, requireRole('admin'), verifyCsrfToken, ...qrCodeUpload, propertyController.uploadQrCode)
  .all(methodNotAllowed(['POST']));

module.exports = router;
