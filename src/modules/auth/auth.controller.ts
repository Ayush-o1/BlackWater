import { Request, Response, NextFunction } from 'express';
import { AuthService } from './auth.service';
import { successResponse } from '../../utils/response';

export class AuthController {
  static async register(req: Request, res: Response, next: NextFunction) {
    try {
      const user = await AuthService.register(req.body);
      res.status(201).json(successResponse(user, 'User registered successfully'));
    } catch (error) {
      next(error);
    }
  }

  static async login(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await AuthService.login(req.body);
      res.status(200).json(successResponse(result, 'Login successful'));
    } catch (error) {
      next(error);
    }
  }

  static async getCurrentUser(req: Request, res: Response, next: NextFunction) {
    try {
      // req.user is guaranteed to be set by the auth.middleware at this point
      const userId = req.user!.id;
      const user = await AuthService.getUserById(userId);
      res.status(200).json(successResponse(user, 'Current user retrieved successfully'));
    } catch (error) {
      next(error);
    }
  }
}
