import { verifyToken } from '../utils/jwt.js';
import { AppError } from '../utils/AppError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import * as authService from '../services/auth.service.js';

// Authenticates a request from its "Authorization: Bearer <jwt>" header and
// sets req.user. Every protected route starts with this middleware.
export const requireAuth = asyncHandler(async (req, res, next) => {
  const header = req.headers.authorization;

  if (!header || !header.startsWith('Bearer ')) {
    throw new AppError('Unauthorized: Missing or invalid token format', 401);
  }

  const token = header.split(' ')[1];
  if (!token) {
    throw new AppError('Unauthorized: Missing token', 401);
  }

  let payload;
  try {
    payload = verifyToken(token);
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      throw new AppError('Unauthorized: Token expired', 401);
    }
    throw new AppError('Unauthorized: Invalid token', 401);
  }

  // The user is re-read from the database on every request instead of trusting
  // the role and orgId stored in the token. A deleted user stops working at once
  // and a changed role takes effect immediately, instead of after the token expires.
  try {
    req.user = await authService.getUserById(payload.userId);
  } catch (error) {
    // A valid token for a user who no longer exists is an authentication
    // failure (401), not "resource not found", so clients sign the user out.
    if (error instanceof AppError && error.statusCode === 404) {
      throw new AppError('Unauthorized: User no longer exists', 401);
    }
    throw error;
  }
  next();
});
