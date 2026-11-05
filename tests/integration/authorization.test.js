import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { api } from '../helpers/request.js';
import { cleanDatabase, prisma } from '../helpers/db.js';
import jwt from 'jsonwebtoken';
import { createOrgWithUser } from '../helpers/factories.js';

beforeEach(cleanDatabase);
afterAll(() => prisma.$disconnect());

describe('protected routes without a token', () => {
  it.each([
    ['get', '/api/incidents'],
    ['post', '/api/incidents'],
    ['get', '/api/services'],
    ['post', '/api/services'],
    ['get', '/api/auth/me'],
  ])('%s %s returns 401', async (method, path) => {
    const res = await api()[method](path);
    expect(res.status).toBe(401);
  });
});

describe('VIEWER role', () => {
  it('is refused write access to incidents and services (403)', async () => {
    const { token } = await createOrgWithUser('VIEWER');

    const incidentRes = await api()
      .post('/api/incidents')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Viewer should not create this', severity: 'LOW' });
    const serviceRes = await api()
      .post('/api/services')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Viewer should not create this' });

    expect(incidentRes.status).toBe(403);
    expect(serviceRes.status).toBe(403);
  });

  it('retains read access to incidents and services', async () => {
    const { token } = await createOrgWithUser('VIEWER');

    const incidentRes = await api().get('/api/incidents').set('Authorization', `Bearer ${token}`);
    const serviceRes = await api().get('/api/services').set('Authorization', `Bearer ${token}`);

    expect(incidentRes.status).toBe(200);
    expect(serviceRes.status).toBe(200);
  });
});

describe('an expired or forged token', () => {
  it('is rejected with a specific message once it has expired', async () => {
    const { user } = await createOrgWithUser('ADMIN');
    const expired = jwt.sign({ userId: user.id, orgId: user.orgId, role: user.role }, process.env.JWT_SECRET, {
      algorithm: 'HS256',
      expiresIn: -10,
    });

    const res = await api().get('/api/incidents').set('Authorization', `Bearer ${expired}`);

    expect(res.status).toBe(401);
    expect(res.body.message).toBe('Unauthorized: Token expired');
  });

  it('is rejected when signed with the wrong key or with the "none" algorithm', async () => {
    const { user } = await createOrgWithUser('ADMIN');
    const payload = { userId: user.id, orgId: user.orgId, role: 'ADMIN' };
    const wrongKey = jwt.sign(payload, 'a-completely-different-secret-of-sufficient-length');
    const unsigned = jwt.sign(payload, '', { algorithm: 'none' });

    for (const token of [wrongKey, unsigned]) {
      const res = await api().get('/api/incidents').set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(401);
    }
  });

  it('is rejected with 401', async () => {
    const res = await api().get('/api/incidents').set('Authorization', 'Bearer not-a-real-jwt');
    expect(res.status).toBe(401);
  });

  it('is rejected once the user it names no longer exists', async () => {
    // requireAuth re-fetches the user on every request, so a stale token cannot
    // outlive the account. It is reported as 401 so a browser knows to sign out.
    const { user, token } = await createOrgWithUser('ADMIN');
    await prisma.user.delete({ where: { id: user.id } });

    const res = await api().get('/api/incidents').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(401);
  });
});
