import { IncidentStatus } from '@prisma/client';
import { prisma } from '../database/prisma.js';
import { AppError } from '../utils/AppError.js';
import { paginate, cursorOptions, NEWEST_FIRST } from '../utils/pagination.js';
import { TimelineEventType } from '../utils/timelineEvents.js';
import { emitToOrg } from '../socket/emitter.js';
import { SocketEvent } from '../socket/events.js';
import { healthSelect, withHealth } from './health.service.js';

// The lifecycle as a table: each status lists the statuses it may move to.
// RESOLVED -> TRIGGERED is how a resolved incident is reopened when the problem
// comes back. CLOSED is final: a closed incident is a finished record.
const ALLOWED_TRANSITIONS = {
  [IncidentStatus.TRIGGERED]: [IncidentStatus.ACKNOWLEDGED, IncidentStatus.RESOLVED],
  [IncidentStatus.ACKNOWLEDGED]: [IncidentStatus.RESOLVED, IncidentStatus.TRIGGERED],
  [IncidentStatus.RESOLVED]: [IncidentStatus.TRIGGERED, IncidentStatus.CLOSED],
  [IncidentStatus.CLOSED]: [],
};

export function validateTransition(currentStatus, newStatus) {
  if (currentStatus === IncidentStatus.CLOSED) {
    throw new AppError('Incident is closed and cannot be modified', 400);
  }

  if (!ALLOWED_TRANSITIONS[currentStatus].includes(newStatus)) {
    throw new AppError(`Invalid state transition from ${currentStatus} to ${newStatus}`, 400);
  }
}

function assertNotClosed(incident) {
  if (incident.status === IncidentStatus.CLOSED) {
    throw new AppError('Incident is closed and cannot be modified', 400);
  }
}

// Loads an incident and locks its row (SELECT ... FOR UPDATE) until the
// surrounding transaction ends. Every change to an incident starts here, for
// two reasons:
//   1. Two people acting on the same incident at once are handled one after
//      the other. The second request therefore sees the first one's result and
//      is validated against it, instead of both passing the same check
//      against the same old status.
//   2. The orgId in the WHERE clause is the tenant check: another
//      organization's incident is "not found".
async function lockIncident(tx, orgId, incidentId) {
  const rows = await tx.$queryRaw`
    SELECT "id", "title", "description", "status", "severity", "isPublic", "assigneeId"
    FROM "Incident"
    WHERE "id" = ${incidentId} AND "orgId" = ${orgId}
    FOR UPDATE`;

  if (rows.length === 0) {
    throw new AppError('Incident not found', 404);
  }
  return rows[0];
}

// Every audit entry goes through here so the actor is always the authenticated
// user passed down from the request, never a value supplied by the client.
function recordEvent(tx, { incidentId, actorId, eventType, metadata }) {
  return tx.timelineEvent.create({ data: { incidentId, actorId, eventType, metadata } });
}

function announce(orgId, event, incidentId) {
  emitToOrg(orgId, event, { id: incidentId });
}

// Returns the services (id and name) with the given ids, but only if every one
// belongs to the organization. Otherwise an incident could be attached to, and
// change the health of, another tenant's service.
async function loadOrgServices(tx, orgId, serviceIds) {
  if (serviceIds.length === 0) return [];

  const services = await tx.service.findMany({
    where: { id: { in: serviceIds }, orgId },
    select: { id: true, name: true },
  });

  if (services.length !== serviceIds.length) {
    throw new AppError('One or more services were not found in this organization', 400);
  }
  return services;
}

const personFields = { id: true, name: true, email: true };

export async function createIncident(orgId, actorId, { title, description, severity, serviceIds, isPublic }) {
  const uniqueServiceIds = [...new Set(serviceIds)];

  // The incident and its first timeline entry are written together so the
  // audit trail can never be missing the creation event.
  const incident = await prisma.$transaction(async (tx) => {
    await loadOrgServices(tx, orgId, uniqueServiceIds);

    const created = await tx.incident.create({
      data: {
        title,
        description,
        severity,
        isPublic,
        orgId,
        creatorId: actorId,
        status: IncidentStatus.TRIGGERED,
        affectedServices: { connect: uniqueServiceIds.map((id) => ({ id })) },
      },
    });

    await recordEvent(tx, {
      incidentId: created.id,
      actorId,
      eventType: TimelineEventType.INCIDENT_CREATED,
      metadata: { severity, isPublic },
    });

    return created;
  });

  // Broadcast only after the transaction has committed, so no client is told
  // about a change that could still be rolled back.
  announce(orgId, SocketEvent.INCIDENT_CREATED, incident.id);
  return incident;
}

