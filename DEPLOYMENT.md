# Deployment Guide

This document covers building BlackWater for production, configuring environment variables, running database migrations, and deployment considerations.

---

## Local Development

```bash
# Clone and install
git clone https://github.com/Ayush-o1/BlackWater.git
cd BlackWater

npm install
cp .env.example .env
# Edit .env — set DATABASE_URL and JWT_SECRET

# Database setup
npm run prisma:migrate    # runs pending migrations
npm run prisma:seed       # loads demo data (optional)

# Start servers
npm run dev               # backend on port 8000

cd frontend
npm install
npm run dev               # frontend on port 5173
```

---

## Production Build

### Backend

```bash
# Compile TypeScript to JavaScript
npm run build
# Output: ./dist/

# Start the compiled server
npm start
# Runs: node dist/server.js
```

### Frontend

```bash
cd frontend
npm run build
# Output: ./frontend/dist/
# Serve this directory as static files via any HTTP server, CDN, or platform.
```

---

## Environment Variables

### Backend (`.env`)

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `DATABASE_URL` | ✅ | — | PostgreSQL connection string |
| `JWT_SECRET` | ✅ | — | JWT signing secret (minimum 32 characters) |
| `PORT` | ❌ | `8000` | HTTP server port |
| `NODE_ENV` | ❌ | `development` | `development` \| `production` \| `test` |
| `JWT_EXPIRES_IN` | ❌ | `1d` | Token expiry (e.g., `1d`, `12h`, `7d`) |

```bash
DATABASE_URL="postgresql://user:password@host:5432/blackwater?schema=public"
JWT_SECRET="<64-char random hex string>"
PORT=8000
NODE_ENV=production
JWT_EXPIRES_IN=1d
```

Generate a secure JWT secret:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### Frontend (`frontend/.env`)

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `VITE_API_URL` | ❌ | `http://localhost:8000` | Backend API base URL |

```bash
VITE_API_URL=https://api.your-domain.com
```

Set `VITE_API_URL` **before** running `npm run build`. The value is inlined at build time by Vite.

---

## Database Migrations

```bash
# Development — runs migrations and prompts to create missing migration files
npm run prisma:migrate

# Production — applies pending migrations without resetting data
npm run prisma:migrate:prod

# Regenerate Prisma Client after schema changes
npm run prisma:generate

# Inspect the database via GUI
npm run prisma:studio
```

> **Important:** Always run `npm run prisma:migrate:prod` (not `prisma migrate dev`) in production environments. `migrate dev` can reset data in edge cases.

---

## CORS Configuration

The default configuration allows all origins (`*`). Before deploying, restrict CORS to your actual frontend domain.

**`src/app.ts`** — REST API:
```typescript
app.use(cors({
  origin: 'https://your-frontend.example.com',
  credentials: true,
}));
```

**`src/socket/socket.server.ts`** — Socket.IO:
```typescript
const io = new Server(httpServer, {
  cors: {
    origin: 'https://your-frontend.example.com',
    methods: ['GET', 'POST'],
  },
});
```

---

## Health Check

The `/health` endpoint is available for load balancer probes and uptime monitors:

```bash
curl https://api.your-domain.com/health
# → { "status": "UP", "message": "BlackWater API is healthy" }
```

Returns `200 OK` when Express is accepting connections. Note: it does not verify database connectivity. To add a database ping, see [OBSERVABILITY.md](OBSERVABILITY.md).

---

## Seeding Demo Data

```bash
npm run prisma:seed
```

Creates:
- 1 organization: `BlackWater Demo Corp`
- Admin user: `admin@BlackWater.com` / `password123`
- Member user: `bob@BlackWater.com` / `password123`
- 3 sample services (API Gateway, Authentication Service, Primary DB Cluster)
- 1 resolved historical incident
- 1 active `ACKNOWLEDGED` incident with updates and timeline events

The organization ID is printed to the console after seeding. Use it for the public status page: `/status/<orgId>`.

> **Do not seed production databases.** The seed script truncates all data before inserting.

---

## Recommended Deployment Targets

| Component | Options |
|-----------|---------|
| Backend API | Railway, Render, Fly.io, AWS EC2/ECS, any VPS |
| Frontend | Vercel, Netlify, Cloudflare Pages, any static host |
| Database | Supabase, Railway Postgres, AWS RDS, Neon |

---

## Process Management (Self-hosted)

For production deployments on a VPS, use a process manager:

```bash
# Install PM2
npm install -g pm2

# Start the server
pm2 start dist/server.js --name blackwater-api

# Save process list for automatic restart on reboot
pm2 save
pm2 startup
```

---

## Troubleshooting

**`Cannot connect to database` on startup**  
Verify `DATABASE_URL` is correct and the database is accepting connections. Test connectivity: `npx prisma db pull`.

**Migrations fail with "relation already exists"**  
The database may have been manually modified. Run `npx prisma migrate resolve` to mark the migration as applied without re-running it.

**Socket connections drop immediately**  
Check that the CORS `origin` in `socket.server.ts` matches the frontend origin exactly, including protocol and port.

**`JWT_SECRET` validation error**  
All environment variables are validated at startup. If `JWT_SECRET` is missing or empty, the process exits with an error. Ensure the variable is set in the deployment environment, not just locally.
