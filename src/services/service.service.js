import { ServiceStatus } from '@prisma/client';
import { prisma } from '../database/prisma.js';
import { AppError } from '../utils/AppError.js';
import { paginate, cursorOptions } from '../utils/pagination.js';
import { emitToOrg } from '../socket/emitter.js';

export async function createService(orgId, { name, description }) {
  // Health is never supplied by the client; it is calculated from incidents,
  // so a new service always starts healthy.
  const service = await prisma.service.create({
    data: { name, description, orgId, status: ServiceStatus.OPERATIONAL },
  });

  emitToOrg(orgId, 'service:created', { id: service.id, name: service.name });
  return service;
}

export async function listServices(orgId, { cursor, limit }) {
  const services = await prisma.service.findMany({
    where: { orgId },
    take: limit + 1,
    ...cursorOptions(cursor),
    orderBy: { createdAt: 'desc' },
  });

  return paginate(services, limit);
}

export async function getServiceDetails(orgId, serviceId) {
  const service = await prisma.service.findFirst({
    where: { id: serviceId, orgId },
    include: {
      incidents: {
        where: { orgId },
        orderBy: { createdAt: 'desc' },
        take: 10, // the most recent incidents that affected this service
        include: {
          creator: { select: { name: true } },
          assignee: { select: { name: true } },
        },
      },
    },
  });

  if (!service) {
    throw new AppError('Service not found', 404);
  }

  return service;
}

export async function updateService(orgId, serviceId, { name, description }) {
  await getServiceInOrg(orgId, serviceId);

  const service = await prisma.service.update({
    where: { id: serviceId },
    data: { name, description },
  });

  emitToOrg(orgId, 'service:updated', { id: service.id });
  return service;
}

export async function deleteService(orgId, serviceId) {
  await getServiceInOrg(orgId, serviceId);

  await prisma.service.delete({ where: { id: serviceId } });

  emitToOrg(orgId, 'service:deleted', { id: serviceId });
}

// Looking the service up by id AND orgId is the tenant check: another
// organization's service looks exactly like a missing one (404).
async function getServiceInOrg(orgId, serviceId) {
  const service = await prisma.service.findFirst({ where: { id: serviceId, orgId } });
  if (!service) {
    throw new AppError('Service not found', 404);
  }
  return service;
}
