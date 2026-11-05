import { IncidentStatus, Severity } from '@prisma/client';
import { prisma } from '../database/prisma.js';
import { NEWEST_FIRST } from '../utils/pagination.js';
import { healthSelect, withHealth, overallStatusOf } from './health.service.js';

const OPEN = { notIn: [IncidentStatus.RESOLVED, IncidentStatus.CLOSED] };

// Everything the dashboard shows, calculated on the server so the browser never
// has to repeat the health rules or page through lists to count things.
export async function getDashboard(orgId) {
  const [services, activeIncidentCount, criticalIncidentCount, recentActiveIncidents] = await Promise.all([
    prisma.service.findMany({ where: { orgId }, include: healthSelect(orgId) }),
    prisma.incident.count({ where: { orgId, status: OPEN } }),
    prisma.incident.count({ where: { orgId, status: OPEN, severity: Severity.CRITICAL } }),
    prisma.incident.findMany({
      where: { orgId, status: OPEN },
      orderBy: NEWEST_FIRST,
      take: 5,
      include: { assignee: { select: { id: true, name: true } } },
    }),
  ]);

  return {
    overallStatus: overallStatusOf(services.map(withHealth)),
    serviceCount: services.length,
    activeIncidentCount,
    criticalIncidentCount,
    recentActiveIncidents,
  };
}
