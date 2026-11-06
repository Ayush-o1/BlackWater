import http from 'node:http';

// Creates the HTTP server with timeouts suited to running behind a load balancer.
//
// Node closes a connection that has sat idle for 5 seconds (keepAliveTimeout). Load
// balancers, Render's included, keep connections to the app open and reuse them for
// longer than that. When one reuses a connection the app has just closed, the request
// fails with "connection reset by peer": rare, intermittent, and invisible in the app's
// own logs. Render's troubleshooting guide names this exact symptom and the fix. The
// app must hold idle connections open longer than the proxy will reuse them, and
// headersTimeout must stay above keepAliveTimeout or Node cuts the connection first.
const KEEP_ALIVE_MS = 120_000;

export function createHttpServer(app) {
  const server = http.createServer(app);
  server.keepAliveTimeout = KEEP_ALIVE_MS;
  server.headersTimeout = KEEP_ALIVE_MS + 1_000;
  return server;
}
