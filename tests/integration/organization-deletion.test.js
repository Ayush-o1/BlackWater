import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { api } from '../helpers/request.js';
import { cleanDatabase, prisma } from '../helpers/db.js';
import { addUserToOrg, bearer, createIncident, createOrgWithUser, createService } from '../helpers/factories.js';

beforeEach(cleanDatabase);
afterAll(() => prisma.$disconnect());

const remove = (token, body) => api().delete('/api/organizations/me').set('Authorization', bearer(token)).send(body);

// Everything an organization can own, so a deletion that misses a table shows up.
async function populate(org, admin) {
  const service = await createService(org.id);
  const incident = await createIncident(org.id, admin.id, { serviceIds: [service.id], isPublic: true });
  await prisma.incidentUpdate.create({ data: { incidentId: incident.id, userId: admin.id, message: 'A note', isPublic: true } });
  await prisma.timelineEvent.create({ data: { incidentId: incident.id, actorId: admin.id, eventType: 'INCIDENT_CREATED', metadata: {} } });
  await prisma.invitation.create({ data: { orgId: org.id, role: 'MEMBER', tokenHash: `hash-${org.id}`, expiresAt: new Date(Date.now() + 60_000), createdById: admin.id } });
  return incident;
}

const rowsOf = (orgId) =>
  Promise.all([
    prisma.organization.count({ where: { id: orgId } }),
    prisma.user.count({ where: { orgId } }),
    prisma.service.count({ where: { orgId } }),
    prisma.incident.count({ where: { orgId } }),
    prisma.incidentUpdate.count({ where: { incident: { orgId } } }),
    prisma.timelineEvent.count({ where: { incident: { orgId } } }),
    prisma.invitation.count({ where: { orgId } }),
  ]);

describe('DELETE /organizations/me', () => {
  it('is for administrators only', async () => {
    const { org } = await createOrgWithUser('ADMIN');
    for (const role of ['MEMBER', 'VIEWER']) {
      const { token, password } = await addUserToOrg(org.id, role);
      const res = await remove(token, { password, confirmName: org.name });
      expect(res.status).toBe(403);
    }
    expect(await prisma.organization.count({ where: { id: org.id } })).toBe(1);
  });

  it('needs the administrator\'s own password, and a wrong one deletes nothing', async () => {
    const { org, token } = await createOrgWithUser('ADMIN');

    const res = await remove(token, { password: 'not-the-password', confirmName: org.name });

    expect(res.status).toBe(403);
    expect(res.body.message).toMatch(/password/i);
    expect(await prisma.organization.count({ where: { id: org.id } })).toBe(1);
  });

  it('needs the organization\'s exact name typed out, so a slip cannot erase it', async () => {
    const { org, token, password } = await createOrgWithUser('ADMIN');

    const res = await remove(token, { password, confirmName: `${org.name} copy` });

    expect(res.status).toBe(400);
    expect(await prisma.organization.count({ where: { id: org.id } })).toBe(1);
  });

  it('deletes the organization with everything it owns, and nothing of another organization', async () => {
    const mine = await createOrgWithUser('ADMIN');
    const theirs = await createOrgWithUser('ADMIN');
    await addUserToOrg(mine.org.id, 'VIEWER');
    const incident = await populate(mine.org, mine.user);
    await populate(theirs.org, theirs.user);
    const theirsBefore = await rowsOf(theirs.org.id);

    const res = await remove(mine.token, { password: mine.password, confirmName: mine.org.name });

    expect(res.status).toBe(200);
    expect(await rowsOf(mine.org.id)).toEqual([0, 0, 0, 0, 0, 0, 0]);
    expect(await rowsOf(theirs.org.id)).toEqual(theirsBefore);

    // Gone for everyone: the public page, the old token, the incident.
    expect((await api().get('/api/status').query({ orgId: mine.org.id })).status).toBe(404);
    expect((await api().get('/api/auth/me').set('Authorization', bearer(mine.token))).status).toBe(401);
    expect(await prisma.incident.count({ where: { id: incident.id } })).toBe(0);
  });

  it('rejects a request without both confirmations', async () => {
    const { token } = await createOrgWithUser('ADMIN');
    expect((await remove(token, {})).status).toBe(400);
    expect((await remove(token, { password: 'x' })).status).toBe(400);
  });
});
