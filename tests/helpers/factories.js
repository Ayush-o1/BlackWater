import bcrypt from 'bcrypt';
import { Role, Severity } from '@prisma/client';
import { prisma } from './db.js';
import { generateToken } from '../../src/utils/jwt.js';

let counter = 0;
const unique = () => `${Date.now()}-${(counter++).toString(36)}`;

export const bearer = (token) => `Bearer ${token}`;

async function createOrg(name = `Test Org ${unique()}`) {
  return prisma.organization.create({ data: { name } });
}

export async function createUser(orgId, role = Role.MEMBER, overrides = {}) {
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

const tokenFor = (user) => generateToken({ userId: user.id, orgId: user.orgId, role: user.role });

/** Creates an org + a single user with the given role, plus a ready-to-use bearer token. */
export async function createOrgWithUser(role = Role.ADMIN, overrides = {}) {
  const org = await createOrg();
  const { user, password } = await createUser(org.id, role, overrides);
  return { org, user, password, token: tokenFor(user) };
}

/** Adds another user to an existing org and returns them with a token. */
export async function addUserToOrg(orgId, role = Role.MEMBER, overrides = {}) {
  const { user, password } = await createUser(orgId, role, overrides);
  return { user, password, token: tokenFor(user) };
}

export async function createService(orgId, overrides = {}) {
  return prisma.service.create({
    data: {
      name: overrides.name ?? `Service ${unique()}`,
      description: overrides.description ?? 'A monitored component',
      orgId,
    },
  });
}

// Creates an incident directly in the database. Private by default, like the API.
export async function createIncident(orgId, creatorId, overrides = {}) {
  return prisma.incident.create({
    data: {
      title: overrides.title ?? `Incident ${unique()}`,
      description: overrides.description,
      severity: overrides.severity ?? Severity.HIGH,
      status: overrides.status,
      isPublic: overrides.isPublic ?? false,
      orgId,
      creatorId,
      ...(overrides.serviceIds?.length && {
        affectedServices: { connect: overrides.serviceIds.map((id) => ({ id })) },
      }),
    },
  });
}
