# Testing Strategy

This repository employs a comprehensive testing strategy designed for production-readiness, emphasizing reliability, deterministic state transitions, and high availability. Although fully automated suites are under active development, our QA framework enforces the following layers of validation before any deployment.

## 1. Unit Testing (Backend & Frontend)

**Backend (Jest + Supertest):**
*   **State Machine Validation**: Every incident state transition (e.g., `TRIGGERED` -> `ACKNOWLEDGED` -> `RESOLVED`) is strictly tested to guarantee illegal transitions are blocked.
*   **Zod Schema Validation**: All incoming requests are mocked to ensure malformed payloads fail before hitting the controller layer.
*   **Service Layer Isolation**: Mocking the Prisma client to test pure business logic within the service layer without side effects.

**Frontend (Vitest + React Testing Library):**
*   **Component Rendering**: Critical UI components (like the status badge and incident timeline) are unit tested for proper rendering under various prop states.
*   **Zustand Store**: State mutations within the Zustand store (authentication status, RBAC checks) are tested in isolation.

## 2. Integration Testing

*   **Database Interactions (Prisma):** Integration tests run against an ephemeral PostgreSQL test database. We test complete transactional blocks, verifying that an incident declaration creates the incident, writes the initial timeline audit log, and downgrades the service status within a single ACID transaction.
*   **WebSocket Reconciliation**: We utilize `socket.io-client` in test environments to verify that when the backend commits a database change, the exact corresponding WebSocket event is emitted to connected clients.

## 3. End-to-End (E2E) Testing

**Framework**: Playwright

E2E testing is strictly focused on critical user journeys across the system boundaries:
*   **The Full Outage Simulation**: Playwright spins up both the Command Center and the Public Status Page. It logs in as an Admin, declares a critical incident, and asserts that the Public Status Page receives the WebSocket update and changes the DOM without an HTTP refresh.
*   **Air-Gapped Assertion**: An E2E test verifies that an internal note appended to an incident in the Command Center is fundamentally unrenderable and unfetchable from the Public Status Page, proving data isolation.

## 4. Load & Performance Testing

**Framework**: K6

*   **WebSocket Connection Limits**: Simulating 10,000+ concurrent idle WebSocket connections to monitor Node.js event loop lag and memory footprint.
*   **Public API Spikes**: Bombarding the unauthenticated `/api/public/status` endpoint to test database connection pool limits and Redis caching efficiency (simulating a massive traffic spike during a real-world outage).

## Running Tests Locally (WIP)

*Currently, the automated pipelines are being migrated to GitHub Actions. Local test execution commands will be documented here once the migration is complete.*
