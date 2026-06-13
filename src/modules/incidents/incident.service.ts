import prisma from '../../prisma/client';
import { AppError } from '../../utils/errors/AppError';
import { IncidentStatus } from '@prisma/client';
import {
  CreateIncidentInput,
  ListIncidentsQuery,
  AssignIncidentInput,
  AddUpdateInput,
  ChangeStatusInput,
} from './incident.schemas';
import { SocketEmitter } from '../../socket/socket.emitter';
import { ServiceEngine } from '../services/service.engine';

export class IncidentService {
  /**
   * Helper to validate state transitions
   */
  private static validateTransition(currentStatus: IncidentStatus, newStatus: IncidentStatus) {
    if (currentStatus === IncidentStatus.CLOSED) {
      throw new AppError('Incident is closed and cannot be modified', 400);
    }

    const allowedTransitions: Record<IncidentStatus, IncidentStatus[]> = {
      [IncidentStatus.TRIGGERED]: [IncidentStatus.ACKNOWLEDGED, IncidentStatus.RESOLVED],
      [IncidentStatus.ACKNOWLEDGED]: [IncidentStatus.RESOLVED, IncidentStatus.TRIGGERED],
      [IncidentStatus.RESOLVED]: [IncidentStatus.TRIGGERED, IncidentStatus.CLOSED],
      [IncidentStatus.CLOSED]: [],
    };

    if (!allowedTransitions[currentStatus].includes(newStatus)) {
      throw new AppError(`Invalid state transition from ${currentStatus} to ${newStatus}`, 400);
    }
  }

  static async createIncident(orgId: string, creatorId: string, data: CreateIncidentInput) {
    const result = await prisma.$transaction(async (tx) => {
      const incident = await tx.incident.create({
        data: {
          title: data.title,
          description: data.description,
          severity: data.severity,
          orgId,
          creatorId,
          status: IncidentStatus.TRIGGERED,
          // Connect to affected services if provided
          ...(data.serviceIds.length > 0 && {
            affectedServices: {
              connect: data.serviceIds.map((id) => ({ id })),
            },
          }),
        },
      });

      // Insert Timeline Audit
      const timelineEvent = await tx.timelineEvent.create({
        data: {
          incidentId: incident.id,
          eventType: 'INCIDENT_CREATED',
          metadata: { severity: incident.severity },
        },
      });

      // Emit Socket Events
      SocketEmitter.toOrg(orgId, 'incident:created', { id: incident.id, title: incident.title, severity: incident.severity });
      SocketEmitter.toIncident(incident.id, 'timeline:event_created', { incidentId: incident.id, eventType: timelineEvent.eventType });
      SocketEmitter.toOrg(orgId, 'status:updated', { orgId });

      return incident;
    });

    if (data.serviceIds.length > 0) {
      await ServiceEngine.recalculateMultipleServices(orgId, data.serviceIds);
    }

    return result;
  }

  static async listIncidents(orgId: string, query: ListIncidentsQuery) {
    const { status, severity, assigneeId, serviceId, cursor, limit } = query;

    const where: any = { orgId };

    if (status) where.status = status;
    if (severity) where.severity = severity;
    if (assigneeId) where.assigneeId = assigneeId;
    if (serviceId) {
      where.affectedServices = {
        some: { id: serviceId },
      };
    }

    const incidents = await prisma.incident.findMany({
      where,
      take: limit + 1,
      ...(cursor && { skip: 1, cursor: { id: cursor } }),
      orderBy: { createdAt: 'desc' },
      include: {
        creator: { select: { id: true, name: true, email: true } },
        assignee: { select: { id: true, name: true, email: true } },
        affectedServices: { select: { id: true, name: true, status: true } },
      },
    });

    const hasMore = incidents.length > limit;
    const data = hasMore ? incidents.slice(0, limit) : incidents;
    const nextCursor = hasMore ? data[data.length - 1].id : null;

    return { data, pagination: { nextCursor, hasMore } };
  }

