const { z } = require('zod');

// Owner confirms or rejects a payment proof. The 'amount' field is intentionally
// absent - the server never reads a client-supplied amount for this transition.
const confirmPaymentSchema = z
  .object({
    decision: z.enum(['confirmed', 'rejected']),
    rejectionReason: z.string().trim().max(500).optional(),
  })
  .strict();

module.exports = { confirmPaymentSchema };
