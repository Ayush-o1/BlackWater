# BlackWater — Verified Technical Facts

Full-stack incident-management platform. Express/TypeScript/Prisma/PostgreSQL/Socket.IO backend + React 19/TypeScript/Tailwind v4 frontend. All figures below are counted directly from the source (`Ayush-o1/BlackWater`).

## Stack
- **Backend:** Node.js, Express, TypeScript (strict mode), Prisma ORM, PostgreSQL, Socket.IO, zod, JWT (`jsonwebtoken`), bcrypt, helmet, express-rate-limit
- **Frontend:** React 19, Vite, TypeScript, Tailwind CSS v4, React Router v7, Zustand, TanStack React Query v5, Axios, Socket.IO client

## API & Modules
- 23 REST endpoints across 6 modules: auth, users, organizations, services, incidents, status
- 6 zod validation schema files (one per module) validating request input before controller logic
- 4 custom Express middleware: JWT auth, RBAC, request validation, centralized error handling

## Database (PostgreSQL via Prisma)
- 9 models: Organization, User, Service, Incident, IncidentUpdate, TimelineEvent, OnCallSchedule, OnCallMember, NotificationLog
- 17 defined relations between models
- 20 `@@index` entries, 1 composite `@@unique` constraint
- 3 versioned migrations, applied with zero drift
- 7 enums modeling domain state (Role, IncidentStatus, Severity, ServiceStatus, NotificationChannel, NotificationStatus, EscalationLevel)

## Authentication & Authorization
- Stateless JWT authentication, verified per-request via middleware and reused for Socket.IO handshake auth
- bcrypt password hashing
- 3-tier RBAC (ADMIN, MEMBER, VIEWER) via a `requireRole()` middleware, applied across 12 route-level permission checks

## Domain Model
- 4-state incident lifecycle: TRIGGERED → ACKNOWLEDGED → RESOLVED → CLOSED
- 4 severity levels: CRITICAL, HIGH, MEDIUM, LOW
- 4 service health states: OPERATIONAL, DEGRADED, PARTIAL_OUTAGE, MAJOR_OUTAGE

## Real-Time (Socket.IO)
- 6 server→client event types: `incident:created`, `incident:assigned`, `incident:status_changed`, `incident:update_added`, `service:status_changed`, `status:updated`
- Frontend maps each event to targeted React Query cache invalidation instead of polling
- Public status page (unauthenticated) also receives live updates via the same socket layer

## Security
- Two-tier rate limiting (`express-rate-limit`): stricter limiter on `/auth/*`, general limiter on the rest of the API
- `helmet()` security headers; CORS restricted to a configured origin (not wildcard)
- Multi-tenant isolation: all queries scoped by organization, verified via cross-tenant access test returning 404 on foreign-org resources
- 11 npm dependency vulnerabilities (axios, ws, form-data, body-parser, brace-expansion) patched via `npm audit fix`, verified with a clean rebuild

## Frontend Architecture
- 11 route-level pages, each lazy-loaded via `React.lazy()` behind a single `Suspense` boundary — confirmed by 17 separate route chunk files in the production build output
- 14 reusable UI primitive components (Card, Badge, Button, Modal, ConfirmDialog, Input, Select, Textarea, Table, Skeleton, EmptyState, StatCard, PageLoader, ServiceMultiSelect)
- 18 custom React Query hooks (queries + mutations) covering all server-state access
- State split by concern: Zustand for persisted auth state, React Query for server/cache state
- Cursor-based pagination on the incident list (avoids duplicate/skipped rows under concurrent inserts, unlike offset pagination)

## Not present (do not claim)
- No automated test suite committed to the repo (no `*.test.ts`/`*.spec.ts` files)
- No Dockerfile / containerization
- No load testing, benchmarking, or production deployment — no throughput, uptime, or scale figures exist
