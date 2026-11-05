import { IncidentStatus } from '@prisma/client';
import { prisma } from '../database/prisma.js';
import { AppError } from '../utils/AppError.js';
import { paginate, cursorOptions } from '../utils/pagination.js';
import { emitToOrg, emitToIncident } from '../socket/emitter.js';
import { recalculateServices } from './health.service.js';

// The lifecycle as a table: each status lists the statuses it may move to.
// RESOLVED -> TRIGGERED is how a "resolved" incident is reopened when the
// problem comes back. CLOSED is final.
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

const personFields = { id: true, name: true, email: true };

export async function createIncident(orgId, creatorId, { title, description, severity, serviceIds }) {
  // Every linked service must belong to the caller's organization; otherwise an
  // incident could be attached to (and change the health of) another tenant's service.
  if (serviceIds.length > 0) {
    const ownedServices = await prisma.service.findMany({
      where: { id: { in: serviceIds }, orgId },
      select: { id: true },
    });
    if (ownedServices.length !== serviceIds.length) {
      throw new AppError('One or more services were not found in this organization', 400);
    }
  }

  // The incident and its first timeline entry are written together so the
  // audit trail can never be missing the creation event.
  const { incident, timelineEvent } = await prisma.$transaction(async (tx) => {
    const incident = await tx.incident.create({
      data: {
        title,
        description,
        severity,
        orgId,
        creatorId,
        status: IncidentStatus.TRIGGERED,
        ...(serviceIds.length > 0 && {
          affectedServices: { connect: serviceIds.map((id) => ({ id })) },
        }),
      },
    });

    const timelineEvent = await tx.timelineEvent.create({
      data: {
        incidentId: incident.id,
        eventType: 'INCIDENT_CREATED',
        metadata: { severity: incident.severity },
      },
    });

    return { incident, timelineEvent };
  });

  // Broadcast only after the transaction has committed, so no client is told
  // about a change that could still be rolled back.
  emitToOrg(orgId, 'incident:created', { id: incident.id, title: incident.title, severity: incident.severity });
  emitToIncident(incident.id, 'timeline:event_created', { incidentId: incident.id, eventType: timelineEvent.eventType });
  emitToOrg(orgId, 'status:updated', { orgId });

  if (serviceIds.length > 0) {
    await recalculateServices(orgId, serviceIds);
  }

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
    orderBy: { createdAt: 'desc' },
    include: {
      creator: { select: personFields },
      assignee: { select: personFields },
      affectedServices: { select: { id: true, name: true, status: true } },
    },
  });

  return paginate(incidents, limit);
}

export async function getIncidentDetails(orgId, incidentId) {
  const incident = await prisma.incident.findFirst({
    where: { id: incidentId, orgId },
    include: {
      creator: { select: personFields },
      assignee: { select: personFields },
      affectedServices: { select: { id: true, name: true, status: true } },
      updates: {
        include: { user: { select: { id: true, name: true } } },
        orderBy: { createdAt: 'asc' },
      },
      timelineEvents: { orderBy: { createdAt: 'asc' } },
    },
  });

  if (!incident) {
    throw new AppError('Incident not found', 404);
  }

  return incident;
}

export async function assignIncident(orgId, incidentId, { assigneeId }) {
  const { updatedIncident, timelineEvent } = await prisma.$transaction(async (tx) => {
    const incident = await tx.incident.findFirst({
      where: { id: incidentId, orgId },
      select: { id: true, assigneeId: true, status: true },
    });
    if (!incident) throw new AppError('Incident not found', 404);
    if (incident.status === IncidentStatus.CLOSED) throw new AppError('Incident is closed', 400);

    // The assignee must be in the same organization as the incident.
    const assignee = await tx.user.findFirst({ where: { id: assigneeId, orgId } });
    if (!assignee) throw new AppError('Assignee not found in this organization', 400);

    const updatedIncident = await tx.incident.update({
      where: { id: incident.id },
      data: { assigneeId },
    });

    const timelineEvent = await tx.timelineEvent.create({
      data: {
        incidentId: incident.id,
        eventType: 'ASSIGNEE_CHANGED',
        metadata: { oldAssigneeId: incident.assigneeId, newAssigneeId: assigneeId },
      },
    });

    return { updatedIncident, timelineEvent };
  });

  emitToOrg(orgId, 'incident:assigned', { id: updatedIncident.id, assigneeId });
  emitToIncident(updatedIncident.id, 'timeline:event_created', { incidentId: updatedIncident.id, eventType: timelineEvent.eventType });

  return updatedIncident;
}

