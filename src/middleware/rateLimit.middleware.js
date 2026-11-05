import rateLimit from 'express-rate-limit';
import { env } from '../config/env.js';

const FIFTEEN_MINUTES = 15 * 60 * 1000;

export const createRateLimiter = ({ windowMs = FIFTEEN_MINUTES, limit, ...options }) =>
  rateLimit({
    windowMs,
    limit,
    ...options,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, message: 'Too many requests, please try again later' },
  });

// Registration and invitation links. Attach this to the endpoints that can be
// guessed at or abused, never to a whole router: GET /auth/me is called on every
// signed-in page load and must not spend this small budget.
export const authLimiter = createRateLimiter({ limit: env.AUTH_RATE_LIMIT });

// Login counts only the attempts that fail. That is what stops password guessing,
// while the many people behind one office or school address can all sign in
// without using up each other's allowance.
export const loginLimiter = createRateLimiter({ limit: env.AUTH_RATE_LIMIT, skipSuccessfulRequests: true });

// Baseline for the whole API.
export const apiLimiter = createRateLimiter({ limit: env.API_RATE_LIMIT });
