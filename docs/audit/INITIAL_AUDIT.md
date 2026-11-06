# Initial audit (Phase 0)

Date: 2026-11-06. Read-only discovery: no source file was changed to produce this document.
Every result below was observed on this machine or read from GitHub's API; anything that
could not be observed is marked as such.

## 1. What was inspected

- All 168 tracked files: `src/` (routes, middleware, controllers, services, validators,
  socket, utils, config), `public/` (13 HTML pages, 22 ES modules, 3 stylesheets),
  `prisma/` (schema, 8 migrations, seed), `tests/` (27 Vitest files), `e2e/` (3 Playwright
  specs + helpers), CI workflows, `Dockerfile`, `render.yaml`, `vercel.json`, all docs.
- Git: every local and remote branch, their divergence from `main`, all 5 pull requests,
  the last 25 workflow runs and the logs of the failing ones.
- The live deployment at `https://blackwater-app.onrender.com` (read-only requests).

## 2. Architecture as found

One Node.js process (Express 4) serves three things on one origin:

```
Browser ── HTML/CSS/ES modules (public/, served by express.static + src/pages.js)
        ── /api/* ── noStore → apiLimiter → express.json → router
                      route → requireAuth (JWT → user re-read from DB) → requireRole
                      → validateRequest (zod; replaces body/query/params with parsed values)
                      → controller (thin) → service (rules + Prisma) → PostgreSQL
                      errors → asyncHandler → globalErrorHandler (AppError / Prisma codes / 500)
        ── /socket.io ── authenticateSocket (same JWT + DB check) → join `organization:<orgId>`
                         services call emitToOrg(orgId, event, { id }) after commit;
                         browsers refetch through the API ("doorbell, not data channel")
```

Notable design decisions already in place (and verified by reading the code):

- Tenant isolation: every query filters on `orgId` taken from the DB-loaded user, never from input.
- Incident writes lock the row (`SELECT … FOR UPDATE`) and write the audit event in the same transaction.
- Service health is derived at read time from open incidents (no stored status).
- Public status endpoints use explicit allow-list DTOs (`src/utils/publicDto.js`) and filter `isPublic`.
- Invitation tokens are stored as SHA-256 hashes and claimed with one atomic `UPDATE`.
- "Last admin" rule protected by locking all admin rows of the organization.
- The frontend never builds markup from strings (`dom.js`), CSP forbids inline script and style.

## 3. Baseline results (working tree = PR #5 head `1eeabe6` + 4 uncommitted files)

| Check | Command | Result |
|---|---|---|
| Lint | `npm run lint` | **2 errors**, both in the untracked scratch file `ff-tmp.mjs` (no errors in tracked files) |
| Unit + integration | `npm test` | 27 files, **252 passed**, 0 failed, 0 skipped (local PostgreSQL 18) |
| Browser, Chromium (macOS) | `CI=1 npx playwright test --project=chromium` | **39 passed** |
| Browser, WebKit (macOS) | `CI=1 ALL_BROWSERS=1 npx playwright test --project=webkit` | **39 passed** |
| Browser, WebKit (Linux, Docker `playwright:v1.62.1-noble`, Postgres 16) | same, in container | **39 passed**, no retries |
| Browser, Firefox (Linux, same container) | same | 38 passed, **1 flaky** (passed on retry) |
| Browser, Firefox (macOS) | — | **Blocked**: Firefox cannot start on this Mac (macOS 27 refuses `sandbox_extension_issue_file_to_process`); every launch times out |
| Dependency audit | `npm audit` | 0 vulnerabilities (prod and dev) |
| Schema drift | `prisma migrate diff --from-migrations … --to-schema-datamodel …` | No difference |
| Secrets in git history | grep of all history for `JWT_SECRET=`/`DATABASE_URL=` and `.env` files | Placeholders only; no real `.env` was ever committed |
| Live deployment | `GET /health` | `UP`, database `UP`, commit `74ba904` (= current `main`); first response took 22 s |

## 4. Git and GitHub state