  static async getIncidentDetails(orgId: string, incidentId: string) {
    const incident = await prisma.incident.findFirst({
      where: { id: incidentId, orgId },
      include: {
        creator: { select: { id: true, name: true, email: true } },
        assignee: { select: { id: true, name: true, email: true } },
        affectedServices: { select: { id: true, name: true, status: true } },
        updates: {
          include: { user: { select: { id: true, name: true } } },
          orderBy: { createdAt: 'asc' },
        },
        timelineEvents: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!incident) {
      throw new AppError('Incident not found', 404);
    }

    return incident;
  }

  static async assignIncident(orgId: string, incidentId: string, data: AssignIncidentInput) {
    return prisma.$transaction(async (tx) => {
      const incident = await tx.incident.findFirst({
        where: { id: incidentId, orgId },
        select: { id: true, assigneeId: true, status: true },
      });

      if (!incident) throw new AppError('Incident not found', 404);
      if (incident.status === IncidentStatus.CLOSED) throw new AppError('Incident is closed', 400);

      // Verify Assignee exists and belongs to the same org
      const assignee = await tx.user.findFirst({
        where: { id: data.assigneeId, orgId },
      });
      if (!assignee) throw new AppError('Assignee not found in this organization', 400);

      const updatedIncident = await tx.incident.update({
        where: { id: incident.id },
        data: { assigneeId: data.assigneeId },
      });

      const timelineEvent = await tx.timelineEvent.create({
        data: {
          incidentId: incident.id,
          eventType: 'ASSIGNEE_CHANGED',
          metadata: { oldAssigneeId: incident.assigneeId, newAssigneeId: data.assigneeId },
        },
      });

      SocketEmitter.toOrg(orgId, 'incident:assigned', { id: incident.id, assigneeId: data.assigneeId });
      SocketEmitter.toIncident(incident.id, 'timeline:event_created', { incidentId: incident.id, eventType: timelineEvent.eventType });

      return updatedIncident;
    });
  }

  static async updateStatus(orgId: string, incidentId: string, data: ChangeStatusInput) {
    const result = await prisma.$transaction(async (tx) => {
      const incident = await tx.incident.findFirst({
        where: { id: incidentId, orgId },
        select: { id: true, status: true },
      });

      if (!incident) throw new AppError('Incident not found', 404);

      // Run state machine validation
      this.validateTransition(incident.status, data.status);

      // Determine timestamp updates for Analytics
      const timestampUpdates: any = {};
      if (data.status === IncidentStatus.ACKNOWLEDGED && incident.status === IncidentStatus.TRIGGERED) {
        timestampUpdates.acknowledgedAt = new Date();
      }
      if (data.status === IncidentStatus.RESOLVED) {
        timestampUpdates.resolvedAt = new Date();
      }

      const updatedIncident = await tx.incident.update({
        where: { id: incident.id },
        data: {
          status: data.status,
          ...timestampUpdates,
        },
      });

      const timelineEvent = await tx.timelineEvent.create({
        data: {
          incidentId: incident.id,
          eventType: 'STATUS_CHANGED',
          metadata: { oldStatus: incident.status, newStatus: data.status },
        },
      });

      SocketEmitter.toOrg(orgId, 'incident:status_changed', { id: incident.id, status: data.status });
      SocketEmitter.toIncident(incident.id, 'timeline:event_created', { incidentId: incident.id, eventType: timelineEvent.eventType });
      SocketEmitter.toOrg(orgId, 'status:updated', { orgId });

      return updatedIncident;
    });

    const incidentWithServices = await prisma.incident.findUnique({
      where: { id: incidentId },
      select: { affectedServices: { select: { id: true } } }
    });

    if (incidentWithServices && incidentWithServices.affectedServices.length > 0) {
      const serviceIds = incidentWithServices.affectedServices.map(s => s.id);
      await ServiceEngine.recalculateMultipleServices(orgId, serviceIds);
    }

    return result;
  }

  static async addUpdate(orgId: string, incidentId: string, userId: string, data: AddUpdateInput) {
    return prisma.$transaction(async (tx) => {
      const incident = await tx.incident.findFirst({
        where: { id: incidentId, orgId },
        select: { id: true, status: true },
      });

      if (!incident) throw new AppError('Incident not found', 404);
      if (incident.status === IncidentStatus.CLOSED) throw new AppError('Incident is closed', 400);

      const update = await tx.incidentUpdate.create({
        data: {
          incidentId: incident.id,
          userId,
          message: data.message,
          isPublic: data.isPublic,
        },
      });

      const timelineEvent = await tx.timelineEvent.create({
        data: {
          incidentId: incident.id,
          eventType: 'UPDATE_ADDED',
          metadata: { updateId: update.id, isPublic: data.isPublic },
        },
      });

      SocketEmitter.toOrg(orgId, 'incident:update_added', { id: incident.id, updateId: update.id, isPublic: data.isPublic });
      SocketEmitter.toIncident(incident.id, 'timeline:event_created', { incidentId: incident.id, eventType: timelineEvent.eventType });
      
      if (data.isPublic) {
        SocketEmitter.toOrg(orgId, 'status:updated', { orgId });
      }

      return update;
    });
  }
}
