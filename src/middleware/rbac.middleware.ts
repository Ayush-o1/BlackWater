import { Request, Response, NextFunction } from 'express';
import { Role } from '@prisma/client';
import { AppError } from '../utils/errors/AppError';

/**
 * Middleware to enforce role-based access control.
 * Must be used after requireAuth middleware so req.user is populated.
 * 
 * @param roles Array of allowed roles
 */
export const requireRole = (...roles: Role[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    // 1. Ensure user is authenticated (defensive check)
    if (!req.user) {
      return next(new AppError('Unauthorized: User not authenticated', 401));
    }

    // 2. Check if user's role is in the allowed roles list
    if (!roles.includes(req.user.role as Role)) {
      return next(new AppError(`Forbidden: Requires one of the following roles: ${roles.join(', ')}`, 403));
    }

    // 3. User is authorized, proceed
    next();
  };
};
