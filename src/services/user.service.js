import { Role } from '@prisma/client';
import { prisma } from '../database/prisma.js';
import { AppError } from '../utils/AppError.js';
import { paginate, cursorOptions, NEWEST_FIRST } from '../utils/pagination.js';
import { emitToOrg } from '../socket/emitter.js';
import { SocketEvent } from '../socket/events.js';

// The fields that are safe to return for a user (everything except passwordHash).
const publicUserFields = {
  id: true,
  email: true,
  name: true,
  role: true,
  orgId: true,
  createdAt: true,
  updatedAt: true,
};

export async function listUsers(orgId, { cursor, limit }) {
  const users = await prisma.user.findMany({
    where: { orgId },
    take: limit + 1,
    ...cursorOptions(cursor),
    select: publicUserFields,
    orderBy: NEWEST_FIRST,
  });

  return paginate(users, limit);
}

export async function getUserById(userId, orgId) {
  // orgId is part of the lookup so one organization can never read another's users.
  const user = await prisma.user.findFirst({
    where: { id: userId, orgId },
    select: publicUserFields,
  });

  if (!user) {
    throw new AppError('User not found', 404);
  }

  return user;
}

export async function updateProfile(userId, orgId, { name }) {
  await getUserById(userId, orgId);

  const user = await prisma.user.update({
    where: { id: userId },
    data: { name },
    select: publicUserFields,
  });

  // Teammates show this name in the team list and assignee pickers.
  emitToOrg(orgId, SocketEvent.TEAM_CHANGED, { id: userId });
  return user;
}

// Changes a user's role. The target is looked up by id AND orgId, so an admin
// can never touch a user of another organization (that user is "not found").
export async function changeRole(orgId, targetUserId, newRole) {
  const user = await prisma.$transaction(async (tx) => {
    // Lock every ADMIN row of this organization for the rest of the transaction.
    // This is what protects the "at least one ADMIN" rule: if two admins demote
    // each other at the same moment, the second request waits here, then sees
    // only one admin left and is refused. Without the lock both could pass the
    // count below and leave the organization with nobody in charge.
    const admins = await tx.$queryRaw`
      SELECT "id" FROM "User" WHERE "orgId" = ${orgId} AND "role" = 'ADMIN' FOR UPDATE`;

    const target = await tx.user.findFirst({ where: { id: targetUserId, orgId }, select: publicUserFields });
    if (!target) {
      throw new AppError('User not found', 404);
    }

    if (target.role === newRole) {
      return { user: target, changed: false };
    }

    const isLastAdmin = target.role === Role.ADMIN && admins.length <= 1;
    if (isLastAdmin) {
      throw new AppError('An organization must keep at least one ADMIN. Promote someone else first.', 409);
    }

    const updated = await tx.user.update({
      where: { id: targetUserId },
      data: { role: newRole },
      select: publicUserFields,
    });
    return { user: updated, changed: true };
  });

  if (user.changed) emitToOrg(orgId, SocketEvent.TEAM_CHANGED, { id: targetUserId });
  return user.user;
}
