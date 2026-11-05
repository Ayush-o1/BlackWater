import crypto from 'node:crypto';
import bcrypt from 'bcrypt';
import { Prisma, Role } from '@prisma/client';
import { prisma } from '../database/prisma.js';
import { AppError } from '../utils/AppError.js';
import { generateToken } from '../utils/jwt.js';
import { emitToOrg } from '../socket/emitter.js';
import { SocketEvent } from '../socket/events.js';

const INVITATION_LIFETIME_MS = 7 * 24 * 60 * 60 * 1000;
const BCRYPT_ROUNDS = 10;

// One message for unknown, expired and already-used links. Distinguishing them
// would let someone probe which tokens used to exist.
const INVALID_INVITATION = 'This invitation link is no longer valid';

// A fast one-way hash is enough here (unlike passwords): the token is 256 bits
// of randomness, so there is nothing to brute-force. Only the hash is stored,
// so reading the database does not reveal a usable link.
const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');

const publicInvitationFields = {
  id: true,
  role: true,
  expiresAt: true,
  createdAt: true,
  createdBy: { select: { id: true, name: true } },
};

// Creates a one-time link for the admin's own organization. The raw token is
// returned exactly once, here; it cannot be recovered later.
export async function createInvitation(orgId, adminId, role) {
  // Defence in depth: the validator and a database CHECK constraint refuse this too.
  if (role === Role.ADMIN) {
    throw new AppError('Invitations cannot grant the ADMIN role', 400);
  }

  const token = crypto.randomBytes(32).toString('base64url');

  const invitation = await prisma.invitation.create({
    data: {
      orgId,
      role,
      tokenHash: hashToken(token),
      expiresAt: new Date(Date.now() + INVITATION_LIFETIME_MS),
      createdById: adminId,
    },
    select: publicInvitationFields,
  });

  return { ...invitation, token };
}

// Invitations that can still be used (not accepted, not expired).
export async function listPendingInvitations(orgId) {
  return prisma.invitation.findMany({
    where: { orgId, usedAt: null, expiresAt: { gt: new Date() } },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: 100,
    select: publicInvitationFields,
  });
}

export async function revokeInvitation(orgId, invitationId) {
  // orgId in the filter: an admin can only revoke their own organization's links.
  const { count } = await prisma.invitation.deleteMany({
    where: { id: invitationId, orgId, usedAt: null },
  });

  if (count === 0) {
    throw new AppError('Invitation not found', 404);
  }
}

// Lets the invitation page show "Join Acme as a Member" before the person
// fills in the form. Public, so it reveals only the organization name and role.
export async function previewInvitation(token) {
  const invitation = await prisma.invitation.findFirst({
    where: { tokenHash: hashToken(token), usedAt: null, expiresAt: { gt: new Date() } },
    select: { role: true, expiresAt: true, organization: { select: { name: true } } },
  });

  if (!invitation) {
    throw new AppError(INVALID_INVITATION, 410);
  }

  return { organizationName: invitation.organization.name, role: invitation.role, expiresAt: invitation.expiresAt };
}

export async function acceptInvitation({ token, name, email, password }) {
  const tokenHash = hashToken(token);

  // Cheap check first so a bad link does not cost a bcrypt hash.
  await previewInvitation(token);

  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

  const user = await prisma.$transaction(async (tx) => {
    // Claim the invitation with one UPDATE that includes every validity rule.
    // The database applies it atomically: if two people open the same link at
    // the same moment, exactly one UPDATE matches a row and the other matches
    // none. A separate "check, then mark as used" would let both through.
    const claimed = await tx.invitation.updateMany({
      where: { tokenHash, usedAt: null, expiresAt: { gt: new Date() } },
      data: { usedAt: new Date() },
    });
    if (claimed.count !== 1) {
      throw new AppError(INVALID_INVITATION, 410);
    }

    // The organization and role come from the stored invitation, never from
    // the request, so the invitee cannot choose either.
    const invitation = await tx.invitation.findUnique({ where: { tokenHash } });

    let created;
    try {
      created = await tx.user.create({
        data: { name, email, passwordHash, orgId: invitation.orgId, role: invitation.role },
      });
    } catch (error) {
      // Throwing rolls the whole transaction back, including the claim above,
      // so a taken email does not burn the invitation.
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new AppError('Email already in use', 409);
      }
      throw error;
    }

    await tx.invitation.update({ where: { id: invitation.id }, data: { usedById: created.id } });
    return created;
  });

  emitToOrg(user.orgId, SocketEvent.TEAM_CHANGED, { id: user.id });

  const { passwordHash: _hash, ...safeUser } = user; // never return the hash
  return {
    token: generateToken({ userId: user.id, orgId: user.orgId, role: user.role }),
    user: safeUser,
  };
}
