import { z } from 'zod';

export const updateOrgSchema = z.object({
  body: z.object({
    // Trimmed first, like the name given at registration, so spaces cannot make a blank name.
    name: z
      .string()
      .trim()
      .min(2, 'Organization name must be at least 2 characters')
      .max(200, 'Organization name must be at most 200 characters'),
  }),
});
