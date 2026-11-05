import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { api } from '../helpers/request.js';
import { cleanDatabase, prisma } from '../helpers/db.js';
import { bearer, createOrgWithUser, createService, createIncident } from '../helpers/factories.js';

beforeEach(cleanDatabase);
afterAll(() => prisma.$disconnect());

const publicGet = (path, orgId) => api().get(path).query({ orgId });

describe('GET /status (public overview)', () => {
  it('requires no authentication and starts out operational', async () => {
    const { org } = await createOrgWithUser('ADMIN');
    await createService(org.id);

    const res = await publicGet('/api/status', org.id);

    expect(res.status).toBe(200);
    expect(res.body.data.overallStatus).toBe('OPERATIONAL');
    expect(res.body.data.services).toHaveLength(1);
  });

  it('rolls up the health caused by published incidents', async () => {
    const { org, user } = await createOrgWithUser('ADMIN');
    const service = await createService(org.id);
    await createIncident(org.id, user.id, { severity: 'MEDIUM', serviceIds: [service.id], isPublic: true });

    const res = await publicGet('/api/status', org.id);

    expect(res.body.data.overallStatus).toBe('DEGRADED');
    expect(res.body.data.services[0].status).toBe('DEGRADED');
    expect(res.body.data.activeIncidents).toHaveLength(1);
  });

  it('never exposes internal incident fields', async () => {
    const { org, user } = await createOrgWithUser('ADMIN');
    const service = await createService(org.id);
    const incident = await createIncident(org.id, user.id, {
      description: 'Internal root cause details',
      serviceIds: [service.id],
      isPublic: true,
    });

    const res = await publicGet('/api/status', org.id);

    const [publicIncident] = res.body.data.activeIncidents;
    expect(publicIncident.id).toBe(incident.id);
    expect(Object.keys(publicIncident).sort()).toEqual(
      ['affectedServices', 'createdAt', 'id', 'resolvedAt', 'severity', 'status', 'title']
    );
    expect(JSON.stringify(res.body)).not.toContain('Internal root cause details');
    expect(JSON.stringify(res.body)).not.toContain(user.id);
  });

  it('returns 404 for an unknown organization', async () => {
    const res = await api().get('/api/status').query({ orgId: '3f2b8c1e-6a4d-4f5b-9c7e-1a2b3c4d5e6f' });
    expect(res.status).toBe(404);
  });

  it('rejects a missing or malformed organization id with 400', async () => {
    expect((await api().get('/api/status')).status).toBe(400);
    expect((await api().get('/api/status').query({ orgId: 'not-a-uuid' })).status).toBe(400);
  });
});

describe('private incidents never reach the public API', () => {
  const SECRET_TITLE = 'Breach investigation in progress';
  const SECRET_DESCRIPTION = 'Customer data possibly affected';

  async function orgWithPrivateIncident() {
    const { org, user, token } = await createOrgWithUser('MEMBER');
    const service = await createService(org.id, { name: 'Payments' });
    const incident = await createIncident(org.id, user.id, {
      title: SECRET_TITLE,
      description: SECRET_DESCRIPTION,
      severity: 'CRITICAL',
      serviceIds: [service.id],
      isPublic: false,
    });
    await api()
      .post(`/api/incidents/${incident.id}/updates`)
      .set('Authorization', bearer(token))
      .send({ message: 'Public-looking message on a private incident', isPublic: true });
    return { org, user, token, service, incident };
  }

  it('is absent from the overview, the incident list and the service list', async () => {
    const { org } = await orgWithPrivateIncident();

    for (const path of ['/api/status', '/api/status/incidents', '/api/status/services']) {
      const res = await publicGet(path, org.id);
      expect(res.status).toBe(200);
      const body = JSON.stringify(res.body);
      expect(body).not.toContain(SECRET_TITLE);
      expect(body).not.toContain(SECRET_DESCRIPTION);
      expect(body).not.toContain('Public-looking message');
    }
    expect((await publicGet('/api/status/incidents', org.id)).body.data).toEqual([]);
  });

  it('looks exactly like a nonexistent incident when requested directly', async () => {
    const { org, incident } = await orgWithPrivateIncident();

    const privateRes = await publicGet(`/api/status/incidents/${incident.id}`, org.id);
    const missingRes = await publicGet('/api/status/incidents/3f2b8c1e-6a4d-4f5b-9c7e-1a2b3c4d5e6f', org.id);

    expect(privateRes.status).toBe(404);
    expect(privateRes.body).toEqual(missingRes.body);
  });

  it('does not change the health shown to visitors (no severity leak through service colour)', async () => {
    const { org, token, service } = await orgWithPrivateIncident();

    // The team sees the truth...
    const internal = await api().get(`/api/services/${service.id}`).set('Authorization', bearer(token));
    expect(internal.body.data.status).toBe('MAJOR_OUTAGE');

    // ...visitors see nothing wrong, because nothing wrong has been published.
    const overview = await publicGet('/api/status', org.id);
    expect(overview.body.data.overallStatus).toBe('OPERATIONAL');
    expect(overview.body.data.services[0].status).toBe('OPERATIONAL');
    const services = await publicGet('/api/status/services', org.id);
    expect(services.body.data.services[0].status).toBe('OPERATIONAL');
  });

  it('cannot be read through another organization\'s status page', async () => {
    const { incident } = await orgWithPrivateIncident();
    const { org: otherOrg } = await createOrgWithUser('ADMIN');

    const res = await publicGet(`/api/status/incidents/${incident.id}`, otherOrg.id);

    expect(res.status).toBe(404);
  });

  it('on a public incident, a private incident on the same service adds nothing visible', async () => {
    const { org, user, service } = await orgWithPrivateIncident();
    const published = await createIncident(org.id, user.id, {
      title: 'Slow payments',
      severity: 'LOW',
      serviceIds: [service.id],
      isPublic: true,
    });

    const detail = await publicGet(`/api/status/incidents/${published.id}`, org.id);

    // Visitors see the LOW incident's effect (DEGRADED), not the private CRITICAL one (MAJOR_OUTAGE).
    expect(detail.body.data.affectedServices[0].status).toBe('DEGRADED');
    expect(JSON.stringify(detail.body)).not.toContain(SECRET_TITLE);
  });
});

