import { z } from 'zod';
import { IncidentStatus, Severity } from '@prisma/client';
import { paginationQuery, uuid } from './common.validators.js';

const incidentIdParam = z.object({ id: uuid('incident ID') });
const titleField = z.string().trim().min(5, 'Title must be at least 5 characters').max(200, 'Title must be at most 200 characters');
const descriptionField = z.string().max(5000, 'Description must be at most 5000 characters');
const serviceIdsField = z.array(z.uuid()).max(100);

export const createIncidentSchema = z.object({
  body: z.object({
    title: titleField,
    description: descriptionField.optional(),
    severity: z.enum(Object.values(Severity)),
    serviceIds: serviceIdsField.default([]),
    isPublic: z.boolean().default(false), // private unless the creator says otherwise
  }),
});

// Only these fields can be edited here. Status, assignee and visibility have
// their own endpoints because each is validated and audited differently; unknown
// fields are dropped by zod, so they cannot be smuggled in through an edit.
export const editIncidentSchema = z.object({
  params: incidentIdParam,
  body: z
    .object({
      title: titleField,
      description: descriptionField.nullable(),
      severity: z.enum(Object.values(Severity)),
      serviceIds: serviceIdsField,
    })
    .partial()
    .refine((body) => Object.keys(body).length > 0, { message: 'Provide at least one field to update' }),
});

export const listIncidentsSchema = z.object({
  query: z.object({
    status: z.enum(Object.values(IncidentStatus)).optional(),
    severity: z.enum(Object.values(Severity)).optional(),
    assigneeId: z.uuid().optional(),
    serviceId: z.uuid().optional(),
    // Title search, case-insensitive.
    q: z.string().trim().min(1).max(200).optional(),
    // "true" limits the list to incidents still being worked (triggered or acknowledged).
    open: z.enum(['true', 'false']).transform((value) => value === 'true').optional(),
    // priority: worst severity first, then newest. The order has to come from the
    // database: sorting one page in the browser would be wrong as soon as there are two.
    sort: z.enum(['newest', 'priority']).default('newest'),
    ...paginationQuery,
  }),
});

export const getIncidentSchema = z.object({ params: incidentIdParam });

export const assignIncidentSchema = z.object({
  params: incidentIdParam,
  // null removes the current assignee.
  body: z.object({ assigneeId: uuid('assignee ID').nullable() }),
});

export const addUpdateSchema = z.object({
  params: incidentIdParam,
  body: z.object({
    message: z.string().trim().min(1, 'Message is required').max(5000, 'Message must be at most 5000 characters'),
    isPublic: z.boolean().default(false),
  }),
});

export const changeStatusSchema = z.object({
  params: incidentIdParam,
  body: z.object({ status: z.enum(Object.values(IncidentStatus)) }),
});

export const changeVisibilitySchema = z.object({
  params: incidentIdParam,
  body: z.object({ isPublic: z.boolean() }),
});
