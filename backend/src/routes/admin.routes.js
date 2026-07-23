const express = require('express');
const adminController = require('../controllers/admin.controller');
const methodNotAllowed = require('../middleware/methodGuard');
const { verifyCsrfToken } = require('../middleware/csrf');
const requireAuth = require('../middleware/requireAuth');
const requireRole = require('../middleware/requireRole');
const validateBody = require('../middleware/validateBody');
const { listAuditLogsSchema } = require('../validators/admin.validators');

const router = express.Router();

// All admin routes require auth and admin role - the requireRole guard enforces
// least privilege so an applicant/tenant JWT cannot reach these endpoints.
router
  .route('/dashboard')
  .get(requireAuth, requireRole('admin'), adminController.getDashboardStats)
  .all(methodNotAllowed(['GET']));

router
  .route('/audit-logs')
  .post(requireAuth, requireRole('admin'), verifyCsrfToken, validateBody(listAuditLogsSchema), adminController.listAuditLogs)
  .all(methodNotAllowed(['POST']));

router
  .route('/properties/bulk-import')
  .post(requireAuth, requireRole('admin'), verifyCsrfToken, adminController.bulkImportProperties)
  .all(methodNotAllowed(['POST']));

// Admin-only: list all non-admin users (applicants and tenants).
router
  .route('/users')
  .get(requireAuth, requireRole('admin'), adminController.listUsers)
  .all(methodNotAllowed(['GET']));

// Admin-only: permanently delete a user account.
router
  .route('/users/:id/delete')
  .post(requireAuth, requireRole('admin'), verifyCsrfToken, adminController.deleteUser)
  .all(methodNotAllowed(['POST']));

// Admin-only: remove a tenant (ends lease, downgrades role to applicant).
router
  .route('/users/:id/remove-tenant')
  .post(requireAuth, requireRole('admin'), verifyCsrfToken, adminController.removeTenant)
  .all(methodNotAllowed(['POST']));

module.exports = router;
