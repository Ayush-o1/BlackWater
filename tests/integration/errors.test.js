import { describe, it, expect, afterAll } from 'vitest';
import { api } from '../helpers/request.js';
import { prisma } from '../helpers/db.js';

afterAll(() => prisma.$disconnect());

describe('error responses', () => {
  it('answers a malformed JSON body with 400, not 500', async () => {
    const res = await api()
      .post('/api/auth/login')
      .set('Content-Type', 'application/json')
      .send('{"email": "broken"');

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ success: false, message: 'Request body is not valid JSON' });
  });

  it('answers an unknown API route with the same error shape', async () => {
    const res = await api().get('/api/nope');

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toContain('/api/nope');
  });

  it('answers validation failures with the same error shape', async () => {
    const res = await api().post('/api/auth/login').send({});

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toContain('Validation Error');
  });

  it('does not leak internals in a 401', async () => {
    const res = await api().get('/api/incidents').set('Authorization', 'Bearer nonsense');

    expect(res.status).toBe(401);
    expect(Object.keys(res.body).sort()).toEqual(['message', 'success']);
  });
});
