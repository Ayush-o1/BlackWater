import { AppError } from '../utils/AppError.js';

// Allows the request only if the authenticated user has one of the given roles.
// Must run after requireAuth, which is what sets req.user.
export const requireRole = (...allowedRoles) => (req, res, next) => {
  if (!req.user) {
    return next(new AppError('Unauthorized: User not authenticated', 401));
  }

  if (!allowedRoles.includes(req.user.role)) {
    return next(
      new AppError(`Forbidden: Requires one of the following roles: ${allowedRoles.join(', ')}`, 403)
    );
  }

  next();
};
