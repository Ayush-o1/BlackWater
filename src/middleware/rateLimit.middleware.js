import rateLimit from 'express-rate-limit';
import { env } from '../config/env.js';

const FIFTEEN_MINUTES = 15 * 60 * 1000;

export const createRateLimiter = ({ windowMs = FIFTEEN_MINUTES, limit }) =>
  rateLimit({
    windowMs,
    limit,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, message: 'Too many requests, please try again later' },
  });

// Login, registration and invitation links: all of these can be guessed at.
export const authLimiter = createRateLimiter({ limit: env.AUTH_RATE_LIMIT });

// Baseline for the whole API.
export const apiLimiter = createRateLimiter({ limit: env.API_RATE_LIMIT });
