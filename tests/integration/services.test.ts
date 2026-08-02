import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { api } from '../helpers/request';
import { cleanDatabase, prisma } from '../helpers/db';
import { createOrgWithUser, createService } from '../helpers/factories';

beforeEach(cleanDatabase);
afterAll(() => prisma.$disconnect());

describe('POST /services', () => {
  it('lets a MEMBER create a service, always starting OPERATIONAL', async () => {
    const { token } = await createOrgWithUser('MEMBER');

    const res = await api()
      .post('/services')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Payments API', description: 'Handles checkout charges' });

    expect(res.status).toBe(201);
    expect(res.body.data.status).toBe('OPERATIONAL');
  });

  it('returns 403 for a VIEWER', async () => {
    const { token } = await createOrgWithUser('VIEWER');

    const res = await api()
      .post('/services')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Payments API' });

    expect(res.status).toBe(403);
  });
});

describe('GET /services', () => {
  it('only lists services scoped to the caller organization', async () => {
    const { org, token } = await createOrgWithUser('VIEWER');
    const { org: otherOrg } = await createOrgWithUser('VIEWER');
    await createService(org.id, { name: 'Mine' });
    await createService(otherOrg.id, { name: 'Not mine' });

    const res = await api().get('/services').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].name).toBe('Mine');
  });
});

describe('DELETE /services/:id', () => {
  it('allows ADMIN to delete', async () => {
    const { org, token } = await createOrgWithUser('ADMIN');
    const service = await createService(org.id);

    const res = await api().delete(`/services/${service.id}`).set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    await expect(prisma.service.findUnique({ where: { id: service.id } })).resolves.toBeNull();
  });

  it('returns 403 for a MEMBER', async () => {
    const { org, token } = await createOrgWithUser('MEMBER');
    const service = await createService(org.id);

    const res = await api().delete(`/services/${service.id}`).set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
    await expect(prisma.service.findUnique({ where: { id: service.id } })).resolves.not.toBeNull();
  });

  it('returns 404 for a service belonging to another organization', async () => {
    const { token } = await createOrgWithUser('ADMIN');
    const { org: otherOrg } = await createOrgWithUser('ADMIN');
    const foreignService = await createService(otherOrg.id);

    const res = await api().delete(`/services/${foreignService.id}`).set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
  });
});
