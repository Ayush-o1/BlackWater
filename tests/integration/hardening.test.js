import { execFileSync } from 'node:child_process';
import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { api } from '../helpers/request.js';
import { cleanDatabase, prisma } from '../helpers/db.js';
import { bearer, createOrgWithUser, createService } from '../helpers/factories.js';

beforeEach(cleanDatabase);
afterAll(() => prisma.$disconnect());

describe('organization name', () => {
  it('is trimmed, and a name of only spaces is refused', async () => {
    const { token } = await createOrgWithUser('ADMIN');

    const blank = await api().patch('/api/organizations/me').set('Authorization', bearer(token)).send({ name: '    ' });
    expect(blank.status).toBe(400);

    const padded = await api().patch('/api/organizations/me').set('Authorization', bearer(token)).send({ name: '  Acme Corp  ' });
    expect(padded.status).toBe(200);
    expect(padded.body.data.name).toBe('Acme Corp');
  });
});

describe('PATCH /services/:id', () => {
  it('refuses a request that changes nothing instead of announcing a change that did not happen', async () => {
    const { org, token } = await createOrgWithUser('MEMBER');
    const service = await createService(org.id);

    const res = await api().patch(`/api/services/${service.id}`).set('Authorization', bearer(token)).send({});

    expect(res.status).toBe(400);
  });

  it('answers 404, not 500, when the service is deleted while a second delete is in flight', async () => {
    const { org, token } = await createOrgWithUser('ADMIN');
    const service = await createService(org.id);
    const remove = () => api().delete(`/api/services/${service.id}`).set('Authorization', bearer(token));

    const results = await Promise.all([remove(), remove(), remove()]);
    const statuses = results.map((res) => res.status);

    expect(statuses.filter((status) => status < 300)).toHaveLength(1);
    expect(statuses.every((status) => status < 300 || status === 404)).toBe(true);
  });
});

describe('response caching', () => {
  it('forbids caching of API responses, which carry private data', async () => {
    const { token } = await createOrgWithUser('VIEWER');

    const authenticated = await api().get('/api/auth/me').set('Authorization', bearer(token));
    expect(authenticated.headers['cache-control']).toBe('no-store');

    const unknownRoute = await api().get('/api/nothing-here');
    expect(unknownRoute.headers['cache-control']).toBe('no-store');
  });
});

describe('public status for an organization that does not exist', () => {
  const missingOrg = '11111111-1111-4111-8111-111111111111';

  it.each(['/api/status', '/api/status/services', '/api/status/incidents'])('%s answers 404 like its siblings', async (path) => {
    const res = await api().get(path).query({ orgId: missingOrg });
    expect(res.status).toBe(404);
  });
});

describe('startup configuration', () => {
  // env.js stops the process on bad settings, so it has to be run as a process.
  const runWith = (overrides) =>
    execFileSync(process.execPath, ['--input-type=module', '-e', "await import('./src/config/env.js'); console.log('started')"], {
      env: { ...process.env, ...overrides },
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });

  it('accepts usual token lifetimes', () => {
    expect(runWith({ JWT_EXPIRES_IN: '12h' })).toContain('started');
    expect(runWith({ JWT_EXPIRES_IN: '3600' })).toContain('started');
  });

  it('refuses a token lifetime that would only fail at the first login', () => {
    expect(() => runWith({ JWT_EXPIRES_IN: 'tomorrow-ish' })).toThrow(/JWT_EXPIRES_IN/);
  });
});
