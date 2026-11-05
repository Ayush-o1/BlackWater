import { Prisma } from '@prisma/client';
import { AppError } from '../utils/AppError.js';
import { env } from '../config/env.js';

// Turns an error from the libraries we use into an AppError when the client
// caused it, so the client gets a useful message instead of a bare 500.
function toClientError(err) {
  if (err instanceof AppError) return err;

  // express.json() rejects bad bodies with an error tagged by `type`.
  if (err.type === 'entity.parse.failed') return new AppError('Request body is not valid JSON', 400);
  if (err.type === 'entity.too.large') return new AppError('Request body is too large', 413);

  // A unique constraint was violated: two requests raced past an existence
  // check and the database stopped the second one.
  if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
    return new AppError('That record already exists', 409);
  }

  return null;
}

// Last middleware in the chain; every thrown or forwarded error ends up here.
// Express recognises it as an error handler by its four parameters.
// eslint-disable-next-line no-unused-vars
export const globalErrorHandler = (err, req, res, next) => {
  const clientError = toClientError(err);

  if (clientError) {
    return res.status(clientError.statusCode).json({ success: false, message: clientError.message });
  }

  // Anything else is a bug. Log it, and show details only while developing:
  // in production the message could contain SQL, file paths or other internals.
  console.error('Unexpected error:', err);
  res.status(500).json({
    success: false,
    message: env.NODE_ENV === 'development' ? err.message : 'Something went wrong!',
  });
};
