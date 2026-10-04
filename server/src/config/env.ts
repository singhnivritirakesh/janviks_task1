import dotenv from 'dotenv';
import path from 'path';
import { z } from 'zod';

// Load .env if present (e.g. during local development)
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(5000),
  HOST: z.string().default('0.0.0.0'),
  DATABASE_URL: z.string().optional(),
  DB_FILE: z.string().default('playsphere.sqlite'),
  JWT_PRIVATE_KEY_PATH: z.string().default('server/keys/jwt_private.pem'),
  JWT_PUBLIC_KEY_PATH: z.string().default('server/keys/jwt_public.pem'),
  JWT_ACCESS_TOKEN_TTL_MINUTES: z.coerce.number().min(1).max(15).default(15),
  JWT_REFRESH_TOKEN_TTL_DAYS: z.coerce.number().min(1).max(30).default(7),
  JWT_ISSUER: z.string().default('playsphere-auth-service'),
  JWT_AUDIENCE: z.string().default('playsphere-client'),
  COOKIE_SECRET: z.string().min(16).default('playsphere-cookie-secret-key-32-chars-long!'),
  COOKIE_DOMAIN: z.string().optional(),
  COOKIE_SECURE: z.preprocess((val) => val === 'true' || val === true, z.boolean()).default(false),
  CORS_ALLOWED_ORIGINS: z.string().default('http://localhost:5173,http://localhost:8080,https://localhost,http://localhost:5000'),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().default(900000), // 15 mins
  RATE_LIMIT_MAX_REQUESTS: z.coerce.number().default(100),
  MAX_LOGIN_ATTEMPTS: z.coerce.number().default(5),
  LOCKOUT_DURATION_MINUTES: z.coerce.number().default(15),
  ALERT_FAILED_LOGIN_THRESHOLD: z.coerce.number().default(5),
  ALERT_FAILED_LOGIN_WINDOW_MINUTES: z.coerce.number().default(10),
  ALERT_UNAUTHORIZED_THRESHOLD: z.coerce.number().default(5),
  ALERT_UNAUTHORIZED_WINDOW_MINUTES: z.coerce.number().default(5),
  ALERT_DATA_EXPORT_THRESHOLD: z.coerce.number().default(100),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ FATAL: Invalid or missing environment configuration:');
  console.error(JSON.stringify(parsed.error.format(), null, 2));
  process.exit(1);
}

export const env = parsed.data;
