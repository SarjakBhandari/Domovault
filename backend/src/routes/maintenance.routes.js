const express = require('express');
const maintenanceController = require('../controllers/maintenance.controller');
const { createMaintenanceSchema, updateMaintenanceStatusSchema } = require('../validators/maintenance.validators');
const validateBody = require('../middleware/validateBody');
const methodNotAllowed = require('../middleware/methodGuard');
const { verifyCsrfToken } = require('../middleware/csrf');
const requireAuth = require('../middleware/requireAuth');
const requireRole = require('../middleware/requireRole');
const { createUploadMiddleware } = require('../middleware/upload');

const router = express.Router();

const photoUpload = createUploadMiddleware('photo');

// Tenant or admin: list requests.
router
  .route('/')
  .get(requireAuth, maintenanceController.listRequests)
  .post(requireAuth, requireRole('tenant'), verifyCsrfToken, validateBody(createMaintenanceSchema), maintenanceController.createRequest)
  .all(methodNotAllowed(['GET', 'POST']));

// Get a single request (ownership enforced in controller).
router
  .route('/:id')
  .get(requireAuth, maintenanceController.getRequest)
  .all(methodNotAllowed(['GET']));

// Admin-only: update status.
router
  .route('/:id/status')
  .patch(requireAuth, requireRole('admin'), verifyCsrfToken, validateBody(updateMaintenanceStatusSchema), maintenanceController.updateStatus)
  .all(methodNotAllowed(['PATCH']));

// Tenant-only: add photos to a request.
router
  .route('/:id/photos')
  .post(requireAuth, requireRole('tenant'), verifyCsrfToken, ...photoUpload, maintenanceController.addPhoto)
  .all(methodNotAllowed(['POST']));

// Tenant or admin: download a photo by numeric index.
router
  .route('/:id/photos/:photoIndex')
  .get(requireAuth, maintenanceController.downloadPhoto)
  .all(methodNotAllowed(['GET']));

module.exports = router;
