# Deployment

BlackWater is one long-running Node.js process plus a PostgreSQL database. The process serves the API, the web pages and the Socket.IO connections, and keeps each organization's live-update rooms and the rate-limit counters in its own memory. It therefore needs a host that keeps a process running and allows WebSocket connections: a container platform such as Render, Railway or Fly.io, a VM, or your own server. Run exactly one instance.

## Recommended: Render

The repository includes a [`render.yaml`](../render.yaml) Blueprint that creates the web service (from the `Dockerfile`) and its PostgreSQL database, connects them, generates the JWT secret and sets the health check. No secret is typed anywhere.

1. In the Render dashboard choose **New > Blueprint** and select this repository.
2. Add a payment method when asked. The Blueprint uses paid plans on purpose (see below).
3. Apply. The first deploy builds the image, applies the migrations and starts the server. Every later push to the connected branch deploys automatically.
4. Open `https://<service-name>.onrender.com/register` and create the first organization; its creator is the administrator.

What Render provides that this application needs, from Render's documentation: inbound WebSocket connections on web services, HTTPS on `onrender.com` and custom domains, a configurable health check, `SIGTERM` before a service stops (the server shuts down gracefully on it), Docker builds, and managed PostgreSQL reachable over a private network.

### Plans

| | Free | Paid (used by the Blueprint) |
|---|---|---|
| Web service | Spins down after 15 minutes without traffic, which drops every Socket.IO connection and makes the next visit wait for a cold start | Always on |
| PostgreSQL | Expires after 30 days; Render deletes it 14 days later | Persistent |

