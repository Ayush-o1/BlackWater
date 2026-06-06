import { Request, Response, NextFunction } from 'express';
import { StatusService } from './status.service';
import { successResponse } from '../../utils/response';
import { PublicIncidentsListQuery } from './status.schemas';

export class StatusController {
  static async getOverview(req: Request, res: Response, next: NextFunction) {
    try {
      const orgId = req.query.orgId as string;
      const data = await StatusService.getOverview(orgId);
      res.status(200).json(successResponse(data));
    } catch (error) {
      next(error);
    }
  }

  static async getServices(req: Request, res: Response, next: NextFunction) {
    try {
      const orgId = req.query.orgId as string;
      const data = await StatusService.getServices(orgId);
      res.status(200).json(successResponse(data));
    } catch (error) {
      next(error);
    }
  }

  static async getIncidents(req: Request, res: Response, next: NextFunction) {
    try {
      const orgId = req.query.orgId as string;
      const query = req.query as unknown as PublicIncidentsListQuery;
      const data = await StatusService.getIncidents(orgId, query);
      res.status(200).json(successResponse(data));
    } catch (error) {
      next(error);
    }
  }

  static async getIncidentDetails(req: Request, res: Response, next: NextFunction) {
    try {
      const orgId = req.query.orgId as string;
      const incidentId = req.params.id;
      const data = await StatusService.getIncidentDetails(orgId, incidentId);
      res.status(200).json(successResponse(data));
    } catch (error) {
      next(error);
    }
  }
}
