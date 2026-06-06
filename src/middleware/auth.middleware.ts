import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../utils/jwt';
import { AppError } from '../utils/errors/AppError';
import { AuthService } from '../modules/auth/auth.service';

export const requireAuth = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new AppError('Unauthorized: Missing or invalid token format', 401);
    }

    const token = authHeader.split(' ')[1];

    if (!token) {
      throw new AppError('Unauthorized: Missing token', 401);
    }

    try {
      // Verify token
      const decoded = verifyToken(token);
      
      // Load user from database to ensure they still exist and token data is fresh
      const user = await AuthService.getUserById(decoded.userId);

      // Attach user to request
      req.user = user;
      
      next();
    } catch (error: any) {
      if (error.name === 'TokenExpiredError') {
        throw new AppError('Unauthorized: Token expired', 401);
      }
      if (error.name === 'JsonWebTokenError') {
        throw new AppError('Unauthorized: Invalid token', 401);
      }
      throw error;
    }
  } catch (error) {
    next(error);
  }
};
