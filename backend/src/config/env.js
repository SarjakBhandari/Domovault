const { z } = require('zod');

const envSchema = z.object({
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
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('Invalid environment configuration:');
  console.error(parsed.error.flatten().fieldErrors);
  throw new Error('Environment validation failed. Check backend/.env against .env.example.');
}

module.exports = parsed.data;
