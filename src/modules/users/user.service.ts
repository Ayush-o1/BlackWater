import prisma from '../../prisma/client';
import { UpdateProfileInput } from './user.schemas';
import { AppError } from '../../utils/errors/AppError';

export class UserService {
  static async listUsers(orgId: string, query: { cursor?: string; limit: number }) {
    const { cursor, limit } = query;
    const users = await prisma.user.findMany({
      where: { orgId },
      take: limit + 1,
      ...(cursor && { skip: 1, cursor: { id: cursor } }),
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        orgId: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    const hasMore = users.length > limit;
    const data = hasMore ? users.slice(0, limit) : users;
    const nextCursor = hasMore ? data[data.length - 1].id : null;

    return {
      data,
      pagination: {
        nextCursor,
        hasMore,
      }
    };
  }

  static async getUserById(userId: string, orgId: string) {
    const user = await prisma.user.findFirst({
      where: { id: userId, orgId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        orgId: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      throw new AppError('User not found', 404);
    }

    return user;
  }

  static async updateProfile(userId: string, orgId: string, data: UpdateProfileInput) {
    // Ensure user exists and belongs to the org before updating
    await this.getUserById(userId, orgId);

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { name: data.name },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        orgId: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return updatedUser;
  }
}
