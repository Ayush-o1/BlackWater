import { Incident, IncidentUpdate, Service, TimelineEvent } from '@prisma/client';

export class StatusDTO {
  /**
   * Sanitizes a Service record for public consumption
   */
  static toPublicService(service: Service) {
    return {
      id: service.id,
      name: service.name,
      description: service.description,
      status: service.status,
    };
  }

  /**
   * Sanitizes an Incident record for public consumption
   */
  static toPublicIncident(incident: Incident & { affectedServices?: Service[] }) {
    return {
      id: incident.id,
      title: incident.title,
      status: incident.status,
      severity: incident.severity,
      createdAt: incident.createdAt,
      resolvedAt: incident.resolvedAt,
      affectedServices: incident.affectedServices?.map(this.toPublicService) || [],
    };
  }

  /**
   * Sanitizes a public Incident Update
   */
  static toPublicUpdate(update: IncidentUpdate) {
    return {
      id: update.id,
      message: update.message,
      createdAt: update.createdAt,
    };
  }

  /**
   * Sanitizes a Timeline Event
   */
  static toPublicTimelineEvent(event: TimelineEvent) {
    return {
      id: event.id,
      eventType: event.eventType,
      createdAt: event.createdAt,
      // We strip metadata to prevent internal UUID leaks (like user IDs, etc.)
    };
  }
}
