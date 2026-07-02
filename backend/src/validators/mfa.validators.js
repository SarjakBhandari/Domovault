const { z } = require('zod');

const enableMfaSchema = z
  .object({
    code: z.string().trim().regex(/^\d{6}$/, 'Code must be 6 digits'),
  })
  .strict();

const disableMfaSchema = z
  .object({
    password: z.string().min(1).max(128),
    code: z.string().trim().min(6).max(64),
  })
  .strict();

// code can be either a 6-digit TOTP code or a backup code - the controller
// tries TOTP first, then falls back to backup codes, so the schema only
// enforces a sane length, not a fixed format.
const verifyMfaSchema = z
  .object({
    mfaToken: z.string().min(1),
    code: z.string().trim().min(6).max(64),
    captchaToken: z.string().max(2048).optional(),
  })
  .strict();

module.exports = { enableMfaSchema, disableMfaSchema, verifyMfaSchema };
