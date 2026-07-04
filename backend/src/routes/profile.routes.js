const express = require('express');
const profileController = require('../controllers/profile.controller');
const { updateProfileSchema, changePasswordSchema } = require('../validators/profile.validators');
const validateBody = require('../middleware/validateBody');
const methodNotAllowed = require('../middleware/methodGuard');
const { verifyCsrfToken } = require('../middleware/csrf');
const requireAuth = require('../middleware/requireAuth');

const router = express.Router();

// Any logged-in user: read or update their own profile.
router
  .route('/')
  .get(requireAuth, profileController.getProfile)
  .patch(requireAuth, verifyCsrfToken, validateBody(updateProfileSchema), profileController.updateProfile)
  .all(methodNotAllowed(['GET', 'PATCH']));

// Password change requires current password proof + CSRF.
router
  .route('/change-password')
  .post(requireAuth, verifyCsrfToken, validateBody(changePasswordSchema), profileController.changePassword)
  .all(methodNotAllowed(['POST']));

// Data export: scoped strictly to the authenticated user's own records.
// CSRF token required because this is a state-changing, audit-logged action.
router
  .route('/export')
  .get(requireAuth, verifyCsrfToken, profileController.exportData)
  .all(methodNotAllowed(['GET']));

module.exports = router;
