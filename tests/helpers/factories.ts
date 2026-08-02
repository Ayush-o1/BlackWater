import bcrypt from 'bcrypt';
import { Role, Severity, ServiceStatus } from '@prisma/client';
import { prisma } from './db';
import { generateToken } from '../../src/utils/jwt';

let counter = 0;
const unique = () => `${Date.now()}-${(counter++).toString(36)}`;

export async function createOrg(name = `Test Org ${unique()}`) {
  return prisma.organization.create({ data: { name } });
}

export async function createUser(
  orgId: string,
  role: Role = Role.MEMBER,
  overrides: { name?: string; email?: string; password?: string } = {}
) {
  const password = overrides.password ?? 'CorrectHorse!9';
  const passwordHash = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({
    data: {
      name: overrides.name ?? 'Priya Menon',
      email: overrides.email ?? `user-${unique()}@blackwater.test`,
      passwordHash,
      role,
      orgId,
    },
  });
  return { user, password };
}

/** Creates an org + a single user with the given role, plus a ready-to-use bearer token. */
export async function createOrgWithUser(
  role: Role = Role.ADMIN,
  overrides: { name?: string; email?: string; password?: string } = {}
) {
  const org = await createOrg();
  const { user, password } = await createUser(org.id, role, overrides);
  const token = generateToken({ userId: user.id, orgId: org.id, role: user.role });
  return { org, user, password, token };
}

export async function createService(
  orgId: string,
  overrides: { name?: string; description?: string; status?: ServiceStatus } = {}
) {
  return prisma.service.create({
    data: {
      name: overrides.name ?? `Service ${unique()}`,
      description: overrides.description ?? 'A monitored component',
      status: overrides.status ?? ServiceStatus.OPERATIONAL,
      orgId,
    },
  });
}

export async function createIncident(
  orgId: string,
  creatorId: string,
  overrides: { title?: string; severity?: Severity; serviceIds?: string[] } = {}
) {
  return prisma.incident.create({
    data: {
      title: overrides.title ?? `Incident ${unique()}`,
      severity: overrides.severity ?? Severity.HIGH,
      orgId,
      creatorId,
      ...(overrides.serviceIds?.length && {
        affectedServices: { connect: overrides.serviceIds.map((id) => ({ id })) },
      }),
    },
  });
}
