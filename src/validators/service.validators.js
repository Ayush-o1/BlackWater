import { z } from 'zod';
import { paginationQuery, uuid } from './common.validators.js';

const serviceIdParam = z.object({ id: uuid('service ID') });
const nameField = z.string().trim().min(2, 'Name must be at least 2 characters').max(200, 'Name must be at most 200 characters');
const descriptionField = z.string().max(2000, 'Description must be at most 2000 characters');

export const createServiceSchema = z.object({
  body: z.object({ name: nameField, description: descriptionField.optional() }),
});

export const updateServiceSchema = z.object({
  params: serviceIdParam,
  // An empty edit would change nothing yet tell every open page that something changed.
  body: z
    .object({ name: nameField.optional(), description: descriptionField.optional() })
    .refine((body) => Object.keys(body).length > 0, { message: 'Provide at least one field to update' }),
});

export const getServiceSchema = z.object({ params: serviceIdParam });

export const deleteServiceSchema = z.object({ params: serviceIdParam });

export const listServicesSchema = z.object({
  query: z.object(paginationQuery),
});
