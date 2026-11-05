import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { api } from '../helpers/request.js';
import { cleanDatabase, prisma } from '../helpers/db.js';
import { bearer, createOrgWithUser, createService, createIncident } from '../helpers/factories.js';

beforeEach(cleanDatabase);
afterAll(() => prisma.$disconnect());

describe('POST /services', () => {
  it('lets a MEMBER create a service, which starts OPERATIONAL', async () => {
    const { token } = await createOrgWithUser('MEMBER');

    const res = await api()
      .post('/services')
      .set('Authorization', bearer(token))
      .send({ name: 'Payments API', description: 'Handles checkout charges' });

    expect(res.status).toBe(201);
    expect(res.body.data.status).toBe('OPERATIONAL');
  });

  it('ignores a status supplied by the client: health is always calculated', async () => {
    const { token } = await createOrgWithUser('MEMBER');

    const res = await api()
      .post('/services')
      .set('Authorization', bearer(token))
      .send({ name: 'Payments API', status: 'MAJOR_OUTAGE' });

    expect(res.status).toBe(201);
    expect(res.body.data.status).toBe('OPERATIONAL');
  });

  it('returns 403 for a VIEWER', async () => {
    const { token } = await createOrgWithUser('VIEWER');

    const res = await api().post('/services').set('Authorization', bearer(token)).send({ name: 'Payments API' });

    expect(res.status).toBe(403);
  });
});

describe('GET /services', () => {
  it('only lists services scoped to the caller organization', async () => {
    const { org, token } = await createOrgWithUser('VIEWER');
    const { org: otherOrg } = await createOrgWithUser('VIEWER');
    await createService(org.id, { name: 'Mine' });
    await createService(otherOrg.id, { name: 'Not mine' });

    const res = await api().get('/services').set('Authorization', bearer(token));

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].name).toBe('Mine');
  });
});

describe('service health', () => {
  it('follows the worst open incident, whether or not it is public', async () => {
    const { org, user, token } = await createOrgWithUser('MEMBER');
    const service = await createService(org.id);

    await createIncident(org.id, user.id, { severity: 'LOW', serviceIds: [service.id] });
    expect((await api().get(`/services/${service.id}`).set('Authorization', bearer(token))).body.data.status).toBe('DEGRADED');

    // A private critical incident still counts for the team's own view.
    const critical = await createIncident(org.id, user.id, { severity: 'CRITICAL', serviceIds: [service.id], isPublic: false });
    expect((await api().get(`/services/${service.id}`).set('Authorization', bearer(token))).body.data.status).toBe('MAJOR_OUTAGE');

    // Resolving it drops health back to the remaining LOW incident.
    await api().patch(`/incidents/${critical.id}/status`).set('Authorization', bearer(token)).send({ status: 'RESOLVED' });
    expect((await api().get(`/services/${service.id}`).set('Authorization', bearer(token))).body.data.status).toBe('DEGRADED');
  });

  it('returns to OPERATIONAL when the incident is resolved, and shows it in the list too', async () => {
    const { org, user, token } = await createOrgWithUser('MEMBER');
    const service = await createService(org.id);
    const incident = await createIncident(org.id, user.id, { severity: 'HIGH', serviceIds: [service.id] });

    const during = await api().get('/services').set('Authorization', bearer(token));
    expect(during.body.data[0].status).toBe('PARTIAL_OUTAGE');

    await api().patch(`/incidents/${incident.id}/status`).set('Authorization', bearer(token)).send({ status: 'RESOLVED' });

    const after = await api().get('/services').set('Authorization', bearer(token));
    expect(after.body.data[0].status).toBe('OPERATIONAL');
  });

  it('is not changed by an incident from another organization', async () => {
    const { org, token } = await createOrgWithUser('MEMBER');
    const { org: otherOrg, user: otherUser } = await createOrgWithUser('MEMBER');
    const service = await createService(org.id);
    await createIncident(otherOrg.id, otherUser.id, { severity: 'CRITICAL' });

    const res = await api().get(`/services/${service.id}`).set('Authorization', bearer(token));
    expect(res.body.data.status).toBe('OPERATIONAL');
  });
});

describe('GET and PATCH /services/:id', () => {
  it('returns the service with its recent incidents', async () => {
    const { org, user, token } = await createOrgWithUser('VIEWER');
    const service = await createService(org.id);
    await createIncident(org.id, user.id, { title: 'Earlier problem', serviceIds: [service.id] });

    const res = await api().get(`/services/${service.id}`).set('Authorization', bearer(token));

    expect(res.status).toBe(200);
    expect(res.body.data.incidents.map((i) => i.title)).toEqual(['Earlier problem']);
    expect(res.body.data.status).toBe('PARTIAL_OUTAGE');
  });

  it('lets a MEMBER rename it, but a VIEWER not', async () => {
    const { org, token } = await createOrgWithUser('MEMBER');
    const { token: viewerToken } = await createOrgWithUser('VIEWER');
    const service = await createService(org.id, { name: 'Old name' });

    const ok = await api().patch(`/services/${service.id}`).set('Authorization', bearer(token)).send({ name: 'New name' });
    const denied = await api().patch(`/services/${service.id}`).set('Authorization', bearer(viewerToken)).send({ name: 'Hacked' });

    expect(ok.status).toBe(200);
    expect(ok.body.data.name).toBe('New name');
    expect(denied.status).toBe(403);
  });

  it('returns 404 for another organization\'s service', async () => {
    const { token } = await createOrgWithUser('ADMIN');
    const { org: otherOrg } = await createOrgWithUser('ADMIN');
    const foreign = await createService(otherOrg.id);

    expect((await api().get(`/services/${foreign.id}`).set('Authorization', bearer(token))).status).toBe(404);
    expect((await api().patch(`/services/${foreign.id}`).set('Authorization', bearer(token)).send({ name: 'Taken over' })).status).toBe(404);
  });
});

describe('DELETE /services/:id', () => {
  it('allows ADMIN to delete', async () => {
    const { org, token } = await createOrgWithUser('ADMIN');
    const service = await createService(org.id);

    const res = await api().delete(`/services/${service.id}`).set('Authorization', bearer(token));

    expect(res.status).toBe(200);
    await expect(prisma.service.findUnique({ where: { id: service.id } })).resolves.toBeNull();
  });

  it('returns 403 for a MEMBER', async () => {
    const { org, token } = await createOrgWithUser('MEMBER');
    const service = await createService(org.id);

    const res = await api().delete(`/services/${service.id}`).set('Authorization', bearer(token));

    expect(res.status).toBe(403);
    await expect(prisma.service.findUnique({ where: { id: service.id } })).resolves.not.toBeNull();
  });

  it('returns 404 for a service belonging to another organization', async () => {
    const { token } = await createOrgWithUser('ADMIN');
    const { org: otherOrg } = await createOrgWithUser('ADMIN');
    const foreignService = await createService(otherOrg.id);

    const res = await api().delete(`/services/${foreignService.id}`).set('Authorization', bearer(token));

    expect(res.status).toBe(404);
    await expect(prisma.service.findUnique({ where: { id: foreignService.id } })).resolves.not.toBeNull();
  });
});
