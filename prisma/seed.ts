import { PrismaClient, Role, Severity, IncidentStatus, ServiceStatus } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'Refusing to run the demo seed script with NODE_ENV=production — it wipes all data. ' +
      'If this is intentional, run with a different NODE_ENV value.'
    );
  }

  console.log('Seeding database with BlackWater demo data...');

  // Clean the database
  await prisma.timelineEvent.deleteMany({});
  await prisma.incidentUpdate.deleteMany({});
  await prisma.incident.deleteMany({});
  await prisma.service.deleteMany({});
  await prisma.user.deleteMany({});
  await prisma.organization.deleteMany({});

  // 1. Create Organization
  const org = await prisma.organization.create({
    data: { name: 'BlackWater Demo Corp' },
  });

  // 2. Create Users
  const passwordHash = await bcrypt.hash('password123', 10);
  
  const adminUser = await prisma.user.create({
    data: { name: 'Alice Admin', email: 'admin@BlackWater.com', passwordHash, role: Role.ADMIN, orgId: org.id },
  });

  const memberUser = await prisma.user.create({
    data: { name: 'Bob Engineer', email: 'bob@BlackWater.com', passwordHash, role: Role.MEMBER, orgId: org.id },
  });

  // 3. Create Services
  const apiGateway = await prisma.service.create({
    data: { name: 'API Gateway', description: 'Main edge router and rate limiter', orgId: org.id, status: ServiceStatus.DEGRADED },
  });

  const authService = await prisma.service.create({
    data: { name: 'Authentication Service', description: 'Handles JWT generation and RBAC', orgId: org.id, status: ServiceStatus.OPERATIONAL },
  });

  const dbCluster = await prisma.service.create({
    data: { name: 'Primary DB Cluster', description: 'Postgres Aurora instance', orgId: org.id, status: ServiceStatus.OPERATIONAL },
  });

  // 4. Create Historical Incident (Resolved)
  const pastIncident = await prisma.incident.create({
    data: {
      title: 'Database Failover Latency',
      description: 'Brief spike in latency during automated multi-AZ failover.',
      status: IncidentStatus.RESOLVED,
      severity: Severity.LOW,
      orgId: org.id,
      creatorId: memberUser.id,
      assigneeId: memberUser.id,
      createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 7 days ago
      resolvedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000 + 3600000), // Resolved 1 hr later
      affectedServices: { connect: [{ id: dbCluster.id }] },
    }
  });

  await prisma.timelineEvent.create({
    data: { incidentId: pastIncident.id, eventType: 'STATUS_CHANGE', metadata: { status: 'RESOLVED' } }
  });

  // 5. Create Active Incident
  const activeIncident = await prisma.incident.create({
    data: {
      title: 'Elevated Error Rates on Edge Gateway',
      description: 'We are seeing a 5% 5xx error rate across the main API Gateway.',
      status: IncidentStatus.ACKNOWLEDGED,
      severity: Severity.HIGH,
      orgId: org.id,
      creatorId: adminUser.id,
      assigneeId: memberUser.id,
      affectedServices: { connect: [{ id: apiGateway.id }] },
    }
  });

  await prisma.timelineEvent.createMany({
    data: [
      { incidentId: activeIncident.id, eventType: 'CREATED', metadata: { title: activeIncident.title } },
      { incidentId: activeIncident.id, eventType: 'STATUS_CHANGE', metadata: { oldStatus: 'TRIGGERED', newStatus: 'ACKNOWLEDGED' } },
      { incidentId: activeIncident.id, eventType: 'ASSIGNED', metadata: { assigneeId: memberUser.id } },
    ]
  });

  await prisma.incidentUpdate.createMany({
    data: [
      { incidentId: activeIncident.id, userId: adminUser.id, message: 'Investigating the root cause. Looks like a misconfigured rate limit rule.', isPublic: false },
      { incidentId: activeIncident.id, userId: memberUser.id, message: 'We are currently investigating elevated error rates affecting the API Gateway. Engineering is engaged.', isPublic: true },
    ]
  });

  console.log(`✅ Seeding complete!`);
  console.log(`Organization ID: ${org.id}`);
  console.log(`Admin Login: admin@BlackWater.com / password123`);
  console.log(`Member Login: bob@BlackWater.com / password123`);
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
