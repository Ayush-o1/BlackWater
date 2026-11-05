import { z } from 'zod';
import { IncidentStatus, Severity } from '@prisma/client';
import { paginationQuery, uuid } from './common.validators.js';

const incidentIdParam = z.object({ id: uuid('incident ID') });

export const createIncidentSchema = z.object({
  body: z.object({
    title: z.string().min(5, 'Title must be at least 5 characters').max(200, 'Title must be at most 200 characters'),
    description: z.string().max(5000, 'Description must be at most 5000 characters').optional(),
    severity: z.enum(Object.values(Severity)),
    serviceIds: z.array(z.uuid()).max(100).default([]),
  }),
});

export const listIncidentsSchema = z.object({
  query: z.object({
    status: z.enum(Object.values(IncidentStatus)).optional(),
    severity: z.enum(Object.values(Severity)).optional(),
    assigneeId: z.uuid().optional(),
    serviceId: z.uuid().optional(),
    ...paginationQuery,
  }),
});

export const getIncidentSchema = z.object({ params: incidentIdParam });

export const assignIncidentSchema = z.object({
  params: incidentIdParam,
  body: z.object({ assigneeId: uuid('assignee ID') }),
});

export const addUpdateSchema = z.object({
  params: incidentIdParam,
  body: z.object({
    message: z.string().min(1, 'Message is required').max(5000, 'Message must be at most 5000 characters'),
    isPublic: z.boolean().default(false),
  }),
});

export const changeStatusSchema = z.object({
  params: incidentIdParam,
  body: z.object({ status: z.enum(Object.values(IncidentStatus)) }),
});