export async function listIncidents(orgId, { status, severity, assigneeId, serviceId, cursor, limit }) {
  const where = { orgId };
  if (status) where.status = status;
  if (severity) where.severity = severity;
  if (assigneeId) where.assigneeId = assigneeId;
  if (serviceId) where.affectedServices = { some: { id: serviceId } };

  const incidents = await prisma.incident.findMany({
    where,
    take: limit + 1,
    ...cursorOptions(cursor),
    orderBy: NEWEST_FIRST,
    include: {
      creator: { select: personFields },
      assignee: { select: personFields },
      affectedServices: { select: { id: true, name: true, ...healthSelect(orgId) } },
    },
  });

  const page = paginate(incidents, limit);
  return { data: page.data.map(withServiceHealth), pagination: page.pagination };
}

export async function getIncidentDetails(orgId, incidentId) {
  const incident = await prisma.incident.findFirst({
    where: { id: incidentId, orgId },
    include: {
      creator: { select: personFields },
      assignee: { select: personFields },
      affectedServices: { select: { id: true, name: true, ...healthSelect(orgId) } },
      updates: {
        include: { user: { select: { id: true, name: true } } },
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      },
      timelineEvents: {
        include: { actor: { select: { id: true, name: true } } },
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      },
    },
  });

  if (!incident) {
    throw new AppError('Incident not found', 404);
  }

  return withServiceHealth(incident);
}

function withServiceHealth(incident) {
  return { ...incident, affectedServices: incident.affectedServices.map(withHealth) };
}

export async function editIncident(orgId, incidentId, actorId, changes) {
  const { incident, changed } = await prisma.$transaction(async (tx) => {
    const current = await lockIncident(tx, orgId, incidentId);
    assertNotClosed(current);

    const data = {};
    const recorded = {}; // what actually changed, for the timeline

    for (const field of ['title', 'description', 'severity']) {
      if (changes[field] === undefined) continue;

      const before = current[field] ?? null;
      const after = changes[field] ?? null;
      if (before !== after) {
        data[field] = after;
        recorded[field] = { from: before, to: after };
      }
    }

    if (changes.serviceIds !== undefined) {
      const newIds = [...new Set(changes.serviceIds)];
      const newServices = await loadOrgServices(tx, orgId, newIds);
      const { affectedServices: oldServices } = await tx.incident.findUnique({
        where: { id: incidentId },
        select: { affectedServices: { select: { id: true, name: true } } },
      });

      const added = newServices.filter((s) => !oldServices.some((old) => old.id === s.id));
      const removed = oldServices.filter((old) => !newIds.includes(old.id));

      if (added.length > 0 || removed.length > 0) {
        data.affectedServices = { set: newIds.map((id) => ({ id })) };
        recorded.services = { added, removed };
      }
    }

    // Saving without changing anything must not add noise to the audit trail.
    if (Object.keys(recorded).length === 0) {
      return { incident: await tx.incident.findUnique({ where: { id: incidentId } }), changed: false };
    }

    const updated = await tx.incident.update({ where: { id: incidentId }, data });
    await recordEvent(tx, {
      incidentId,
      actorId,
      eventType: TimelineEventType.INCIDENT_EDITED,
      metadata: { changes: recorded },
    });

    return { incident: updated, changed: true };
  });

  if (changed) announce(orgId, SocketEvent.INCIDENT_UPDATED, incidentId);
  return incident;
}

