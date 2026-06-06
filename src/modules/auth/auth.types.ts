import { User } from '@prisma/client';

export type UserWithoutPassword = Omit<User, 'passwordHash'>;

declare global {
  namespace Express {
    interface Request {
      user?: UserWithoutPassword;
    }
  }
}
