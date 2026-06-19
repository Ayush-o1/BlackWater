# Architecture

This document explains how BlackWater is built internally — module by module, layer by layer.

---

## System Overview

BlackWater has three logical layers:

```
┌─────────────────────────────────────────────────┐
│                  React SPA (Vite)                │
│   Pages → Hooks (React Query) → API functions   │
│   Zustand (auth) + Socket.IO Client (realtime)  │
└──────────────┬──────────────────┬───────────────┘
               │  HTTP REST        │  WebSocket
               │  Bearer JWT       │  JWT handshake
               ▼                  ▼
┌─────────────────────────────────────────────────┐
│             Express.js Backend                   │
│  requireAuth → requireRole → Zod validation      │
│  Controller → Service → Engine → DB              │
│  SocketEmitter singleton (event broadcast)       │
└──────────────────────┬──────────────────────────┘
                       │  Prisma ORM
                       ▼
┌─────────────────────────────────────────────────┐
│                  PostgreSQL                      │
│  9 models, UUID primary keys, composite indexes  │
└─────────────────────────────────────────────────┘
```

---

## Backend: Request Lifecycle

Every authenticated API request passes through this middleware chain before reaching business logic:

```
Request
  │
  ▼
Helmet (sets security HTTP headers)
  │
  ▼
CORS
  │
  ▼
express.json() (body parsing)
  │
  ▼
requireAuth middleware
  │   - Extracts "Bearer <token>" from Authorization header
  │   - Calls verifyToken(token) using jsonwebtoken
  │   - Fetches the user from DB (ensures user still exists)
  │   - Attaches user to req.user
  ▼
requireRole(...roles) middleware
  │   - Checks req.user.role against the allowed roles array
  │   - Returns 403 if not authorized
  ▼
validateRequest(zodSchema) middleware
  │   - Validates req.body, req.query, req.params against a Zod schema
  │   - Returns 400 with field-level error messages on failure
  ▼
Controller function
  │   - Calls the appropriate Service method
  │   - Formats and sends the HTTP response
  ▼
Service / Engine (business logic)
  │   - Runs database operations (inside Prisma transactions where needed)
  │   - Emits Socket.IO events via SocketEmitter
  ▼
globalErrorHandler (express error middleware)
      - Catches all thrown AppError or unexpected errors
      - Returns structured JSON error responses
      - In development: includes stack trace
      - In production: hides internal details for non-operational errors
```

---

## Backend Module Structure

Each feature module in `src/modules/` follows a consistent 4-file pattern:

| File | Responsibility |
|------|---------------|
| `*.routes.ts` | Declares routes, attaches middleware chain |
| `*.controller.ts` | Receives HTTP request, calls service, sends response |
| `*.service.ts` | Business logic, DB operations, socket emissions |
| `*.schemas.ts` | Zod schemas for request validation |

Some modules have additional files:

| File | Module | Purpose |
|------|--------|---------|
| `service.engine.ts` | services | Automatic service health recalculation |
| `status.engine.ts` | status | Overall org health calculation |
| `status.dto.ts` | status | Strips internal fields before public exposure |
| `auth.types.ts` | auth | TypeScript type for user without passwordHash |

---

## Incident State Machine

Incidents follow a strict state transition graph. The `IncidentService.validateTransition()` method enforces these rules:

```
              ┌─────────────────┐
              │    TRIGGERED    │◄──────────────┐
              └────────┬────────┘               │
                       │                        │
          ┌────────────▼────────────┐           │
          │      ACKNOWLEDGED      │───────────►│
          └────────────┬────────────┘
                       │
          ┌────────────▼────────────┐
          │        RESOLVED         │───────────► TRIGGERED (re-open)
          └────────────┬────────────┘
                       │
          ┌────────────▼────────────┐
          │         CLOSED          │  (terminal state — no further changes)
          └─────────────────────────┘
```

**Key rules from code:**
- `CLOSED` incidents cannot be modified at all.
- Timestamps are captured automatically: `acknowledgedAt` when moving `TRIGGERED → ACKNOWLEDGED`, and `resolvedAt` when moving to `RESOLVED`.
- These timestamps are stored to support future analytics (e.g., MTTA, MTTR calculations).

---

## ServiceEngine: Automatic Health Calculation

`src/modules/services/service.engine.ts`

This is one of the core design decisions in the project. Instead of requiring engineers to manually update a service's status, BlackWater derives it automatically from active incidents.

**How it works:**

1. When an incident is created or its status changes, `ServiceEngine.recalculateMultipleServices()` is called.
2. The engine queries all **active** (non-RESOLVED, non-CLOSED) incidents linked to the service.
3. It applies this severity → status mapping:

```
No active incidents      → OPERATIONAL
Severity LOW or MEDIUM   → DEGRADED
Severity HIGH            → PARTIAL_OUTAGE
Severity CRITICAL        → MAJOR_OUTAGE
```

4. If the calculated status differs from the current database value, it updates the service and emits a `service:status_changed` Socket.IO event.
5. This update-only-on-delta approach avoids unnecessary DB writes and redundant socket broadcasts.

**StatusEngine** (`src/modules/status/status.engine.ts`) works similarly at the organization level: it rolls up service statuses to calculate one overall health label shown at the top of the public status page.

---

## Socket.IO Architecture

### Server Side

**Socket room model:**
- Every authenticated user automatically joins an `organization:<orgId>` room on connect.
- Clients can additionally join `incident:<incidentId>` rooms by emitting a `join:incident` event.
- The server verifies that the incident belongs to the user's organization before allowing the join.

