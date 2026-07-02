# Testing

This document describes the test strategy for BlackWater, the areas of highest priority, and the commands used to run tests.

---

## Current Coverage

Automated tests are not yet part of this repository. Playwright is listed as a dev dependency in `frontend/package.json` but no test files exist. This is documented as a known gap — see [Technical Debt](#technical-debt).

---

## Unit Tests (Backend — Vitest or Jest)

The following are the highest-priority units to cover:

### `IncidentService.validateTransition()`

Verifies state machine correctness. Every valid and invalid transition must be tested:

| From | To | Expected |
|------|----|---------|
| `TRIGGERED` | `ACKNOWLEDGED` | ✅ allowed |
| `TRIGGERED` | `RESOLVED` | ✅ allowed |
| `TRIGGERED` | `CLOSED` | ❌ throws `AppError(400)` |
| `ACKNOWLEDGED` | `RESOLVED` | ✅ allowed |
| `ACKNOWLEDGED` | `TRIGGERED` | ✅ allowed (re-open) |
| `ACKNOWLEDGED` | `CLOSED` | ❌ throws `AppError(400)` |
| `RESOLVED` | `CLOSED` | ✅ allowed |
| `RESOLVED` | `TRIGGERED` | ✅ allowed (re-open) |
| `CLOSED` | `TRIGGERED` | ❌ throws `AppError(400)` |
| `CLOSED` | `ACKNOWLEDGED` | ❌ throws `AppError(400)` |

### `ServiceEngine.recalculateServiceStatus()`

Verifies the severity → service health mapping:

| Condition | Expected Status |
|-----------|----------------|
| No active incidents | `OPERATIONAL` |
| Active `LOW` incident | `DEGRADED` |
| Active `MEDIUM` incident | `DEGRADED` |
| Active `HIGH` incident | `PARTIAL_OUTAGE` |
| Active `CRITICAL` incident | `MAJOR_OUTAGE` |

### `StatusEngine.calculateOverallHealth()`

Verifies org-level health rollup:

| Service Statuses | Expected Overall |
|-----------------|-----------------|
| All `OPERATIONAL` | `OPERATIONAL` |
| Any `DEGRADED` | `DEGRADED` |
| Any `PARTIAL_OUTAGE` | `PARTIAL_OUTAGE` |
| Any `MAJOR_OUTAGE` | `MAJOR_OUTAGE` |
| No services | `OPERATIONAL` |

---

## Integration Tests (Supertest)

Route-level tests against a test database or mocked Prisma client:

**Auth:**
- `POST /auth/register` — success, duplicate email conflict (`409`)
- `POST /auth/login` — success, incorrect password (`401`), unknown email (`401`)

**Incidents:**
- `GET /incidents` — with and without filters, cursor pagination
- `POST /incidents` — success, Zod validation failure (`400`)
- `PATCH /incidents/:id/status` — valid transition, invalid transition, closed incident

**Services:**
- `POST /services` — success
- `DELETE /services/:id` — `ADMIN` succeeds, `MEMBER` receives `403`

**Public status:**
- `GET /status?orgId=` — confirm internal fields (`description`, `assigneeId`, `metadata`) are absent from response

**Authorization:**
- All protected routes return `401` without a token
- All MEMBER-only routes return `403` for `VIEWER`
- All ADMIN-only routes return `403` for `MEMBER`

---

## End-to-End Tests (Playwright)

Critical user flows to cover once E2E tests are introduced:

- Login and session persistence across page refresh
- Register a new organization
- Create an incident, assign it, advance through all status transitions, post an update
- Verify the public status page reflects the active incident
- Verify an internal (`isPublic: false`) update does not appear on the public page
- Verify a `CLOSED` incident cannot be modified

---

## Running Tests

```bash
# Backend unit/integration tests (once configured)
npm test

# Frontend E2E tests (Playwright)
cd frontend
npx playwright test
```

---

## Technical Debt

Automated test coverage is the most significant item of technical debt in this codebase. The architecture was designed with testability as a requirement — service classes have clear inputs and outputs, engine classes are pure functions against the database, and middleware is composable and isolated. Each layer can be tested independently with mocked dependencies.

**Recommended implementation order:**
1. Unit tests for `IncidentService.validateTransition()` — pure logic, no database dependency
2. Unit tests for `ServiceEngine` and `StatusEngine` — mock the Prisma client
3. Integration tests for auth and incident routes — use a dedicated test database with `prisma migrate reset`
4. End-to-end tests with Playwright for critical user flows
