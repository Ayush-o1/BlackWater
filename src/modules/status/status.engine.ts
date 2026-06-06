import prisma from '../../prisma/client';
import { ServiceStatus } from '@prisma/client';

export class StatusEngine {
  /**
   * Calculates the overall global health of an Organization based on the
   * underlying health of all its Services.
   */
  static async calculateOverallHealth(orgId: string): Promise<ServiceStatus> {
    const services = await prisma.service.findMany({
      where: { orgId },
      select: { status: true },
    });

    if (services.length === 0) {
      return ServiceStatus.OPERATIONAL;
    }

    const statuses = services.map((s) => s.status);

    if (statuses.includes(ServiceStatus.MAJOR_OUTAGE)) {
      return ServiceStatus.MAJOR_OUTAGE;
    } else if (statuses.includes(ServiceStatus.PARTIAL_OUTAGE)) {
      return ServiceStatus.PARTIAL_OUTAGE;
    } else if (statuses.includes(ServiceStatus.DEGRADED)) {
      return ServiceStatus.DEGRADED;
    } else {
      return ServiceStatus.OPERATIONAL;
    }
  }
}
