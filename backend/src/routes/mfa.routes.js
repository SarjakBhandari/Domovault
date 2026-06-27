const express = require('express');
const mfaController = require('../controllers/mfa.controller');
const {
  enableMfaSchema,
  disableMfaSchema,
  verifyMfaSchema,
} = require('../validators/mfa.validators');
const validateBody = require('../middleware/validateBody');
const methodNotAllowed = require('../middleware/methodGuard');
const { verifyCsrfToken } = require('../middleware/csrf');
const requireAuth = require('../middleware/requireAuth');
const { authRateLimiter } = require('../middleware/rateLimit');

const router = express.Router();

// setup/enable/disable require a full session (requireAuth) - they manage an
// already-logged-in user's own MFA configuration. verify is reached mid-login,
// before any access token exists, so it relies on the short-lived mfaToken
// instead.
router
  .route('/setup')
  .post(requireAuth, verifyCsrfToken, mfaController.startEnrollment)
  .all(methodNotAllowed(['POST']));

router
  .route('/enable')
  .post(requireAuth, verifyCsrfToken, validateBody(enableMfaSchema), mfaController.enableMfa)
  .all(methodNotAllowed(['POST']));

router
  .route('/disable')
  .post(requireAuth, verifyCsrfToken, validateBody(disableMfaSchema), mfaController.disableMfa)
  .all(methodNotAllowed(['POST']));

router
  .route('/verify')
  .post(authRateLimiter, verifyCsrfToken, validateBody(verifyMfaSchema), mfaController.verifyMfa)
  .all(methodNotAllowed(['POST']));

module.exports = router;
