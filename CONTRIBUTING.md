# Contributing

## Setup

Follow the quick start in the [README](README.md), then create a **separate** database for tests:

```bash
createdb blackwater_test
cp .env.test.example .env.test     # point DATABASE_URL at blackwater_test
```

> The test suite deletes every row in the database named by `.env.test`. Never point it at data you care about.

## Running the tests

| Command | What it runs |
|---|---|
| `npm test` | Applies migrations to the test database, then all unit and integration tests (Vitest and Supertest, against real PostgreSQL) |
| `npm run test:watch` | The same, re-running on change |
| `npm run test:coverage` | With a coverage report |
| `npm run test:e2e` | Browser tests: starts the app against the test database and drives the real interface with Playwright. First run: `npx playwright install chromium` |
| `SMOKE_URL=https://... npm run smoke` | The main workflows driven through the real interface of an already running deployment. Not part of `npm test`; it creates data, so use it on a deployment where that is acceptable |
| `npm run lint` | ESLint over the whole repository |

The tests cover, among other things: authentication and token handling; role permissions on every route; isolation between organizations; the incident lifecycle including concurrent changes; the audit timeline and its actors; service health; private incidents never reaching the public API; invitations (single use, expiry, races, roles); the last-administrator rule; pagination; Socket.IO authentication and tenancy; the page routes and security headers; and, in the browser, the complete incident workflow, rendering of hostile text, live updates reaching other signed-in sessions (and never another organization's), keyboard-only use of dialogs, and a crawl of every page that fails on any console error or failed request.

CI runs the backend suite on the minimum supported Node.js (20.19) as well as on 22, runs the browser suite, and builds the Docker image and starts it against an empty database.

Integration tests share one database and run one file at a time. Each test starts from an empty database, so tests create what they need with the helpers in `tests/helpers/factories.js`.

## Conventions

- **Plain JavaScript, ES modules.** No TypeScript, no framework, no build step.
- **Keep the layers.** Routes wire URLs to middleware and controllers; controllers touch only `req` and `res`; services hold the rules and all database access; validators describe input. Do not put business rules in controllers or database queries in routes.
- **Tenant filter on every query.** Take `orgId` from `req.user`, never from the request, and put it in the `where`.
- **Writes that must go together belong in one transaction**, and socket events are emitted after it commits.
- **Comments explain why**, not what: the business rule, the security reason or the concurrency hazard behind a line that looks odd. Do not narrate code.
- **No `innerHTML` in `public/`.** Build elements with `h()` so user text stays text.
- **Add dependencies only with a clear need.**
- A change to behaviour needs a test that fails without it.

## Changing the database

1. Edit `prisma/schema.prisma`.
2. `npm run prisma:migrate` to create and apply a migration (use `-- --create-only` to edit the SQL first for data fixes or constraints).
3. Never edit a migration that has been applied; add a new one.
4. Commit schema and migration together. See [docs/database.md](docs/database.md).

## Pull requests

Keep each pull request to one concern. Before opening one, run `npm run lint`, `npm test` and `npm run test:e2e`; CI runs the same. Describe what changed and why, and mention anything you could not verify.
