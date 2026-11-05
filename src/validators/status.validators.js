import { z } from 'zod';
import { IncidentStatus } from '@prisma/client';
import { paginationQuery, uuid } from './common.validators.js';

const orgIdQuery = { orgId: uuid('Organization ID provided in query') };

export const publicOrgSchema = z.object({
  query: z.object(orgIdQuery),
});

export const publicIncidentSchema = z.object({
  query: z.object(orgIdQuery),
  params: z.object({ id: uuid('Incident ID') }),
});

export const publicIncidentsListSchema = z.object({
  query: z.object({
    ...orgIdQuery,
    status: z.enum(Object.values(IncidentStatus)).optional(),
    ...paginationQuery,
  }),
});