// `assigneeId: null` removes the assignee.
export async function assignIncident(orgId, incidentId, actorId, assigneeId) {
  const { incident, changed } = await prisma.$transaction(async (tx) => {
    const current = await lockIncident(tx, orgId, incidentId);
    assertNotClosed(current);

    if ((current.assigneeId ?? null) === assigneeId) {
      return { incident: await tx.incident.findUnique({ where: { id: incidentId } }), changed: false };
    }

    // The assignee must belong to the same organization as the incident.
    let assignee = null;
    if (assigneeId !== null) {
      assignee = await tx.user.findFirst({ where: { id: assigneeId, orgId }, select: { id: true, name: true } });
      if (!assignee) throw new AppError('Assignee not found in this organization', 400);
    }

    const previous = current.assigneeId
      ? await tx.user.findUnique({ where: { id: current.assigneeId }, select: { id: true, name: true } })
      : null;

    const updated = await tx.incident.update({ where: { id: incidentId }, data: { assigneeId } });

    // Names are stored in the event as well as ids: the history should keep
    // reading correctly even if someone is renamed later.
    await recordEvent(tx, {
      incidentId,
      actorId,
      eventType: TimelineEventType.ASSIGNEE_CHANGED,
      metadata: { from: previous, to: assignee },
    });

    return { incident: updated, changed: true };
  });

  if (changed) announce(orgId, SocketEvent.INCIDENT_UPDATED, incidentId);
  return incident;
}

export async function updateStatus(orgId, incidentId, actorId, newStatus) {
  const incident = await prisma.$transaction(async (tx) => {
    const current = await lockIncident(tx, orgId, incidentId);

    // Checked against the locked, current status and before any write, so an
    // illegal move (or a request that lost a race to another one) changes nothing.
    validateTransition(current.status, newStatus);

    // acknowledgedAt and resolvedAt describe the incident's current cycle, so
    // they follow the status: set when it is reached, cleared when the incident
    // goes back to TRIGGERED (reopened, or un-acknowledged).
    const now = new Date();
    const timestamps = {};
    if (newStatus === IncidentStatus.TRIGGERED) {
      timestamps.acknowledgedAt = null;
      timestamps.resolvedAt = null;
    } else if (newStatus === IncidentStatus.ACKNOWLEDGED) {
      timestamps.acknowledgedAt = now;
    } else if (newStatus === IncidentStatus.RESOLVED) {
      timestamps.resolvedAt = now;
    }

    const updated = await tx.incident.update({
      where: { id: incidentId },
      data: { status: newStatus, ...timestamps },
    });

    await recordEvent(tx, {
      incidentId,
      actorId,
      eventType: TimelineEventType.STATUS_CHANGED,
      metadata: { oldStatus: current.status, newStatus },
    });

    return updated;
  });

  // Service health is derived from open incidents, so there is nothing to
  // recalculate here: the next read already reflects this change.
  announce(orgId, SocketEvent.INCIDENT_UPDATED, incidentId);
  return incident;
}

export async function addUpdate(orgId, incidentId, actorId, { message, isPublic }) {
  const update = await prisma.$transaction(async (tx) => {
    const current = await lockIncident(tx, orgId, incidentId);
    assertNotClosed(current);

    const created = await tx.incidentUpdate.create({
      data: { incidentId, userId: actorId, message, isPublic },
    });

    await recordEvent(tx, {
      incidentId,
      actorId,
      eventType: TimelineEventType.UPDATE_ADDED,
      metadata: { updateId: created.id, isPublic },
    });

    return created;
  });

  announce(orgId, SocketEvent.INCIDENT_UPDATED, incidentId);
  return update;
}

// Publishing makes the incident (title, severity, status, affected services and
// its public updates) visible on the public status page. Unpublishing is allowed
// even on a CLOSED incident: taking something off the public page should never
// be blocked by the incident's lifecycle.
export async function setVisibility(orgId, incidentId, actorId, isPublic) {
  const { incident, changed } = await prisma.$transaction(async (tx) => {
    const current = await lockIncident(tx, orgId, incidentId);

    if (current.isPublic === isPublic) {
      return { incident: await tx.incident.findUnique({ where: { id: incidentId } }), changed: false };
    }

    const updated = await tx.incident.update({ where: { id: incidentId }, data: { isPublic } });
    await recordEvent(tx, {
      incidentId,
      actorId,
      eventType: TimelineEventType.VISIBILITY_CHANGED,
      metadata: { isPublic },
    });

    return { incident: updated, changed: true };
  });

  if (changed) announce(orgId, SocketEvent.INCIDENT_UPDATED, incidentId);
  return incident;
}
