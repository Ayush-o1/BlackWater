import { z } from 'zod';

export const uuid = (label) => z.uuid(`Invalid ${label}`);

// Shared query parameters for every cursor-paginated list endpoint.
// Query strings arrive as text, so `limit` is coerced to a number; zod 4 would
// otherwise keep a string default and `limit + 1` would become "201".
export const paginationQuery = {
  cursor: z.uuid().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
};
