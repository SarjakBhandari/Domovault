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
    // Base URL used when building links (e.g. password-reset emails) so they
    // are never constructed from req.headers.host (host-header attack prevention).
    APP_URL: z.string().url().default('http://localhost:3000'),
    // Located outside the web root so files are never served directly by the HTTP server.
    UPLOAD_DIR: z.string().min(1).default('uploads'),
    // Optional comma-separated domain allow-list for outbound URL fetches
    // (property photo import). Empty = no restriction beyond IP-range blocking.
    SSRF_ALLOWED_DOMAINS: z.string().default(''),
    ADMIN_SEED_EMAIL: z.string().email().optional(),
    ADMIN_SEED_PASSWORD: z.string().min(12).optional(),
    SMTP_HOST: z.string().min(1).default('localhost'),
    SMTP_PORT: z.coerce.number().int().positive().default(1025),
    SMTP_SECURE: z
      .string()
      .transform((v) => v === 'true')
      .default('false'),
    SMTP_USER: z.string().optional(),
    SMTP_PASS: z.string().optional(),
    SMTP_FROM: z.string().default('noreply@domovault.local'),
    // IP-level rate limiter tunables. Window in ms, max requests per window.
    RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(15 * 60 * 1000),
    RATE_LIMIT_MAX: z.coerce.number().int().positive().default(300),
    // Auth-specific tighter limits (login / register / reset endpoints).
    RATE_LIMIT_AUTH_WINDOW_MS: z.coerce.number().int().positive().default(15 * 60 * 1000),
    RATE_LIMIT_AUTH_MAX: z.coerce.number().int().positive().default(20),
  });

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('Invalid environment configuration:');
  console.error(parsed.error.flatten().fieldErrors);
  throw new Error('Environment validation failed. Check backend/.env against .env.example.');
}

module.exports = parsed.data;
