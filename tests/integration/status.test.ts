import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { api } from '../helpers/request';
import { cleanDatabase, prisma } from '../helpers/db';
import { createOrgWithUser, createService, createIncident } from '../helpers/factories';

beforeEach(cleanDatabase);
afterAll(() => prisma.$disconnect());

describe('GET /status (public overview)', () => {
  it('requires no authentication and rolls up overall health', async () => {
    const { org } = await createOrgWithUser('ADMIN');
    await createService(org.id, { status: 'DEGRADED' });

    const res = await api().get('/status').query({ orgId: org.id });

    expect(res.status).toBe(200);
    expect(res.body.data.overallStatus).toBe('DEGRADED');
  });

  it('never exposes internal incident fields', async () => {
    const { org, user } = await createOrgWithUser('ADMIN');
    const service = await createService(org.id);
    const incident = await createIncident(org.id, user.id, { serviceIds: [service.id] });

    const res = await api().get('/status').query({ orgId: org.id });

    expect(res.status).toBe(200);
    const [publicIncident] = res.body.data.activeIncidents;
    expect(publicIncident.id).toBe(incident.id);
    expect(publicIncident.description).toBeUndefined();
    expect(publicIncident.creatorId).toBeUndefined();
    expect(publicIncident.assigneeId).toBeUndefined();
  });

  it('returns 404 for an unknown organization', async () => {
    const res = await api().get('/status').query({ orgId: '00000000-0000-0000-0000-000000000000' });
    expect(res.status).toBe(404);
  });
});

describe('GET /status/incidents/:id (public incident detail)', () => {
  it('includes only public updates and strips timeline metadata', async () => {
    const { org, user, token } = await createOrgWithUser('MEMBER');
    const incident = await createIncident(org.id, user.id);

    await api()
      .post(`/incidents/${incident.id}/updates`)
      .set('Authorization', `Bearer ${token}`)
      .send({ message: 'Internal note about root cause', isPublic: false });
    await api()
      .post(`/incidents/${incident.id}/updates`)
      .set('Authorization', `Bearer ${token}`)
      .send({ message: 'We are aware and investigating', isPublic: true });

    const res = await api().get(`/status/incidents/${incident.id}`).query({ orgId: org.id });

    expect(res.status).toBe(200);
    expect(res.body.data.updates).toHaveLength(1);
    expect(res.body.data.updates[0].message).toBe('We are aware and investigating');
    expect(res.body.data.timeline.every((event: any) => event.metadata === undefined)).toBe(true);
  });
});
