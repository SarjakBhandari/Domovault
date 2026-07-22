const express = require('express');
const oauthController = require('../controllers/oauth.controller');
const methodNotAllowed = require('../middleware/methodGuard');
const { authRateLimiter } = require('../middleware/rateLimit');

const router = express.Router();

// Initiate route is rate-limited  -  it makes outbound fetches and generates
// cookies. Callback route is NOT rate-limited because the provider calls
// it and adding a limiter there could block legitimate returning users.
// CSRF via verifyCsrfToken is NOT used here: the OAuth state parameter is
// the CSRF mechanism for this flow (RFC 6749 Section10.12).

router
  .route('/google')
  .get(authRateLimiter, oauthController.initiateGoogle)
  .all(methodNotAllowed(['GET']));

router
  .route('/google/callback')
  .get(oauthController.callbackGoogle)
  .all(methodNotAllowed(['GET']));

module.exports = router;
