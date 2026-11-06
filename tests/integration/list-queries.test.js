import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { api } from '../helpers/request.js';
import { cleanDatabase, prisma } from '../helpers/db.js';
import { bearer, createIncident, createOrgWithUser, createService } from '../helpers/factories.js';

beforeEach(cleanDatabase);
afterAll(() => prisma.$disconnect());

const list = (token, query) => api().get('/api/incidents').set('Authorization', bearer(token)).query(query);
const titles = (res) => res.body.data.map((incident) => incident.title);

// Sequential creation gives distinct createdAt values, so "newest first" is deterministic.
async function seed(org, user) {
  const rows = [
    ['Low priority glitch', 'LOW', 'TRIGGERED'],
    ['Checkout is down', 'CRITICAL', 'ACKNOWLEDGED'],
    ['Slow search results', 'MEDIUM', 'TRIGGERED'],
    ['Old payment outage', 'CRITICAL', 'RESOLVED'],
    ['Login errors for some users', 'HIGH', 'TRIGGERED'],
    ['Archived cache issue', 'HIGH', 'CLOSED'],
  ];
  for (const [title, severity, status] of rows) await createIncident(org.id, user.id, { title, severity, status });
}

describe('GET /incidents: search, open filter and priority order', () => {
  it('searches titles, ignoring case', async () => {
    const { org, user, token } = await createOrgWithUser('VIEWER');
    await seed(org, user);
    expect(titles(await list(token, { q: 'CHECKOUT' }))).toEqual(['Checkout is down']);
    expect(titles(await list(token, { q: 'outage' }))).toEqual(['Old payment outage']);
    expect(titles(await list(token, { q: 'nothing like this' }))).toEqual([]);
  });

  it('treats search text literally (% and _ are not wildcards)', async () => {
    const { org, user, token } = await createOrgWithUser('VIEWER');
    await seed(org, user);
    expect(titles(await list(token, { q: '%' }))).toEqual([]);
    expect(titles(await list(token, { q: '_' }))).toEqual([]);

    // ...and they still find titles that really contain them.
    await createIncident(org.id, user.id, { title: 'CPU at 100% on worker_3' });
    expect(titles(await list(token, { q: '100%' }))).toEqual(['CPU at 100% on worker_3']);
    expect(titles(await list(token, { q: 'worker_3' }))).toEqual(['CPU at 100% on worker_3']);
  });

  it('"open" means triggered or acknowledged', async () => {
    const { org, user, token } = await createOrgWithUser('VIEWER');
    await seed(org, user);
    const res = await list(token, { open: 'true' });
    expect(res.body.data.every((incident) => ['TRIGGERED', 'ACKNOWLEDGED'].includes(incident.status))).toBe(true);
    expect(res.body.data).toHaveLength(4);
  });

  it('sorts by priority: worst severity first, newest first within a severity', async () => {
    const { org, user, token } = await createOrgWithUser('VIEWER');
    await seed(org, user);
    expect(titles(await list(token, { open: 'true', sort: 'priority' }))).toEqual([
      'Checkout is down',
      'Login errors for some users',
      'Slow search results',
      'Low priority glitch',
    ]);
  });

  it('pages through the priority order without skipping or repeating', async () => {
    const { org, user, token } = await createOrgWithUser('VIEWER');
    await seed(org, user);
    const seen = [];
    let cursor;
    do {
      const res = await list(token, { sort: 'priority', limit: 2, ...(cursor && { cursor }) });
      seen.push(...titles(res));
      cursor = res.body.pagination.hasMore ? res.body.pagination.nextCursor : null;
    } while (cursor);
    expect(seen).toEqual(titles(await list(token, { sort: 'priority', limit: 100 })));
    expect(new Set(seen).size).toBe(6);
  });

  it('rejects an unknown sort and an over-long search', async () => {
    const { token } = await createOrgWithUser('VIEWER');
    expect((await list(token, { sort: 'random' })).status).toBe(400);
    expect((await list(token, { q: 'x'.repeat(201) })).status).toBe(400);
  });

  it('never searches another organization', async () => {
    const mine = await createOrgWithUser('VIEWER');
    const theirs = await createOrgWithUser('ADMIN');
    await createIncident(theirs.org.id, theirs.user.id, { title: 'Their secret checkout problem' });
    expect(titles(await list(mine.token, { q: 'checkout' }))).toEqual([]);
  });
});

describe('GET /services: open incident count', () => {
  it('counts each service\'s open incidents, ignoring resolved and closed ones', async () => {
    const { org, user, token } = await createOrgWithUser('VIEWER');
    const busy = await createService(org.id, { name: 'Busy' });
    const quiet = await createService(org.id, { name: 'Quiet' });
    await createIncident(org.id, user.id, { serviceIds: [busy.id], status: 'TRIGGERED' });
    await createIncident(org.id, user.id, { serviceIds: [busy.id], status: 'ACKNOWLEDGED' });
    await createIncident(org.id, user.id, { serviceIds: [busy.id, quiet.id], status: 'RESOLVED' });

    const res = await api().get('/api/services').set('Authorization', bearer(token));
    const byName = Object.fromEntries(res.body.data.map((service) => [service.name, service.openIncidentCount]));
    expect(byName).toEqual({ Busy: 2, Quiet: 0 });
  });
});
