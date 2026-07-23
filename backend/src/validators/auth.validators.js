const { z } = require('zod');

// .strict() rejects any key outside this list outright - a request body
// containing role/isVerified (or anything else unexpected) fails validation
// before the controller ever sees it. The controller then also only ever
// destructures the named fields, so there is no second path for extra
// fields to slip through.
const strongPassword = z
  .string()
  .min(12, 'Password must be at least 12 characters')
  .max(128)
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
  .regex(/[0-9]/, 'Password must contain at least one number')
  .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character');

const registerSchema = z
  .object({
    fullName: z.string().trim().min(2).max(100),
    email: z.string().trim().toLowerCase().email().max(254),
    password: strongPassword,
  })
  .strict();

const loginSchema = z
  .object({
    email: z.string().trim().toLowerCase().email().max(254),
    password: z.string().min(1).max(128),
    rememberMe: z.boolean().optional().default(false),
  })
  .strict();

const forgotPasswordSchema = z
  .object({
    email: z.string().trim().toLowerCase().email().max(254),
  })
  .strict();

// Token is 32 random bytes rendered as a 64-char hex string.
// The email is required so we can look up the user without exposing
// whether any given email exists (we do a constant-time-ish lookup and
// always return the same success response regardless).
const resetPasswordSchema = z
  .object({
    token: z.string().length(64),
    email: z.string().trim().toLowerCase().email().max(254),
    password: strongPassword,
  })
  .strict();

const verifyEmailSchema = z
  .object({
    email: z.string().trim().toLowerCase().email().max(254),
    otp: z.string().regex(/^\d{6}$/, 'OTP must be exactly 6 digits'),
  })
  .strict();

const resendOtpSchema = z
  .object({
    email: z.string().trim().toLowerCase().email().max(254),
  })
  .strict();

module.exports = { registerSchema, loginSchema, forgotPasswordSchema, resetPasswordSchema, verifyEmailSchema, resendOtpSchema };
