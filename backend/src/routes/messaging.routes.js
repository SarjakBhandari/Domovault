const express = require('express');
const messagingController = require('../controllers/messaging.controller');
const { sendMessageSchema } = require('../validators/messaging.validators');
const validateBody = require('../middleware/validateBody');
const methodNotAllowed = require('../middleware/methodGuard');
const { verifyCsrfToken } = require('../middleware/csrf');
const requireAuth = require('../middleware/requireAuth');
const { authRateLimiter } = require('../middleware/rateLimit');

const router = express.Router();

// List all conversations for the caller.
router
  .route('/')
  .get(requireAuth, messagingController.listConversations)
  .all(methodNotAllowed(['GET']));

// Get a conversation thread (all messages on a property between two users).
router
  .route('/:propertyId/:partnerId')
  .get(requireAuth, messagingController.getConversation)
  .all(methodNotAllowed(['GET']));

// Send a message on a property thread. Rate-limited to discourage flooding.
router
  .route('/:propertyId')
  .post(authRateLimiter, requireAuth, verifyCsrfToken, validateBody(sendMessageSchema), messagingController.sendMessage)
  .all(methodNotAllowed(['POST']));

module.exports = router;
