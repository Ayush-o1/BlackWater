import crypto from 'node:crypto';
import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { api } from '../helpers/request.js';
import { cleanDatabase, prisma } from '../helpers/db.js';
import { addUserToOrg, bearer, createOrgWithUser } from '../helpers/factories.js';

beforeEach(cleanDatabase);
afterAll(() => prisma.$disconnect());

const invite = (token, role = 'MEMBER') =>
  api().post('/api/invitations').set('Authorization', bearer(token)).send({ role });

const accept = (body) => api().post('/api/invitations/accept').send(body);

const newcomer = (token, overrides = {}) => ({
  token,
  name: 'Kavya Reddy',
  email: 'kavya@blackwater.test',
  password: 'CorrectHorse!9',
  ...overrides,
});

describe('creating invitations', () => {
  it('lets an ADMIN create a one-time link and returns the raw token only once', async () => {
    const { token } = await createOrgWithUser('ADMIN');

    const res = await invite(token, 'VIEWER');

    expect(res.status).toBe(201);
    expect(res.body.data.role).toBe('VIEWER');
    expect(typeof res.body.data.token).toBe('string');
    expect(res.body.data.token.length).toBeGreaterThanOrEqual(40);

    // Roughly 7 days.
    const days = (new Date(res.body.data.expiresAt) - Date.now()) / 86_400_000;
    expect(days).toBeGreaterThan(6.9);
    expect(days).toBeLessThanOrEqual(7);

    // Listing never returns tokens.
    const list = await api().get('/api/invitations').set('Authorization', bearer(token));
    expect(list.status).toBe(200);
    expect(list.body.data).toHaveLength(1);
    expect(JSON.stringify(list.body)).not.toContain(res.body.data.token);
    expect(list.body.data[0].token).toBeUndefined();
    expect(list.body.data[0].tokenHash).toBeUndefined();
  });

  it('stores only a hash of the token, never the token itself', async () => {
    const { token } = await createOrgWithUser('ADMIN');

    const res = await invite(token);

    const stored = await prisma.invitation.findFirstOrThrow();
    expect(stored.tokenHash).toBe(crypto.createHash('sha256').update(res.body.data.token).digest('hex'));
    expect(JSON.stringify(stored)).not.toContain(res.body.data.token);
  });

  it('refuses to create an ADMIN invitation, in the API and in the database', async () => {
    const { org, token } = await createOrgWithUser('ADMIN');

    const res = await invite(token, 'ADMIN');
    expect(res.status).toBe(400);

    // Even a direct insert (a careless future code change) is refused by the CHECK constraint.
    await expect(
      prisma.invitation.create({
        data: { orgId: org.id, role: 'ADMIN', tokenHash: 'x', expiresAt: new Date(Date.now() + 1000) },
      })
    ).rejects.toThrow();
  });

  it('is limited to ADMIN: MEMBER and VIEWER get 403, no token gets 401', async () => {
    const { org } = await createOrgWithUser('ADMIN');
    const { token: memberToken } = await addUserToOrg(org.id, 'MEMBER');
    const { token: viewerToken } = await addUserToOrg(org.id, 'VIEWER');

    expect((await invite(memberToken)).status).toBe(403);
    expect((await invite(viewerToken)).status).toBe(403);
    expect((await api().post('/api/invitations').send({ role: 'MEMBER' })).status).toBe(401);
    expect((await api().get('/api/invitations').set('Authorization', bearer(memberToken))).status).toBe(403);
  });
});

