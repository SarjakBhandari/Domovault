const { z } = require('zod');

// .strict() rejects any key outside this list outright - a request body
// containing role/isVerified (or anything else unexpected) fails validation
// before the controller ever sees it. The controller then also only ever
// destructures the named fields, so there is no second path for extra
// fields to slip through.
const registerSchema = z
  .object({
    fullName: z.string().trim().min(2).max(100),
    email: z.string().trim().toLowerCase().email().max(254),
    password: z.string().min(12).max(128),
  })
  .strict();

const loginSchema = z
  .object({
    email: z.string().trim().toLowerCase().email().max(254),
    password: z.string().min(1).max(128),
    // Only required once the account has hit CAPTCHA_TRIGGER_THRESHOLD
    // failed attempts - the controller enforces that, not this schema.
    captchaToken: z.string().max(2048).optional(),
  })
  .strict();

module.exports = { registerSchema, loginSchema };
