const express = require('express');
const adminController = require('../controllers/admin.controller');
const methodNotAllowed = require('../middleware/methodGuard');
const { verifyCsrfToken } = require('../middleware/csrf');
const requireAuth = require('../middleware/requireAuth');
const requireRole = require('../middleware/requireRole');

const router = express.Router();

// All admin routes require auth and admin role - the requireRole guard enforces
// least privilege so an applicant/tenant JWT cannot reach these endpoints.
router
  .route('/dashboard')
  .get(requireAuth, requireRole('admin'), adminController.getDashboardStats)
  .all(methodNotAllowed(['GET']));

router
  .route('/audit-logs')
  .get(requireAuth, requireRole('admin'), adminController.listAuditLogs)
  .all(methodNotAllowed(['GET']));

router
  .route('/properties/bulk-import')
  .post(requireAuth, requireRole('admin'), verifyCsrfToken, adminController.bulkImportProperties)
  .all(methodNotAllowed(['POST']));

module.exports = router;
