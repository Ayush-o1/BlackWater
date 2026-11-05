import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { api } from '../helpers/request.js';
import { cleanDatabase, prisma } from '../helpers/db.js';
import { bearer, createOrgWithUser } from '../helpers/factories.js';

beforeEach(cleanDatabase);
afterAll(() => prisma.$disconnect());

// Follows nextCursor until the list ends and returns every id seen, in order.
async function readAllPages(path, token, limit, query = {}) {
  const ids = [];
  let cursor;
  let pages = 0;

  do {
    const res = await api()
      .get(path)
      .query({ limit, ...(cursor && { cursor }), ...query })
      .set('Authorization', bearer(token));
    expect(res.status).toBe(200);
    ids.push(...res.body.data.map((row) => row.id));
    cursor = res.body.pagination.nextCursor;
    pages += 1;
  } while (cursor && pages < 50);

  return ids;
}

describe('cursor pagination', () => {
  it('walks a list page by page without skipping or repeating rows that share a timestamp', async () => {
    const { org, user, token } = await createOrgWithUser('ADMIN');
    // Identical createdAt on every row: ordering by createdAt alone would be ambiguous.
    const sameInstant = new Date('2026-03-01T10:00:00.000Z');
    await prisma.incident.createMany({
      data: Array.from({ length: 7 }, (_, i) => ({
        title: `Incident number ${i}`,
        severity: 'LOW',
        orgId: org.id,
        creatorId: user.id,
        createdAt: sameInstant,
      })),
    });

    const everything = await api().get('/api/incidents').query({ limit: 100 }).set('Authorization', bearer(token));
    const expected = everything.body.data.map((row) => row.id);

    const paged = await readAllPages('/api/incidents', token, 2);

    expect(expected).toHaveLength(7);
    expect(paged).toEqual(expected);
    expect(new Set(paged).size).toBe(7);
  });

  it('reports hasMore and nextCursor correctly on the last page', async () => {
    const { org, token } = await createOrgWithUser('ADMIN');
    await prisma.service.createMany({
      data: Array.from({ length: 3 }, (_, i) => ({ name: `Service ${i}`, orgId: org.id })),
    });

    const first = await api().get('/api/services').query({ limit: 2 }).set('Authorization', bearer(token));
    expect(first.body.pagination.hasMore).toBe(true);
    expect(first.body.pagination.nextCursor).toBe(first.body.data[1].id);

    const second = await api()
      .get('/api/services')
      .query({ limit: 2, cursor: first.body.pagination.nextCursor })
      .set('Authorization', bearer(token));
    expect(second.body.data).toHaveLength(1);
    expect(second.body.pagination).toEqual({ hasMore: false, nextCursor: null });
  });

  it('pages services and users too', async () => {
    const { org, token } = await createOrgWithUser('ADMIN');
    await prisma.service.createMany({
      data: Array.from({ length: 5 }, (_, i) => ({ name: `Service ${i}`, orgId: org.id })),
    });

    expect(await readAllPages('/api/services', token, 2)).toHaveLength(5);
    expect(await readAllPages('/api/users', token, 1)).toHaveLength(1);
  });

  it('rejects limits outside 1 to 100', async () => {
    const { token } = await createOrgWithUser('ADMIN');
    for (const limit of ['0', '101', '-1', '2.5']) {
      const res = await api().get('/api/services').query({ limit }).set('Authorization', bearer(token));
      expect(res.status).toBe(400);
    }
  });
});
