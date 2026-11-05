import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { api } from '../helpers/request.js';
import { cleanDatabase, prisma } from '../helpers/db.js';
import { createOrgWithUser, bearer } from '../helpers/factories.js';

beforeEach(cleanDatabase);
afterAll(() => prisma.$disconnect());

describe('POST /auth/register', () => {
  it('creates an organization and an ADMIN user, returning a usable token', async () => {
    const res = await api().post('/api/auth/register').send({
      name: 'Ananya Gupta',
      email: 'ananya@blackwater.test',
      password: 'CorrectHorse!9',
      orgName: 'Fenwick Retail',
    });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.user.email).toBe('ananya@blackwater.test');
    expect(res.body.data.user.role).toBe('ADMIN');
    expect(res.body.data.user.passwordHash).toBeUndefined();
    expect(typeof res.body.data.token).toBe('string');

    const me = await api().get('/api/auth/me').set('Authorization', bearer(res.body.data.token));
    expect(me.status).toBe(200);
    expect(me.body.data.email).toBe('ananya@blackwater.test');
  });

  it('rejects a duplicate email with 409', async () => {
    await api().post('/api/auth/register').send({
      name: 'Rohit Kumar',
      email: 'rohit@blackwater.test',
      password: 'CorrectHorse!9',
      orgName: 'Org One',
    });

    const res = await api().post('/api/auth/register').send({
      name: 'Rohit Kumar Again',
      email: 'rohit@blackwater.test',
      password: 'AnotherPass!9',
      orgName: 'Org Two',
    });

    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toBe('Email already in use');
  });

  it('rejects a payload that fails validation with 400', async () => {
    const res = await api().post('/api/auth/register').send({
      name: 'A',
      email: 'not-an-email',
      password: 'short',
      orgName: '',
    });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toContain('Validation Error');
  });

  it('treats emails as case-insensitive and stores them lowercase', async () => {
    const first = await api().post('/api/auth/register').send({
      name: 'Meera Iyer',
      email: '  Meera.Iyer@BlackWater.test ',
      password: 'CorrectHorse!9',
      orgName: 'Case Test One',
    });
    expect(first.status).toBe(201);
    expect(first.body.data.user.email).toBe('meera.iyer@blackwater.test');

    const duplicate = await api().post('/api/auth/register').send({
      name: 'Meera Again',
      email: 'MEERA.IYER@blackwater.test',
      password: 'CorrectHorse!9',
      orgName: 'Case Test Two',
    });
    expect(duplicate.status).toBe(409);

    // Logging in works with any casing of the same address.
    const login = await api()
      .post('/api/auth/login')
      .send({ email: 'Meera.Iyer@BLACKWATER.test', password: 'CorrectHorse!9' });
    expect(login.status).toBe(200);
  });

  it('lets exactly one of two simultaneous registrations with the same email win', async () => {
    const attempt = (orgName) =>
      api().post('/api/auth/register').send({
        name: 'Race Runner',
        email: 'race@blackwater.test',
        password: 'CorrectHorse!9',
        orgName,
      });

    const results = await Promise.all([attempt('Race Org A'), attempt('Race Org B')]);

    expect(results.map((r) => r.status).sort()).toEqual([201, 409]);
    // The loser's organization must have been rolled back with its failed user.
    expect(await prisma.user.count({ where: { email: 'race@blackwater.test' } })).toBe(1);
    expect(await prisma.organization.count()).toBe(1);
  });
});

describe('POST /auth/login', () => {
  it('logs in with correct credentials', async () => {
    const { user, password } = await createOrgWithUser('ADMIN', { email: 'login-ok@blackwater.test' });

    const res = await api().post('/api/auth/login').send({ email: user.email, password });

    expect(res.status).toBe(200);
    expect(res.body.data.user.id).toBe(user.id);
    expect(typeof res.body.data.token).toBe('string');
  });

  it('rejects an incorrect password with 401 and a generic message', async () => {
    const { user } = await createOrgWithUser('ADMIN', { email: 'login-wrong-pw@blackwater.test' });

    const res = await api().post('/api/auth/login').send({ email: user.email, password: 'TotallyWrong!1' });

    expect(res.status).toBe(401);
    expect(res.body.message).toBe('Invalid credentials');
  });

  it('rejects an unknown email with the same generic message (no user enumeration)', async () => {
    const res = await api()
      .post('/api/auth/login')
      .send({ email: 'nobody@blackwater.test', password: 'Whatever!123' });

    expect(res.status).toBe(401);
    expect(res.body.message).toBe('Invalid credentials');
  });
});

describe('GET /auth/me', () => {
  it('returns 401 without a token', async () => {
    const res = await api().get('/api/auth/me');
    expect(res.status).toBe(401);
  });

  it('returns 401 for a malformed Authorization header', async () => {
    const res = await api().get('/api/auth/me').set('Authorization', 'NotBearer sometoken');
    expect(res.status).toBe(401);
  });
});
