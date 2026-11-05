import { z } from 'zod';
import { emailField, newPasswordField, personNameField } from './common.validators.js';

export const registerSchema = z.object({
  body: z.object({
    name: personNameField,
    email: emailField,
    password: newPasswordField,
    orgName: z
      .string()
      .trim()
      .min(2, 'Organization name is required')
      .max(200, 'Organization name must be at most 200 characters'),
  }),
});

export const loginSchema = z.object({
  body: z.object({
    email: emailField,
    password: z.string().min(1, 'Password is required'),
  }),
});
