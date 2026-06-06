import bcrypt from 'bcrypt';
import prisma from '../../prisma/client';
import { RegisterInput, LoginInput } from './auth.schemas';
import { generateToken } from '../../utils/jwt';
import { AppError } from '../../utils/errors/AppError';
import { UserWithoutPassword } from './auth.types';
import { Role } from '@prisma/client';

export class AuthService {
  /**
   * Helper to omit the passwordHash from the user object
   */
  private static sanitizeUser(user: any): UserWithoutPassword {
    const { passwordHash, ...userWithoutPassword } = user;
    return userWithoutPassword as UserWithoutPassword;
  }

  static async register(data: RegisterInput) {
    // 1. Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: data.email },
    });

    if (existingUser) {
      throw new AppError('Email already in use', 409);
    }

    // 2. Hash password
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(data.password, saltRounds);

    // 3. Create org and user in transaction
    const user = await prisma.$transaction(async (tx) => {
      const org = await tx.organization.create({
        data: { name: data.orgName },
      });

      return await tx.user.create({
        data: {
          name: data.name,
          email: data.email,
          passwordHash,
          orgId: org.id,
          role: Role.ADMIN, // First user in an org is an ADMIN
        },
      });
    });

    const sanitizedUser = this.sanitizeUser(user);

    // 4. Generate JWT
    const token = generateToken({
      userId: user.id,
      orgId: user.orgId,
      role: user.role,
    });

    return {
      token,
      user: sanitizedUser,
    };
  }

  static async login(data: LoginInput) {
    // 1. Find user by email
    const user = await prisma.user.findUnique({
      where: { email: data.email },
    });

    if (!user) {
      throw new AppError('Invalid credentials', 401);
    }

    // 2. Compare password
    const isPasswordValid = await bcrypt.compare(data.password, user.passwordHash);

    if (!isPasswordValid) {
      throw new AppError('Invalid credentials', 401);
    }

    // 3. Generate JWT
    const token = generateToken({
      userId: user.id,
      orgId: user.orgId,
      role: user.role,
    });

    // 4. Return token and sanitized user
    return {
      token,
      user: this.sanitizeUser(user),
    };
  }

  static async getUserById(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new AppError('User not found', 404);
    }

    return this.sanitizeUser(user);
  }
}