| Branch | Ahead of `main` | Behind | Status |
|---|---|---|---|
| `main` (`74ba904`) | – | – | PRs #1–#3 merged; CI green |
| `fix/blackwater-production-release` (`0aabca8`) | 3 | 1 (merge commit only) | **PR #4 open**, CI green |
| `feat/blackwater-premium-frontend` (`1eeabe6`) | 7 (= PR #4's 3 + 4 own) | 1 | **PR #5 open**, base `main`, **CI red** |
| `fix/blackwater-production-readiness` | 0 | 5 | Fully merged (PR #2) – safe to delete |
| `rebuild/vanilla-js-migration` | 0 | 17 | Fully merged (PR #1) – safe to delete |

PR #5 contains PR #4's three commits unchanged, so the dependency is linear: merging #4
first and then #5 (or #5 alone, with a merge commit) loses nothing. There are no duplicate
or conflicting commits between them.

PR #5 CI history:
- `0c85601`: Firefox job failed (`page.goto`/`locator.check` timeouts, 30 s).
- `1eeabe6`: WebKit job failed (2 tests, see F1). Firefox passed.

## 5. Findings

Severity: **High** = broken behaviour or a red pipeline that blocks release; **Medium** =
real defect or risk with limited impact; **Low** = quality, hygiene or efficiency.

### F1 — High — PR #5 CI fails in WebKit (two real defects)
- `e2e/app.spec.js` "uses every page without console errors": WebKit reports
  `… /api/auth/me due to access control checks` as an uncaught page error when a page is
  left while its fetches are in flight. Users of Safari would see these in the console;
  nothing functional breaks, but the suite is right to fail on it.
- `e2e/accessibility.spec.js` "arrow keys move between the options": in Linux WebKit,
  after `Alt+Tab` reaches the radio, ArrowRight did not change the selection.
- **Status:** a fix already exists **uncommitted** in the working tree (`public/js/api.js`
  aborts its own in-flight requests on `pagehide`; `components.css` uses `:focus-within`;
  the test tries `Tab` then `Alt+Tab`). With it, WebKit passes 39/39 on macOS and on Linux.
- **Fix:** review, commit, and let CI confirm.

### F2 — Medium — Intermittent Firefox navigation hang in the browser suite
- About 1 in 30–100 runs, `page.goto('/register')` on a fresh page never reports
  navigation. The trace shows the page and all 12 of its files loaded in under 10 ms, yet
  Playwright never received the navigation-committed event. Reproduced 1/30 locally on
  Linux, 0/60 on a second batch, 0/60 with Playwright 1.65. It also caused PR #5's Firefox
  failure on `0c85601`.
- Evidence points at the Playwright↔Firefox protocol rather than the app (the server
  answered everything), but this is **not yet proven**. CI's single retry masks it.
- **Fix:** investigate further in Phase 7; candidate mitigations are upgrading Playwright
  (dev dependency only) and keeping one retry with the flake reported, not hidden.

### F3 — Medium — Production is behind and its hosting plan is unverified
- Live `/health` reports `74ba904`: PR #4's fixes (proxy connection resets, missed first
  live update, handshake retry) are not deployed.
- The first request took 22 s, consistent with a Render **Free** instance waking from
  sleep. `render.yaml` and `docs/deployment.md` describe paid, always-on plans under the
  names `blackwater-server`/`blackwater-server-db`, but the live service is `blackwater-app`.
  So the live service was most likely created by hand, not from the Blueprint.
- **Cannot verify** the plan, region, database expiry or backups without Render dashboard
  access. No billing or plan change will be made.
- **Fix:** deploy the final `main` through the existing auto-deploy and verify it with
  `production.yml` (commit check + smoke journey). State the plan uncertainty plainly in
  the docs and the final report.

### F4 — Low — Repository hygiene
- `ff-tmp.mjs` (untracked scratch file) makes `npm run lint` fail locally.
- Two fully merged remote branches remain (see §4).
- `playwright-report/` and `test-results/` exist locally but are correctly git-ignored.
- **Fix:** delete the scratch file; delete merged branches after consolidation.

### F5 — Low — Live indicator stays on "Reconnecting" after a server-side disconnect
- `public/js/realtime.js` maps every `disconnect` to "connecting". When the server
  disconnects a socket on purpose (`disconnectSockets`, used on organization deletion),
  Socket.IO does not reconnect, so the indicator says "Reconnecting" forever. Impact is
  small (the next API call signs the user out), but the label is untrue.
- **Fix:** treat reason `io server disconnect` as offline.

### F6 — Low — Shutdown edge cases in `src/server.js`
- After an `uncaughtException` the process exits with code **0**, which tells a supervisor
  the stop was clean. A second signal calls `shutdown` again.
- **Fix:** exit non-zero after a crash and make shutdown idempotent; verify with real signals (Phase 8).

### F7 — Low — Incident page refetches on every incident event in the organization
- `public/js/pages/incident.js` subscribes to `incident:updated` without checking the id,
  so in a busy organization every open incident page refetches on every change anywhere.
- **Fix:** ignore events for other incidents (the payload already carries the id).

### F8 — Low — Connected sockets outlive token expiry
- A socket authenticated once stays in its room after its JWT expires. Events carry ids
  only and every refetch goes through the authenticated API, so no data is exposed.
  Document as a design property rather than change.

### F9 — Info — No way to remove or deactivate a member
- Already listed as a known limitation in the README. As a result, "a user loses access
  while connected" can only be exercised via organization deletion (cuts sockets) and
  role demotion (tested). Not adding a feature without your decision.

### F10 — Low — Responsive tests cover 360, 390 and 1280 px only
- The required set is 360, 390, 430, 768, 1024, 1280, 1440, 1920.
- **Fix:** extend the "no sideways scroll" check to all eight widths (Phase 7).

### F11 — Low — CI uses actions that run on deprecated Node 20
- `actions/checkout@v4`, `setup-node@v4` and `upload-artifact@v4` produce deprecation warnings.
- **Fix:** move to the current major versions.

### F12 — Info — Outdated major versions
- Prisma 5 (7 is current), Express 4 (5), helmet 7 (8), express-rate-limit 7 (8), dotenv 16.
  None has a known vulnerability (`npm audit` is clean). Major upgrades change APIs, and
  the current versions are supported, so they are **not** planned here; noted for the report.

### F13 — Low — Documentation details to re-check against the final code (Phase 9)
- `docs/deployment.md` "Operations > Health" omits the `commit` field.
- Plan and Blueprint statements (see F3) need to reflect what is actually deployed.
- Screenshots were refreshed in PR #5; confirm they match the final UI.

## 6. Things verified as correct (no change needed)

- Authentication: bcrypt cost 10, constant-time-ish unknown-email path (dummy hash), HS256
  pinned on sign and verify, user re-read per request, deleted user → 401.
- Authorization: role middleware on every write route; admin-only invitation/role/org routes;
  last-admin rule with row locks; invitations cannot grant ADMIN (validator + service + DB CHECK).
- Public exposure: allow-list DTOs; private incidents do not affect public health.
- Rate limits: strict on register/invitations/failed logins/org deletion, loose elsewhere.
- Migrations: forward-only, reproducible, no drift; email-lowercasing migration refuses to
  merge case-duplicates.
- XSS: no string-to-markup paths in the frontend; CSP without `unsafe-inline`.

## 7. Plan

1. Commit the WebKit fixes (F1) and remove scratch files (F4).
2. Phases 1–3: confirm the backend and database by running targeted attacks and a fresh
   migration on an empty database; fix F5–F7 with regression tests.
3. Phases 4–7: browser verification in all three engines on Linux, eight widths, axe,
   performance measurement; resolve or document F2.
4. Phase 8: real shutdown test, container test, production verification after deploy.
5. Phases 9–11: documentation, merge PR #4 then PR #5, delete merged branches, fresh-clone
   verification, final report.
