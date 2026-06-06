import prisma from '../../prisma/client';
import { StatusEngine } from './status.engine';
import { StatusDTO } from './status.dto';
import { PublicIncidentsListQuery } from './status.schemas';
import { AppError } from '../../utils/errors/AppError';
import { IncidentStatus } from '@prisma/client';

export class StatusService {
  /**
   * Fetches the overarching Organization status page
   */
  static async getOverview(orgId: string) {
    const org = await prisma.organization.findUnique({
      where: { id: orgId },
      select: { name: true },
    });

    if (!org) throw new AppError('Organization not found', 404);

    const overallStatus = await StatusEngine.calculateOverallHealth(orgId);

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
      organization: { name: org.name },
      overallStatus,
      services: services.map(StatusDTO.toPublicService),
      activeIncidents: activeIncidents.map(i => StatusDTO.toPublicIncident(i)),
    };
  }

  /**
   * Fetches only services
   */
  static async getServices(orgId: string) {
    const services = await prisma.service.findMany({
      where: { orgId },
      orderBy: { name: 'asc' },
    });

    return {
      services: services.map(StatusDTO.toPublicService),
      lastUpdated: new Date().toISOString(), // Generic timestamp for client refreshing
    };
  }

  /**
   * Lists Incidents (supports pagination/filtering)
   */
  static async getIncidents(orgId: string, query: PublicIncidentsListQuery) {
    const { page, limit, status } = query;
    const skip = (page - 1) * limit;

    const where: any = { orgId };
    
    // Optionally filter out internal statuses if necessary.
    // For now we allow filtering by exact status if provided.
    if (status) {
      where.status = status;
    }

    const [incidents, total] = await Promise.all([
      prisma.incident.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: { affectedServices: true },
      }),
      prisma.incident.count({ where }),
    ]);

    return {
      incidents: incidents.map(i => StatusDTO.toPublicIncident(i)),
      total,
      page,
      limit,
    };
  }

  /**
   * Deep fetch of a specific incident
   */
  static async getIncidentDetails(orgId: string, incidentId: string) {
    const incident = await prisma.incident.findFirst({
      where: { id: incidentId, orgId },
      include: {
        affectedServices: true,
        // Only fetch public updates
        updates: {
          where: { isPublic: true },
          orderBy: { createdAt: 'asc' },
        },
        timelineEvents: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!incident) throw new AppError('Incident not found', 404);

    return {
      ...StatusDTO.toPublicIncident(incident),
      updates: incident.updates.map(u => StatusDTO.toPublicUpdate(u)),
      timeline: incident.timelineEvents.map(e => StatusDTO.toPublicTimelineEvent(e)),
    };
  }
}
