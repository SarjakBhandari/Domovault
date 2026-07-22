const express = require('express');
const profileController = require('../controllers/profile.controller');
const { updateProfileSchema, changePasswordSchema, deleteAccountSchema } = require('../validators/profile.validators');
const validateBody = require('../middleware/validateBody');
const methodNotAllowed = require('../middleware/methodGuard');
const { verifyCsrfToken } = require('../middleware/csrf');
const requireAuth = require('../middleware/requireAuth');
const { createUploadMiddleware } = require('../middleware/upload');

const router = express.Router();
const avatarUpload = createUploadMiddleware('avatar');

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
// GET is safe from CSRF (browsers cannot be forced to set custom headers on
// cross-origin GET requests), so verifyCsrfToken is not needed here.
router
  .route('/export')
  .get(requireAuth, profileController.exportData)
  .all(methodNotAllowed(['GET']));

// Self-delete: requires password proof + CSRF. The account and all its
// active leases are permanently removed from the database.
router
  .route('/delete')
  .post(requireAuth, verifyCsrfToken, validateBody(deleteAccountSchema), profileController.deleteAccount)
  .all(methodNotAllowed(['POST']));

// Upload own profile picture (requires CSRF). Serve avatar by userId (public).
router
  .route('/avatar')
  .post(requireAuth, verifyCsrfToken, ...avatarUpload, profileController.uploadAvatar)
  .all(methodNotAllowed(['POST']));

// Avatar images are served without auth  -  profile pictures are not sensitive
// and <img> tags cannot send custom Authorization headers.
router
  .route('/avatar/:userId')
  .get(profileController.serveAvatar)
  .all(methodNotAllowed(['GET']));

module.exports = router;
