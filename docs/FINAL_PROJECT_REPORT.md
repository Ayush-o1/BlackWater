# BlackWater: final project report

Date: 2026-11-07. Covers the audit and release work recorded in
[FINAL_COMPLETION_TRACKER.md](FINAL_COMPLETION_TRACKER.md); findings F1–F17 are described
in [audit/INITIAL_AUDIT.md](audit/INITIAL_AUDIT.md). Every result below was observed;
anything not verified is listed in section 10.

**Summary.** `main` was verified end to end at commit `dc13db1` (CI in three browser
engines, the production image, and the live deployment, which reported that commit and
passed the browser smoke journey). The last pull request (#7) adds this report, a CI
reliability change (browsers run in Playwright's image instead of being installed with apt), and a final frontend fix found by its own CI run (F16 on the
settings page and error states); its CI and production results are in its description.
The project is code-complete and production-verified, with the limitations in section 10.

## 1. Final architecture

One Node.js 22 process (Express 4) serves the web pages, the JSON API under `/api` and
Socket.IO, backed by PostgreSQL 16 through Prisma 5.

- **Request path:** rate limit → JWT authentication (user reloaded from the database on
  every request) → role check → zod validation (replaces raw input) → thin controller →
  service (business rules, all database access, `orgId` in every query) → one error handler.
- **Incident changes** lock the row (`SELECT … FOR UPDATE`), check the lifecycle table, and
  write the audit event in the same transaction; socket events are emitted after commit.
- **Service health** is derived from open incidents on every read, never stored.
- **Real-time** is a doorbell: events carry ids only, each organization has one room, and
  pages refetch through the API. Pages refetch once on every connection and skip repainting
  when the data is unchanged.
- **Public status page:** published incidents only, allow-listed fields, health from
  published incidents only.
- **Frontend:** plain HTML, CSS and ES modules, no build step, no `innerHTML`, strict CSP.
- **Deployment:** one Docker container (migrations on start) plus PostgreSQL; Render.

## 2. Features verified

| Feature | Evidence |
|---|---|
| Registration, login, sessions, sign-out, expired-session handling | integration tests; browser tests in 3 engines; live smoke journey |
| Roles (admin, member, viewer) enforced on every route | `authorization`, `roles`, `incidents`, `services` tests |
| Invitations: one-time, 7-day expiry, cannot grant admin, race-safe | `invitations` tests; browser test; live smoke journey |
| Multi-tenant isolation (every id-addressed endpoint, lists, sockets) | `isolation`, `socket` tests; cross-org browser tests; probes (Phase 2) |
| Incident lifecycle incl. reopen, close, concurrent changes | `incidents` tests (39); browser tests; live smoke journey |
| Audit trail with actors, no entries for no-op changes | `incidents`, `errors` tests; live smoke journey |
| Internal notes vs public updates; publish/unpublish | `status`, `exposure` tests; live smoke journey |
| Derived service health, internal vs public | `services`, `status` tests; visual check |
| Live updates across sessions, never across organizations | browser tests; real server-restart script (Phase 5) |
| Organization deletion (password + exact name), live sessions cut | `organization-deletion` tests; browser tests |
| Public status page and incident page, paging | `status` tests; browser tests |
| Responsive layout 360–1920 px | browser test at 8 widths × 8 pages |

## 3. Bugs found and fixed

| # | Problem | Fix | Regression evidence |
|---|---|---|---|
| F1 | WebKit page errors when leaving a page mid-request; radio arrow keys failed in Linux WebKit (PR #5 CI red) | page aborts its own requests on `pagehide`; `:focus-within` ring | WebKit passes in CI and locally |
| F2 | Intermittent Firefox navigation hangs in tests | Playwright 1.62 → 1.65 | same code, retries off: 3/80 failed on 1.62, 0/80 on 1.65 |
| F5 | Live indicator said "Reconnecting" forever after the server closed the socket on purpose | treat `io server disconnect` as Offline | browser test, fails without the fix |
| F6 | Exit code 0 after an uncaught exception; repeated signals ran shutdown twice | exit 1 on crash; idempotent shutdown | real-signal test (SIGTERM ×2 → one shutdown, exit 0 in 10 ms) |
| F14 | Renames were not announced to open pages | emit `team:changed` | integration test, fails without the fix |
| F15 | Smoke journey broken by the redesign; CI only listed it, so production deploys would have been marked failed | accessible-name locator; CI runs the journey against the built image | CI image job |
| F16 | Live refreshes rebuilt unchanged pages: focus lost while typing an update, clicks during a rebuild lost (incident, list, overview, service and settings pages), and a repeated failure re-rendered the error over its own Try again button | skip repaints when data, or the failure, is unchanged; composer attached once; focus restored | two browser tests, each fails without the fix |
| F17 | `npm run prisma:seed` failed on a fresh clone (`.env` not loaded) | seed loads `.env` | CI step runs the seed from a plain `.env` |
| — | Smoke journey counted deliberately aborted requests as failures over a real network (production run of `6ec5f38` marked failed) | ignore aborted/cancelled requests; report others with reason | passed against the live site, then in `production.yml` |
| — | Lifecycle stepper wrapped badly on phones | spaced steps on narrow screens | visual check |
| — | Three test-only races in WebKit CI (axe measured a fading menu; aborted requests counted; a retry test raced the page's own recovery) | wait for animations; ignore aborted requests; isolate the retry test from live refresh | 20/20, 10/10 and 30/30 under repetition |

## 4. Testing results

All on Node.js 24 locally (macOS, PostgreSQL 18) unless stated; retries disabled locally.

| Suite | Command | Result |
|---|---|---|
| Lint | `npm run lint` | 0 problems |
| Unit + integration | `npm test` | 27 files, 253 tests, all passed |
| Browser, Chromium | `CI=1 npx playwright test --project=chromium` | 42/42 |
| Browser, WebKit | Linux container `playwright:v1.65.0-noble`, Postgres 16 | 42/42 |
| Browser, Firefox | same container | 42/42 |
| Fresh clone of `main` (`dc13db1`), README steps exactly | install, migrate, seed, dev, sign-in, lint, test, test:e2e | all passed (41 browser tests at that commit), nothing patched |
| CI on `dc13db1` (GitHub, Node 22 and 20.19, Postgres 16) | 5 jobs | 4 passed; Firefox stalled installing system packages twice (runner apt mirror) and was cancelled; Firefox passed 41/41 with no retries on the identical code of PR #6's head (`d7eb102`) |
| Dependency audit | `npm audit` | 0 vulnerabilities |

Performance (local, 527 incidents): every measured endpoint p95 ≤ 17.4 ms; SQL statements
per request constant regardless of page size (no N+1). Lighthouse (simulated mobile):
`/login` 100/100/100, `/status/:org` 98/100/100, CLS 0 on both.

## 5. Security results

No exploitable vulnerability was found. Verified by tests and probes: password hashing
(bcrypt 10, 72-byte limit), HS256 pinned, `alg: none` and forged tokens refused, deleted
users refused, role checks on every route, tenant isolation on every endpoint, mass
assignment ignored, SQL injection inert, XSS rendered as text under a CSP without
`unsafe-inline`, no CORS, `no-store` on the API, invitation tokens hashed and single-use,
private incidents and internal notes absent from every public response, logs free of
secrets, container runs as an unprivileged user. Limitations are listed in `SECURITY.md`
(non-revocable tokens in browser storage, open registration that reveals taken emails,
no MFA or password reset, per-process rate limits).

## 6. Database status

8 migrations apply to an empty database; no drift between migrations and schema. Upgrade
from the fourth migration with legacy rows (mixed-case emails, stored health, old event
names) migrates correctly; the duplicate-email guard stops the upgrade without changing data,
and the documented `migrate resolve` recovery works. Seed works and refuses to run in
production. Backups: `pg_dump`/`pg_restore` procedure in `docs/deployment.md`; restore
was not exercised against the live database (no access to it).

## 7. Frontend results

11 pages screenshotted and reviewed at 8 widths; no horizontal overflow anywhere, no inner
overflow, no console errors. axe-core (WCAG A/AA tags) passes on every page at desktop and
phone width with menus and dialogs open, in all three engines. Keyboard: skip link,
menus, drawer, dialogs (focus trap and return), radio groups, and focus kept during live
refreshes are covered by tests. Manual screen-reader testing was not done.

## 8. Deployment status

Live at https://blackwater-app.onrender.com (Render). `production.yml` recorded deployment
7609787240 for `dc13db1` as successful: the live `/health` reported that commit with the
database up, and the browser smoke journey (registration, services, invitation, roles,
full incident lifecycle, audit trail, publish/unpublish, public view, second organization,
live updates between sessions, phone layout) passed against it and removed its own data.
Live security headers confirmed. The production image was also built and smoke-tested
locally and in CI.

## 9. GitHub status

- PRs #4, #5 and #6 merged with merge commits, each at the exact head that CI tested (the
  merged trees are identical to the tested heads). No force-push; history preserved.
- All feature branches deleted after `git` confirmed each was fully contained in `main`;
  `main` is the only branch.
- PR #7 (this report, the CI change to Playwright's image, and the last F16 fix) was merged last;
  its CI and production results are stated in its description.

## 10. Remaining limitations and unverified items

- **Not verified:** manual screen-reader use (VoiceOver/NVDA); Playwright's Firefox on
  macOS 27 (it cannot start there; Firefox was tested on Linux); the Render plan, region
  and database backups of the live service (no dashboard access). The live service is not
  the one `render.yaml` would create, and a ~20 s first response suggests a Free instance,
  which sleeps when idle and whose database expires; check before relying on it.
- **By design / documented:** single instance only (rate limits and socket rooms in
  memory); members cannot be removed individually; no password reset or email; tokens are
  not revocable; relative times on signed-in pages update when data changes, not on a timer.
- **Runner reliability:** installing browser libraries with apt on GitHub's Ubuntu runners
  was at times extremely slow (21.9 MB in 9 min 34 s), which timed out or hung browser jobs.
  CI and the production check now run the browsers inside Playwright's Docker image, which
  already contains them; the image tag must be kept equal to the `@playwright/test` version.
- Major-version upgrades (Prisma 7, Express 5) were deliberately not done.

## 11. How to run

```bash
git clone https://github.com/Ayush-o1/BlackWater.git && cd BlackWater
npm install
createdb blackwater_dev && cp .env.example .env   # set DATABASE_URL and JWT_SECRET
npm run prisma:migrate:prod
npm run prisma:seed          # demo data; sign in as admin@blackwater.com / password123
npm run dev                  # http://localhost:8000

createdb blackwater_test && cp .env.test.example .env.test   # disposable database
npm test && npx playwright install chromium && npm run test:e2e
```

## 12. Resume-ready description

**BlackWater: incident management platform with a public status page.** Node.js,
Express, PostgreSQL/Prisma, Socket.IO, vanilla JavaScript; deployed with Docker on Render.

- Built a multi-tenant incident tracker with role-based access (admin, member, viewer),
  one-time invitation links, and an incident lifecycle enforced in row-locked database
  transactions that write an audit trail atomically.
- Delivered real-time updates over Socket.IO with per-organization rooms and an id-only
  event design, so clients only ever see data the API would return to them.
- Published a public status page that exposes only explicitly published incidents through
  field allow-lists, with service health derived from open incidents rather than stored.
- Wrote 253 backend tests against a real PostgreSQL database and a 42-test browser suite
  run in Chromium, Firefox and WebKit, including axe-core accessibility checks and
  multi-session real-time tests; CI also smoke-tests the production Docker image, and a
  deployment workflow verifies the live site runs the pushed commit.
