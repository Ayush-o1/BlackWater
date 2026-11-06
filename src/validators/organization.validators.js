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

// Both are required: the password proves it is really the administrator (a stolen
// token alone must not be able to erase an organization), and typing the exact
// name makes sure they are deleting the one they mean to.
export const deleteOrgSchema = z.object({
  body: z.object({
    password: z.string().min(1, 'Password is required').max(200),
    confirmName: z.string().trim().min(1, 'Type the organization name to confirm').max(200),
  }),
});
