import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { api } from '../helpers/request';
import { cleanDatabase, prisma } from '../helpers/db';
import { createOrgWithUser } from '../helpers/factories';

beforeEach(cleanDatabase);
afterAll(() => prisma.$disconnect());

describe('protected routes without a token', () => {
  it.each([
    ['get', '/incidents'],
    ['post', '/incidents'],
    ['get', '/services'],
    ['post', '/services'],
    ['get', '/auth/me'],
  ])('%s %s returns 401', async (method, path) => {
    const res = await (api() as any)[method](path);
    expect(res.status).toBe(401);
  });
});

describe('VIEWER role', () => {
  it('is refused write access to incidents and services (403)', async () => {
    const { token } = await createOrgWithUser('VIEWER');

    const incidentRes = await api()
      .post('/incidents')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Viewer should not create this', severity: 'LOW' });
    const serviceRes = await api()
      .post('/services')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Viewer should not create this' });

    expect(incidentRes.status).toBe(403);
    expect(serviceRes.status).toBe(403);
  });

  it('retains read access to incidents and services', async () => {
    const { token } = await createOrgWithUser('VIEWER');

    const incidentRes = await api().get('/incidents').set('Authorization', `Bearer ${token}`);
    const serviceRes = await api().get('/services').set('Authorization', `Bearer ${token}`);

    expect(incidentRes.status).toBe(200);
    expect(serviceRes.status).toBe(200);
  });
});

describe('an expired or forged token', () => {
  it('is rejected with 401', async () => {
    const res = await api().get('/incidents').set('Authorization', 'Bearer not-a-real-jwt');
    expect(res.status).toBe(401);
  });

  it('is rejected once the user it names no longer exists', async () => {
    // requireAuth re-fetches the user on every request (see auth.middleware.ts) so a
    // stale token can't outlive the account — but the lookup fails via AuthService's
    // own 404 AppError rather than a 401, since that error isn't a JWT-specific one.
    const { user, token } = await createOrgWithUser('ADMIN');
    await prisma.user.delete({ where: { id: user.id } });

    const res = await api().get('/incidents').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(404);
  });
});
