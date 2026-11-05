import { IncidentStatus } from '@prisma/client';
import { statusFromSeverities, worstStatus } from '../utils/serviceHealth.js';

// Health is calculated at read time from a service's open incidents, never
// stored. That removes the whole class of bugs where a stored status and the
// incidents it came from disagree after a crash or two overlapping requests.

const CLOSED_STATUSES = [IncidentStatus.RESOLVED, IncidentStatus.CLOSED];

// Prisma `select` fragment: load just the severities of the open incidents
// linked to a service. Spread it into any service select/include.
//
// `publicOnly` is the privacy switch. The internal dashboard reports true
// health (all open incidents). The public status page passes publicOnly: true
// so that only incidents an organization chose to publish can change what
// visitors see; a private incident can neither colour a service nor reveal
// its severity.
export function healthSelect(orgId, { publicOnly = false } = {}) {
  return {
    incidents: {
      where: {
        orgId,
        status: { notIn: CLOSED_STATUSES },
        ...(publicOnly && { isPublic: true }),
      },
      select: { severity: true },
    },
  };
}

// Replaces the loaded `incidents` severities with the derived `status`.
export function withHealth(service) {
  const { incidents, ...rest } = service;
  return { ...rest, status: statusFromSeverities(incidents.map((incident) => incident.severity)) };
}

// An organization is as healthy as its least healthy service.
export function overallStatusOf(servicesWithHealth) {
  return worstStatus(servicesWithHealth.map((service) => service.status));
}
