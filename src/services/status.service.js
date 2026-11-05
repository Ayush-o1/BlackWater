import { IncidentStatus } from '@prisma/client';
import { prisma } from '../database/prisma.js';
import { AppError } from '../utils/AppError.js';
import { paginate, cursorOptions, NEWEST_FIRST } from '../utils/pagination.js';
import { healthSelect, withHealth, overallStatusOf } from './health.service.js';
import {
  toPublicService,
  toPublicIncident,
  toPublicUpdate,
  toPublicTimeline,
} from '../utils/publicDto.js';

// Everything in this file is reachable without logging in, so it follows three
// rules:
//   1. The organization comes from the request, so every query filters by it.
//   2. Every incident query also filters on isPublic: true. A private incident
//      is indistinguishable from one that does not exist.
//   3. Service health is calculated from public incidents only (publicOnly), so
//      a private incident cannot change what visitors see or hint at its severity.

const OPEN = { notIn: [IncidentStatus.RESOLVED, IncidentStatus.CLOSED] };

// Selects the services of an incident with their *public* health.
const publicServices = (orgId) => ({
  select: { id: true, name: true, description: true, ...healthSelect(orgId, { publicOnly: true }) },
});

async function loadPublicServices(orgId) {
  const services = await prisma.service.findMany({
    where: { orgId },
    orderBy: { name: 'asc' },
    ...publicServices(orgId),
  });
  return services.map(withHealth);
}

function publicIncident(incident) {
  return toPublicIncident({ ...incident, affectedServices: incident.affectedServices.map(withHealth) });
}

export async function getOverview(orgId) {
  const organization = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { name: true },
  });
  if (!organization) throw new AppError('Organization not found', 404);

  const services = await loadPublicServices(orgId);

  const activeIncidents = await prisma.incident.findMany({
    where: { orgId, isPublic: true, status: OPEN },
    orderBy: NEWEST_FIRST,
    include: { affectedServices: publicServices(orgId) },
  });

  return {
    organization: { name: organization.name },
    overallStatus: overallStatusOf(services),
    services: services.map(toPublicService),
    activeIncidents: activeIncidents.map(publicIncident),
  };
}

export async function getServices(orgId) {
  const services = await loadPublicServices(orgId);

  return {
    services: services.map(toPublicService),
    lastUpdated: new Date().toISOString(),
  };
}

export async function getIncidents(orgId, { cursor, limit, status }) {
  const incidents = await prisma.incident.findMany({
    where: { orgId, isPublic: true, ...(status && { status }) },
    take: limit + 1,
    ...cursorOptions(cursor),
    orderBy: NEWEST_FIRST,
    include: { affectedServices: publicServices(orgId) },
  });

  const page = paginate(incidents, limit);
  return { data: page.data.map(publicIncident), pagination: page.pagination };
}

export async function getIncidentDetails(orgId, incidentId) {
  const incident = await prisma.incident.findFirst({
    where: { id: incidentId, orgId, isPublic: true },
    include: {
      affectedServices: publicServices(orgId),
      updates: { where: { isPublic: true }, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] },
      timelineEvents: { orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] },
    },
  });
  if (!incident) throw new AppError('Incident not found', 404);

  return {
    ...publicIncident(incident),
    updates: incident.updates.map(toPublicUpdate),
    timeline: toPublicTimeline(incident.timelineEvents),
  };
}
