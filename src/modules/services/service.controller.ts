import { Request, Response, NextFunction } from 'express';
import { ServiceService } from './service.service';
import { successResponse } from '../../utils/response';

export class ServiceController {
  static async createService(req: Request, res: Response, next: NextFunction) {
    try {
      const service = await ServiceService.createService(req.user!.orgId, req.body);
      res.status(201).json(successResponse(service, 'Service created successfully'));
    } catch (error) {
      next(error);
    }
  }

  static async listServices(req: Request, res: Response, next: NextFunction) {
    try {
      const services = await ServiceService.listServices(req.user!.orgId);
      res.status(200).json(successResponse(services, 'Services retrieved successfully'));
    } catch (error) {
      next(error);
    }
  }

  static async getServiceDetails(req: Request, res: Response, next: NextFunction) {
    try {
      const service = await ServiceService.getServiceDetails(req.user!.orgId, req.params.id);
      res.status(200).json(successResponse(service, 'Service details retrieved successfully'));
    } catch (error) {
      next(error);
    }
  }

  static async updateService(req: Request, res: Response, next: NextFunction) {
    try {
      const service = await ServiceService.updateService(req.user!.orgId, req.params.id, req.body);
      res.status(200).json(successResponse(service, 'Service updated successfully'));
    } catch (error) {
      next(error);
    }
  }

  static async deleteService(req: Request, res: Response, next: NextFunction) {
    try {
      await ServiceService.deleteService(req.user!.orgId, req.params.id);
      res.status(200).json(successResponse(null, 'Service deleted successfully'));
    } catch (error) {
      next(error);
    }
  }
}
