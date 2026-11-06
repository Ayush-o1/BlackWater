// Loads .env like the server does (src/config/env.js). `npm run prisma:seed` runs this
// file with plain node, so without it DATABASE_URL would be missing.
import 'dotenv/config';
import bcrypt from 'bcrypt';
import { Role, Severity, IncidentStatus } from '@prisma/client';
import { prisma } from '../src/database/prisma.js';
import { TimelineEventType } from '../src/utils/timelineEvents.js';

// Demo data for local development. It deletes everything first, so it refuses
// to run against production.
async function main() {
  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'Refusing to run the demo seed script with NODE_ENV=production because it deletes all data.'
    );
  }

  console.log('Seeding database with BlackWater demo data...');

  // Deleting organizations cascades to users, services, incidents, updates,
  // timeline events and invitations. IncidentUpdate -> User is RESTRICT, so
  // updates have to go first.
  await prisma.incidentUpdate.deleteMany({});
  await prisma.organization.deleteMany({});

  const org = await prisma.organization.create({ data: { name: 'BlackWater Demo Corp' } });

  const passwordHash = await bcrypt.hash('password123', 10);
  const makeUser = (name, email, role) =>
    prisma.user.create({ data: { name, email, passwordHash, role, orgId: org.id } });

  const admin = await makeUser('Alice Admin', 'admin@blackwater.com', Role.ADMIN);
  const member = await makeUser('Bob Engineer', 'bob@blackwater.com', Role.MEMBER);
  await makeUser('Vera Viewer', 'viewer@blackwater.com', Role.VIEWER);

  const service = (name, description) => prisma.service.create({ data: { name, description, orgId: org.id } });
  const apiGateway = await service('API Gateway', 'Main edge router and rate limiter');
  await service('Authentication Service', 'Handles login and token issuing');
  const database = await service('Primary DB Cluster', 'PostgreSQL primary and replicas');

  const daysAgo = (days, hours = 0) => new Date(Date.now() - days * 24 * 3600 * 1000 + hours * 3600 * 1000);

  // A resolved, public incident from last week.
  const pastStart = daysAgo(7);
  const pastResolved = daysAgo(7, 1);
  const past = await prisma.incident.create({
    data: {
      title: 'Database failover latency',
      description: 'Brief spike in latency during automated multi-AZ failover.',
      status: IncidentStatus.RESOLVED,
      severity: Severity.LOW,
      isPublic: true,
      orgId: org.id,
      creatorId: member.id,
      assigneeId: member.id,
      createdAt: pastStart,
      acknowledgedAt: daysAgo(7, 0.2),
      resolvedAt: pastResolved,
      affectedServices: { connect: [{ id: database.id }] },
    },
  });
  await prisma.timelineEvent.createMany({
    data: [
      { incidentId: past.id, actorId: member.id, eventType: TimelineEventType.INCIDENT_CREATED, metadata: { severity: Severity.LOW, isPublic: true }, createdAt: pastStart },
      { incidentId: past.id, actorId: member.id, eventType: TimelineEventType.STATUS_CHANGED, metadata: { oldStatus: IncidentStatus.TRIGGERED, newStatus: IncidentStatus.ACKNOWLEDGED }, createdAt: daysAgo(7, 0.2) },
      { incidentId: past.id, actorId: member.id, eventType: TimelineEventType.STATUS_CHANGED, metadata: { oldStatus: IncidentStatus.ACKNOWLEDGED, newStatus: IncidentStatus.RESOLVED }, createdAt: pastResolved },
    ],
  });

  // An active, public incident that is degrading the API gateway.
  const active = await prisma.incident.create({
    data: {
      title: 'Elevated error rates on the API gateway',
      description: 'About 5% of requests return 5xx. Suspected rate-limit misconfiguration.',
      status: IncidentStatus.ACKNOWLEDGED,
      severity: Severity.HIGH,
      isPublic: true,
      orgId: org.id,
      creatorId: admin.id,
      assigneeId: member.id,
      acknowledgedAt: new Date(),
      affectedServices: { connect: [{ id: apiGateway.id }] },
    },
  });
  await prisma.timelineEvent.createMany({
    data: [
      { incidentId: active.id, actorId: admin.id, eventType: TimelineEventType.INCIDENT_CREATED, metadata: { severity: Severity.HIGH, isPublic: true } },
      { incidentId: active.id, actorId: admin.id, eventType: TimelineEventType.ASSIGNEE_CHANGED, metadata: { from: null, to: { id: member.id, name: member.name } } },
      { incidentId: active.id, actorId: member.id, eventType: TimelineEventType.STATUS_CHANGED, metadata: { oldStatus: IncidentStatus.TRIGGERED, newStatus: IncidentStatus.ACKNOWLEDGED } },
    ],
  });
  const note = await prisma.incidentUpdate.create({
    data: { incidentId: active.id, userId: admin.id, message: 'Looks like a misconfigured rate limit rule. Rolling back.', isPublic: false },
  });
  const statement = await prisma.incidentUpdate.create({
    data: { incidentId: active.id, userId: member.id, message: 'We are investigating elevated error rates on the API. Engineers are engaged.', isPublic: true },
  });
  await prisma.timelineEvent.createMany({
    data: [
      { incidentId: active.id, actorId: admin.id, eventType: TimelineEventType.UPDATE_ADDED, metadata: { updateId: note.id, isPublic: false } },
      { incidentId: active.id, actorId: member.id, eventType: TimelineEventType.UPDATE_ADDED, metadata: { updateId: statement.id, isPublic: true } },
    ],
  });

  // A private incident: visible to the team only, never on the status page.
  const internal = await prisma.incident.create({
    data: {
      title: 'Suspicious login attempts on the admin panel',
      description: 'Internal investigation. Not for the status page.',
      status: IncidentStatus.TRIGGERED,
      severity: Severity.MEDIUM,
      isPublic: false,
      orgId: org.id,
      creatorId: admin.id,
    },
  });
  await prisma.timelineEvent.create({
    data: { incidentId: internal.id, actorId: admin.id, eventType: TimelineEventType.INCIDENT_CREATED, metadata: { severity: Severity.MEDIUM, isPublic: false } },
  });

  console.log('Seeding complete.');
  console.log(`Organization ID (public status page: /status/${org.id})`);
  console.log('Logins (password for all: password123):');
  console.log('  admin@blackwater.com   ADMIN');
  console.log('  bob@blackwater.com     MEMBER');
  console.log('  viewer@blackwater.com  VIEWER');
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
