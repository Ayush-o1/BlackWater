import prisma from '../../prisma/client';
import { AppError } from '../../utils/errors/AppError';
import { SocketEmitter } from '../../socket/socket.emitter';
import { CreateServiceInput, UpdateServiceInput } from './service.schemas';

export class ServiceService {
  static async createService(orgId: string, data: CreateServiceInput) {
    const service = await prisma.service.create({
      data: {
        name: data.name,
        description: data.description,
        orgId,
        status: 'OPERATIONAL', // Always starts operational until incidents are linked
      },
    });

    SocketEmitter.toOrg(orgId, 'service:created', { id: service.id, name: service.name });

    return service;
  }

  static async listServices(orgId: string, query: { cursor?: string; limit: number }) {
    const { cursor, limit } = query;
    const services = await prisma.service.findMany({
      where: { orgId },
      take: limit + 1,
      ...(cursor && { skip: 1, cursor: { id: cursor } }),
      orderBy: { createdAt: 'desc' },
    });

    const hasMore = services.length > limit;
    const data = hasMore ? services.slice(0, limit) : services;
    const nextCursor = hasMore ? data[data.length - 1].id : null;

    return {
      data,
      pagination: {
        nextCursor,
        hasMore,
      }
    };
  }

  static async getServiceDetails(orgId: string, serviceId: string) {
    const service = await prisma.service.findFirst({
      where: { id: serviceId, orgId },
      include: {
        incidents: {
          orderBy: { createdAt: 'desc' },
          take: 10, // Returns the 10 most recent incidents affecting this service
          include: {
            creator: { select: { name: true } },
            assignee: { select: { name: true } }
          }
        },
      },
    });

    if (!service) {
      throw new AppError('Service not found', 404);
    }

    return service;
  }

  static async updateService(orgId: string, serviceId: string, data: UpdateServiceInput) {
    const existing = await prisma.service.findFirst({ where: { id: serviceId, orgId } });
    if (!existing) throw new AppError('Service not found', 404);

    const updated = await prisma.service.update({
      where: { id: serviceId },
      data: {
        name: data.name !== undefined ? data.name : existing.name,
        description: data.description !== undefined ? data.description : existing.description,
      },
    });

    SocketEmitter.toOrg(orgId, 'service:updated', { id: updated.id });

    return updated;
  }

  static async deleteService(orgId: string, serviceId: string) {
    const existing = await prisma.service.findFirst({ where: { id: serviceId, orgId } });
    if (!existing) throw new AppError('Service not found', 404);

    await prisma.service.delete({ where: { id: serviceId } });

    SocketEmitter.toOrg(orgId, 'service:deleted', { id: serviceId });
  }
}
