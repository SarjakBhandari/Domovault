const express = require('express');
const propertyController = require('../controllers/property.controller');
const {
  createPropertySchema,
  updatePropertySchema,
  importPhotoSchema,
  propertySearchSchema,
  updatePaymentDetailsSchema,
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
const photoUpload = createUploadMiddleware('photo');

// Public: search properties via POST JSON body (no query strings).
router
  .route('/search')
  .post(validateBody(propertySearchSchema), propertyController.searchProperties)
  .all(methodNotAllowed(['POST']));

// Admin: create a property.
router
  .route('/')
  .post(requireAuth, requireRole('admin'), verifyCsrfToken, validateBody(createPropertySchema), propertyController.createProperty)
  .all(methodNotAllowed(['POST']));

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

// Admin: upload property image file. Tenant: not applicable.
router
  .route('/:id/upload-image')
  .post(requireAuth, requireRole('admin'), verifyCsrfToken, ...photoUpload, propertyController.uploadPropertyImage)
  .all(methodNotAllowed(['POST']));

// Public: serve locally uploaded property image.
router
  .route('/:id/image')
  .get(propertyController.servePropertyImage)
  .all(methodNotAllowed(['GET']));

// Admin: upload QR code image. Tenant: download QR code (lease-gated).
router
  .route('/:id/qr-code')
  .post(requireAuth, requireRole('admin'), verifyCsrfToken, ...qrCodeUpload, propertyController.uploadQrCode)
  .get(requireAuth, requireRole('tenant'), propertyController.downloadQrCode)
  .all(methodNotAllowed(['POST', 'GET']));

// Admin: update payment details. Tenant: get payment details (lease-gated).
router
  .route('/:id/payment-details')
  .patch(requireAuth, requireRole('admin'), verifyCsrfToken, validateBody(updatePaymentDetailsSchema), propertyController.updatePaymentDetails)
  .get(requireAuth, requireRole('tenant'), propertyController.getPaymentDetails)
  .all(methodNotAllowed(['PATCH', 'GET']));

module.exports = router;
