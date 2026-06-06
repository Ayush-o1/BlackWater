import prisma from '../../prisma/client';
import { ServiceStatus, Severity, IncidentStatus } from '@prisma/client';
import { SocketEmitter } from '../../socket/socket.emitter';

export class ServiceEngine {
  /**
   * Automatically calculates and updates the operational health of a Service
   * based on the severity of any active, unresolved incidents affecting it.
   */
  static async recalculateServiceStatus(orgId: string, serviceId: string) {
    const service = await prisma.service.findFirst({
      where: { id: serviceId, orgId },
      select: { id: true, status: true },
    });

    if (!service) return;

    // Query active incidents (not RESOLVED or CLOSED) affecting this service
    const activeIncidents = await prisma.incident.findMany({
      where: {
        orgId,
        affectedServices: { some: { id: serviceId } },
        status: {
          notIn: [IncidentStatus.RESOLVED, IncidentStatus.CLOSED],
        },
      },
      select: { severity: true },
    });

    // Run Auto-Calculation Rules
    let newStatus: ServiceStatus = ServiceStatus.OPERATIONAL;

    if (activeIncidents.length > 0) {
      const severities = activeIncidents.map((i) => i.severity);
      
      if (severities.includes(Severity.CRITICAL)) {
        newStatus = ServiceStatus.MAJOR_OUTAGE;
      } else if (severities.includes(Severity.HIGH)) {
        newStatus = ServiceStatus.PARTIAL_OUTAGE;
      } else if (severities.includes(Severity.MEDIUM) || severities.includes(Severity.LOW)) {
        newStatus = ServiceStatus.DEGRADED;
      }
    }

    // Update the database and broadcast real-time events only if a delta is detected
    if (newStatus !== service.status) {
      await prisma.service.update({
        where: { id: service.id },
        data: { status: newStatus },
      });

      SocketEmitter.toOrg(orgId, 'service:status_changed', { id: service.id, status: newStatus });
      SocketEmitter.toOrg(orgId, 'status:updated', { orgId });
    }
  }

  /**
   * Helper to recalculate multiple services at once (used when an incident creates/updates)
   */
  static async recalculateMultipleServices(orgId: string, serviceIds: string[]) {
    // Process serially or via Promise.all. Promise.all is safe here since they are distinct rows.
    await Promise.all(serviceIds.map((id) => this.recalculateServiceStatus(orgId, id)));
  }
}
