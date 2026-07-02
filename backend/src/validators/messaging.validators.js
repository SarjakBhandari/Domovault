const { z } = require('zod');

const sendMessageSchema = z
  .object({
    // receiverId is validated as a MongoDB ObjectId string. The controller
    // additionally verifies the receiver is the property owner (for applicants)
    // or an applicant/tenant (for admins) to prevent arbitrary messaging.
    receiverId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid receiver ID'),
    content: z.string().trim().min(1).max(2000),
  })
  .strict();

module.exports = { sendMessageSchema };
