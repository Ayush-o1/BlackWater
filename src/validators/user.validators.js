import { z } from 'zod';
import { Role } from '@prisma/client';
import { paginationQuery, personNameField, uuid } from './common.validators.js';

export const updateProfileSchema = z.object({
  body: z.object({ name: personNameField }),
});

export const listUsersSchema = z.object({
  query: z.object(paginationQuery),
});

export const changeRoleSchema = z.object({
  params: z.object({ id: uuid('user ID') }),
  body: z.object({ role: z.enum(Object.values(Role)) }),
});
