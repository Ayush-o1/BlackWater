# BlackWater

**Full-stack incident management platform with role-based access control and a real-time public status page.**

[![CI](https://github.com/Ayush-o1/BlackWater/actions/workflows/ci.yml/badge.svg)](https://github.com/Ayush-o1/BlackWater/actions/workflows/ci.yml)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-20+-339933?style=flat-square&logo=node.js&logoColor=white)](https://nodejs.org/)
[![React](https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react&logoColor=black)](https://react.dev/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1?style=flat-square&logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![Socket.IO](https://img.shields.io/badge/Socket.IO-4.x-010101?style=flat-square&logo=socket.io&logoColor=white)](https://socket.io/)
[![Prisma](https://img.shields.io/badge/Prisma-5.x-2D3748?style=flat-square&logo=prisma&logoColor=white)](https://www.prisma.io/)
[![License](https://img.shields.io/badge/License-MIT-green?style=flat-square)](LICENSE)

---

## Overview

BlackWater is an incident management platform that gives engineering teams a private dashboard to declare, track, and resolve infrastructure incidents — while automatically keeping end users informed through a **public status page** that updates in real time via WebSockets.

Incident state changes propagate instantly across every connected client. Service health is derived automatically from active incidents, eliminating manual status updates.

---

## Core Features

- **Incident Lifecycle** — Enforced state machine: `TRIGGERED → ACKNOWLEDGED → RESOLVED → CLOSED`
- **Role-Based Access Control** — Three-tier permission model: `ADMIN`, `MEMBER`, `VIEWER`
- **Real-Time Updates** — Socket.IO broadcasts all state changes instantly across the dashboard and public status page
- **Automatic Service Health** — `ServiceEngine` recalculates service health on every incident mutation; no manual intervention required
- **Public Status Page** — Unauthenticated route at `/status/:orgId` showing live service health and public incident updates
- **DTO Isolation** — Internal fields (`description`, `assigneeId`, `metadata`) are stripped before exposure on public endpoints
- **Audit Timeline** — Every incident action creates an immutable `TimelineEvent` record; supports MTTA/MTTR analytics
- **Cursor Pagination** — All list endpoints use cursor-based pagination for correctness under live data
- **Multi-tenant** — All data is scoped by `orgId`; cross-organization data access is impossible by design

---

## Screenshots

| Login | Dashboard |
|-------|-----------|
| ![Login](screenshots/01_login.png) | ![Dashboard](screenshots/02_dashboard.png) |

| Incident List | Incident Details & Timeline |
|--------------|---------------------------|
| ![Incident List](screenshots/03_incident_list.png) | ![Incident Details](screenshots/04_incident_details.png) |

| Services | Service Health Badge |
|----------|---------------------|
| ![Services](screenshots/05_service_list.png) | ![Service Health](screenshots/06_service_health_badge.png) |

| Public Status Page | Public Incident Detail |
|-------------------|----------------------|
| ![Public Status](screenshots/07_public_status_page.png) | ![Public Incident](screenshots/08_public_incident_detail.png) |

| Settings |
|----------|
| ![Settings](screenshots/09_settings.png) |

---

## Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                     React SPA  (Vite)                        │
│   Zustand (auth + localStorage)                              │
│   TanStack React Query (server state + cache invalidation)   │
│   Socket.IO Client (real-time event subscriptions)           │
└──────────────────┬───────────────────────┬───────────────────┘
                   │  REST API (Bearer JWT) │  WebSocket (JWT handshake)
                   ▼                       ▼
┌──────────────────────────────────────────────────────────────┐
│                    Express.js API Server                      │
│   Helmet → CORS → express.json()                             │
│   requireAuth → requireRole → validateRequest(Zod)           │
│   Controller → Service → Engine → Prisma                     │
│   SocketEmitter singleton (event broadcast)                  │
└─────────────────────────────┬────────────────────────────────┘
                              │  Prisma ORM
                              ▼
┌──────────────────────────────────────────────────────────────┐
│                       PostgreSQL 16                           │
│   9 models · UUID primary keys · composite indexes           │
│   Multi-tenant: all queries scoped by orgId                  │
└──────────────────────────────────────────────────────────────┘
```

### Request Lifecycle

```
Request
  │
  ▼  Helmet (security headers)
  │
  ▼  CORS
  │
  ▼  express.json() (body parsing)
  │
  ▼  requireAuth    — extracts Bearer token, verifies JWT, fetches user from DB
  │
  ▼  requireRole    — checks req.user.role against allowed roles, returns 403 if not permitted
  │
  ▼  validateRequest(zodSchema) — validates body/query/params, returns 400 with field errors
  │
  ▼  Controller     — calls service method, sends HTTP response
  │
  ▼  Service / Engine — business logic, Prisma transactions, socket emissions
  │
  ▼  globalErrorHandler — structured JSON error for all thrown AppError or unexpected errors
```

### Incident State Machine

```
             ┌──────────────┐
             │  TRIGGERED   │◄──────────────────────┐
             └──────┬───────┘                        │
                    │                                │
        ┌───────────▼────────────┐                  │
        │     ACKNOWLEDGED       │──────────────────►│
        └───────────┬────────────┘
                    │
        ┌───────────▼────────────┐
        │       RESOLVED         │──────────► TRIGGERED (reopen)
        └───────────┬────────────┘
                    │
        ┌───────────▼────────────┐
        │        CLOSED          │  (terminal — no further transitions)
        └────────────────────────┘
```

`CLOSED` incidents are immutable. `acknowledgedAt` and `resolvedAt` timestamps are captured automatically for MTTA/MTTR calculations.

### ServiceEngine: Automatic Health Derivation

When any incident is created or changes status, `ServiceEngine.recalculateMultipleServices()` runs **outside the transaction** to recalculate the health of all affected services:

| Active Incident Severity | Derived Service Status |
|--------------------------|------------------------|
| No active incidents      | `OPERATIONAL`          |
| `LOW` or `MEDIUM`        | `DEGRADED`             |
| `HIGH`                   | `PARTIAL_OUTAGE`       |
| `CRITICAL`               | `MAJOR_OUTAGE`         |

The engine only writes to the database and emits a socket event if the calculated status **differs** from the current stored value.

---

## Technology Stack

### Backend

| Technology | Version | Purpose |
|------------|---------|---------|
| Node.js | 20+ | Runtime |
| Express.js | 4.x | REST API server |
| TypeScript | 5.x | End-to-end type safety |
| Prisma ORM | 5.x | Database access, migrations, type-safe queries |
| PostgreSQL | 16 | Primary relational database |
| Socket.IO | 4.x | WebSocket-based real-time event delivery |
| Zod | 3.x | Runtime request validation with field-level error messages |
| bcrypt | 5.x | Password hashing (salt rounds = 10) |
| jsonwebtoken | 9.x | JWT signing and verification |
| Helmet.js | 7.x | HTTP security headers |

### Frontend

| Technology | Version | Purpose |
|------------|---------|---------|
| React | 19 | UI framework |
| Vite | 8.x | Build tool and development server |
| TypeScript | 6.x | Type safety |
| Tailwind CSS | 4.x | Utility-first styling |
| React Router DOM | 7.x | Client-side routing |
| Zustand | 5.x | Auth state (persisted to `localStorage`) |
| TanStack React Query | 5.x | Server state management, caching, cache invalidation |
| Socket.IO Client | 4.x | Real-time event subscriptions |
| Axios | 1.x | HTTP client with JWT request interceptors |
| Lucide React | latest | Icon library |
| React Hot Toast | 2.x | Toast notifications |

---

## Project Structure

```
BlackWater/
├── src/                          # Backend — Node.js + Express
│   ├── server.ts                 # Entry point: DB connect, HTTP + Socket.IO init
│   ├── app.ts                    # Express app: middleware stack, route mounting
│   ├── config/
│   │   └── env.ts                # Zod-validated env config (fails fast on bad env)
│   ├── middleware/
│   │   ├── auth.middleware.ts    # JWT verification, user hydration from DB
│   │   ├── rbac.middleware.ts    # Role-based access control guard
│   │   ├── validate.middleware.ts# Zod schema validation (body/query/params)
│   │   └── error.middleware.ts   # Global error handler
│   ├── modules/                  # Feature modules: controller / service / routes / schemas
│   │   ├── auth/                 # Register, login, current user
│   │   ├── incidents/            # Incident CRUD, state machine, updates, assignment
│   │   ├── services/             # Service CRUD + ServiceEngine
│   │   ├── status/               # Public status API (unauthenticated)
│   │   ├── users/                # User listing and profile updates
│   │   └── organizations/        # Org details and settings
│   ├── socket/
│   │   ├── socket.server.ts      # Socket.IO init, room join/leave logic
│   │   ├── socket.emitter.ts     # Singleton emitter used by services
│   │   ├── socket.auth.ts        # JWT authentication middleware for WebSocket
│   │   └── socket.types.ts       # TypeScript event type definitions
│   ├── prisma/
│   │   └── client.ts             # Singleton Prisma client instance
│   └── utils/
│       ├── jwt.ts                # generateToken / verifyToken helpers
│       ├── response.ts           # Standardised API response helpers
│       └── errors/
│           ├── AppError.ts       # Custom error class: statusCode + isOperational
│           └── asyncHandler.ts   # try/catch wrapper for async route controllers
│
├── prisma/
│   ├── schema.prisma             # Database schema: 9 models, 7 enums
│   ├── seed.ts                   # Demo data seeder
│   └── migrations/               # Prisma migration history (auto-generated)
│
├── frontend/                     # Frontend — React + Vite
│   └── src/
│       ├── App.tsx               # Route definitions (public + protected)
│       ├── api/                  # Axios API call functions (one file per domain)
│       │   ├── axios.ts          # Axios instance, JWT interceptor, 401 auto-logout
│       │   ├── auth.api.ts
│       │   ├── incident.api.ts
│       │   ├── service.api.ts
│       │   ├── status.api.ts
│       │   ├── user.api.ts
│       │   └── organization.api.ts
│       ├── hooks/
│       │   ├── queries.ts        # All React Query hooks (useQuery + useMutation)
│       │   └── useSocketSubscriptions.ts  # Socket lifecycle + cache invalidation
│       ├── store/
│       │   └── useAuthStore.ts   # Zustand auth store (persisted)
│       ├── pages/                # Page-level components (one per route)
│       ├── components/           # Reusable UI components
│       └── types/                # Shared TypeScript interfaces
│
├── screenshots/                  # UI screenshots
├── .env.example                  # Backend environment variable template
├── LICENSE                       # MIT License
├── package.json                  # Backend dependencies and scripts
└── tsconfig.json                 # Backend TypeScript configuration
```

---

## Getting Started

### Prerequisites

- **Node.js** 20 or higher
- **PostgreSQL** 16 (running locally or accessible via connection string)
- **npm** 10+

### Installation

```bash
# Clone the repository
git clone https://github.com/Ayush-o1/BlackWater.git
cd BlackWater

# Install backend dependencies
npm install

# Install frontend dependencies
cd frontend && npm install && cd ..
```

### Environment Setup

```bash
# Copy the environment template
cp .env.example .env
```

Edit `.env` and configure the required variables:

```bash
# Required
DATABASE_URL="postgresql://user:password@localhost:5432/blackwater?schema=public"
JWT_SECRET="your-strong-random-secret-min-32-characters"

# Optional (defaults shown)
PORT=8000
NODE_ENV=development
JWT_EXPIRES_IN=1d
```

Generate a secure JWT secret:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

For the frontend, create `frontend/.env` (optional — defaults to `http://localhost:8000`):
```bash
VITE_API_URL=http://localhost:8000
```

> All backend environment variables are validated at startup via Zod in `src/config/env.ts`. The process exits immediately with a clear error if any required variable is missing or malformed.

### Database Setup

```bash
# Run migrations (creates schema in your PostgreSQL database)
npm run prisma:migrate

# Load demo data
npm run prisma:seed
```

**Demo accounts created by the seeder:**

| Email | Password | Role |
|-------|----------|------|
| `admin@BlackWater.com` | `password123` | `ADMIN` |
| `bob@BlackWater.com` | `password123` | `MEMBER` |

The seeder prints the `orgId` to the console. Use it for the public status page URL: `http://localhost:5173/status/<orgId>`.

### Running Locally

```bash
# Terminal 1 — Backend API (port 8000)
npm run dev

# Terminal 2 — Frontend dev server (port 5173)
cd frontend && npm run dev
```

Open `http://localhost:5173` to access the dashboard.

---

## Available Scripts

### Backend

| Script | Command | Description |
|--------|---------|-------------|
| `dev` | `npm run dev` | Start dev server with hot reload |
| `build` | `npm run build` | Compile TypeScript to `dist/` |
| `start` | `npm start` | Run compiled production server |
| `prisma:generate` | `npm run prisma:generate` | Regenerate Prisma client |
| `prisma:migrate` | `npm run prisma:migrate` | Run pending migrations (dev) |
| `prisma:migrate:prod` | `npm run prisma:migrate:prod` | Apply migrations (production, no reset) |
| `prisma:seed` | `npm run prisma:seed` | Load demo data |
| `prisma:studio` | `npm run prisma:studio` | Open Prisma Studio GUI |

### Frontend

| Script | Command | Description |
|--------|---------|-------------|
| `dev` | `npm run dev` | Start Vite dev server |
| `build` | `npm run build` | Production build to `frontend/dist/` |
| `lint` | `npm run lint` | Run ESLint |
| `preview` | `npm run preview` | Preview production build locally |

---

## Environment Variables

### Backend (`.env`)

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `DATABASE_URL` | ✅ | — | PostgreSQL connection string |
| `JWT_SECRET` | ✅ | — | JWT signing secret (min 32 chars) |
| `PORT` | ❌ | `8000` | HTTP server port |
| `NODE_ENV` | ❌ | `development` | Environment: `development`, `production`, `test` |
| `JWT_EXPIRES_IN` | ❌ | `1d` | JWT expiry duration |

### Frontend (`frontend/.env`)

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `VITE_API_URL` | ❌ | `http://localhost:8000` | Backend API base URL |

---

## API Reference

All authenticated routes require `Authorization: Bearer <token>`.  
All responses are `Content-Type: application/json`.

### Authentication

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| `POST` | `/auth/register` | — | Create organization + ADMIN user |
| `POST` | `/auth/login` | — | Authenticate, returns JWT |
| `GET` | `/auth/me` | Required | Current user profile |

### Incidents

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| `GET` | `/incidents` | VIEWER+ | List incidents (filterable, cursor-paginated) |
| `POST` | `/incidents` | MEMBER+ | Create incident |
| `GET` | `/incidents/:id` | VIEWER+ | Incident detail with timeline and updates |
| `PATCH` | `/incidents/:id/status` | MEMBER+ | Advance state machine |
| `PATCH` | `/incidents/:id/assign` | MEMBER+ | Assign to a user |
| `POST` | `/incidents/:id/updates` | MEMBER+ | Post internal or public update |

**Incident filter parameters:** `status`, `severity`, `assigneeId`, `serviceId`, `cursor`, `limit`

### Services

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| `GET` | `/services` | VIEWER+ | List services (cursor-paginated) |
| `POST` | `/services` | MEMBER+ | Register new service |
| `GET` | `/services/:id` | VIEWER+ | Service detail + 10 most recent incidents |
| `PATCH` | `/services/:id` | MEMBER+ | Update name/description |
| `DELETE` | `/services/:id` | ADMIN | Delete service |

### Users & Organizations

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| `GET` | `/users` | Required | List users in organization |
| `GET` | `/users/me` | Required | Current user |
| `PATCH` | `/users/me` | Required | Update own display name |
| `GET` | `/organizations/me` | Required | Organization details |
| `PATCH` | `/organizations/me` | ADMIN | Update organization name |

### Public Status API (No Auth)

| Method | Route | Description |
|--------|-------|-------------|
| `GET` | `/status?orgId=<uuid>` | Full overview: org health, services, active incidents |
| `GET` | `/status/services?orgId=<uuid>` | Service list with current statuses |
| `GET` | `/status/incidents?orgId=<uuid>` | Paginated incident list |
| `GET` | `/status/incidents/:id?orgId=<uuid>` | Public incident detail and timeline |

### Health Check

| Method | Route | Description |
|--------|-------|-------------|
| `GET` | `/health` | Liveness check — `{ "status": "UP" }` |

Full request/response examples with payload shapes: **[API_DOCS.md](API_DOCS.md)**

---

## Role-Based Access Control

Three roles with cascading permissions:

| Permission | VIEWER | MEMBER | ADMIN |
|------------|:------:|:------:|:-----:|
| View incidents and services | ✅ | ✅ | ✅ |
| Create incidents | ❌ | ✅ | ✅ |
| Change incident status | ❌ | ✅ | ✅ |
| Assign incidents | ❌ | ✅ | ✅ |
| Post incident updates | ❌ | ✅ | ✅ |
| Create / update services | ❌ | ✅ | ✅ |
| Delete services | ❌ | ❌ | ✅ |
| Update organization settings | ❌ | ❌ | ✅ |

The first user to register an organization is automatically assigned the `ADMIN` role.

---

## WebSocket Events

Connect with the JWT from the auth handshake:

```javascript
import { io } from 'socket.io-client';

const socket = io('http://localhost:8000', {
  auth: { token: 'your-jwt-token' },
  transports: ['websocket'],
});
```

### Room Model

- **`organization:<orgId>`** — All authenticated users in an org join automatically on connect.
- **`incident:<incidentId>`** — Clients join explicitly by emitting `join:incident`.

### Client → Server

| Event | Payload | Description |
|-------|---------|-------------|
| `join:incident` | `(incidentId, callback)` | Subscribe to an incident room |
| `leave:incident` | `(incidentId)` | Unsubscribe from an incident room |

### Server → Client

| Event | Payload | Trigger |
|-------|---------|---------|
| `incident:created` | `{ id, title, severity }` | New incident declared |
| `incident:status_changed` | `{ id, status }` | Status machine transition |
| `incident:assigned` | `{ id, assigneeId }` | Incident assigned to user |
| `incident:update_added` | `{ id, updateId, isPublic }` | Update posted |
| `timeline:event_created` | `{ incidentId, eventType }` | Timeline audit entry created |
| `service:created` | `{ id, name }` | New service registered |
| `service:updated` | `{ id }` | Service name/description changed |
| `service:status_changed` | `{ id, status }` | ServiceEngine recalculated health |
| `service:deleted` | `{ id }` | Service deleted |
| `status:updated` | `{ orgId }` | Broad signal for public page refresh |

---

## Database

PostgreSQL with Prisma ORM. 9 models, 7 enums, UUID primary keys, composite indexes on all high-frequency query patterns.

**Core models:** `Organization`, `User`, `Service`, `Incident`, `IncidentUpdate`, `TimelineEvent`  
**Future-ready models:** `OnCallSchedule`, `OnCallMember`, `NotificationLog`

Full schema reference: **[DATABASE.md](DATABASE.md)**

---

## Documentation Index

| Document | Contents |
|----------|----------|
| [ARCHITECTURE.md](ARCHITECTURE.md) | Backend layers, request lifecycle, state machine, socket design, transactions |
| [FRONTEND_ARCHITECTURE.md](FRONTEND_ARCHITECTURE.md) | React structure, state management, real-time strategy, routing |
| [API_DOCS.md](API_DOCS.md) | Request/response examples for every endpoint and socket event |
| [DATABASE.md](DATABASE.md) | All 9 models, 7 enums, indexes, seed data |
| [DEPLOYMENT.md](DEPLOYMENT.md) | Build, production setup, database migration commands |
| [SECURITY.md](SECURITY.md) | Authentication, RBAC, HTTP headers, known limitations |
| [TESTING.md](TESTING.md) | Test strategy, coverage targets, planned test suite |
| [OBSERVABILITY.md](OBSERVABILITY.md) | Health check, error response format, audit timeline |
| [CONTRIBUTING.md](CONTRIBUTING.md) | Development workflow, conventions, pull request process |

---

## Deployment

### Build

```bash
# Backend
npm run build       # Compiles TypeScript to ./dist/
npm start           # Runs ./dist/server.js

# Frontend
cd frontend
npm run build       # Builds to ./frontend/dist/ — serve as static files
```

### Production Environment

Set these environment variables on your hosting platform:

```bash
DATABASE_URL="postgresql://..."
JWT_SECRET="<64-char random hex>"
NODE_ENV=production
PORT=8000
```

For the frontend, set `VITE_API_URL` to your deployed backend URL before building.

### CORS

Before deploying, restrict the CORS origin in `src/socket/socket.server.ts` and `src/app.ts` from `*` to your frontend's domain:

```typescript
cors: {
  origin: 'https://your-frontend.example.com',
  methods: ['GET', 'POST'],
}
```

### Database Migrations (Production)

```bash
# Apply all pending migrations — does NOT reset data
npm run prisma:migrate:prod
```

Full deployment guide: **[DEPLOYMENT.md](DEPLOYMENT.md)**

---

## Troubleshooting

**`DATABASE_URL` connection error on startup**  
Verify the PostgreSQL connection string format and that the database server is running and accessible. Run `npx prisma db pull` to test connectivity.

**JWT errors on authenticated routes**  
Ensure the `Authorization: Bearer <token>` header is present and the token has not expired. The default expiry is `1d`. Check `JWT_EXPIRES_IN` in your `.env`.

**Socket.IO connection rejected**  
The WebSocket authentication middleware requires a valid JWT in `socket.handshake.auth.token`. Verify the token is passed correctly in the client connection options.

**Prisma Client out of sync**  
If you modify `prisma/schema.prisma`, run `npm run prisma:generate` to regenerate the Prisma Client before restarting the server.

**Service status not updating**  
Service health is recalculated only when an incident is created or its status changes. If a service shows a stale status, trigger a status change on any linked incident to force recalculation.

---

## License

[MIT](LICENSE)
