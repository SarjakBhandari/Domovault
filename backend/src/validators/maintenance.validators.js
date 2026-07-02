const { z } = require('zod');

const createMaintenanceSchema = z
  .object({
    description: z.string().trim().min(10).max(2000),
  })
  .strict();

// Admin-only status update. Tenant cannot set status or ownerNotes.
const updateMaintenanceStatusSchema = z
  .object({
    status: z.enum(['open', 'in_progress', 'resolved']),
    ownerNotes: z.string().trim().max(1000).optional(),
  })
  .strict();

module.exports = { createMaintenanceSchema, updateMaintenanceStatusSchema };