export async function updateStatus(orgId, incidentId, { status: newStatus }) {
  const { updatedIncident, timelineEvent } = await prisma.$transaction(async (tx) => {
    const incident = await tx.incident.findFirst({
      where: { id: incidentId, orgId },
      select: { id: true, status: true },
    });
    if (!incident) throw new AppError('Incident not found', 404);

    // Validated before any write: an illegal move must not leave a half-applied change.
    validateTransition(incident.status, newStatus);

    // acknowledgedAt and resolvedAt are kept for response-time metrics, so they
    // are stamped only at the moment the matching transition happens.
    const timestamps = {};
    if (newStatus === IncidentStatus.ACKNOWLEDGED && incident.status === IncidentStatus.TRIGGERED) {
      timestamps.acknowledgedAt = new Date();
    }
    if (newStatus === IncidentStatus.RESOLVED) {
      timestamps.resolvedAt = new Date();
    }

    const updatedIncident = await tx.incident.update({
      where: { id: incident.id },
      data: { status: newStatus, ...timestamps },
    });

    const timelineEvent = await tx.timelineEvent.create({
      data: {
        incidentId: incident.id,
        eventType: 'STATUS_CHANGED',
        metadata: { oldStatus: incident.status, newStatus },
      },
    });

    return { updatedIncident, timelineEvent };
  });

  emitToOrg(orgId, 'incident:status_changed', { id: updatedIncident.id, status: newStatus });
  emitToIncident(updatedIncident.id, 'timeline:event_created', { incidentId: updatedIncident.id, eventType: timelineEvent.eventType });
  emitToOrg(orgId, 'status:updated', { orgId });

  // Open incidents drive service health, so a status change can change it.
  const affected = await prisma.incident.findUnique({
    where: { id: incidentId },
    select: { affectedServices: { select: { id: true } } },
  });
  if (affected && affected.affectedServices.length > 0) {
    await recalculateServices(orgId, affected.affectedServices.map((service) => service.id));
  }

  return updatedIncident;
}

export async function addUpdate(orgId, incidentId, userId, { message, isPublic }) {
  const { update, timelineEvent } = await prisma.$transaction(async (tx) => {
    const incident = await tx.incident.findFirst({
      where: { id: incidentId, orgId },
      select: { id: true, status: true },
    });
    if (!incident) throw new AppError('Incident not found', 404);
    if (incident.status === IncidentStatus.CLOSED) throw new AppError('Incident is closed', 400);

    const update = await tx.incidentUpdate.create({
      data: { incidentId: incident.id, userId, message, isPublic },
    });

    const timelineEvent = await tx.timelineEvent.create({
      data: {
        incidentId: incident.id,
        eventType: 'UPDATE_ADDED',
        metadata: { updateId: update.id, isPublic },
      },
    });

    return { update, timelineEvent };
  });

  emitToOrg(orgId, 'incident:update_added', { id: incidentId, updateId: update.id, isPublic });
  emitToIncident(incidentId, 'timeline:event_created', { incidentId, eventType: timelineEvent.eventType });

  // Only public updates change what the status page shows.
  if (isPublic) {
    emitToOrg(orgId, 'status:updated', { orgId });
  }

  return update;
}
