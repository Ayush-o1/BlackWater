import { ZodError } from 'zod';
import { AppError } from '../utils/AppError.js';

// Validates req.body, req.query and req.params against a zod schema shaped like
// z.object({ body, query, params }). On success the cleaned values (trimmed,
// converted, defaults applied) replace the raw ones, so controllers never see
// unvalidated input.
export const validateRequest = (schema) => (req, res, next) => {
  try {
    const parsed = schema.parse({ body: req.body, query: req.query, params: req.params });

    if (parsed.body !== undefined) req.body = parsed.body;
    if (parsed.query !== undefined) req.query = parsed.query;
    if (parsed.params !== undefined) req.params = parsed.params;

    next();
  } catch (error) {
    if (error instanceof ZodError) {
      const details = error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join(', ');
      return next(new AppError(`Validation Error: ${details}`, 400));
    }
    next(error);
  }
};
