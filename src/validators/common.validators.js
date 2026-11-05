import { z } from 'zod';

export const uuid = (label) => z.uuid(`Invalid ${label}`);

// Emails are trimmed and lowercased before they are validated or stored, so
// "Ana@Example.com " and "ana@example.com" are the same account.
export const emailField = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email('Invalid email address').max(255, 'Email must be at most 255 characters'));

// bcrypt only uses the first 72 bytes of a password, so longer input would be
// silently truncated. Reject it instead of pretending to accept it.
export const newPasswordField = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(72, 'Password must be at most 72 characters');

export const personNameField = z
  .string()
  .trim()
  .min(2, 'Name must be at least 2 characters')
  .max(100, 'Name must be at most 100 characters');

// Shared query parameters for every cursor-paginated list endpoint.
// Query strings arrive as text, so `limit` is coerced to a number; zod 4 would
// otherwise keep a string default and `limit + 1` would become "201".
export const paginationQuery = {
  cursor: z.uuid().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
};
