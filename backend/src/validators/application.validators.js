const { z } = require('zod');

const createApplicationSchema = z
  .object({
    propertyId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid property ID'),
    notes: z.string().trim().max(1000).optional().default(''),
  })
  .strict();

// Admin-only: approve or reject an application. Only status is accepted
// here - the admin cannot change anything else about the application body.
const reviewApplicationSchema = z
  .object({
    status: z.enum(['approved', 'rejected']),
    notes: z.string().trim().max(1000).optional().default(''),
  })
  .strict();

module.exports = { createApplicationSchema, reviewApplicationSchema };
