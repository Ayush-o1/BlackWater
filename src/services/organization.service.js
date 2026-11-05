import { prisma } from '../database/prisma.js';
import { AppError } from '../utils/AppError.js';

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
