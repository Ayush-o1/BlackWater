import bcrypt from 'bcrypt';
import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { api } from '../helpers/request.js';
import { cleanDatabase, prisma } from '../helpers/db.js';
import { bearer, createOrgWithUser, addUserToOrg, createService } from '../helpers/factories.js';

beforeEach(cleanDatabase);
afterAll(() => prisma.$disconnect());

// Attack-shaped checks: each sends what an attacker would send and looks at what
// the system actually did, rather than at how the code is written.

describe('passwords', () => {
  it('are stored only as bcrypt hashes, never in a form that contains the password', async () => {
    const password = 'CorrectHorse!9-unique-marker';
    const res = await api().post('/api/auth/register').send({ name: 'Test Person', email: 'hash.check@blackwater.test', password, orgName: 'Hash Org' });
    expect(res.status).toBe(201);

    const stored = await prisma.user.findUniqueOrThrow({ where: { email: 'hash.check@blackwater.test' } });
    expect(stored.passwordHash).toMatch(/^\$2[aby]\$10\$/);
    expect(stored.passwordHash).not.toContain(password);
    expect(await bcrypt.compare(password, stored.passwordHash)).toBe(true);
  });
});

describe('cross-origin access (CORS)', () => {
  it('is never granted: no response invites another website to read it', async () => {
    const { token } = await createOrgWithUser('ADMIN');
    const evil = 'https://evil.example';

    const preflight = await api()
      .options('/api/incidents')
      .set('Origin', evil)
      .set('Access-Control-Request-Method', 'GET')
      .set('Access-Control-Request-Headers', 'authorization');
    expect(preflight.headers['access-control-allow-origin']).toBeUndefined();

    const read = await api().get('/api/auth/me').set('Origin', evil).set('Authorization', bearer(token));
    expect(read.status).toBe(200); // the server answers (it cannot tell who is asking)...
    expect(read.headers['access-control-allow-origin']).toBeUndefined(); // ...but the browser will not hand it to the other site
  });
});

describe('SQL injection', () => {
  const payload = `'; DROP TABLE "Incident"; --`;

  it('stores hostile text as plain text and keeps every table', async () => {
    const { token } = await createOrgWithUser('MEMBER');

    const created = await api().post('/api/incidents').set('Authorization', bearer(token)).send({ title: payload, description: payload, severity: 'LOW' });
    expect(created.status).toBe(201);

    const listed = await api().get('/api/incidents').set('Authorization', bearer(token));
    expect(listed.status).toBe(200);
    expect(listed.body.data[0].title).toBe(payload);
  });

  it('rejects hostile values in ids, filters and pagination before they reach a query', async () => {
    const { token } = await createOrgWithUser('MEMBER');
    const get = (path) => api().get(path).set('Authorization', bearer(token));

    expect((await get(`/api/incidents/${encodeURIComponent("1' OR '1'='1")}`)).status).toBe(400);
    expect((await get(`/api/incidents?status=${encodeURIComponent("TRIGGERED' OR 1=1 --")}`)).status).toBe(400);
    expect((await get(`/api/incidents?serviceId=${encodeURIComponent('x" OR "1"="1')}`)).status).toBe(400);
    expect((await get(`/api/incidents?limit=${encodeURIComponent('1; DROP TABLE "User"')}`)).status).toBe(400);
    expect((await get(`/api/incidents?cursor=${encodeURIComponent("' OR 1=1 --")}`)).status).toBe(400);
  });

  it('does not let a password or an email bypass the login check', async () => {
    const { user } = await createOrgWithUser('MEMBER');

    const guessPassword = await api().post('/api/auth/login').send({ email: user.email, password: "' OR '1'='1" });
    expect(guessPassword.status).toBe(401);

    const injectedEmail = await api().post('/api/auth/login').send({ email: "admin@x.com' OR '1'='1", password: 'whatever1' });
    expect(injectedEmail.status).toBe(400);
  });
});

describe('mass assignment', () => {
  it('registration ignores a role or organization supplied by the client', async () => {
    const { org } = await createOrgWithUser('ADMIN');

    const res = await api().post('/api/auth/register').send({
      name: 'Sneaky Person',
      email: 'sneaky@blackwater.test',
      password: 'CorrectHorse!9',
      orgName: 'My Own Org',
      orgId: org.id,
      role: 'VIEWER',
    });

    expect(res.status).toBe(201);
    expect(res.body.data.user.orgId).not.toBe(org.id);
    expect(res.body.data.user.role).toBe('ADMIN'); // admin of their own, brand-new organization
    expect(await prisma.user.count({ where: { orgId: org.id } })).toBe(1);
  });

  it('a profile edit cannot change role, organization or email', async () => {
    const { org } = await createOrgWithUser('ADMIN');
    const { user, token } = await addUserToOrg(org.id, 'VIEWER');
    const other = await createOrgWithUser('ADMIN');

    const res = await api()
      .patch('/api/users/me')
      .set('Authorization', bearer(token))
      .send({ name: 'Renamed Person', role: 'ADMIN', orgId: other.org.id, email: 'taken.over@blackwater.test' });

    expect(res.status).toBe(200);
    const after = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(after).toMatchObject({ name: 'Renamed Person', role: 'VIEWER', orgId: org.id, email: user.email });
  });

  it('an incident edit cannot move the incident to another organization or change its visibility', async () => {
    const { org, token } = await createOrgWithUser('MEMBER');
    const other = await createOrgWithUser('ADMIN');
    const created = await api().post('/api/incidents').set('Authorization', bearer(token)).send({ title: 'Edit me carefully', severity: 'LOW' });

    await api()
      .patch(`/api/incidents/${created.body.data.id}`)
      .set('Authorization', bearer(token))
      .send({ title: 'Edited title here', orgId: other.org.id, isPublic: true, status: 'CLOSED' });

    const after = await prisma.incident.findUniqueOrThrow({ where: { id: created.body.data.id } });
    expect(after).toMatchObject({ title: 'Edited title here', orgId: org.id, isPublic: false, status: 'TRIGGERED' });
  });

  it('a service cannot be created inside or moved to another organization', async () => {
    const { org, token } = await createOrgWithUser('MEMBER');
    const other = await createOrgWithUser('ADMIN');

    const res = await api().post('/api/services').set('Authorization', bearer(token)).send({ name: 'Mine really', orgId: other.org.id });
    expect(res.status).toBe(201);
    expect((await prisma.service.findUniqueOrThrow({ where: { id: res.body.data.id } })).orgId).toBe(org.id);

    const theirs = await createService(other.org.id);
    const attempt = await api().patch(`/api/services/${theirs.id}`).set('Authorization', bearer(token)).send({ name: 'Hijacked name' });
    expect(attempt.status).toBe(404);
  });
});
