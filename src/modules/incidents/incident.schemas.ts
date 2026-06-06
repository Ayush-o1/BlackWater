import { z } from 'zod';
import { Severity, IncidentStatus } from '@prisma/client';

export const createIncidentSchema = z.object({
  body: z.object({
    title: z.string().min(5, 'Title must be at least 5 characters'),
    description: z.string().optional(),
    severity: z.nativeEnum(Severity),
    serviceIds: z.array(z.string().uuid()).optional().default([]),
  }),
});

export const listIncidentsSchema = z.object({
  query: z.object({
    status: z.nativeEnum(IncidentStatus).optional(),
    severity: z.nativeEnum(Severity).optional(),
    assigneeId: z.string().uuid().optional(),
    serviceId: z.string().uuid().optional(),
    page: z.string().regex(/^\d+$/).transform(Number).optional().default('1'),
    limit: z.string().regex(/^\d+$/).transform(Number).optional().default('10'),
  }),
});

export const assignIncidentSchema = z.object({
  params: z.object({ id: z.string().uuid('Invalid incident ID') }),
  body: z.object({
    assigneeId: z.string().uuid('Invalid assignee ID'),
  }),
});

export const addUpdateSchema = z.object({
  params: z.object({ id: z.string().uuid('Invalid incident ID') }),
  body: z.object({
    message: z.string().min(1, 'Message is required'),
    isPublic: z.boolean().optional().default(false),
  }),
});

export const changeStatusSchema = z.object({
  params: z.object({ id: z.string().uuid('Invalid incident ID') }),
  body: z.object({
    status: z.nativeEnum(IncidentStatus),
  }),
});

export const getIncidentSchema = z.object({
  params: z.object({ id: z.string().uuid('Invalid incident ID') }),
});

export type CreateIncidentInput = z.infer<typeof createIncidentSchema>['body'];
export type ListIncidentsQuery = z.infer<typeof listIncidentsSchema>['query'];
export type AssignIncidentInput = z.infer<typeof assignIncidentSchema>['body'];
export type AddUpdateInput = z.infer<typeof addUpdateSchema>['body'];
export type ChangeStatusInput = z.infer<typeof changeStatusSchema>['body'];
