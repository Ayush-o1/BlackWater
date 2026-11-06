import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';
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
  // Signing a throwaway token is the only reliable way to know the library accepts
  // the value; otherwise a typo here would surface as a 500 at the first login.
  JWT_EXPIRES_IN: z
    .string()
    .default('1d')
    .refine(
      (value) => {
        try {
          jwt.sign({}, 'x'.repeat(32), { expiresIn: value });
          return true;
        } catch {
          return false;
        }
      },
      { message: 'must be a duration such as 12h, 7d or a number of seconds' }
    ),
  // Requests allowed per IP per 15 minutes: a strict limit for login, registration
  // and invitation links (they can be guessed at), and a looser one for the rest.
  AUTH_RATE_LIMIT: z.coerce.number().int().positive().default(20),
  // One page load makes about three API calls and open pages refetch on live events,
  // so a team behind one office address can use a few hundred requests in 15 minutes.
  API_RATE_LIMIT: z.coerce.number().int().positive().default(1000),
  // Number of reverse proxies in front of the app (0 when none). Needed so rate
  // limits see each visitor's real IP instead of the proxy's.
  TRUST_PROXY: z.coerce.number().int().min(0).default(0),
  // Which commit is running, reported by /health so a deployment check can tell
  // the new version from the old one. Render sets RENDER_GIT_COMMIT itself.
  COMMIT_SHA: z.string().min(1).optional(),
  RENDER_GIT_COMMIT: z.string().min(1).optional(),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('Invalid environment variables:');
  for (const issue of parsed.error.issues) {
    console.error(`  ${issue.path.join('.')}: ${issue.message}`);
  }
  process.exit(1);
}

export const env = {
  ...parsed.data,
  // Never guessed: null means the platform did not say.
  commit: parsed.data.COMMIT_SHA ?? parsed.data.RENDER_GIT_COMMIT ?? null,
};