describe('publishing and unpublishing', () => {
  it('makes an incident appear, then disappear, without touching other data', async () => {
    const { org, user, token } = await createOrgWithUser('MEMBER');
    const service = await createService(org.id);
    const incident = await createIncident(org.id, user.id, { severity: 'HIGH', serviceIds: [service.id] });
    const setVisibility = (isPublic) =>
      api().patch(`/api/incidents/${incident.id}/visibility`).set('Authorization', bearer(token)).send({ isPublic });

    expect((await publicGet('/api/status', org.id)).body.data.overallStatus).toBe('OPERATIONAL');

    await setVisibility(true);
    const shown = await publicGet('/api/status', org.id);
    expect(shown.body.data.overallStatus).toBe('PARTIAL_OUTAGE');
    expect(shown.body.data.activeIncidents).toHaveLength(1);
    expect((await publicGet(`/api/status/incidents/${incident.id}`, org.id)).status).toBe(200);

    await setVisibility(false);
    const hidden = await publicGet('/api/status', org.id);
    expect(hidden.body.data.overallStatus).toBe('OPERATIONAL');
    expect(hidden.body.data.activeIncidents).toHaveLength(0);
    expect((await publicGet(`/api/status/incidents/${incident.id}`, org.id)).status).toBe(404);

    // The incident itself is untouched for the team.
    expect((await api().get(`/api/incidents/${incident.id}`).set('Authorization', bearer(token))).status).toBe(200);
  });
});

describe('GET /status/incidents/:id (public incident detail)', () => {
  it('includes only public updates and an allow-listed timeline without people or ids', async () => {
    const { org, user, token } = await createOrgWithUser('MEMBER');
    const incident = await createIncident(org.id, user.id, { isPublic: true });
    const auth = { Authorization: bearer(token) };

    await api().post(`/api/incidents/${incident.id}/updates`).set(auth).send({ message: 'Internal note about root cause', isPublic: false });
    await api().post(`/api/incidents/${incident.id}/updates`).set(auth).send({ message: 'We are aware and investigating', isPublic: true });
    await api().patch(`/api/incidents/${incident.id}/status`).set(auth).send({ status: 'ACKNOWLEDGED' });
    await api().patch(`/api/incidents/${incident.id}`).set(auth).send({ title: 'A quietly edited title' });
    await api().patch(`/api/incidents/${incident.id}/assign`).set(auth).send({ assigneeId: user.id });
    await api().patch(`/api/incidents/${incident.id}/visibility`).set(auth).send({ isPublic: false });
    await api().patch(`/api/incidents/${incident.id}/visibility`).set(auth).send({ isPublic: true });

    const res = await publicGet(`/api/status/incidents/${incident.id}`, org.id);

    expect(res.status).toBe(200);
    expect(res.body.data.updates.map((u) => u.message)).toEqual(['We are aware and investigating']);

    // Public timeline: status change + the public update only.
    expect(res.body.data.timeline.map((e) => e.eventType)).toEqual(['UPDATE_ADDED', 'STATUS_CHANGED']);
    const body = JSON.stringify(res.body);
    expect(body).not.toContain('Internal note');
    expect(body).not.toContain(user.id);
    expect(body).not.toContain('actor');
    expect(body).not.toContain('metadata');
  });
});
