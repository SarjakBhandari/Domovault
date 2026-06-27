const express = require('express');
const authController = require('../controllers/auth.controller');
const { registerSchema, loginSchema } = require('../validators/auth.validators');
const validateBody = require('../middleware/validateBody');
const methodNotAllowed = require('../middleware/methodGuard');
const { issueCsrfToken, verifyCsrfToken } = require('../middleware/csrf');
const { authRateLimiter } = require('../middleware/rateLimit');

const router = express.Router();

// Every path below is whitelisted to exactly the method it needs. Any other
// verb on the same path (GET on /login, PUT on /register, etc.) hits the
// trailing .all() and gets a 405 with an Allow header, not a generic 404.
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

module.exports = router;
