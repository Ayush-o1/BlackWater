import { Request, Response, NextFunction } from 'express';
import { UserService } from './user.service';
import { successResponse } from '../../utils/response';

export class UserController {
  static async listUsers(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await UserService.listUsers(req.user!.orgId, req.query as any);
      res.status(200).json(successResponse(result.data, 'Users retrieved successfully', result.pagination));
    } catch (error) {
      next(error);
    }
  }

  static async getMe(req: Request, res: Response, next: NextFunction) {
    try {
      // Fetch fresh data for the logged-in user
      const user = await UserService.getUserById(req.user!.id, req.user!.orgId);
      res.status(200).json(successResponse(user, 'Current user retrieved successfully'));
    } catch (error) {
      next(error);
    }
  }

  static async updateProfile(req: Request, res: Response, next: NextFunction) {
    try {
      const user = await UserService.updateProfile(req.user!.id, req.user!.orgId, req.body);
      res.status(200).json(successResponse(user, 'Profile updated successfully'));
    } catch (error) {
      next(error);
    }
  }
}
