const express = require('express');
const billingController = require('../controllers/billing.controller');
const { confirmPaymentSchema, billRequestSchema } = require('../validators/billing.validators');
const validateBody = require('../middleware/validateBody');
const methodNotAllowed = require('../middleware/methodGuard');
const { verifyCsrfToken } = require('../middleware/csrf');
const requireAuth = require('../middleware/requireAuth');
const requireRole = require('../middleware/requireRole');
const { createUploadMiddleware } = require('../middleware/upload');

const router = express.Router();

const proofUpload = createUploadMiddleware('proof');

// Tenant: list their own leases. Admin: list leases for owned properties.
router
  .route('/leases')
  .get(requireAuth, requireRole('tenant', 'admin'), billingController.listLeases)
  .all(methodNotAllowed(['GET']));

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

// Tenant: submit a bill request. Admin: list all bill requests for owned properties.
router
  .route('/requests')
  .get(requireAuth, billingController.listBillRequests)
  .post(requireAuth, requireRole('tenant'), verifyCsrfToken, validateBody(billRequestSchema), billingController.createBillRequest)
  .all(methodNotAllowed(['GET', 'POST']));

// Admin-only: mark a bill request as sent. CSRF required.
router
  .route('/requests/:id/send')
  .post(requireAuth, requireRole('admin'), verifyCsrfToken, billingController.sendBillRequest)
  .all(methodNotAllowed(['POST']));

module.exports = router;
