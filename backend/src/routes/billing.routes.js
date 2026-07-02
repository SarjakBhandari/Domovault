const express = require('express');
const billingController = require('../controllers/billing.controller');
const { confirmPaymentSchema } = require('../validators/billing.validators');
const validateBody = require('../middleware/validateBody');
const methodNotAllowed = require('../middleware/methodGuard');
const { verifyCsrfToken } = require('../middleware/csrf');
const requireAuth = require('../middleware/requireAuth');
const requireRole = require('../middleware/requireRole');
const { createUploadMiddleware } = require('../middleware/upload');

const router = express.Router();

const proofUpload = createUploadMiddleware('proof');

// Tenant or admin: list billing cycles.
router
  .route('/')
  .get(requireAuth, billingController.listBillingCycles)
  .all(methodNotAllowed(['GET']));

// Get a single cycle.
router
  .route('/:id')
  .get(requireAuth, billingController.getBillingCycle)
  .all(methodNotAllowed(['GET']));

// Tenant-only: upload payment proof. CSRF required.
router
  .route('/:id/proof')
  .post(requireAuth, requireRole('tenant'), verifyCsrfToken, ...proofUpload, billingController.uploadPaymentProof)
  .all(methodNotAllowed(['POST']));

// Tenant: download their own payment proof.
router
  .route('/:id/proof/download')
  .get(requireAuth, requireRole('tenant'), billingController.downloadProof)
  .all(methodNotAllowed(['GET']));

// Admin-only: confirm or reject payment. CSRF required. Ownership enforced
// in the controller (only the property's owner can confirm, not any admin).
router
  .route('/:id/confirm')
  .post(requireAuth, requireRole('admin'), verifyCsrfToken, validateBody(confirmPaymentSchema), billingController.confirmPayment)
  .all(methodNotAllowed(['POST']));

module.exports = router;
