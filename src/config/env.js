import dotenv from 'dotenv';
import { z } from 'zod';

// Load variables from .env into process.env. dotenv never overwrites variables
// that are already set, which is how the test setup swaps in .env.test.
dotenv.config();

// Validate once at startup so a missing or weak setting stops the server
// immediately instead of surfacing later as a confusing runtime error.
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().positive().default(8000),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  JWT_EXPIRES_IN: z.string().default('1d'),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),
  // Number of reverse proxies in front of the app (0 when none). Needed so rate
  // limits see each visitor's real IP instead of the proxy's.
  // Requests allowed per IP per 15 minutes: a strict limit for login, registration
  // and invitation links (they can be guessed at), and a looser one for the rest.
  AUTH_RATE_LIMIT: z.coerce.number().int().positive().default(20),
  API_RATE_LIMIT: z.coerce.number().int().positive().default(300),
  TRUST_PROXY: z.coerce.number().int().min(0).default(0),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('Invalid environment variables:');
  for (const issue of parsed.error.issues) {
    console.error(`  ${issue.path.join('.')}: ${issue.message}`);
  }
  process.exit(1);
}

export const env = parsed.data;
