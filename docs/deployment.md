# Deployment

BlackWater is one long-running Node.js process plus a PostgreSQL database. The process serves the API, the web pages and the Socket.IO connections, and keeps each organization's live-update rooms in its own memory. It therefore needs a host that keeps a process running: a container platform (Render, Railway, Fly.io), a VM, or your own server.

## Why not Vercel

The repository was first connected to a Vercel project that was set up for the earlier React frontend. Vercel runs Express as serverless functions, and its documentation describes three properties that clash with this application:

- A WebSocket connection is pinned to the single function instance that accepted it, and new connections may land on a different instance.
- State shared between instances (rooms, presence) has to live in an external store such as Redis. BlackWater's rooms and rate limiter are in process memory, so an incident created through one instance would not reach a browser connected to another.
- Connections are closed when the function reaches its maximum duration.

Supporting that would mean adding Redis and the Socket.IO Redis adapter, a connection pooler for Prisma, and WebSocket-only transport, in return for nothing the application needs. A single always-on process is simpler and behaves the way the code was written. `vercel.json` therefore disables Git-triggered Vercel deployments; delete that file if you want to experiment with Vercel anyway.

## Requirements

- A host that can run a Docker image or Node.js 20.19 or newer as a long-lived process
- PostgreSQL (tested on 16 and 18) reachable from that host
- HTTPS in front of the app (the platform's TLS termination or a reverse proxy)

## Run the container

The `Dockerfile` builds a production image that runs as an unprivileged user, applies pending migrations when it starts, then starts the server. Nothing else is needed.

```bash
docker build -t blackwater .
docker run -p 8000:8000 \
  -e DATABASE_URL="postgresql://USER:PASSWORD@HOST:5432/DBNAME?schema=public" \
  -e JWT_SECRET="$(openssl rand -hex 32)" \
  -e TRUST_PROXY=1 \
  blackwater
```

Then open <http://localhost:8000/register>. Over plain HTTP on `localhost` this was verified in Chromium. The production security policy asks browsers to upgrade every request to HTTPS, and a browser that does so for `localhost` would fail to load the page's files (Safari has been reported to; not tested here). In that case test behind HTTPS or run with `NODE_ENV=development`.

On a container platform the steps are the same, whichever provider you pick:

1. Create a PostgreSQL database and copy its connection string (add `?sslmode=require` if the platform requires TLS to the database).
2. Create a web service from this repository using its `Dockerfile`.
3. Set `DATABASE_URL`, `JWT_SECRET` (32 or more random characters) and `TRUST_PROXY=1`. The platform provides `PORT`.
4. Set the health check path to `/health`.
5. Run only one instance. See Operations below.

## Without Docker

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
| `TRUST_PROXY` | Number of proxies in front of the app, typically `1`. Without it every visitor looks like the proxy and shares one rate-limit bucket, so the login limit (20 per 15 minutes) would apply to all your users together. |
| `AUTH_RATE_LIMIT`, `API_RATE_LIMIT` | Defaults 20 and 1000 per IP per 15 minutes. See the API reference for what each covers. |

## Reverse proxy

- Forward WebSocket upgrades to the app (Socket.IO needs them). For nginx: `proxy_set_header Upgrade $http_upgrade; proxy_set_header Connection "upgrade";`.
- Pass `X-Forwarded-For` and `X-Forwarded-Proto`, and set `TRUST_PROXY`.
- The app sends its own security headers, including HSTS in production.

## Operations

- **Health:** `GET /health` returns 200 with `{ "status": "UP", "database": "UP" }`, or 503 when the database is unreachable. Point load-balancer and uptime checks at it.
- **Logs:** written to standard output. Unexpected errors are logged with their stack and returned to clients only as "Something went wrong!".
- **Shutdown:** on `SIGTERM` or `SIGINT` the server stops accepting connections, lets requests in flight finish and closes the database pool; it exits after 10 seconds regardless.
- **Backups:** back up the PostgreSQL database. The application keeps no other state.
- **Scaling:** the rate limiter and the Socket.IO rooms are in process memory. Run a single instance; running several would need a shared store for both (not implemented). A rolling restart briefly disconnects browsers; they reconnect on their own and refetch what they show.

## First administrator

Open `/register` and create the organization; whoever registers is its administrator. Registration is open to anyone who can reach the server, so if the deployment is private, restrict access at the network or proxy level.
