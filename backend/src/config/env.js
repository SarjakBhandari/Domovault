const { z } = require('zod');

const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().positive().default(4000),
    MONGODB_URI: z.string().min(1, 'MONGODB_URI is required'),
    CORS_ORIGIN: z.string().min(1, 'CORS_ORIGIN is required'),
    JWT_ALGORITHM: z.literal('HS256'),
    JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET must be at least 32 characters'),
    JWT_ACCESS_EXPIRES_IN: z.string().min(1).default('15m'),
    JWT_REFRESH_SECRET: z.string().min(32, 'JWT_REFRESH_SECRET must be at least 32 characters'),
    JWT_REFRESH_EXPIRES_IN: z.string().min(1).default('15d'),
    // Separate secret from the access/refresh tokens: a leaked MFA challenge
    // token must never be usable to forge (or be confused with) a real
    // session token, even though both are signed with the same algorithm.
    JWT_MFA_SECRET: z.string().min(32, 'JWT_MFA_SECRET must be at least 32 characters'),
    JWT_MFA_EXPIRES_IN: z.string().min(1).default('5m'),
    PII_ENCRYPTION_KEY: z
      .string()
      .refine((val) => Buffer.from(val, 'base64').length === 32, {
        message: 'PII_ENCRYPTION_KEY must be a base64-encoded 32-byte key',
      }),
    // "none" leaves CAPTCHA off (the local/dev default). "test" is a
    // deterministic stand-in for integration tests - it is refused outside
    // NODE_ENV=test/development below so it can never end up protecting a
    // real deployment.
    CAPTCHA_PROVIDER: z.enum(['none', 'hcaptcha', 'recaptcha', 'test']).default('none'),
    CAPTCHA_SECRET_KEY: z.string().optional(),
    CAPTCHA_TRIGGER_THRESHOLD: z.coerce.number().int().positive().default(5),
    // Base URL used when building links (e.g. password-reset emails) so they
    // are never constructed from req.headers.host (host-header attack prevention).
    APP_URL: z.string().url().default('http://localhost:3000'),
    // Directory where uploaded files are stored. Must be writable by the
    // process and located outside the web root so files are never served
    // directly by the HTTP server.
    UPLOAD_DIR: z.string().min(1).default('uploads'),
    // Optional comma-separated domain allow-list for outbound URL fetches
    // (property photo import). Empty = no restriction beyond IP-range blocking.
    SSRF_ALLOWED_DOMAINS: z.string().default(''),
    // Optional seed credentials for the admin user created on first startup.
    // Only honoured when NODE_ENV is not 'production'.
    ADMIN_SEED_EMAIL: z.string().email().optional(),
    ADMIN_SEED_PASSWORD: z.string().min(12).optional(),
  })
  .superRefine((config, ctx) => {
    if (['hcaptcha', 'recaptcha'].includes(config.CAPTCHA_PROVIDER) && !config.CAPTCHA_SECRET_KEY) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['CAPTCHA_SECRET_KEY'],
        message: 'CAPTCHA_SECRET_KEY is required when CAPTCHA_PROVIDER is hcaptcha or recaptcha',
      });
    }

    if (config.CAPTCHA_PROVIDER === 'test' && config.NODE_ENV === 'production') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['CAPTCHA_PROVIDER'],
        message: 'CAPTCHA_PROVIDER=test is not allowed when NODE_ENV=production',
      });
    }
  });

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('Invalid environment configuration:');
  console.error(parsed.error.flatten().fieldErrors);
  throw new Error('Environment validation failed. Check backend/.env against .env.example.');
}

module.exports = parsed.data;
