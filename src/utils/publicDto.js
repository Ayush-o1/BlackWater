import { IncidentStatus } from '@prisma/client';
import { TimelineEventType } from './timelineEvents.js';

// The public status page is readable by anyone, so it must never return a
// database row directly. Each function below copies an explicit list of fields:
// a column added to the schema later stays private until it is added here.

export function toPublicService(service) {
  return {
    id: service.id,
    name: service.name,
    description: service.description,
    status: service.status,
  };
}

// Deliberately absent: description, creator, assignee, isPublic, acknowledgedAt,
// orgId and anything else an internal user sees.
export function toPublicIncident(incident) {
  return {
    id: incident.id,
    title: incident.title,
    status: incident.status,
    severity: incident.severity,
    createdAt: incident.createdAt,
    resolvedAt: incident.resolvedAt,
    affectedServices: (incident.affectedServices ?? []).map(toPublicService),
  };
}

export function toPublicUpdate(update) {
  return { id: update.id, message: update.message, createdAt: update.createdAt };
}

// The public timeline is an allow-list, not "everything minus secrets":
//  - creation and status changes are shown (statuses only, no people);
//  - an update appears only if it was posted as public;
//  - edits, assignments and visibility changes are internal and never shown.
// The actor and all ids in the metadata are dropped.
export function toPublicTimeline(events) {
  const visible = [];

  for (const event of events) {
    const base = { id: event.id, eventType: event.eventType, createdAt: event.createdAt };

    switch (event.eventType) {
      case TimelineEventType.INCIDENT_CREATED:
        visible.push(base);
        break;
      case TimelineEventType.STATUS_CHANGED:
        visible.push({
          ...base,
          oldStatus: IncidentStatus[event.metadata?.oldStatus] ?? null,
          newStatus: IncidentStatus[event.metadata?.newStatus] ?? null,
        });
        break;
      case TimelineEventType.UPDATE_ADDED:
        if (event.metadata?.isPublic === true) visible.push(base);
        break;
      default:
        break;
    }
  }

  return visible;
}
