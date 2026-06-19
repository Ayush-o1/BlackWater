# Testing

This document describes the current state of testing in BlackWater and what a complete test suite would look like.

---

## Current State

> **There are currently no automated tests in this project.** Playwright is listed as a dev dependency in the frontend `package.json`, but no test files exist. This is a known gap.

---

## What Should Be Tested

### Unit Tests (Backend — Jest or Vitest)

**`IncidentService.validateTransition()`**  
This is the most important unit to test. It should verify:
- Valid transitions succeed (e.g., TRIGGERED → ACKNOWLEDGED)
- Invalid transitions throw an `AppError` with status 400 (e.g., CLOSED → anything)
- CLOSED is a terminal state

Example test cases:
```
TRIGGERED → ACKNOWLEDGED ✅
TRIGGERED → RESOLVED ✅
TRIGGERED → CLOSED ❌ should throw
ACKNOWLEDGED → RESOLVED ✅
ACKNOWLEDGED → TRIGGERED ✅ (re-open)
RESOLVED → CLOSED ✅
CLOSED → TRIGGERED ❌ should throw
CLOSED → ACKNOWLEDGED ❌ should throw
```

**`ServiceEngine.recalculateServiceStatus()`**  
Should verify the severity → status mapping:
```
No active incidents        → OPERATIONAL
Active LOW incident        → DEGRADED
Active MEDIUM incident     → DEGRADED
Active HIGH incident       → PARTIAL_OUTAGE
Active CRITICAL incident   → MAJOR_OUTAGE
```

**`StatusEngine.calculateOverallHealth()`**  
Should verify org-level health rollup from service statuses:
```
All OPERATIONAL            → OPERATIONAL
Any DEGRADED               → DEGRADED
Any PARTIAL_OUTAGE         → PARTIAL_OUTAGE
Any MAJOR_OUTAGE           → MAJOR_OUTAGE
No services                → OPERATIONAL
```

---

### Integration Tests (Supertest)

API routes should be tested with a real database (test database) or mocked Prisma client:

**Auth routes:**
- `POST /auth/register` — success, duplicate email
- `POST /auth/login` — success, wrong password, unknown email

**Incident routes:**
- `GET /incidents` — with and without filters, pagination
- `POST /incidents` — success, validation failure
- `PATCH /incidents/:id/status` — valid transition, invalid transition, closed incident

**Service routes:**
- `POST /services` — success
- `DELETE /services/:id` — ADMIN can delete, MEMBER cannot (403)

**Public status routes:**
- `GET /status?orgId=` — verify internal fields are stripped from response

---

### End-to-End Tests (Playwright)

The frontend already has Playwright as a dev dependency. E2E scenarios would include:

- Login flow
- Register a new organization
- Create an incident, assign it, change status, add an update
- Verify the public status page shows the incident
- Verify internal update does not appear on public page

---

## How to Run Tests (when implemented)

```bash
# Backend unit/integration tests
npm test

# Frontend E2E tests (Playwright)
cd frontend
npx playwright test
```

---

## Why There Are No Tests Currently

Testing was deliberately deferred to focus on building out the full feature set and architecture. The structure of the codebase (service classes with clear input/output, pure engine classes, separated middleware) was designed with testability in mind — each class can be tested in isolation with mocked dependencies.

The most valuable next step is to add unit tests for `validateTransition` and `ServiceEngine` since those contain the critical business logic.
