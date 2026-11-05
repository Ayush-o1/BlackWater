import { prisma } from '../database/prisma.js';
import { AppError } from '../utils/AppError.js';
import { paginate, cursorOptions } from '../utils/pagination.js';

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
    orderBy: { createdAt: 'desc' },
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

  return prisma.user.update({
    where: { id: userId },
    data: { name },
    select: publicUserFields,
  });
}
