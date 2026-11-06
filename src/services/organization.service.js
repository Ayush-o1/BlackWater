import bcrypt from 'bcrypt';
import { prisma } from '../database/prisma.js';
import { AppError } from '../utils/AppError.js';
import { disconnectOrg } from '../socket/emitter.js';

export async function getOrganization(orgId) {
  const organization = await prisma.organization.findUnique({
    where: { id: orgId },
    include: { _count: { select: { users: true } } },
  });

  if (!organization) {
    throw new AppError('Organization not found', 404);
  }

  return organization;
}

export async function updateOrganization(orgId, { name }) {
  await getOrganization(orgId);

  return prisma.organization.update({ where: { id: orgId }, data: { name } });
}

// Permanently deletes the organization and everything it owns. Irreversible, so it
// asks for two things a stolen session could not supply by itself: the acting
// administrator's password, and the organization's exact name.
export async function deleteOrganization(orgId, actorId, { password, confirmName }) {
  const organization = await getOrganization(orgId);

  const actor = await prisma.user.findUnique({ where: { id: actorId }, select: { passwordHash: true } });
  // 403, not 401: the client treats 401 as "your session expired" and signs the user out.
  if (!(await bcrypt.compare(password, actor.passwordHash))) {
    throw new AppError('Incorrect password', 403);
  }
  if (confirmName !== organization.name) {
    throw new AppError('The name you typed does not match the organization name', 400);
  }

  await prisma.$transaction(async (tx) => {
    // IncidentUpdate.userId is ON DELETE RESTRICT (so a user with history cannot be
    // deleted on its own). The organization cascade would reach those rows through
    // the users, so they are removed first, in the same transaction.
    await tx.incidentUpdate.deleteMany({ where: { incident: { orgId } } });
    await tx.organization.delete({ where: { id: orgId } });
  });

  // Operators need a record of a destructive act; it holds ids only, no personal data.
  console.log(`Organization ${orgId} deleted by user ${actorId}`);
  disconnectOrg(orgId);
}
