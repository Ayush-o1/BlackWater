# Testing

This document describes the test suite, how to run it, and what's still a known gap.

---

## Current Coverage

Backend: **76 tests** (Vitest) covering unit logic and full HTTP integration flows against a real Postgres test database — **73.9% statement coverage** (`npm run test:coverage`). Frontend: **9 Playwright end-to-end tests** driving the actual app (real backend + real dev server) through the flows a user or an interview panel would actually try.

CI (`.github/workflows/ci.yml`) runs all of it — backend tests, frontend build, and the E2E suite — on every push and pull request to `main`.

---

## Unit Tests (Backend — Vitest)

`tests/unit/`

### `IncidentService.validateTransition()` — `incident-transitions.test.ts`

Every legal and illegal state transition, plus the specific 400 message shape:

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
| `CLOSED` | anything | ❌ throws `AppError(400)` |

The method is private, so the test reaches past TypeScript's privacy check (`(IncidentService as any).validateTransition(...)`) to call it directly — it's pure state-machine logic with no I/O, so there's no reason to drive it through a live HTTP+DB round trip just to satisfy the compiler.

### `ServiceEngine.recalculateServiceStatus()` — `service-engine.test.ts`

Prisma is mocked (`vi.mock('../../src/prisma/client', ...)`) so this tests the severity → health mapping in isolation, including the "worst active severity wins" case with multiple concurrent incidents, and the no-op path when the computed status matches the current one:

| Active severities | Expected status |
|---|---|
| none | `OPERATIONAL` |
| `LOW` | `DEGRADED` |
| `MEDIUM` | `DEGRADED` |
| `HIGH` | `PARTIAL_OUTAGE` |
| `CRITICAL` | `MAJOR_OUTAGE` |
| mixed (e.g. `LOW` + `CRITICAL`) | worst wins → `MAJOR_OUTAGE` |

### `StatusEngine.calculateOverallHealth()` — `status-engine.test.ts`

Same mocked-Prisma approach for the org-level health rollup (no services → `OPERATIONAL`, worst service status wins regardless of ordering).

---

## Integration Tests (Backend — Vitest + Supertest)

`tests/integration/` — real HTTP requests against the actual Express `app` (via `supertest`), hitting a real, disposable Postgres database (`blackwater_test`). `tests/helpers/db.ts` resets state between tests by deleting all `Organization` rows, which cascades everywhere *except* `IncidentUpdate.userId` (that FK is `onDelete: Restrict`, so it's cleared explicitly first).

- **`auth.test.ts`** — register (success, duplicate email → 409, invalid payload → 400), login (success, wrong password / unknown email both → 401 with the same generic message), `GET /auth/me` (401 without a token, 401 on a malformed header).
- **`incidents.test.ts`** — create (with service linking, cross-org service rejection, VIEWER → 403), list (org-scoped, filtered by severity), get (404 across orgs), status transitions (valid, invalid, blocked once `CLOSED`, triggers `ServiceEngine` recalculation), assign (cross-org assignee rejected), updates (internal + public, empty message rejected).
- **`services.test.ts`** — create, org-scoped list, delete (`ADMIN` succeeds, `MEMBER` → 403, cross-org → 404).
- **`status.test.ts`** — the public, unauthenticated endpoints: overview health rollup, confirms `description`/`creatorId`/`assigneeId` never appear on public incidents, unknown org → 404, and confirms a non-public (`isPublic: false`) update never reaches the public incident-detail response while its metadata-stripped timeline still does.
- **`authorization.test.ts`** — a sweep of every protected route without a token (401), `VIEWER` blocked from every write endpoint but not reads, a forged/garbage JWT (401), and a token naming a user who's since been deleted (the middleware re-fetches the user on every request — see `SECURITY.md` — so this correctly 404s rather than silently succeeding).
- **`users-and-organizations.test.ts`** — org-scoped user listing, profile updates, org rename gated to `ADMIN`.

---

## End-to-End Tests (Frontend — Playwright)

`frontend/e2e/critical-flows.spec.ts`, config in `frontend/playwright.config.ts`. Runs the real Vite dev server against the real backend (`ts-node-dev`) on the same `blackwater_test` database and `.env.test` the backend integration tests use. Every test registers its own organization through the UI, so nothing depends on — or collides with — another run's leftover data.

- Register → land on the dashboard → session survives a hard refresh.
- Log out, log back in with the same credentials.
- Wrong password shows a visible, generic error.
- Declare an incident through the modal, assign it to yourself, walk it through every status transition, post both an internal note and a public update.
- The public status page reflects the incident and never leaks the internal note.
- Close the incident (there's no UI action for `RESOLVED → CLOSED` today, so this step goes through the API directly, the same way an external integration would) and confirm the details page removes every mutating control — "Reopen," "Assign to Me," and the update form all disappear once an incident is `CLOSED`.

That last check exists because writing it caught a real bug: `IncidentDetails.tsx` used to render "Reopen," "Assign to Me," and the update form unconditionally, so a closed incident let you click controls that the backend would always reject with a 400. Fixed in the same change that added the test.

---

## Running Tests

```bash
# Backend unit + integration tests (spins up against blackwater_test via .env.test)
cp .env.test.example .env.test   # first time only — point DATABASE_URL at a disposable database
npm test

# Backend coverage report
npm run test:coverage

# Frontend E2E (starts both dev servers automatically)
cd frontend
npx playwright install chromium   # first time only
npm run test:e2e
```

---

## Technical Debt

- **Coverage is concentrated where it matters most, not uniform.** Auth, incidents, and the state-machine/health engines are well covered (88–97%); `socket.server.ts` / `socket.auth.ts` are near-0% (Socket.IO connection handling isn't exercised by either suite — it would need a real socket client in the integration tests, which wasn't in scope for this pass) and `asyncHandler.ts` is dead code with 0% coverage (see `FRONTEND_ARCHITECTURE.md`-adjacent note in the codebase: it's defined but never actually wired into any controller — all of them use manual `try/catch`).
- **The frontend has 36 pre-existing `@typescript-eslint/no-explicit-any` lint errors** across the API/hooks/pages layer (`npm run lint` inside `frontend/`). None of them are new — they predate this test pass — and fixing them properly means introducing a real shared type layer for API responses (there currently isn't one), which is a distinct, larger piece of work than adding tests. `npm run lint` is intentionally **not** part of `ci.yml` yet for this reason; it should be added once that cleanup happens, so CI doesn't go red on unrelated pre-existing debt.
- **E2E covers the critical path, not every screen.** Settings, service CRUD, and the admin status page have backend integration coverage but no dedicated E2E flow yet.
