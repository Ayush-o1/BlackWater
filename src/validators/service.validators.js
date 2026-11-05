import { z } from 'zod';
import { paginationQuery, uuid } from './common.validators.js';

const serviceIdParam = z.object({ id: uuid('service ID') });

export const createServiceSchema = z.object({
  body: z.object({
    name: z.string().min(2, 'Name must be at least 2 characters').max(200, 'Name must be at most 200 characters'),
    description: z.string().max(2000, 'Description must be at most 2000 characters').optional(),
  }),
});

export const updateServiceSchema = z.object({
  params: serviceIdParam,
  body: z.object({
    name: z.string().min(2).max(200).optional(),
    description: z.string().max(2000).optional(),
  }),
});

export const getServiceSchema = z.object({ params: serviceIdParam });

export const deleteServiceSchema = z.object({ params: serviceIdParam });

export const listServicesSchema = z.object({
  query: z.object(paginationQuery),
});
