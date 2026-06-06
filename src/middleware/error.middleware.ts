import { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/errors/AppError';
import { env } from '../config/env';

export const globalErrorHandler = (
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  let statusCode = err.statusCode || 500;
  let message = err.message || 'Internal Server Error';

  if (env.NODE_ENV === 'development') {
    res.status(statusCode).json({
      status: 'error',
      message,
      stack: err.stack,
      error: err,
    });
  } else {
    // Production mode: do not leak error details unless it's an operational error
    if (err instanceof AppError && err.isOperational) {
      res.status(statusCode).json({
        status: 'error',
        message,
      });
    } else {
      console.error('💥 ERROR:', err); // Log non-operational errors
      res.status(500).json({
        status: 'error',
        message: 'Something went wrong!',
      });
    }
  }
};
