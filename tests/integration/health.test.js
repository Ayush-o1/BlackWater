import request from 'supertest';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// /health is how a deployment check learns which version is really running, so
// the commit must come from the platform's environment, and never be invented.
let appPrisma;

async function appWith(environment) {
  for (const [key, value] of Object.entries(environment)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  vi.resetModules();
  const { default: app } = await import('../../src/app.js');
  ({ prisma: appPrisma } = await import('../../src/database/prisma.js'));
  return app;
}

beforeEach(() => {
  delete process.env.COMMIT_SHA;
  delete process.env.RENDER_GIT_COMMIT;
});
afterEach(async () => {
  await appPrisma?.$disconnect();
  delete process.env.COMMIT_SHA;
  delete process.env.RENDER_GIT_COMMIT;
});

describe('GET /health', () => {
  it('reports the commit the platform says it is running (Render)', async () => {
    const app = await appWith({ RENDER_GIT_COMMIT: 'abc1234def5678' });
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'UP', database: 'UP', commit: 'abc1234def5678' });
  });

  it('prefers an explicit COMMIT_SHA, for hosts that do not set a Render variable', async () => {
    const app = await appWith({ COMMIT_SHA: 'explicit1', RENDER_GIT_COMMIT: 'render2' });
    expect((await request(app).get('/health')).body.commit).toBe('explicit1');
  });

  it('says null rather than guessing when no commit is known', async () => {
    const app = await appWith({});
    expect((await request(app).get('/health')).body).toEqual({ status: 'UP', database: 'UP', commit: null });
  });
});
