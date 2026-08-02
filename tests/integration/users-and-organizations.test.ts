import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { api } from '../helpers/request';
import { cleanDatabase, prisma } from '../helpers/db';
import { createOrgWithUser, createUser } from '../helpers/factories';

beforeEach(cleanDatabase);
afterAll(() => prisma.$disconnect());

describe('GET /users', () => {
  it('only lists users scoped to the caller organization', async () => {
    const { org, token } = await createOrgWithUser('ADMIN');
    await createUser(org.id, 'MEMBER', { name: 'Bob Engineer' });
    const { org: otherOrg } = await createOrgWithUser('ADMIN');
    await createUser(otherOrg.id, 'MEMBER', { name: 'Should not appear' });

    const res = await api().get('/users').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    const names = res.body.data.map((u: any) => u.name);
    expect(res.body.data).toHaveLength(2); // the ADMIN caller + the MEMBER just created
    expect(names).toContain('Bob Engineer');
    expect(names).not.toContain('Should not appear');
    expect(res.body.data.every((u: any) => u.passwordHash === undefined)).toBe(true);
  });
});

describe('PATCH /users/me', () => {
  it('updates the caller own display name', async () => {
    const { token } = await createOrgWithUser('MEMBER', { name: 'Old Name' });

    const res = await api().patch('/users/me').set('Authorization', `Bearer ${token}`).send({ name: 'New Name' });

    expect(res.status).toBe(200);
    expect(res.body.data.name).toBe('New Name');
  });

  it('rejects a name shorter than 2 characters', async () => {
    const { token } = await createOrgWithUser('MEMBER');

    const res = await api().patch('/users/me').set('Authorization', `Bearer ${token}`).send({ name: 'A' });

    expect(res.status).toBe(400);
  });
});

describe('GET /organizations/me', () => {
  it('returns the caller organization with a user count', async () => {
    const { org, token } = await createOrgWithUser('ADMIN');
    await createUser(org.id, 'MEMBER');

    const res = await api().get('/organizations/me').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(org.id);
    expect(res.body.data._count.users).toBe(2);
  });
});

describe('PATCH /organizations/me', () => {
  it('allows an ADMIN to rename the organization', async () => {
    const { token } = await createOrgWithUser('ADMIN');

    const res = await api()
      .patch('/organizations/me')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Renamed Org' });

    expect(res.status).toBe(200);
    expect(res.body.data.name).toBe('Renamed Org');
  });

  it('returns 403 for a non-ADMIN', async () => {
    const { token } = await createOrgWithUser('MEMBER');

    const res = await api()
      .patch('/organizations/me')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Renamed Org' });

    expect(res.status).toBe(403);
  });
});
