const express = require('express');
const authController = require('../controllers/auth.controller');
const {
  registerSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} = require('../validators/auth.validators');
const validateBody = require('../middleware/validateBody');
const methodNotAllowed = require('../middleware/methodGuard');
const { issueCsrfToken, verifyCsrfToken } = require('../middleware/csrf');
const { authRateLimiter } = require('../middleware/rateLimit');

const router = express.Router();

// Every path is whitelisted to exactly the method it needs. Any other verb
// on the same path gets a 405 with an Allow header, not a silent 404.
router
  .route('/csrf-token')
  .get(issueCsrfToken)
  .all(methodNotAllowed(['GET']));

router
  .route('/register')
  .post(authRateLimiter, verifyCsrfToken, validateBody(registerSchema), authController.register)
  .all(methodNotAllowed(['POST']));

router
  .route('/login')
  .post(authRateLimiter, verifyCsrfToken, validateBody(loginSchema), authController.login)
  .all(methodNotAllowed(['POST']));

router
  .route('/refresh')
  .post(verifyCsrfToken, authController.refresh)
  .all(methodNotAllowed(['POST']));

router
  .route('/logout')
  .post(verifyCsrfToken, authController.logout)
  .all(methodNotAllowed(['POST']));

// Rate-limited with the auth limiter - an attacker probing valid emails via
// the reset flow still counts as failed auth traffic.
router
  .route('/forgot-password')
  .post(authRateLimiter, verifyCsrfToken, validateBody(forgotPasswordSchema), authController.forgotPassword)
  .all(methodNotAllowed(['POST']));

router
  .route('/reset-password')
  .post(authRateLimiter, verifyCsrfToken, validateBody(resetPasswordSchema), authController.resetPassword)
  .all(methodNotAllowed(['POST']));

module.exports = router;
