# SignalOps Architecture

SignalOps is a highly responsive, real-time incident management platform built on a modernized Node.js & React stack. It bridges internal engineering workflows with unauthenticated public status reporting securely.

## 1. System Overview

### The Frontend (React + Vite)
- **Framework**: React 18 powered by Vite for instant HMR.
- **State Management**: Zustand for global identity management (`useAuthStore`); TanStack React Query for complex server-state caching, deduping, and pagination.
- **Styling**: Tailwind CSS utilizing a highly scalable, semantic configuration mapping to standard CSS variables.
- **Components**: Radix-inspired accessible primitives.

### The Backend (Node.js + Express)
- **Framework**: Express.js configured with strict feature-based modular architecture (`src/modules/*`).
- **ORM**: Prisma Client providing absolute type-safety directly from the Postgres database up to the HTTP DTO layer.
- **Validation**: Zod schema validation securely guarding all inputs (Params, Queries, Bodies) via middleware before they hit controllers.
- **Real-time**: Socket.IO singleton `SocketEmitter` injected safely into service layers.

---

## 2. Core Engines

### The State Machine Engine
SignalOps abandons "dumb CRUD" for its core entities. Incidents operate strictly on a State Machine:
`TRIGGERED` → `ACKNOWLEDGED` → `RESOLVED` → `CLOSED`

The system explicitly rejects invalid mutations (e.g., you cannot jump from Triggered to Closed without an acknowledgment phase).

### The Service Health Engine
The `ServiceEngine` natively aggregates underlying data rather than relying on manual human updates.
Whenever an incident is created, modified, or resolved, the Engine recalculates the affected Service's health by scanning the maximum severity of its active incidents.
- If it finds a `CRITICAL` incident, the service is `MAJOR_OUTAGE`.
- If it finds no incidents, the service heals to `OPERATIONAL`.

### Data Exposure Boundaries & DTO Layer
A strict DTO (Data Transfer Object) layer guards the public APIs. Because the public Status Page operates without JWT authentication, the DTO layer guarantees that `internal notes`, `user emails`, and `system UUIDs` are stripped from the payload *before* serialization. The database queries inherently filter out `isPublic: false` data to ensure absolute isolation.

---

## 3. Database Schema (Prisma)

- **Organization**: The top-level tenant.
- **User**: Maps to an Organization, utilizing RBAC (`ADMIN`, `MEMBER`, `VIEWER`).
- **Service**: Represents internal infrastructure (e.g., API Gateway).
- **Incident**: The core event. Connects many-to-many with Services.
- **IncidentUpdate**: Relational comments (flagged boolean `isPublic`).
- **TimelineEvent**: An immutable audit log chronologically storing JSON metadata of every state machine transition.

---

## 4. WebSocket Flow & Cache Invalidation

SignalOps utilizes an event-driven architecture to keep public users updated without polling:
1. **Mutation**: A state change occurs via a secured REST endpoint.
2. **Transaction**: The PostgreSQL database commits the change via Prisma.
3. **Emit**: The backend Socket.IO singleton broadcasts a typed event (e.g., `incident:resolved`).
4. **Intercept**: The React frontend intercepts the WebSocket message.
5. **Invalidate**: TanStack React Query instantly updates its local cache and triggers a DOM re-render with zero additional HTTP requests.
