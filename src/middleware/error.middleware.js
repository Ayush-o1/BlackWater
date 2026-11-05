import { AppError } from '../utils/AppError.js';
import { env } from '../config/env.js';

// Last middleware in the chain; every thrown or forwarded error ends up here.
// Express recognises it as an error handler by its four parameters.
// eslint-disable-next-line no-unused-vars
export const globalErrorHandler = (err, req, res, next) => {
  const statusCode = err.statusCode || 500;

  if (env.NODE_ENV === 'development') {
    return res.status(statusCode).json({
      status: 'error',
      message: err.message || 'Internal Server Error',
      stack: err.stack,
    });
  }

  // Outside development only errors we raised deliberately may explain
  // themselves. Anything else could contain SQL, file paths or other internals.
  if (err instanceof AppError && err.isOperational) {
    return res.status(statusCode).json({ status: 'error', message: err.message });
  }

  console.error('Unexpected error:', err);
  res.status(500).json({ status: 'error', message: 'Something went wrong!' });
};
