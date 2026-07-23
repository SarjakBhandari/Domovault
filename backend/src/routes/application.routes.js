const express = require('express');
const applicationController = require('../controllers/application.controller');
const { createApplicationSchema, reviewApplicationSchema } = require('../validators/application.validators');
const validateBody = require('../middleware/validateBody');
const methodNotAllowed = require('../middleware/methodGuard');
const { verifyCsrfToken } = require('../middleware/csrf');
const requireAuth = require('../middleware/requireAuth');
const requireRole = require('../middleware/requireRole');
const { createUploadMiddleware } = require('../middleware/upload');
const { authRateLimiter } = require('../middleware/rateLimit');

const router = express.Router();

const documentUpload = createUploadMiddleware('document');

// Applicant or admin: list applications.
router
  .route('/')
  .get(requireAuth, applicationController.listApplications)
  .post(requireAuth, verifyCsrfToken, validateBody(createApplicationSchema), applicationController.createApplication)
  .all(methodNotAllowed(['GET', 'POST']));

// Get / review a single application.
router
  .route('/:id')
  .get(requireAuth, applicationController.getApplication)
  .all(methodNotAllowed(['GET']));

// Admin-only: approve or reject. requireRole enforces this at the route level
// so a logic error inside the controller cannot silently allow tenant access.
router
  .route('/:id/review')
  .post(requireAuth, requireRole('admin'), verifyCsrfToken, validateBody(reviewApplicationSchema), applicationController.reviewApplication)
  .all(methodNotAllowed(['POST']));

// Applicant-only: upload a supporting document.
router
  .route('/:id/documents')
  .post(requireAuth, verifyCsrfToken, ...documentUpload, applicationController.uploadDocument)
  .all(methodNotAllowed(['POST']));

// Applicant or admin: download a document by document sub-ID.
router
  .route('/:id/documents/:docId')
  .get(requireAuth, applicationController.downloadDocument)
  .all(methodNotAllowed(['GET']));

module.exports = router;
