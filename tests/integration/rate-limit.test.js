import express from 'express';
import request from 'supertest';
import { describe, it, expect } from 'vitest';
import { createRateLimiter } from '../../src/middleware/rateLimit.middleware.js';

describe('rate limiter', () => {
  it('answers with 429 and the standard error shape once the limit is exceeded', async () => {
    const app = express();
    app.use(createRateLimiter({ limit: 3 }));
    app.get('/ping', (req, res) => res.json({ ok: true }));

    const statuses = [];
    for (let i = 0; i < 5; i += 1) {
      statuses.push((await request(app).get('/ping')).status);
    }
    const blocked = await request(app).get('/ping');

    expect(statuses).toEqual([200, 200, 200, 429, 429]);
    expect(blocked.body).toEqual({ success: false, message: 'Too many requests, please try again later' });
  });
});