describe('accepting invitations', () => {
  it('creates the user in the inviting organization with the invited role, and logs them in', async () => {
    const { org, token } = await createOrgWithUser('ADMIN');
    const created = await invite(token, 'VIEWER');

    const res = await accept(newcomer(created.body.data.token));

    expect(res.status).toBe(201);
    expect(res.body.data.user).toMatchObject({ email: 'kavya@blackwater.test', role: 'VIEWER', orgId: org.id });
    expect(res.body.data.user.passwordHash).toBeUndefined();

    const me = await api().get('/api/auth/me').set('Authorization', bearer(res.body.data.token));
    expect(me.body.data.orgId).toBe(org.id);

    // The invited user chose their own password, and can log in with it.
    const login = await api().post('/api/auth/login').send({ email: 'kavya@blackwater.test', password: 'CorrectHorse!9' });
    expect(login.status).toBe(200);
  });

  it('cannot be used twice', async () => {
    const { token } = await createOrgWithUser('ADMIN');
    const { body } = await invite(token);

    const first = await accept(newcomer(body.data.token));
    const second = await accept(newcomer(body.data.token, { email: 'someone.else@blackwater.test' }));

    expect(first.status).toBe(201);
    expect(second.status).toBe(410);
    expect(await prisma.user.count({ where: { email: 'someone.else@blackwater.test' } })).toBe(0);
  });

  it('lets exactly one of several simultaneous attempts succeed', async () => {
    const { org, token } = await createOrgWithUser('ADMIN');
    const { body } = await invite(token);

    const attempts = await Promise.all(
      [1, 2, 3, 4].map((n) => accept(newcomer(body.data.token, { email: `racer${n}@blackwater.test` })))
    );

    expect(attempts.filter((r) => r.status === 201)).toHaveLength(1);
    expect(attempts.filter((r) => r.status === 410)).toHaveLength(3);
    expect(await prisma.user.count({ where: { orgId: org.id } })).toBe(2); // the admin + one newcomer
  });

  it('is refused after expiry', async () => {
    const { token } = await createOrgWithUser('ADMIN');
    const { body } = await invite(token);
    await prisma.invitation.updateMany({ data: { expiresAt: new Date(Date.now() - 1000) } });

    const res = await accept(newcomer(body.data.token));

    expect(res.status).toBe(410);
    expect(await prisma.user.count({ where: { email: 'kavya@blackwater.test' } })).toBe(0);
  });

  it('answers unknown, expired and used links identically', async () => {
    const { token } = await createOrgWithUser('ADMIN');
    const used = (await invite(token)).body.data.token;
    const expired = (await invite(token)).body.data.token;
    await accept(newcomer(used));
    await prisma.invitation.updateMany({
      where: { usedAt: null },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });

    const responses = await Promise.all(
      [used, expired, crypto.randomBytes(32).toString('base64url')].map((t) =>
        accept(newcomer(t, { email: 'probe@blackwater.test' }))
      )
    );

    expect(new Set(responses.map((r) => r.status))).toEqual(new Set([410]));
    expect(new Set(responses.map((r) => JSON.stringify(r.body)))).toHaveProperty('size', 1);
  });

  it('does not burn the invitation when the email is already taken', async () => {
    const { token } = await createOrgWithUser('ADMIN', { email: 'taken@blackwater.test' });
    const { body } = await invite(token);

    const clash = await accept(newcomer(body.data.token, { email: 'TAKEN@blackwater.test' }));
    expect(clash.status).toBe(409);

    const retry = await accept(newcomer(body.data.token));
    expect(retry.status).toBe(201);
  });

  it('ignores any role or organization the client tries to supply', async () => {
    const { org, token } = await createOrgWithUser('ADMIN');
    const { org: otherOrg } = await createOrgWithUser('ADMIN');
    const { body } = await invite(token, 'VIEWER');

    const res = await accept({ ...newcomer(body.data.token), role: 'ADMIN', orgId: otherOrg.id });

    expect(res.status).toBe(201);
    expect(res.body.data.user.role).toBe('VIEWER');
    expect(res.body.data.user.orgId).toBe(org.id);
  });

  it('validates the new account details', async () => {
    const { token } = await createOrgWithUser('ADMIN');
    const { body } = await invite(token);

    expect((await accept(newcomer(body.data.token, { password: 'short' }))).status).toBe(400);
    expect((await accept(newcomer(body.data.token, { email: 'not-an-email' }))).status).toBe(400);
    expect((await accept(newcomer('short'))).status).toBe(400);
    // None of those consumed the link.
    expect((await accept(newcomer(body.data.token))).status).toBe(201);
  });
});

describe('previewing invitations', () => {
  it('shows only the organization name and role', async () => {
    const { org, token } = await createOrgWithUser('ADMIN');
    const { body } = await invite(token, 'MEMBER');

    const res = await api().post('/api/invitations/preview').send({ token: body.data.token });

    expect(res.status).toBe(200);
    expect(Object.keys(res.body.data).sort()).toEqual(['expiresAt', 'organizationName', 'role']);
    expect(res.body.data.role).toBe('MEMBER');
    expect(res.body.data.organizationName).toBe(org.name);
  });

  it('returns 410 for an invalid link', async () => {
    const res = await api().post('/api/invitations/preview').send({ token: crypto.randomBytes(32).toString('base64url') });
    expect(res.status).toBe(410);
  });
});

describe('managing pending invitations', () => {
  it('lists pending ones, hides used and expired ones, and lets an ADMIN revoke', async () => {
    const { token } = await createOrgWithUser('ADMIN');
    const pending = (await invite(token)).body.data;
    const used = (await invite(token)).body.data;
    await accept(newcomer(used.token));
    const expired = (await invite(token)).body.data;
    await prisma.invitation.update({ where: { id: expired.id }, data: { expiresAt: new Date(Date.now() - 1000) } });

    const list = await api().get('/api/invitations').set('Authorization', bearer(token));
    expect(list.body.data.map((i) => i.id)).toEqual([pending.id]);

    const revoke = await api().delete(`/api/invitations/${pending.id}`).set('Authorization', bearer(token));
    expect(revoke.status).toBe(200);
    expect((await accept(newcomer(pending.token))).status).toBe(410);
  });

  it('never lets one organization see or revoke another\'s invitations', async () => {
    const { token: tokenA } = await createOrgWithUser('ADMIN');
    const { token: tokenB } = await createOrgWithUser('ADMIN');
    const aInvite = (await invite(tokenA)).body.data;

    const list = await api().get('/api/invitations').set('Authorization', bearer(tokenB));
    const revoke = await api().delete(`/api/invitations/${aInvite.id}`).set('Authorization', bearer(tokenB));

    expect(list.body.data).toEqual([]);
    expect(revoke.status).toBe(404);
    expect(await prisma.invitation.count({ where: { id: aInvite.id } })).toBe(1);
  });
});
