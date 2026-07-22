import { z } from 'zod';
import { IncidentStatus } from '@prisma/client';

export const publicOrgSchema = z.object({
  query: z.object({
    orgId: z.string().uuid('Invalid Organization ID provided in query'),
  }),
});

export const publicIncidentSchema = z.object({
  query: z.object({
    orgId: z.string().uuid('Invalid Organization ID provided in query'),
  }),
  params: z.object({
    id: z.string().uuid('Invalid Incident ID'),
  }),
});

export const publicIncidentsListSchema = z.object({
  query: z.object({
    orgId: z.string().uuid('Invalid Organization ID provided in query'),
    cursor: z.string().uuid().optional(),
    limit: z.string().regex(/^\d+$/).transform(Number).pipe(z.number().min(1).max(100)).optional().default('20'),
    status: z.nativeEnum(IncidentStatus).optional(),
  }),
});

export type PublicIncidentsListQuery = z.infer<typeof publicIncidentsListSchema>['query'];
