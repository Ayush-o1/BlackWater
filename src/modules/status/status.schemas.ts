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
    page: z.string().regex(/^\d+$/).transform(Number).default('1'),
    limit: z.string().regex(/^\d+$/).transform(Number).default('10'),
    status: z.string().optional(),
  }),
});

export type PublicIncidentsListQuery = z.infer<typeof publicIncidentsListSchema>['query'];
