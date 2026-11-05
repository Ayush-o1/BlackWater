import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { api } from '../helpers/request.js';
import { cleanDatabase, prisma } from '../helpers/db.js';
import { addUserToOrg, bearer, createOrgWithUser } from '../helpers/factories.js';

beforeEach(cleanDatabase);
afterAll(() => prisma.$disconnect());

const changeRole = (token, userId, role) =>
  api().patch(`/users/${userId}/role`).set('Authorization', bearer(token)).send({ role });

describe('PATCH /users/:id/role', () => {
  it('lets an ADMIN change a teammate\'s role, and the new role applies on their very next request', async () => {
    const { org, token: adminToken } = await createOrgWithUser('ADMIN');
    const { user: member, token: memberToken } = await addUserToOrg(org.id, 'MEMBER');
    const createIncident = () =>
      api().post('/incidents').set('Authorization', bearer(memberToken)).send({ title: 'Some incident', severity: 'LOW' });

    expect((await createIncident()).status).toBe(201);

    const res = await changeRole(adminToken, member.id, 'VIEWER');
    expect(res.status).toBe(200);
    expect(res.body.data.role).toBe('VIEWER');

    // Same token as before: the role is read from the database, not the token.
    expect((await createIncident()).status).toBe(403);
  });

  it('can promote someone to ADMIN', async () => {
    const { org, token } = await createOrgWithUser('ADMIN');
    const { user: member } = await addUserToOrg(org.id, 'MEMBER');

    const res = await changeRole(token, member.id, 'ADMIN');

    expect(res.status).toBe(200);
    expect(res.body.data.role).toBe('ADMIN');
  });

  it('is limited to ADMIN', async () => {
    const { org } = await createOrgWithUser('ADMIN');
    const { user: member, token: memberToken } = await addUserToOrg(org.id, 'MEMBER');
    const { token: viewerToken } = await addUserToOrg(org.id, 'VIEWER');

    expect((await changeRole(memberToken, member.id, 'ADMIN')).status).toBe(403);
    expect((await changeRole(viewerToken, member.id, 'VIEWER')).status).toBe(403);
    expect((await prisma.user.findUniqueOrThrow({ where: { id: member.id } })).role).toBe('MEMBER');
  });

  it('cannot reach a user in another organization', async () => {
    const { token } = await createOrgWithUser('ADMIN');
    const { org: otherOrg } = await createOrgWithUser('ADMIN');
    const { user: foreign } = await addUserToOrg(otherOrg.id, 'MEMBER');

    const res = await changeRole(token, foreign.id, 'VIEWER');

    expect(res.status).toBe(404);
    expect((await prisma.user.findUniqueOrThrow({ where: { id: foreign.id } })).role).toBe('MEMBER');
  });

  it('refuses to demote the last ADMIN, including self-demotion', async () => {
    const { user: admin, token } = await createOrgWithUser('ADMIN');

    const res = await changeRole(token, admin.id, 'MEMBER');

    expect(res.status).toBe(409);
    expect((await prisma.user.findUniqueOrThrow({ where: { id: admin.id } })).role).toBe('ADMIN');
  });

  it('allows an ADMIN to step down once another ADMIN exists', async () => {
    const { org, user: first, token: firstToken } = await createOrgWithUser('ADMIN');
    const { user: second } = await addUserToOrg(org.id, 'MEMBER');
    await changeRole(firstToken, second.id, 'ADMIN');

    const res = await changeRole(firstToken, first.id, 'MEMBER');

    expect(res.status).toBe(200);
  });

  it('never leaves an organization without an ADMIN when role changes race', async () => {
    const { org, user: a, token: tokenA } = await createOrgWithUser('ADMIN');
    const { user: b } = await addUserToOrg(org.id, 'ADMIN');

    // Both requests pass authentication as admin A at the same moment. Either one
    // alone is fine (it leaves one admin); together they would leave none. The
    // row lock in changeRole makes the second one see the first one's result.
    const results = await Promise.all([changeRole(tokenA, b.id, 'MEMBER'), changeRole(tokenA, a.id, 'MEMBER')]);

    expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
    expect(await prisma.user.count({ where: { orgId: org.id, role: 'ADMIN' } })).toBe(1);
  });

  it('validates the role and the id', async () => {
    const { user, token } = await createOrgWithUser('ADMIN');

    expect((await changeRole(token, user.id, 'SUPERUSER')).status).toBe(400);
    expect((await changeRole(token, 'not-a-uuid', 'MEMBER')).status).toBe(400);
  });
});
