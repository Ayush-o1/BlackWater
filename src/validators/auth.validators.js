import { z } from 'zod';

export const registerSchema = z.object({
  body: z.object({
    name: z.string().min(2, 'Name must be at least 2 characters').max(100, 'Name must be at most 100 characters'),
    email: z.string().email('Invalid email address').max(255, 'Email must be at most 255 characters'),
    // bcrypt only uses the first 72 bytes of a password, so longer input
    // would be silently truncated. Reject it instead.
    password: z.string().min(8, 'Password must be at least 8 characters').max(72, 'Password must be at most 72 characters'),
    orgName: z.string().min(2, 'Organization name is required').max(200, 'Organization name must be at most 200 characters'),
  }),
});

export const loginSchema = z.object({
  body: z.object({
    email: z.string().email('Invalid email address'),
    password: z.string().min(1, 'Password is required'),
  }),
});
