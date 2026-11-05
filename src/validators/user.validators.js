import { z } from 'zod';
import { paginationQuery } from './common.validators.js';

export const updateProfileSchema = z.object({
  body: z.object({
    name: z.string().min(2, 'Name must be at least 2 characters').max(100, 'Name must be at most 100 characters'),
  }),
});

export const listUsersSchema = z.object({
  query: z.object(paginationQuery),
});
