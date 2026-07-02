# Contributing

Thank you for taking an interest in BlackWater. This document describes how to set up a development environment, the conventions used throughout the codebase, and the process for submitting changes.

---

## Development Setup

### Prerequisites

- Node.js 20+
- PostgreSQL 16
- npm 10+

### Initial Setup

```bash
git clone https://github.com/Ayush-o1/BlackWater.git
cd BlackWater

# Backend
npm install
cp .env.example .env
# Fill in DATABASE_URL and JWT_SECRET in .env

npm run prisma:migrate
npm run prisma:seed
npm run dev

# Frontend (separate terminal)
cd frontend
npm install
npm run dev
```

---

## Repository Layout

```
BlackWater/
├── src/              # Backend — Express + Prisma
├── prisma/           # Schema, migrations, seed
├── frontend/src/     # Frontend — React + Vite
└── screenshots/      # UI screenshots (committed)
```

See the full annotated structure in [README.md](README.md#project-structure).

---

## Code Conventions

### TypeScript

- **Strict mode** is enabled for both the backend (`tsconfig.json`) and the frontend (`frontend/tsconfig.app.json`).
- No use of `any` where avoidable. Prefer Zod-inferred types on the backend, and Prisma-generated types for database models.
- Avoid magic strings; use Prisma-generated enums (`Role`, `IncidentStatus`, `Severity`, `ServiceStatus`).

### Backend

- **Module structure** — every feature in `src/modules/` follows: `*.routes.ts` → `*.controller.ts` → `*.service.ts` → `*.schemas.ts`.
- **Controllers are thin** — they call the service, format the response, and nothing else.
- **Database operations belong in services.** No raw Prisma calls in controllers or middleware.
- **Transactions** — use `prisma.$transaction()` any time multiple writes must succeed or fail together.
- **Engines run outside transactions** — `ServiceEngine` and `StatusEngine` always run after the transaction commits since they perform derived recalculations.
- **Errors** — throw `AppError` with an appropriate HTTP status code. Never use `res.status(500)` directly.
- **Async controllers** — wrap all async route handlers with `asyncHandler()`.

### Frontend

- **State separation** — Zustand for auth state, React Query for all server state. Do not mix them.
- **API layer** — all HTTP calls go through `src/api/` files. No `fetch`/`axios` calls inside components.
- **Hooks** — custom React Query hooks live in `src/hooks/queries.ts`. Socket subscriptions are in `useSocketSubscriptions.ts`.
- **UI primitives** — use components from `src/components/ui/` (Button, Input, Card, Badge, Modal, etc.) rather than inline Tailwind on shared patterns.

### Naming

| Context | Convention |
|---------|-----------|
| Files (backend) | `kebab-case` with role suffix: `incident.service.ts` |
| Files (frontend) | `PascalCase` for components, `camelCase` for hooks/utils |
| Variables & functions | `camelCase` |
| Classes | `PascalCase` |
| Constants | `UPPER_SNAKE_CASE` |
| Database enums | `UPPER_SNAKE_CASE` (Prisma convention) |

---

## Pull Request Process

1. **Branch naming** — `feat/<description>`, `fix/<description>`, `docs/<description>`, `chore/<description>`.

2. **Keep PRs focused** — one concern per pull request. Avoid bundling unrelated changes.

3. **Commits** — follow [Conventional Commits](https://www.conventionalcommits.org/):
   ```
   feat: add cursor pagination to incident list
   fix: correct CORS origin wildcard for production
   docs: update deployment guide with migrate:prod command
   chore: remove unused boilerplate assets
   ```

4. **Before opening a PR:**
   - Confirm the backend builds: `npm run build`
   - Confirm the frontend builds: `cd frontend && npm run build`
   - Confirm migrations run cleanly: `npm run prisma:migrate`
   - Verify there are no secrets, credentials, or personal data in staged files

5. **Environment files** — never commit `.env` or any file containing real credentials. Only `.env.example` is tracked.

---

## Reporting Issues

Open a GitHub Issue with:
- A clear description of the problem
- Steps to reproduce
- Expected vs. actual behaviour
- Node.js version, OS, and PostgreSQL version if relevant

---

## Security Issues

Do not open a public GitHub Issue for security vulnerabilities. See [SECURITY.md](SECURITY.md) for the disclosure process and a description of known limitations.
