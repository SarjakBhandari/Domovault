const express = require('express');
const messagingController = require('../controllers/messaging.controller');
const { z } = require('zod');
const validateBody = require('../middleware/validateBody');
const methodNotAllowed = require('../middleware/methodGuard');
const { verifyCsrfToken } = require('../middleware/csrf');
const requireAuth = require('../middleware/requireAuth');
const requireRole = require('../middleware/requireRole');

const router = express.Router();

const sendMessageSchema = z
  .object({
    recipientId: z.string().min(1).max(64),
    body: z.string().trim().min(1).max(2000),
  })
  .strict();

// Only admin and tenant can use messaging.
router
  .route('/')
  .get(requireAuth, requireRole('admin', 'tenant'), messagingController.listConversations)
  .post(requireAuth, requireRole('admin', 'tenant'), verifyCsrfToken, validateBody(sendMessageSchema), messagingController.sendMessage)
  .all(methodNotAllowed(['GET', 'POST']));

// Get conversation with a specific user. The conversationId is derived
// server-side from the two user IDs  -  the client only supplies the other user's ID.
router
  .route('/:userId')
  .get(requireAuth, requireRole('admin', 'tenant'), messagingController.getConversation)
  .all(methodNotAllowed(['GET']));

module.exports = router;
