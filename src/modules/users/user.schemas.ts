import { z } from 'zod';

export const updateProfileSchema = z.object({
  body: z.object({
    name: z.string().min(2, 'Name must be at least 2 characters'),
  }),
});

export const listUsersSchema = z.object({
  query: z.object({
    cursor: z.string().uuid().optional(),
    limit: z.string().regex(/^\d+$/).transform(Number).optional().default('20'),
  }),
});

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>['body'];
export type ListUsersQuery = z.infer<typeof listUsersSchema>['query'];
