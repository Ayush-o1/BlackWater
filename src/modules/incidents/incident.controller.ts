import { Request, Response, NextFunction } from 'express';
import { IncidentService } from './incident.service';
import { successResponse } from '../../utils/response';

export class IncidentController {
  static async createIncident(req: Request, res: Response, next: NextFunction) {
    try {
      const incident = await IncidentService.createIncident(req.user!.orgId, req.user!.id, req.body);
      res.status(201).json(successResponse(incident, 'Incident created successfully'));
    } catch (error) {
      next(error);
    }
  }

  static async listIncidents(req: Request, res: Response, next: NextFunction) {
    try {
      // req.query is validated and coerced by Zod schemas
      const result = await IncidentService.listIncidents(req.user!.orgId, req.query as any);
      res.status(200).json(successResponse(result, 'Incidents retrieved successfully'));
    } catch (error) {
      next(error);
    }
  }

  static async getIncidentDetails(req: Request, res: Response, next: NextFunction) {
    try {
      const incident = await IncidentService.getIncidentDetails(req.user!.orgId, req.params.id);
      res.status(200).json(successResponse(incident, 'Incident details retrieved successfully'));
    } catch (error) {
      next(error);
    }
  }

  static async assignIncident(req: Request, res: Response, next: NextFunction) {
    try {
      const incident = await IncidentService.assignIncident(req.user!.orgId, req.params.id, req.body);
      res.status(200).json(successResponse(incident, 'Incident assigned successfully'));
    } catch (error) {
      next(error);
    }
  }

  static async updateStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const incident = await IncidentService.updateStatus(req.user!.orgId, req.params.id, req.body);
      res.status(200).json(successResponse(incident, 'Incident status updated successfully'));
    } catch (error) {
      next(error);
    }
  }

  static async addUpdate(req: Request, res: Response, next: NextFunction) {
    try {
      const update = await IncidentService.addUpdate(req.user!.orgId, req.params.id, req.user!.id, req.body);
      res.status(201).json(successResponse(update, 'Incident update added successfully'));
    } catch (error) {
      next(error);
    }
  }
}
