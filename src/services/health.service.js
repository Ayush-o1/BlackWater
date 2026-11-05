import { IncidentStatus, ServiceStatus, Severity } from '@prisma/client';
import { prisma } from '../database/prisma.js';
import { emitToOrg } from '../socket/emitter.js';

// Recalculates the stored health of one service from its open incidents
// (anything not RESOLVED or CLOSED). The worst open severity decides the status:
//   CRITICAL -> MAJOR_OUTAGE, HIGH -> PARTIAL_OUTAGE, MEDIUM/LOW -> DEGRADED,
//   no open incidents -> OPERATIONAL.
export async function recalculateServiceStatus(orgId, serviceId) {
  const service = await prisma.service.findFirst({
    where: { id: serviceId, orgId },
    select: { id: true, status: true },
  });
  if (!service) return;

  const openIncidents = await prisma.incident.findMany({
    where: {
      orgId,
      affectedServices: { some: { id: serviceId } },
      status: { notIn: [IncidentStatus.RESOLVED, IncidentStatus.CLOSED] },
    },
    select: { severity: true },
  });

  const severities = openIncidents.map((incident) => incident.severity);

  let newStatus = ServiceStatus.OPERATIONAL;
  if (severities.includes(Severity.CRITICAL)) {
    newStatus = ServiceStatus.MAJOR_OUTAGE;
  } else if (severities.includes(Severity.HIGH)) {
    newStatus = ServiceStatus.PARTIAL_OUTAGE;
  } else if (severities.length > 0) {
    newStatus = ServiceStatus.DEGRADED;
  }

  // Write and broadcast only on a real change so clients are not told to
  // refetch for nothing.
  if (newStatus !== service.status) {
    await prisma.service.update({ where: { id: service.id }, data: { status: newStatus } });

    emitToOrg(orgId, 'service:status_changed', { id: service.id, status: newStatus });
    emitToOrg(orgId, 'status:updated', { orgId });
  }
}

export async function recalculateServices(orgId, serviceIds) {
  await Promise.all(serviceIds.map((serviceId) => recalculateServiceStatus(orgId, serviceId)));
}

// The status of a whole organization is its worst service status.
export async function calculateOverallHealth(orgId) {
  const services = await prisma.service.findMany({ where: { orgId }, select: { status: true } });
  const statuses = services.map((service) => service.status);

  if (statuses.includes(ServiceStatus.MAJOR_OUTAGE)) return ServiceStatus.MAJOR_OUTAGE;
  if (statuses.includes(ServiceStatus.PARTIAL_OUTAGE)) return ServiceStatus.PARTIAL_OUTAGE;
  if (statuses.includes(ServiceStatus.DEGRADED)) return ServiceStatus.DEGRADED;
  return ServiceStatus.OPERATIONAL;
}
