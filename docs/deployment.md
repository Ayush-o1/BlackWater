# Deployment

BlackWater is one long-running Node.js process plus a PostgreSQL database. Because it holds WebSocket connections it needs a host that runs a persistent process (a VM, a container platform, Render, Railway, Fly.io). Serverless platforms that stop the process between requests will not work.

## Requirements

- Node.js 20.19 or newer
- PostgreSQL
- HTTPS in front of the app (a reverse proxy or the platform's TLS termination)

## Steps

```bash
npm ci --omit=dev
npx prisma migrate deploy      # apply pending migrations
NODE_ENV=production node src/server.js
```

Run `npx prisma migrate deploy` on every release, before starting the new version. It only applies migrations that are missing and never resets data. Do **not** run the seed script; it deletes everything and refuses to run in production.

## Environment

| Variable | Notes |
|---|---|
| `DATABASE_URL` | Required. Use a dedicated database user, with SSL if the database is not on the same private network (`?sslmode=require`). |
| `JWT_SECRET` | Required, at least 32 random characters. Changing it signs everyone out. |
| `NODE_ENV` | Set to `production`. This enables `upgrade-insecure-requests` and hides error details from responses. |
| `PORT` | Default 8000. Many platforms set it for you. |
| `JWT_EXPIRES_IN` | Default `1d`. |
| `TRUST_PROXY` | Number of proxies in front of the app, typically `1`. Without it every visitor looks like the proxy and shares one rate-limit bucket. |
| `AUTH_RATE_LIMIT`, `API_RATE_LIMIT` | Defaults 20 and 300 per IP per 15 minutes. |

## Reverse proxy

- Forward WebSocket upgrades to the app (Socket.IO needs them). For nginx: `proxy_set_header Upgrade $http_upgrade; proxy_set_header Connection "upgrade";`.
- Pass `X-Forwarded-For` and `X-Forwarded-Proto`, and set `TRUST_PROXY`.
- The app sends its own security headers, including HSTS in production.

## Operations

- **Health:** `GET /health` returns 200 with `{ "status": "UP", "database": "UP" }`, or 503 when the database is unreachable. Point load-balancer and uptime checks at it.
- **Logs:** written to standard output. Unexpected errors are logged with their stack and returned to clients only as "Something went wrong!".
- **Shutdown:** on `SIGTERM` or `SIGINT` the server stops accepting connections, lets requests in flight finish and closes the database pool; it exits after 10 seconds regardless.
- **Backups:** back up the PostgreSQL database. The application keeps no other state.
- **Scaling:** the rate limiter and the Socket.IO rooms are in process memory. Run a single instance; running several would need a shared store for both (not implemented).

## First administrator

Open `/register` and create the organization; whoever registers is its administrator. Registration is open to anyone who can reach the server, so if the deployment is private, restrict access at the network or proxy level.