A Free stack is fine to try the application or to test a branch, and it is how the pull-request branch was verified (see [Verification](#verification)). It is not suitable for real use.

### Deploy behaviour

Render starts the new instance and stops the old one after a delay (zero-downtime deploys), so for a short time two instances run. During that window a change made through one is not broadcast to browsers connected to the other; they reconnect when the old instance stops, and every open page refetches on reconnect. Migrations run at the start of the new instance while the old one is still serving, so a migration that removes something the previous release still uses must be split across two releases.

### Moving an existing deployment

If you already have a service running an older version of BlackWater (for example the previous TypeScript backend), do not point it at this code in place without a backup. The new migrations rename and delete things: the unused on-call and notification tables, `Service.status` (health is now calculated), event names, and email case. They preserve users, organizations, services and incidents (tested on an upgrade of a database with legacy rows), and they stop with a clear message instead of guessing if two users have emails that differ only by case. Existing incidents become private, so nothing appears on a public status page until someone publishes it. Back up first (see [Backup and recovery](#backup-and-recovery)), and also update the service's build and start commands: there is no `npm run build` or `dist/` any more. The Docker runtime needs none.

## Other hosts

### Docker

The `Dockerfile` builds a production image that runs as an unprivileged user, applies pending migrations when it starts, then starts the server.

```bash
docker build -t blackwater .
docker run -p 8000:8000 \
  -e DATABASE_URL="postgresql://USER:PASSWORD@HOST:5432/DBNAME?schema=public" \
  -e JWT_SECRET="$(openssl rand -hex 32)" \
  -e TRUST_PROXY=1 \
  blackwater
```

Over plain HTTP on `localhost` this was verified in Chromium. The production security policy asks browsers to upgrade every request to HTTPS, and a browser that does so for `localhost` would fail to load the page's files (Safari has been reported to; not tested here). In that case test behind HTTPS or run with `NODE_ENV=development`.

Whatever the provider, the steps are: create a PostgreSQL database and copy its connection string (add `?sslmode=require` if TLS to the database is required); create a web service from the `Dockerfile`; set `DATABASE_URL`, `JWT_SECRET` (32 or more random characters) and `TRUST_PROXY=1`; set the health check path to `/health`; run one instance.

### Without Docker

```bash
npm ci --omit=dev
npx prisma migrate deploy      # apply pending migrations
NODE_ENV=production node src/server.js
```

Run `npx prisma migrate deploy` on every release, before starting the new version. It only applies migrations that are missing and never resets data. Do **not** run the seed script; it deletes everything and refuses to run in production.

## Why not Vercel

The repository was first connected to a Vercel project that was set up for the earlier React frontend. Vercel runs Express as serverless functions, and its documentation describes three properties that clash with this application:

- A WebSocket connection is pinned to the single function instance that accepted it, and new connections may land on a different instance.
- State shared between instances (rooms, presence) has to live in an external store such as Redis. BlackWater's rooms and rate limiter are in process memory, so an incident created through one instance would not reach a browser connected to another.
- Connections are closed when the function reaches its maximum duration.

Supporting that would mean adding Redis and the Socket.IO Redis adapter, a connection pooler for Prisma, and WebSocket-only transport, in return for nothing the application needs. A single always-on process is simpler and behaves the way the code was written. `vercel.json` therefore disables Git-triggered Vercel deployments; delete that file if you want to experiment with Vercel anyway.

## Environment

| Variable | Notes |
|---|---|
| `DATABASE_URL` | Required. Use a dedicated database user, with SSL if the database is not on the same private network (`?sslmode=require`). Prisma opens a pool of connections (by default `2 × CPU cores + 1`); add `&connection_limit=5` if your database plan allows few connections. |
| `JWT_SECRET` | Required, at least 32 random characters. Changing it signs everyone out. |
| `NODE_ENV` | Set to `production` (the Docker image does). This enables `upgrade-insecure-requests` and hides error details from responses. |
| `PORT` | Default 8000. Platforms such as Render set it for you. |
| `JWT_EXPIRES_IN` | Default `1d`. A value the token library rejects stops the server at startup. |
| `TRUST_PROXY` | Number of proxies in front of the app, typically `1`. Without it every visitor looks like the proxy and shares one rate-limit bucket, so the registration and failed-login limit (20 per 15 minutes) would apply to all your users together. |
| `AUTH_RATE_LIMIT`, `API_RATE_LIMIT` | Defaults 20 and 1000 per IP per 15 minutes. See the API reference for what each covers. |

## Reverse proxy

- Forward WebSocket upgrades to the app (Socket.IO needs them). For nginx: `proxy_set_header Upgrade $http_upgrade; proxy_set_header Connection "upgrade";`.
- Pass `X-Forwarded-For` and `X-Forwarded-Proto`, and set `TRUST_PROXY`.
- The app sends its own security headers, including HSTS in production.

## Operations

- **Health:** `GET /health` returns 200 with `{ "status": "UP", "database": "UP" }`, or 503 when the database is unreachable. Point load-balancer and uptime checks at it.
- **Logs:** written to standard output. Unexpected errors are logged with their stack and returned to clients only as "Something went wrong!".
- **Shutdown:** on `SIGTERM` or `SIGINT` the server stops accepting connections, lets requests in flight finish and closes the database pool; it exits after 10 seconds regardless. Browsers reconnect on their own.
- **Scaling:** the rate limiter and the Socket.IO rooms are in process memory. Run a single instance; running several would need a shared store for both (not implemented).

## Backup and recovery

The database is the only state; the application keeps nothing on disk.

- **Back up** with `pg_dump` (for example `pg_dump --format=custom --file=blackwater.dump "$DATABASE_URL"`, using a connection string that may connect from where you run it), or use your provider's backups. Render's paid PostgreSQL plans are backed up continuously for point-in-time recovery (a few days; 7 days on Pro and above) and can export logical backups from the dashboard. Its Free plan has neither, so back that up with `pg_dump` yourself.
- **Before every release that adds a migration,** take a backup. Migrations only move forward; Prisma has no down-migrations.
- **Restore** into an empty database with `pg_restore --no-owner --dbname="$TARGET_URL" blackwater.dump`, point `DATABASE_URL` at it and start the service. Run `prisma migrate deploy` afterwards if the dump is older than the code.
- **Test the restore** at least once into a scratch database before you depend on it. A backup that has never been restored is an assumption.
- Never run the test suite or the seed script against a database you care about: both delete every row.

## Links the application creates

Invitation links and the public status page link are built in the administrator's browser from the address it is using (`/invite#<token>` and `/status/<organization id>`). The page, the API and the Socket.IO connection are always on the same origin, so nothing needs configuring and there is no canonical-URL setting. If you add a custom domain, open the application on that domain when you create invitations, otherwise the links carry the `onrender.com` address.

## First administrator

Open `/register` and create the organization; whoever registers is its administrator. Registration is open to anyone who can reach the server, so if the deployment is private, restrict access at the network or proxy level.

## The Production environment on GitHub

[`production.yml`](../.github/workflows/production.yml) runs on every push to `main` and records a deployment in GitHub's **Production** environment. It marks it successful only after the live `/health` reports the pushed commit (Render sets `RENDER_GIT_COMMIT`, which `/health` returns) and the smoke journey below passes against the live URL; if Render fails to build, or the journey fails, it marks the deployment failed. Older Vercel entries in the list are history and stay as they are.

The workflow assumes Render deploys every push to `main` by itself (service setting *Auto-Deploy: On Commit*) and that the production address is the one in the workflow's `PRODUCTION_URL`. It needs no secrets.

## Verification

`npm run smoke` drives the main workflows through the real interface of a running deployment (registration, services, invitation, role change, the full incident lifecycle, audit trail, publish and unpublish, the logged-out visitor's view, a second organization, live updates between separate browser sessions, and a phone layout):

```bash
SMOKE_URL=https://your-app.example.com npm run smoke
```

It creates two organizations named "Smoke test ..." and, when it finishes, deletes exactly those two through their own administrators, then checks that they are gone. It cannot touch any other organization. Set `SMOKE_KEEP_DATA=1` to keep them, and `EXPECT_COMMIT=<sha>` to also require that `/health` reports that commit.
