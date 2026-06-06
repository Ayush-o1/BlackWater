import { z } from 'zod';

export const createServiceSchema = z.object({
  body: z.object({
    name: z.string().min(2, 'Name must be at least 2 characters'),
    description: z.string().optional(),
  }),
});

export const updateServiceSchema = z.object({
  params: z.object({ id: z.string().uuid('Invalid service ID') }),
  body: z.object({
    name: z.string().min(2).optional(),
    description: z.string().optional(),
  }),
});

export const getServiceSchema = z.object({
  params: z.object({ id: z.string().uuid('Invalid service ID') }),
});

export const deleteServiceSchema = z.object({
  params: z.object({ id: z.string().uuid('Invalid service ID') }),
});

export type CreateServiceInput = z.infer<typeof createServiceSchema>['body'];
export type UpdateServiceInput = z.infer<typeof updateServiceSchema>['body'];
