import request from 'supertest';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { cleanDatabase } from '../helpers/db.js';
import { bearer, createOrgWithUser } from '../helpers/factories.js';

// The route wiring of the strict limiter, with a limit small enough to reach.
// (The rest of the suite raises the limits so it can send thousands of requests,
// which is exactly how a limiter attached to the wrong route goes unnoticed.)
const LIMIT = 3;
let app;
let appPrisma;

beforeEach(async () => {
  await cleanDatabase();
  process.env.AUTH_RATE_LIMIT = String(LIMIT);
  vi.resetModules(); // a fresh app means a fresh, empty rate-limit counter
  ({ default: app } = await import('../../src/app.js'));
  ({ prisma: appPrisma } = await import('../../src/database/prisma.js'));
});

afterEach(async () => {
  process.env.AUTH_RATE_LIMIT = '100000';
  await appPrisma.$disconnect();
});

describe('strict limit on credential endpoints', () => {
  it('does not apply to GET /auth/me, which every signed-in page load calls', async () => {
    const { token } = await createOrgWithUser('MEMBER');

    const statuses = [];
    for (let i = 0; i < LIMIT * 4; i += 1) {
      statuses.push((await request(app).get('/api/auth/me').set('Authorization', bearer(token))).status);
    }

    expect(statuses.every((status) => status === 200)).toBe(true);
  });

  it('blocks repeated failed logins from one address', async () => {
    const { user } = await createOrgWithUser('MEMBER');
    const attempt = () => request(app).post('/api/auth/login').send({ email: user.email, password: 'wrong-password' });

    const statuses = [];
    for (let i = 0; i < LIMIT + 2; i += 1) statuses.push((await attempt()).status);

    expect(statuses).toEqual([401, 401, 401, 429, 429]);
  });

  it('does not count successful logins, so a shared office address is not locked out by its own staff', async () => {
    const { user, password } = await createOrgWithUser('MEMBER');

    for (let i = 0; i < LIMIT * 2; i += 1) {
      const res = await request(app).post('/api/auth/login').send({ email: user.email, password });
      expect(res.status).toBe(200);
    }

    // The budget for failures is untouched.
    const failure = await request(app).post('/api/auth/login').send({ email: user.email, password: 'wrong-password' });
    expect(failure.status).toBe(401);
  });

  it('counts every registration, successful or not', async () => {
    const register = (n) =>
      request(app).post('/api/auth/register').send({ name: 'Test Person', email: `person-${n}@blackwater.test`, password: 'CorrectHorse!9', orgName: `Org ${n}` });

    const statuses = [];
    for (let n = 0; n < LIMIT + 1; n += 1) statuses.push((await register(n)).status);

    expect(statuses).toEqual([201, 201, 201, 429]);
  });

  it('limits password guessing through organization deletion as well', async () => {
    const { org, token } = await createOrgWithUser('ADMIN');
    const guess = () => request(app).delete('/api/organizations/me').set('Authorization', bearer(token)).send({ password: 'wrong-password', confirmName: org.name });

    const statuses = [];
    for (let i = 0; i < LIMIT + 1; i += 1) statuses.push((await guess()).status);

    expect(statuses).toEqual([403, 403, 403, 429]);
  });
});

