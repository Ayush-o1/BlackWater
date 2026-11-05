import bcrypt from 'bcrypt';
import { Role } from '@prisma/client';
import { prisma } from '../database/prisma.js';
import { generateToken } from '../utils/jwt.js';
import { AppError } from '../utils/AppError.js';

// Cost factor for bcrypt. Each +1 doubles the hashing time, which is what makes
// stolen password hashes expensive to crack. 10 is roughly 100 ms per hash.
const BCRYPT_ROUNDS = 10;

// Never send the password hash to a client, or put it on req.user.
function withoutPasswordHash(user) {
  const { passwordHash, ...safeUser } = user;
  return safeUser;
}

function tokenFor(user) {
  return generateToken({ userId: user.id, orgId: user.orgId, role: user.role });
}

export async function register({ name, email, password, orgName }) {
  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (existingUser) {
    throw new AppError('Email already in use', 409);
  }

  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

  // The organization and its first user are created together or not at all.
  // Without the transaction a failure in the second insert would leave behind
  // an organization that nobody can log in to.
  const user = await prisma.$transaction(async (tx) => {
    const organization = await tx.organization.create({ data: { name: orgName } });

    return tx.user.create({
      data: {
        name,
        email,
        passwordHash,
        orgId: organization.id,
        role: Role.ADMIN, // whoever creates an organization administers it
      },
    });
  });

  return { token: tokenFor(user), user: withoutPasswordHash(user) };
}

export async function login({ email, password }) {
  const user = await prisma.user.findUnique({ where: { email } });

  // An unknown email and a wrong password return the same message so the
  // response does not reveal which emails have accounts.
  if (!user) {
    throw new AppError('Invalid credentials', 401);
  }

  const passwordMatches = await bcrypt.compare(password, user.passwordHash);
  if (!passwordMatches) {
    throw new AppError('Invalid credentials', 401);
  }

  return { token: tokenFor(user), user: withoutPasswordHash(user) };
}

export async function getUserById(userId) {
  const user = await prisma.user.findUnique({ where: { id: userId } });

  if (!user) {
    throw new AppError('User not found', 404);
  }

  return withoutPasswordHash(user);
}
