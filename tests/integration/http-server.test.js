import net from 'node:net';
import express from 'express';
import { describe, it, expect, afterEach } from 'vitest';
import { createHttpServer } from '../../src/httpServer.js';

// A load balancer reuses idle connections to the app for longer than Node's default
// keep-alive timeout (5 seconds). When the app has already closed one, the balancer's
// next request on it fails with "connection reset by peer", an intermittent error
// that no log explains. The app must keep idle connections open longer than any proxy
// in front of it will reuse them.
let server;
afterEach(() => new Promise((resolve) => (server ? server.close(resolve) : resolve())));

async function listen() {
  const app = express();
  app.get('/ping', (req, res) => res.send('pong'));
  server = createHttpServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  return server.address().port;
}

const request = 'GET /ping HTTP/1.1\r\nHost: localhost\r\nConnection: keep-alive\r\n\r\n';

describe('idle connections', () => {
  it('are configured to outlive a proxy\'s idle timeout', async () => {
    await listen();
    expect(server.keepAliveTimeout).toBeGreaterThanOrEqual(65_000);
    // Node needs headersTimeout above keepAliveTimeout, or it cuts the connection first.
    expect(server.headersTimeout).toBeGreaterThan(server.keepAliveTimeout);
  });

  it('stay usable past the old 5 second default', async () => {
    const port = await listen();
    const socket = net.connect(port, '127.0.0.1');
    let received = '';
    let closed = false;
    socket.on('data', (chunk) => { received += chunk.toString(); });
    socket.on('close', () => { closed = true; });
    await new Promise((resolve) => socket.once('connect', resolve));

    socket.write(request);
    await new Promise((resolve) => setTimeout(resolve, 300));
    expect(received).toContain('pong');

    await new Promise((resolve) => setTimeout(resolve, 7_500)); // idle for longer than Node's default (5s, plus the grace newer versions add)
    expect(closed).toBe(false);

    received = '';
    socket.write(request);
    await new Promise((resolve) => setTimeout(resolve, 300));
    expect(received).toContain('pong');
    socket.destroy();
  }, 20_000);
});
