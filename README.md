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

## What Is This?

BlackWater lets engineering teams **declare, track, and resolve infrastructure incidents** through a private dashboard, while automatically keeping customers informed through a **public-facing status page** — all updated in real time over WebSockets without polling.

---

## What It Does (Concisely)

1. **Engineers log in** to a private dashboard (JWT-protected).
2. **Incidents are declared** with a severity level and linked to affected services.
3. **Incidents follow a state machine**: `TRIGGERED → ACKNOWLEDGED → RESOLVED → CLOSED`.
4. When an incident's status changes, a **ServiceEngine** automatically recalculates and updates the health status of every affected service.
5. A **public status page** (`/status/:orgId`) shows customers real-time service health and public incident updates — no login required.
6. All status changes are broadcast over **Socket.IO** so both the internal dashboard and public page update live without a page refresh.
7. Internal notes posted by engineers are **never exposed** to the public page — a DTO layer strips them at the service boundary.

---

## Screenshots

**Internal Dashboard (Command Center)**

![Dashboard](docs/images/blackwater_command_center_1781353830033.png)

**Public Status Page**

![Public Status Page](docs/images/blackwater_status_page_1781353818129.png)

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
| React 19 + Vite 8 | SPA framework and build tool |
| TypeScript | Type safety |
| Tailwind CSS v4 | Styling |
| Zustand v5 | Auth state (persisted to localStorage) |
| TanStack React Query v5 | Server-state fetching and caching |
| Socket.IO Client v4 | Real-time event subscriptions |
| Axios | HTTP client with auth interceptors |
| Lucide React | Icon library |
| React Hot Toast | Toast notifications |

---

## System Architecture (Overview)

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
3. **Engine** — recalculates derived state (service health) after the transaction

---

## Folder Structure

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
│   ├── modules/                # Feature modules (each has controller/service/routes/schemas)
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
│       ├── response.ts         # Standardized API response helpers
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
├── .env.example                # Template for required environment variables
├── package.json                # Backend dependencies and scripts
└── tsconfig.json               # TypeScript compiler config
```

---

## API Endpoints

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
| `GET` | `/users` | Yes | List users in organization |
| `GET` | `/users/me` | Yes | Current user |
| `PATCH` | `/users/me` | Yes | Update own profile |
| `GET` | `/organizations/me` | Yes | Organization details |
| `PATCH` | `/organizations/me` | ADMIN | Update org name |
| `GET` | `/status?orgId=` | No | Public status overview |
| `GET` | `/status/services?orgId=` | No | Public service health list |
| `GET` | `/status/incidents?orgId=` | No | Public incident list |
| `GET` | `/status/incidents/:id?orgId=` | No | Public incident detail |
| `GET` | `/health` | No | Health check |

---

## Local Development Setup

**Prerequisites:** Node.js 20+, PostgreSQL running locally.

```bash
# 1. Clone and install backend dependencies
git clone https://github.com/Ayush-o1/BlackWater.git
cd BlackWater
npm install

# 2. Set up environment variables
cp .env.example .env
# Edit .env — set DATABASE_URL and JWT_SECRET at minimum

# 3. Run database migrations
npx prisma migrate dev

# 4. Seed demo data
npx prisma db seed

# 5. Start the backend dev server (port 8000)
npm run dev

# 6. In a separate terminal, start the frontend (port 5173)
cd frontend
npm install
npm run dev
```

**Demo accounts (after seeding):**
| Email | Password | Role |
|-------|----------|------|
| `admin@BlackWater.com` | `password123` | ADMIN |
| `bob@BlackWater.com` | `password123` | MEMBER |

The public status page runs at `http://localhost:5173/status/<orgId>` — the `orgId` is printed to the console after seeding.

---

## Environment Variables

```bash
# Required
DATABASE_URL="postgresql://user:password@localhost:5432/blackwater?schema=public"
JWT_SECRET="your_signing_secret_min_32_chars"

# Optional (defaults shown)
PORT=8000
NODE_ENV=development
JWT_EXPIRES_IN=1d
```

> The server validates all env vars at startup using a Zod schema in `src/config/env.ts`. If any required variable is missing, the process exits immediately with a clear error message.

---

## Documentation Index

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
