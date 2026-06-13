import prisma from '../../prisma/client';
import { UpdateOrgInput } from './organization.schemas';
import { AppError } from '../../utils/errors/AppError';

export class OrganizationService {
  static async getOrgDetails(orgId: string) {
    const org = await prisma.organization.findUnique({
      where: { id: orgId },
      include: {
        _count: {
          select: { users: true }
        }
      }
    });

    if (!org) {
      throw new AppError('Organization not found', 404);
    }

    return org;
  }

  static async updateOrg(orgId: string, data: UpdateOrgInput) {
    // Check if it exists
    await this.getOrgDetails(orgId);

    const updatedOrg = await prisma.organization.update({
      where: { id: orgId },
      data: { name: data.name },
    });

    return updatedOrg;
  }
}
