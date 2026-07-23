const { z } = require('zod');

// Validates query parameters for listing audit logs. action and actorId are
// optional filters; they must be plain strings so mongo-sanitize cannot be
// bypassed by passing an object with $-prefixed operator keys.
const listAuditLogsSchema = z
  .object({
    page: z.coerce.number().int().positive().optional(),
    limit: z.coerce.number().int().positive().max(100).optional(),
    action: z.string().max(100).optional(),
    actorId: z.string().max(100).optional(),
  })
  .strict();

module.exports = { listAuditLogsSchema };
