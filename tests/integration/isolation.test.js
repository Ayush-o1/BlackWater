import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { api } from '../helpers/request.js';
import { cleanDatabase, prisma } from '../helpers/db.js';
import { addUserToOrg, bearer, createIncident, createOrgWithUser, createService } from '../helpers/factories.js';

beforeEach(cleanDatabase);
afterAll(() => prisma.$disconnect());

// A sweep over every endpoint that takes the id of something: an ADMIN of
// organization A must find organization B's records exactly as if they did not
// exist (404), and must change nothing. Adding a new id-addressed endpoint
// without an entry here should be a conscious decision.
describe('organization isolation across every id-addressed endpoint', () => {
  async function twoOrganizations() {
    const intruder = await createOrgWithUser('ADMIN');
    const owner = await createOrgWithUser('ADMIN');
    const { user: member } = await addUserToOrg(owner.org.id, 'MEMBER');
    const service = await createService(owner.org.id);
    const incident = await createIncident(owner.org.id, owner.user.id, { serviceIds: [service.id], isPublic: true });
    const invitation = await prisma.invitation.create({
      data: { orgId: owner.org.id, role: 'MEMBER', tokenHash: 'h'.repeat(64), expiresAt: new Date(Date.now() + 60_000) },
    });
    return { intruder, owner, member, service, incident, invitation };
  }

  const snapshot = async ({ incident, service, member, invitation }) =>
    JSON.stringify({
      incident: await prisma.incident.findUnique({ where: { id: incident.id }, include: { affectedServices: true } }),
      service: await prisma.service.findUnique({ where: { id: service.id } }),
      member: await prisma.user.findUnique({ where: { id: member.id } }),
      invitation: await prisma.invitation.findUnique({ where: { id: invitation.id } }),
      updates: await prisma.incidentUpdate.count(),
      events: await prisma.timelineEvent.count(),
    });

  it('answers 404 and changes nothing', async () => {
    const world = await twoOrganizations();
    const { intruder, incident, service, member, invitation } = world;
    const as = { Authorization: bearer(intruder.token) };
    const before = await snapshot(world);

    const attempts = [
      ['get', `/api/incidents/${incident.id}`],
      ['patch', `/api/incidents/${incident.id}`, { title: 'Taken over by someone' }],
      ['patch', `/api/incidents/${incident.id}/assign`, { assigneeId: intruder.user.id }],
      ['patch', `/api/incidents/${incident.id}/assign`, { assigneeId: null }],
      ['patch', `/api/incidents/${incident.id}/status`, { status: 'RESOLVED' }],
      ['patch', `/api/incidents/${incident.id}/visibility`, { isPublic: false }],
      ['post', `/api/incidents/${incident.id}/updates`, { message: 'Hello from outside', isPublic: true }],
      ['get', `/api/services/${service.id}`],
      ['patch', `/api/services/${service.id}`, { name: 'Renamed by an intruder' }],
      ['delete', `/api/services/${service.id}`],
      ['patch', `/api/users/${member.id}/role`, { role: 'VIEWER' }],
      ['delete', `/api/invitations/${invitation.id}`],
    ];

    for (const [method, path, body] of attempts) {
      const res = await api()[method](path).set(as).send(body);
      expect(res.status, `${method.toUpperCase()} ${path}`).toBe(404);
    }

    expect(await snapshot(world)).toBe(before);
  });

  it('keeps foreign ids out of every list', async () => {
    const { intruder, owner, incident, service, member, invitation } = await twoOrganizations();
    const as = { Authorization: bearer(intruder.token) };

    const bodies = await Promise.all(
      ['/api/incidents', '/api/services', '/api/users', '/api/invitations', '/api/dashboard'].map(async (path) =>
        JSON.stringify((await api().get(path).set(as)).body)
      )
    );
    const everything = bodies.join(' ');

    for (const foreignId of [incident.id, service.id, member.id, invitation.id, owner.org.id]) {
      expect(everything).not.toContain(foreignId);
    }
  });

  it('cannot read a public incident through someone else\'s status page id', async () => {
    const { intruder, incident } = await twoOrganizations();

    const res = await api().get(`/api/status/incidents/${incident.id}`).query({ orgId: intruder.org.id });

    expect(res.status).toBe(404);
  });

  it('cannot assign an incident to, or link a service from, another organization', async () => {
    const { intruder, member, service } = await twoOrganizations();
    const own = await createIncident(intruder.org.id, intruder.user.id);
    const as = { Authorization: bearer(intruder.token) };

    const assign = await api().patch(`/api/incidents/${own.id}/assign`).set(as).send({ assigneeId: member.id });
    const link = await api().patch(`/api/incidents/${own.id}`).set(as).send({ serviceIds: [service.id] });

    expect(assign.status).toBe(400);
    expect(link.status).toBe(400);
  });
});
