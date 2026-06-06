# SignalOps

[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-43853D?style=for-the-badge&logo=node.js&logoColor=white)](https://nodejs.org/)
[![React](https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)](https://reactjs.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-316192?style=for-the-badge&logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![Prisma](https://img.shields.io/badge/Prisma-3982CE?style=for-the-badge&logo=Prisma&logoColor=white)](https://www.prisma.io/)

## Project Overview
SignalOps is a highly scalable, real-time incident management and system status platform. Engineered to bridge the gap between internal infrastructure monitoring and customer-facing transparency, SignalOps guarantees real-time synchronization between engineering actions and public status dashboards without latency or manual page refreshes.

## Architecture Diagram
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

## Features
* **Zero-Latency Dashboard**: WebSocket integration ensures public dashboards update instantly.
* **Deterministic Service Health**: An automated, severity-based status engine computes global infrastructure health.
* **Immutable State Machine**: Guarantees secure operational transitions (Triggered → Acknowledged → Resolved → Closed).
* **100% Traceability**: Transactional audit system natively captures timeline metadata for every mutation.
* **Isolated Data Boundaries**: Internal notes and metrics are securely air-gapped from the public endpoints via strict DTO validation.

## Tech Stack
* **Backend**: Node.js, Express, TypeScript, PostgreSQL, Prisma Client, Zod, Socket.IO, bcrypt, jsonwebtoken.
* **Frontend**: React 18, Vite, TypeScript, Zustand, TanStack React Query, Tailwind CSS.

## Database Design
* `Organization`: Top-level multi-tenant architecture.
* `User`: JWT-managed roles ensuring Role-Based Access Control.
* `Service`: Represents underlying infrastructure layers.
* `Incident`: Connects to affected Services.
* `IncidentUpdate`: Threaded communication log with `isPublic` flag toggles.
* `TimelineEvent`: Immutable audit log of all system transitions.

## Real-Time WebSocket Features
When an incident mutates, the database transaction resolves, and the backend Socket.IO singleton immediately broadcasts a serialized event to public namespaces. The frontend React Query cache intercepts this WebSocket event, invalidating stale data and triggering an instant DOM re-render, effectively eliminating manual client-side polling.

## Authentication & RBAC
A centralized Express middleware layer enforces JWT verification and strict Role-Based Access Control (Admin, Member, Viewer). This ensures that only authorized engineers can trigger mutations, while viewers are restricted to read-only endpoints.

## Public Status Page
The customer-facing portal is designed as an unauthenticated React application. It safely exposes incident severities and operational health while utilizing the Zod schema validation layer to guarantee that internal operational metadata (e.g., system UUIDs, developer comments) never reaches the client browser.

## Screenshots

### Registration Page
![Registration Page](/frontend/src/assets/hero.png)

### Dashboard
![Dashboard](/frontend/src/assets/hero.png)

### Incident Management
![Incident Management](/frontend/src/assets/hero.png)

### Services
![Services](/frontend/src/assets/hero.png)

### Public Status Page
![Public Status Page](/frontend/src/assets/hero.png)

*(Note: Placeholder image used as screenshot assets are pending upload)*

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
* Webhook integrations for Slack and PagerDuty.
* Advanced analytics dashboard for MTTA (Mean Time to Acknowledge) and MTTR (Mean Time to Resolve) metrics.
* Subscription portal for external users to receive SMS/Email alerts on specific service outages.