**SocketEmitter singleton:**

The `SocketEmitter` class in `src/socket/socket.emitter.ts` is initialized once at server startup and then called directly from service classes:

```typescript
// Inside a service after a DB mutation:
SocketEmitter.toOrg(orgId, 'incident:created', { id, title, severity });
SocketEmitter.toIncident(incidentId, 'timeline:event_created', { ... });
```

This decouples business logic from the socket connection — services don't need to know about socket internals.

**Socket authentication:**
- On WebSocket connection, the server runs `socketAuthMiddleware`.
- It reads the token from `socket.handshake.auth.token` or the Authorization header.
- It verifies the JWT and fetches the user from the database, attaching it to `socket.data.user`.
- Unauthorized connections are rejected before the `connection` event fires.

### Client Side

`frontend/src/hooks/useSocketSubscriptions.ts`

- Creates a single persistent socket connection when the user logs in.
- Disconnects the socket on logout.
- Maps incoming socket events to React Query cache invalidations:

```typescript
const eventMapping = {
  'incident:created':       ['incidents', 'statusOverview'],
  'incident:status_changed': ['incidents', 'incidentDetails', 'statusOverview'],
  'service:status_changed': ['services', 'serviceDetails', 'statusOverview'],
  // ... etc.
};
```

When a socket event arrives, the relevant queries are invalidated, causing React Query to re-fetch fresh data automatically.

---

## Public Status Page Isolation

The `/status` route group is intentionally not protected by `requireAuth`. It is designed to be shared with the public.

**What is sanitized (via `StatusDTO`):**
- `passwordHash` — never exposed anywhere
- Internal incident `description` (only title, status, severity, resolvedAt are public)
- `assigneeId`, `creatorId` — internal user references
- `IncidentUpdate.userId` — who wrote the update
- `TimelineEvent.metadata` — contains internal UUIDs (assignee IDs, etc.)

**What the public sees:**
- Organization name and overall health
- Service names, descriptions, and statuses
- Incident title, status, severity, creation time, resolution time
- Public updates (those with `isPublic: true`)
- Timeline event types and timestamps (without metadata)

---

## Authentication & Authorization Flow

```
POST /auth/register
  1. Check email uniqueness
  2. Hash password with bcrypt (salt rounds = 10)
  3. Create Organization and User in a single Prisma transaction
  4. First user in an org is always assigned ADMIN role
  5. Generate JWT (payload: userId, orgId, role)
  6. Return token + sanitized user (no passwordHash)

POST /auth/login
  1. Find user by email
  2. Compare password with bcrypt.compare()
  3. Generate JWT
  4. Return token + sanitized user

Protected routes:
  1. requireAuth extracts and verifies the JWT
  2. It fetches the user from the DB (catches deleted/deactivated users)
  3. Attaches user to req.user
  4. requireRole checks req.user.role against allowed roles
```

**JWT payload structure:**
```json
{ "userId": "uuid", "orgId": "uuid", "role": "ADMIN|MEMBER|VIEWER" }
```

**Role permission matrix:**
| Action | VIEWER | MEMBER | ADMIN |
|--------|--------|--------|-------|
| View incidents | ✅ | ✅ | ✅ |
| Create incident | ❌ | ✅ | ✅ |
| Change status / assign | ❌ | ✅ | ✅ |
| Add update | ❌ | ✅ | ✅ |
| View services | ✅ | ✅ | ✅ |
| Create/update service | ❌ | ✅ | ✅ |
| Delete service | ❌ | ❌ | ✅ |
| Update org name | ❌ | ❌ | ✅ |

---

## Error Handling Strategy

**Custom `AppError` class** (`src/utils/errors/AppError.ts`):
- Extends `Error` with `statusCode` and `isOperational` fields.
- `isOperational: true` means it's an expected error (e.g., "User not found") — safe to return to the client.
- `isOperational: false` would be for unexpected errors that should not expose details to the client.

**Global error handler** (`src/middleware/error.middleware.ts`):
- In **development**: returns full error details including stack trace.
- In **production**: returns generic message for unexpected errors, detailed message only for operational errors.

---

## Prisma Transaction Usage

Several operations use `prisma.$transaction()` to ensure atomicity:

| Operation | Why a transaction is needed |
|-----------|----------------------------|
| Register | Create org + user together — partial creation would leave orphaned records |
| Create incident | Create incident + first timeline event — both must succeed |
| Assign incident | Update incident + create timeline audit event |
| Change status | Update incident status + capture timestamp + create timeline event |
| Add update | Create update + create timeline event |

Outside the transaction, `ServiceEngine.recalculate*()` runs after the transaction commits — it doesn't need to be part of the atomic operation since it's a derived recalculation.

---

## Environment Configuration

`src/config/env.ts` uses Zod to validate all environment variables at startup:

```typescript
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().default('8000').transform(val => parseInt(val, 10)),
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(1),
  JWT_EXPIRES_IN: z.string().default('1d'),
});
```

If any required variable is missing or invalid, the server exits immediately with a clear error rather than failing silently at runtime.

---

## Graceful Shutdown

The server handles `SIGTERM` and `SIGINT` signals by:
1. Stopping the HTTP server from accepting new connections.
2. Waiting for active connections to drain.
3. Disconnecting the Prisma client cleanly.
4. Force-killing after 10 seconds if connections don't drain.

This prevents data corruption if the process is killed mid-request.
