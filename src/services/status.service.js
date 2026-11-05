import { IncidentStatus } from '@prisma/client';
import { prisma } from '../database/prisma.js';
import { AppError } from '../utils/AppError.js';
import { paginate, cursorOptions } from '../utils/pagination.js';
import { calculateOverallHealth } from './health.service.js';
import {
  toPublicService,
  toPublicIncident,
  toPublicUpdate,
  toPublicTimelineEvent,
} from '../utils/publicDto.js';

// Everything in this file is reachable without logging in. The organization
// comes from the request, so every query filters by it explicitly.

export async function getOverview(orgId) {
  const organization = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { name: true },
  });
  if (!organization) throw new AppError('Organization not found', 404);

  const overallStatus = await calculateOverallHealth(orgId);

  const services = await prisma.service.findMany({
    where: { orgId },
    orderBy: { name: 'asc' },
  });

  const activeIncidents = await prisma.incident.findMany({
    where: {
      orgId,
      status: { notIn: [IncidentStatus.RESOLVED, IncidentStatus.CLOSED] },
    },
    include: { affectedServices: true },
    orderBy: { createdAt: 'desc' },
  });

  return {
    organization: { name: organization.name },
    overallStatus,
    services: services.map(toPublicService),
    activeIncidents: activeIncidents.map(toPublicIncident),
  };
}

export async function getServices(orgId) {
  const services = await prisma.service.findMany({
    where: { orgId },
    orderBy: { name: 'asc' },
  });

  return {
    services: services.map(toPublicService),
    lastUpdated: new Date().toISOString(),
  };
}

export async function getIncidents(orgId, { cursor, limit, status }) {
  const incidents = await prisma.incident.findMany({
    where: { orgId, ...(status && { status }) },
    take: limit + 1,
    ...cursorOptions(cursor),
    orderBy: { createdAt: 'desc' },
    include: { affectedServices: true },
  });

  const page = paginate(incidents, limit);
  return { data: page.data.map(toPublicIncident), pagination: page.pagination };
}

export async function getIncidentDetails(orgId, incidentId) {
  const incident = await prisma.incident.findFirst({
    where: { id: incidentId, orgId },
    include: {
      affectedServices: true,
      updates: { where: { isPublic: true }, orderBy: { createdAt: 'asc' } },
      timelineEvents: { orderBy: { createdAt: 'asc' } },
    },
  });
  if (!incident) throw new AppError('Incident not found', 404);

  return {
    ...toPublicIncident(incident),
    updates: incident.updates.map(toPublicUpdate),
    timeline: incident.timelineEvents.map(toPublicTimelineEvent),
  };
}
