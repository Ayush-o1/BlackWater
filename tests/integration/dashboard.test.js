import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { api } from '../helpers/request.js';
import { cleanDatabase, prisma } from '../helpers/db.js';
import { bearer, createOrgWithUser, createService, createIncident } from '../helpers/factories.js';

beforeEach(cleanDatabase);
afterAll(() => prisma.$disconnect());

describe('GET /dashboard', () => {
  it('requires authentication', async () => {
    expect((await api().get('/dashboard')).status).toBe(401);
  });

  it('is all quiet for a new organization', async () => {
    const { token } = await createOrgWithUser('VIEWER');

    const res = await api().get('/dashboard').set('Authorization', bearer(token));

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({
      overallStatus: 'OPERATIONAL',
      serviceCount: 0,
      activeIncidentCount: 0,
      criticalIncidentCount: 0,
      recentActiveIncidents: [],
    });
  });

  it('counts across the whole organization, not just the first page, and counts private incidents', async () => {
    const { org, user, token } = await createOrgWithUser('ADMIN');
    const service = await createService(org.id);
    await prisma.service.createMany({ data: Array.from({ length: 25 }, (_, i) => ({ name: `S${i}`, orgId: org.id })) });
    await createIncident(org.id, user.id, { severity: 'CRITICAL', serviceIds: [service.id], isPublic: false });
    await createIncident(org.id, user.id, { severity: 'LOW' });
    await createIncident(org.id, user.id, { severity: 'CRITICAL', status: 'RESOLVED' });

    const res = await api().get('/dashboard').set('Authorization', bearer(token));

    expect(res.body.data).toMatchObject({
      overallStatus: 'MAJOR_OUTAGE',
      serviceCount: 26,
      activeIncidentCount: 2,
      criticalIncidentCount: 1,
    });
    expect(res.body.data.recentActiveIncidents).toHaveLength(2);
  });

  it('does not include another organization\'s data', async () => {
    const { token } = await createOrgWithUser('ADMIN');
    const { org: otherOrg, user: otherUser } = await createOrgWithUser('ADMIN');
    await createService(otherOrg.id);
    await createIncident(otherOrg.id, otherUser.id, { severity: 'CRITICAL' });

    const res = await api().get('/dashboard').set('Authorization', bearer(token));

    expect(res.body.data).toMatchObject({ overallStatus: 'OPERATIONAL', serviceCount: 0, activeIncidentCount: 0 });
  });
});
