const { z } = require('zod');

// Explicit allow-list of updatable fields. role, isVerified, failedLoginAttempts,
// and all other server-controlled fields are absent from this schema and
// therefore rejected by .strict() if submitted.
const updateProfileSchema = z
  .object({
    fullName: z.string().trim().min(2).max(100).optional(),
    // Phone is stored as a string (not parsed) since formatting varies by
    // country. The regex accepts common international formats.
    phone: z
      .string()
      .trim()
      .regex(/^\+?[0-9\s\-().]{7,30}$/)
      .optional(),
    bio: z.string().trim().max(500).optional(),
  })
  .strict();

const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1).max(128),
    newPassword: z.string().min(12).max(128),
  })
  .strict();

const deleteAccountSchema = z
  .object({
    password: z.string().min(1).max(128),
  })
  .strict();

module.exports = { updateProfileSchema, changePasswordSchema, deleteAccountSchema };
