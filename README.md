# SignalOps

[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-43853D?style=for-the-badge&logo=node.js&logoColor=white)](https://nodejs.org/)
[![React](https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)](https://reactjs.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-316192?style=for-the-badge&logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![Prisma](https://img.shields.io/badge/Prisma-3982CE?style=for-the-badge&logo=Prisma&logoColor=white)](https://www.prisma.io/)

## Hero Section
![SignalOps Overview](frontend/src/assets/hero.png)

## Project Overview
SignalOps is a highly responsive, real-time incident management platform. It bridges internal engineering workflows with unauthenticated public status reporting securely. Built entirely in TypeScript, it enforces deterministic service health states and strict data boundaries to guarantee synchronization between operational realities and customer transparency.

## Why This Project Exists
Internal engineering teams frequently experience a disconnect between resolving backend outages and updating customer-facing status pages. Manual synchronization introduces latency and human error. SignalOps eliminates this gap by binding the public status directly to the internal incident state machine, updating clients in real-time via WebSockets while strictly isolating sensitive operational data.

## Core Features
* **Deterministic Service Engine**: Automatically computes global infrastructure health without manual toggles.
* **Real-Time WebSockets**: Zero-latency DOM updates bypassing client-side HTTP polling.
* **Immutable State Machine**: Guarantees secure operational transitions across the incident lifecycle.
* **Transactional Audit Logging**: Native timeline metadata capture for every state mutation.
* **Data Air-Gapping**: Strict DTOs ensure internal metrics and developer comments never reach unauthenticated clients.

## Architecture
```text
 [ Public Viewer ]         [ Internal Engineer ]
        | (WebSockets)              | (JWT Auth)
+-------------------+       +-------------------+
| React Public View |       | React Admin Panel |
+-------------------+       +-------------------+
        |                           | (REST API)
        +------------+--------------+
                     |
         +-----------------------+
         |   Node.js & Express   |
         |  - Zod DTO Validation |
         |  - Socket.IO Emitter  |
         |  - ServiceEngine      |
         +-----------------------+
                     |
            +-----------------+
            |   PostgreSQL    |
            | (Prisma Engine) |
            +-----------------+
```

## Database Design
Structured via Prisma ORM for absolute type safety:
* `Organization`: Top-level multi-tenant container.
* `User`: Managed via Role-Based Access Control (Admin, Member, Viewer).
* `Service`: Represents underlying infrastructure layers (e.g., Database, API Gateway).
* `Incident`: Core entity connecting many-to-many with Services.
* `IncidentUpdate`: Relational comments constrained by an `isPublic` flag.
* `TimelineEvent`: Immutable chronological audit log storing JSON metadata of state changes.

## Real-Time Event Flow
1. **Mutation**: Authorized REST endpoint triggered by an Admin.
2. **Transaction**: PostgreSQL commits the state change via Prisma.
3. **Emit**: Socket.IO broadcasts a strongly-typed event to the public namespace.
4. **Intercept & Invalidate**: React frontend intercepts the WebSocket message, invalidates the specific TanStack Query cache, and triggers an instant DOM reconciliation.

## Authentication & RBAC
* **JWT Middleware**: Centralized Express middleware guards protected API routes.
* **Role Verification**: Enforced at the controller level utilizing O(1) checks against decoded JWT claims.
* **Stateless Authorization**: Sessionless JWT architecture ensures scalable, distributed authorization.

## Service Status Engine
The Node.js `ServiceEngine` natively aggregates underlying data. Whenever an incident is created, modified, or resolved, the Engine recalculates the affected Service's health by scanning the maximum severity of its active incidents. This transforms manual status updates into a completely deterministic computation.

## Public Status Page
The unauthenticated portal strictly consumes a Data Transfer Object (DTO) layer. The database queries inherently filter `isPublic: false` records, and the Zod schema validation explicitly strips system UUIDs, internal emails, and developer logs before serialization reaches the client layer.

## Technology Stack
* **Frontend**: React 18, Vite, TypeScript, Zustand, TanStack React Query, Tailwind CSS.
* **Backend**: Node.js, Express, TypeScript, PostgreSQL, Prisma, Zod, Socket.IO.

## Engineering Achievements
* Eliminated manual dashboard refresh workflows by migrating from REST polling to event-driven WebSocket updates, achieving near real-time state propagation.
* Automated service health computations through a severity-based status engine, removing manual status synchronization and operational overhead.
* Designed a transactional audit system guaranteeing timeline event creation for every incident mutation, achieving 100% traceability of operational changes.
* Developed a state-machine-driven incident lifecycle (`TRIGGERED` → `ACKNOWLEDGED` → `RESOLVED` → `CLOSED`), completely preventing invalid state mutations.
* Secured public API boundaries utilizing a strict DTO validation layer with Zod, preventing malformed requests from reaching business logic layers.

## Screenshots

### Registration Page
![Registration Page](frontend/src/assets/registration.png)

### Dashboard
![Dashboard](frontend/src/assets/dashboard.png)

### Incident Management
![Incident Management](frontend/src/assets/incident-management.png)

### Services
![Services](frontend/src/assets/services.png)

### Public Status Page
![Public Status Page](frontend/src/assets/public-status.png)

*(Note: Currently utilizing placeholder assets; ready to be replaced with final capture files)*

## Local Setup

```bash
# 1. Clone & Install
git clone https://github.com/Ayush-o1/statusDec.git
cd StatusDeck
npm install

# 2. Database Setup (Ensure Postgres is running)
cp .env.example .env
npx prisma migrate dev
npm run seed

# 3. Start Backend
npm run dev # Starts on Port 3000

# 4. Start Frontend
cd frontend
npm install
npm run dev # Starts on Port 5173
```

## Future Improvements
* Webhook integrations mapping critical incidents to Slack and PagerDuty endpoints.
* Event-Sourced analytics dashboard for calculating MTTA (Mean Time to Acknowledge) and MTTR (Mean Time to Resolve) metrics natively.
* Scalable subscription portal for external users to receive SMS/Email alerts partitioned by individual service dependencies.
