import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect, afterAll, vi } from 'vitest';
import { api } from '../helpers/request.js';
import { prisma } from '../helpers/db.js';
import { pages, publicDir } from '../../src/pages.js';

afterAll(() => prisma.$disconnect());

describe('web pages', () => {
  it.each(pages.map(([url, file]) => [url, file]))('serves %s from %s', async (url, file) => {
    expect(fs.existsSync(path.join(publicDir, file))).toBe(true);

    const res = await api().get(url.replace(':id', 'x').replace(':orgId', 'y'));

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/html');
    expect(res.text).toContain('<div id="app">');
  });

  it('serves the stylesheets and scripts the pages load', async () => {
    expect((await api().get('/css/base.css')).headers['content-type']).toContain('text/css');
    expect((await api().get('/js/api.js')).headers['content-type']).toContain('javascript');
  });

  it('answers an unknown page with the not-found page and status 404', async () => {
    const res = await api().get('/definitely/not/a/page');

    expect(res.status).toBe(404);
    expect(res.headers['content-type']).toContain('text/html');
  });

  it('does not expose files outside the public folder', async () => {
    for (const attempt of ['/../package.json', '/..%2fpackage.json', '/%2e%2e/.env', '/js/../../.env']) {
      const res = await api().get(attempt);
      expect(res.text).not.toContain('"dependencies"');
      expect(res.text).not.toContain('JWT_SECRET');
    }
  });

  it('keeps the API reachable alongside the pages', async () => {
    const res = await api().get('/api/status');
    expect(res.status).toBe(400); // missing orgId: the API answered, not the page router
    expect(res.headers['content-type']).toContain('application/json');
  });
});

describe('security headers', () => {
  it('sends a Content-Security-Policy that blocks inline scripts and foreign origins', async () => {
    const res = await api().get('/login');
    const csp = res.headers['content-security-policy'];

    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("script-src 'self'");
    expect(csp).toContain("script-src-attr 'none'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toMatch(/style-src 'self'(;|$)/); // no inline styles either
    expect(csp).not.toMatch(/script-src[^;]*unsafe-inline/);
    expect(csp).not.toMatch(/script-src[^;]*unsafe-eval/);
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-frame-options']).toBeDefined();
  });

  it('has no inline scripts or event-handler attributes in any page', () => {
    for (const file of fs.readdirSync(publicDir).filter((name) => name.endsWith('.html'))) {
      const html = fs.readFileSync(path.join(publicDir, file), 'utf8');
      const inlineScripts = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>/g)];
      expect(inlineScripts, `${file} has an inline script`).toHaveLength(0);
      expect(html, `${file} has an inline handler`).not.toMatch(/\son[a-z]+\s*=/i);
    }
  });
});

describe('health check', () => {
  it('reports the server and the database', async () => {
    const res = await api().get('/health');

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: 'UP', database: 'UP' }); // the commit field is covered in health.test.js
  });

  it('answers 503 when the database cannot be reached', async () => {
    const spy = vi.spyOn(prisma, '$queryRaw').mockRejectedValueOnce(new Error('connection refused'));

    const res = await api().get('/health');

    expect(res.status).toBe(503);
    expect(res.body).toMatchObject({ status: 'DOWN', database: 'DOWN' });
    spy.mockRestore();
  });
});
