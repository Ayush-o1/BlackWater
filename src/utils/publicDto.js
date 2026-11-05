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

// Timeline metadata can hold user ids, so it is dropped here.
export function toPublicTimelineEvent(event) {
  return { id: event.id, eventType: event.eventType, createdAt: event.createdAt };
}
