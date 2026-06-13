import { z } from 'zod';

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
    limit: z.string().regex(/^\d+$/).transform(Number).optional().default('20'),
    status: z.string().optional(),
  }),
});

export type PublicIncidentsListQuery = z.infer<typeof publicIncidentsListSchema>['query'];
