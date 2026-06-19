# BlackWater

**A full-stack incident management system with a real-time public status page.**

![TypeScript](https://img.shields.io/badge/typescript-%23007ACC.svg?style=for-the-badge&logo=typescript&logoColor=white)
![React](https://img.shields.io/badge/react-%2320232a.svg?style=for-the-badge&logo=react&logoColor=%2361DAFB)
![NodeJS](https://img.shields.io/badge/node.js-6DA55F?style=for-the-badge&logo=node.js&logoColor=white)
![Express.js](https://img.shields.io/badge/express.js-%23404d59.svg?style=for-the-badge&logo=express&logoColor=%2361DAFB)
![Postgres](https://img.shields.io/badge/postgres-%23316192.svg?style=for-the-badge&logo=postgresql&logoColor=white)
![Prisma](https://img.shields.io/badge/Prisma-3982CE?style=for-the-badge&logo=Prisma&logoColor=white)
![Socket.io](https://img.shields.io/badge/Socket.io-black?style=for-the-badge&logo=socket.io&badgeColor=010101)

---

## Overview

BlackWater lets engineering teams **declare, track, and resolve infrastructure incidents** through a private dashboard, while automatically keeping customers informed through a **public-facing status page** — all updated in real time over WebSockets.

Key behaviours:
1. **Engineers log in** to a JWT-protected private dashboard.
2. **Incidents are declared** with a severity level and linked to affected services.
3. **Incidents follow a strict state machine**: `TRIGGERED → ACKNOWLEDGED → RESOLVED → CLOSED`.
4. When an incident's status changes, a **ServiceEngine** automatically recalculates and updates the health of every affected service — no manual status updates needed.
5. A **public status page** (`/status/:orgId`) shows customers real-time service health and incident updates — no login required.
6. All status changes are broadcast over **Socket.IO** so both the internal dashboard and the public page update live without a page refresh.
7. Internal engineer notes are **never exposed** to the public — a DTO layer strips them at the service boundary.

---

## Screenshots

**Login**

![Login](screenshots/01_login.png)

**Dashboard**

![Dashboard](screenshots/02_dashboard.png)

**Incident List**

![Incident List](screenshots/03_incident_list.png)

**Incident Details & Timeline**

![Incident Details](screenshots/04_incident_details.png)

**Services**

![Services](screenshots/05_service_list.png)

**Public Status Page**

![Public Status Page](screenshots/07_public_status_page.png)

**Public Incident Detail**

![Public Incident Detail](screenshots/08_public_incident_detail.png)

**Settings**

![Settings](screenshots/09_settings.png)

---

## Tech Stack

### Backend
| Tool | Purpose |
|------|---------|
| Node.js + Express.js | REST API server |
| TypeScript | Type safety across the codebase |
| Prisma ORM v5 | Database access and migrations |
| PostgreSQL | Primary relational database |
| Socket.IO v4 | WebSocket-based real-time events |
| Zod v3 | Runtime request validation |
| bcrypt | Password hashing (salt rounds = 10) |
| jsonwebtoken | JWT signing and verification |
| Helmet.js | HTTP security headers |

### Frontend
| Tool | Purpose |
|------|---------|
| React 19 + Vite | SPA framework and build tool |
| TypeScript | Type safety |
| Tailwind CSS v4 | Styling |
| Zustand v5 | Auth state (persisted to localStorage) |
| TanStack React Query v5 | Server-state fetching and caching |
| Socket.IO Client v4 | Real-time event subscriptions |
| Axios | HTTP client with auth interceptors |
| Lucide React | Icon library |
| React Hot Toast | Toast notifications |

---

## Architecture

```
┌─────────────────────────────────────────┐
│            React SPA (Vite)             │
│  Zustand (auth state + localStorage)    │
│  React Query (server state + caching)   │
│  Socket.IO Client (real-time events)    │
└────────────┬──────────────┬─────────────┘
             │ REST (JWT)   │ WebSocket
             ▼              ▼
┌─────────────────────────────────────────┐
│          Express.js API Server          │
│  requireAuth → requireRole → Zod        │
│  Controller → Service → Engine          │
│  SocketEmitter (singleton)              │
└─────────────────┬───────────────────────┘
                  │ Prisma Client
                  ▼
┌─────────────────────────────────────────┐
│              PostgreSQL                 │
│  9 models, UUID PKs, indexed queries    │
└─────────────────────────────────────────┘
```

Every incident mutation goes through a 3-layer pipeline:
1. **Controller** — parses and validates the HTTP request
2. **Service** — runs business logic inside a Prisma transaction
3. **Engine** — recalculates derived state (service health) after the transaction commits

---

## Project Structure

```
BlackWater/
├── src/                        # Backend source (Node.js + Express)
│   ├── server.ts               # Entry point: DB connect, HTTP + Socket.IO start
│   ├── app.ts                  # Express app: middleware, route mounting
│   ├── config/
│   │   └── env.ts              # Zod-validated environment config (fails fast on bad env)
│   ├── middleware/
│   │   ├── auth.middleware.ts  # JWT verification, attaches user to req
│   │   ├── rbac.middleware.ts  # Role-based access control guard
│   │   ├── validate.middleware.ts  # Zod request validation
│   │   └── error.middleware.ts # Global error handler
│   ├── modules/                # Feature modules (controller / service / routes / schemas)
│   │   ├── auth/               # Register, login, get current user
│   │   ├── incidents/          # Incident CRUD, status machine, updates
│   │   ├── services/           # Service CRUD + ServiceEngine
│   │   ├── status/             # Public status page API (no auth)
│   │   ├── users/              # List users, update profile
│   │   └── organizations/      # Org details, update org name
│   ├── socket/
│   │   ├── socket.server.ts    # Socket.IO init, room management
│   │   ├── socket.emitter.ts   # Singleton emitter used by services
│   │   ├── socket.auth.ts      # JWT auth middleware for WebSocket connections
│   │   └── socket.types.ts     # TypeScript event type definitions
│   ├── prisma/
│   │   └── client.ts           # Singleton Prisma client instance
│   └── utils/
│       ├── jwt.ts              # generateToken / verifyToken helpers
│       ├── response.ts         # Standardised API response helpers
│       └── errors/
│           ├── AppError.ts     # Custom error class with statusCode
│           └── asyncHandler.ts # try/catch wrapper for async controllers
├── prisma/
│   ├── schema.prisma           # Database schema (9 models, 7 enums)
│   ├── seed.ts                 # Demo data seeder
│   └── migrations/             # Auto-generated migration history
├── frontend/                   # Frontend source (React + Vite)
│   └── src/
│       ├── App.tsx             # Route definitions (public + protected)
│       ├── api/                # Axios API client functions per module
│       ├── hooks/
│       │   ├── queries.ts      # All React Query hooks
│       │   └── useSocketSubscriptions.ts  # Socket event → cache invalidation
│       ├── store/
│       │   └── useAuthStore.ts # Zustand auth store (persisted)
│       ├── pages/              # Page-level components
│       ├── components/         # Reusable UI components
│       └── types/              # Shared TypeScript interfaces
├── screenshots/                # UI screenshots
├── .env.example                # Template for required environment variables
├── package.json                # Backend dependencies and scripts
└── tsconfig.json               # TypeScript compiler config
```

---

## Local Development Setup

**Prerequisites:** Node.js 20+, PostgreSQL running locally.

```bash
# 1. Clone the repository
git clone https://github.com/Ayush-o1/BlackWater.git
cd BlackWater

# 2. Install backend dependencies
npm install

# 3. Set up environment variables
cp .env.example .env
# Edit .env — set DATABASE_URL to your local Postgres connection string
# and generate a strong JWT_SECRET (see .env.example for instructions)

# 4. Run database migrations
npx prisma migrate dev

# 5. Seed demo data
npx prisma db seed

# 6. Start the backend dev server (port 8000)
npm run dev

# 7. In a separate terminal, start the frontend (port 5173)
cd frontend
npm install
npm run dev
```

**Demo accounts (after seeding):**
| Email | Password | Role |
|-------|----------|------|
| `admin@BlackWater.com` | `password123` | ADMIN |
| `bob@BlackWater.com` | `password123` | MEMBER |

The public status page is available at `http://localhost:5173/status/<orgId>` — the `orgId` is printed to the console after seeding.

---

## Environment Variables

Backend (`.env`):

```bash
# Required
DATABASE_URL="postgresql://user:password@localhost:5432/blackwater?schema=public"
JWT_SECRET="your_signing_secret_min_32_chars"

# Optional (defaults shown)
PORT=8000
NODE_ENV=development
JWT_EXPIRES_IN=1d
```

Frontend (`frontend/.env`):

```bash
# Optional — defaults to http://localhost:8000 if not set
VITE_API_URL=http://localhost:8000
```

> All backend env vars are validated at startup via Zod in `src/config/env.ts`. If any required variable is missing, the process exits immediately with a clear error message.

---

## API Overview

All authenticated routes require `Authorization: Bearer <token>` in the header.

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| `POST` | `/auth/register` | No | Create org + first admin user |
| `POST` | `/auth/login` | No | Login, returns JWT |
| `GET` | `/auth/me` | Yes | Current user profile |
| `GET` | `/incidents` | VIEWER+ | List incidents (filterable, cursor-paginated) |
| `POST` | `/incidents` | MEMBER+ | Create incident |
| `GET` | `/incidents/:id` | VIEWER+ | Incident detail with timeline + updates |
| `PATCH` | `/incidents/:id/status` | MEMBER+ | Change incident status (state machine) |
| `PATCH` | `/incidents/:id/assign` | MEMBER+ | Assign incident to a user |
| `POST` | `/incidents/:id/updates` | MEMBER+ | Add internal or public update |
| `GET` | `/services` | VIEWER+ | List services (cursor-paginated) |
| `POST` | `/services` | MEMBER+ | Create service |
| `GET` | `/services/:id` | VIEWER+ | Service detail + 10 most recent incidents |
| `PATCH` | `/services/:id` | MEMBER+ | Update name/description |
| `DELETE` | `/services/:id` | ADMIN | Delete service |
| `GET` | `/users` | Yes | List users in organisation |
| `GET` | `/users/me` | Yes | Current user |
| `PATCH` | `/users/me` | Yes | Update own profile |
| `GET` | `/organizations/me` | Yes | Organisation details |
| `PATCH` | `/organizations/me` | ADMIN | Update org name |
| `GET` | `/status?orgId=` | No | Public status overview |
| `GET` | `/status/services?orgId=` | No | Public service health list |
| `GET` | `/status/incidents?orgId=` | No | Public incident list |
| `GET` | `/status/incidents/:id?orgId=` | No | Public incident detail |
| `GET` | `/health` | No | Health check |

Full request/response examples are in [API_DOCS.md](API_DOCS.md).

---

## Database

PostgreSQL with Prisma ORM. 9 models: `Organization`, `User`, `Service`, `Incident`, `IncidentUpdate`, `TimelineEvent`, `OnCallSchedule`, `OnCallMember`, `NotificationLog`.

Full schema reference: [DATABASE.md](DATABASE.md)

---

## Documentation

| File | Contents |
|------|---------|
| [ARCHITECTURE.md](ARCHITECTURE.md) | Backend architecture, request lifecycle, state machine, socket design |
| [DATABASE.md](DATABASE.md) | Schema reference, all 9 models, indexes, relationships |
| [API_DOCS.md](API_DOCS.md) | Request/response examples for every endpoint |
| [FRONTEND_ARCHITECTURE.md](FRONTEND_ARCHITECTURE.md) | React app structure, state management, real-time strategy |
| [SECURITY.md](SECURITY.md) | Authentication, RBAC, known limitations |
| [TESTING.md](TESTING.md) | Test coverage status and planned test suite |
| [OBSERVABILITY.md](OBSERVABILITY.md) | Health check, logging, error response format |
| [DEPLOYMENT.md](DEPLOYMENT.md) | Build and deployment instructions |

---

## License

MIT
