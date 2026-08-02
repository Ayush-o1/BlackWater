import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { api } from '../helpers/request';
import { cleanDatabase, prisma } from '../helpers/db';
import { createOrgWithUser } from '../helpers/factories';

beforeEach(cleanDatabase);
afterAll(() => prisma.$disconnect());

describe('POST /auth/register', () => {
  it('creates an organization and an ADMIN user, returning a usable token', async () => {
    const res = await api().post('/auth/register').send({
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

    const me = await api().get('/auth/me').set('Authorization', `Bearer ${res.body.data.token}`);
    expect(me.status).toBe(200);
    expect(me.body.data.email).toBe('ananya@blackwater.test');
  });

  it('rejects a duplicate email with 409', async () => {
    await api().post('/auth/register').send({
      name: 'Rohit Kumar',
      email: 'rohit@blackwater.test',
      password: 'CorrectHorse!9',
      orgName: 'Org One',
    });

    const res = await api().post('/auth/register').send({
      name: 'Rohit Kumar Again',
      email: 'rohit@blackwater.test',
      password: 'AnotherPass!9',
      orgName: 'Org Two',
    });

    expect(res.status).toBe(409);
    expect(res.body.status).toBe('error');
    expect(res.body.message).toBe('Email already in use');
  });

  it('rejects a payload that fails validation with 400', async () => {
    const res = await api().post('/auth/register').send({
      name: 'A',
      email: 'not-an-email',
      password: 'short',
      orgName: '',
    });

    expect(res.status).toBe(400);
    expect(res.body.status).toBe('error');
    expect(res.body.message).toContain('Validation Error');
  });
});

describe('POST /auth/login', () => {
  it('logs in with correct credentials', async () => {
    const { user, password } = await createOrgWithUser('ADMIN', { email: 'login-ok@blackwater.test' });

    const res = await api().post('/auth/login').send({ email: user.email, password });

    expect(res.status).toBe(200);
    expect(res.body.data.user.id).toBe(user.id);
    expect(typeof res.body.data.token).toBe('string');
  });

  it('rejects an incorrect password with 401 and a generic message', async () => {
    const { user } = await createOrgWithUser('ADMIN', { email: 'login-wrong-pw@blackwater.test' });

    const res = await api().post('/auth/login').send({ email: user.email, password: 'TotallyWrong!1' });

    expect(res.status).toBe(401);
    expect(res.body.message).toBe('Invalid credentials');
  });

  it('rejects an unknown email with the same generic message (no user enumeration)', async () => {
    const res = await api()
      .post('/auth/login')
      .send({ email: 'nobody@blackwater.test', password: 'Whatever!123' });

    expect(res.status).toBe(401);
    expect(res.body.message).toBe('Invalid credentials');
  });
});

describe('GET /auth/me', () => {
  it('returns 401 without a token', async () => {
    const res = await api().get('/auth/me');
    expect(res.status).toBe(401);
  });

  it('returns 401 for a malformed Authorization header', async () => {
    const res = await api().get('/auth/me').set('Authorization', 'NotBearer sometoken');
    expect(res.status).toBe(401);
  });
});
