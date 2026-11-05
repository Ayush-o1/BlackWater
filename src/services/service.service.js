import { prisma } from '../database/prisma.js';
import { AppError } from '../utils/AppError.js';
import { paginate, cursorOptions, NEWEST_FIRST } from '../utils/pagination.js';
import { emitToOrg } from '../socket/emitter.js';
import { SocketEvent } from '../socket/events.js';
import { healthSelect, withHealth } from './health.service.js';

export async function createService(orgId, { name, description }) {
  const service = await prisma.service.create({
    data: { name, description, orgId },
    include: healthSelect(orgId),
  });

  emitToOrg(orgId, SocketEvent.SERVICE_CHANGED, { id: service.id });
  return withHealth(service);
}

export async function listServices(orgId, { cursor, limit }) {
  const services = await prisma.service.findMany({
    where: { orgId },
    take: limit + 1,
    ...cursorOptions(cursor),
    orderBy: NEWEST_FIRST,
    include: healthSelect(orgId),
  });

  const page = paginate(services, limit);
  return { data: page.data.map(withHealth), pagination: page.pagination };
}

export async function getServiceDetails(orgId, serviceId) {
  const service = await findServiceWithHealth(orgId, serviceId);

  // The ten most recent incidents that affected this service, newest first.
  const recentIncidents = await prisma.incident.findMany({
    where: { orgId, affectedServices: { some: { id: serviceId } } },
    orderBy: NEWEST_FIRST,
    take: 10,
    include: {
      creator: { select: { name: true } },
      assignee: { select: { name: true } },
    },
  });

  return { ...service, incidents: recentIncidents };
}

export async function updateService(orgId, serviceId, { name, description }) {
  await findServiceWithHealth(orgId, serviceId);

  const service = await prisma.service.update({
    where: { id: serviceId },
    data: { name, description },
    include: healthSelect(orgId),
  });

  emitToOrg(orgId, SocketEvent.SERVICE_CHANGED, { id: serviceId });
  return withHealth(service);
}

export async function deleteService(orgId, serviceId) {
  await findServiceWithHealth(orgId, serviceId);

  await prisma.service.delete({ where: { id: serviceId } });

  emitToOrg(orgId, SocketEvent.SERVICE_CHANGED, { id: serviceId });
}

// Looking the service up by id AND orgId is the tenant check: another
// organization's service looks exactly like a missing one (404).
async function findServiceWithHealth(orgId, serviceId) {
  const service = await prisma.service.findFirst({
    where: { id: serviceId, orgId },
    include: healthSelect(orgId),
  });

  if (!service) {
    throw new AppError('Service not found', 404);
  }

  return withHealth(service);
}
