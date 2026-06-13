import { Request, Response, NextFunction } from 'express';
import { OrganizationService } from './organization.service';
import { successResponse } from '../../utils/response';

export class OrganizationController {
  static async getOrgDetails(req: Request, res: Response, next: NextFunction) {
    try {
      const org = await OrganizationService.getOrgDetails(req.user!.orgId);
      res.status(200).json(successResponse(org, 'Organization details retrieved successfully'));
    } catch (error) {
      next(error);
    }
  }

  static async updateOrg(req: Request, res: Response, next: NextFunction) {
    try {
      const org = await OrganizationService.updateOrg(req.user!.orgId, req.body);
      res.status(200).json(successResponse(org, 'Organization updated successfully'));
    } catch (error) {
      next(error);
    }
  }
}
