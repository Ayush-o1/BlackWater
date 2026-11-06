# Final completion tracker

Status of each phase of the final audit and release. Findings are numbered as in
[audit/INITIAL_AUDIT.md](audit/INITIAL_AUDIT.md) (F1–F13). "Verified" means the result was
observed by running something; anything else says why not.

| Phase | Status |
|---|---|
| 0. Repository discovery | Done |
| 1. Architecture and code quality | Done |
| 2. Backend and business logic | Done |
| 3. Database and data integrity | Done |
| 4. Frontend and UX | Done |
| 5. Real-time / Socket.IO | Done |
| 6. Security | Done |
| 7. Testing and QA | Done |
| 8. Deployment | Done |
| 9. Documentation and cleanup | Done |
| 10. Git consolidation | Done |
| 11. Final verification | Done (see the final report for what remains unverified) |

## Phase 0 — Repository discovery

**Tasks:** read every tracked file; map the request and socket lifecycles; inspect git
branches, PRs and CI runs; run the existing checks; probe the live deployment.

**Findings:** F1–F13 (see the audit). Highest: F1 (PR #5 CI red in WebKit, fix present but
uncommitted), F2 (intermittent Firefox navigation hang), F3 (production behind `main`'s
successors; hosting plan unverified).

**Changes made:** none to source. Added this tracker and the audit.

**Tests executed (working tree = `1eeabe6` + uncommitted WebKit fix):**

| Command | Environment | Result |
|---|---|---|
| `npm run lint` | macOS, Node 24.22.1 | 2 errors, only in untracked `ff-tmp.mjs` |
| `npm test` | macOS, PostgreSQL 18 | 252 passed / 252, 27 files |
| `CI=1 npx playwright test --project=chromium` | macOS | 39 passed |
| `… --project=webkit` | macOS | 39 passed |
| `… --project=webkit` | Linux container (`playwright:v1.62.1-noble`, Postgres 16) | 39 passed |
| `… --project=firefox` | Linux container | 38 passed, 1 flaky |
| `… --project=firefox -g explanation --repeat-each=15/30 --retries=0` | Linux, PW 1.62 | 1 failed / 30; 0 failed / 60 |
| same | Linux, PW 1.65 | 0 failed / 60 |
| `npm audit` | | 0 vulnerabilities |
| `prisma migrate diff` (migrations → schema) | shadow DB | no difference |

**Blocked:** Firefox on this Mac (OS refuses the browser's sandbox extension); Render
dashboard (no access: plan, region and backups unverifiable).

**Remaining:** carried into the phases below.

## Phases 1–3 — Architecture, backend rules, database

**Architecture (Phase 1).** The layering (route → middleware → controller → service →
Prisma) is consistent across all eight routers; controllers are thin; every request is
validated by a zod schema that replaces the raw input; errors flow through one handler.
No circular imports (services reach Socket.IO only through `socket/emitter.js`). No
refactor was justified. F7 was withdrawn after review (see the audit).

**Backend probes (Phase 2).** Beyond the 252 existing tests, a probe script ran against a
server on a disposable database (`blackwater_audit`):

| Probe | Result |
|---|---|
| Cursor id from another organization / nonexistent, internal and public lists | 200, empty page, nothing leaked |
| `__proto__` / `constructor` keys in a JSON body | dropped by validation; 201 with normal fields only |
| Array, `null`, malformed JSON bodies | 400 |
| Editing another organization's incident | 404 |
| Unicode title; 201-char title; blank title; lowercase enum; boolean as string | 201; 400; 400; 400; 400 |
| `Bearer`, `Bearer ` (empty), lowercase scheme, double space, `Token` scheme | all 401 |
| `alg: none` token; token with a forged signature | 401 |
| Public status: bad/missing orgId; private incident; incident through another org | 400; 400; 404; 404 |
| Unknown method/route; `/package.json`, `/.env`, encoded `..` traversal | 404 each |
| `limit` = 0, 101, −1, 1.5, `abc`; bad `status`, `open`, empty `q`, bad cursor | 400 each; `limit=100` 200 |

Server log: no unexpected errors. **Found and fixed:** F14 (renames not announced).

**Database (Phase 3).**

| Check | Result |
|---|---|
| All 8 migrations on an empty database | applied |
| Migrations → schema drift | none |
| Upgrade: first 4 migrations, legacy rows (mixed-case email, stored service status, old event names), then the other 4 | applied; email lowercased; `CREATED`/`STATUS_CHANGE`/`ASSIGNED` mapped to current names with `newStatus`; incidents became private; updates kept |
| Upgrade with two emails differing only by case | migration stops with its message (P3018), no row changed; documented recovery (`migrate resolve --rolled-back`, rerun) then succeeds |
| Seed | creates 1 org, 3 users, 3 services, 3 incidents, 9 events; refuses with `NODE_ENV=production` |
| Graceful shutdown with a live socket and an idle keep-alive connection, SIGTERM sent twice | exit code 0 in 10 ms, one shutdown, client sees `transport close` |

**Changes:** F14 fixed (+1 test); F5 (indicator after server disconnect) and F6
(idempotent shutdown, exit 1 after a crash) fixed; `docs/database.md` gained the failed
migration recovery procedure and a corrected description of the drift check output.

**Tests:** `npm test` 253 passed / 253 (27 files); `npm run lint` clean. The new socket
test was confirmed to fail without the fix.

**Not verified:** the crash path's exit code 1 (would need fault injection; reviewed only).

## Phase 4 — Frontend and UX

Seeded demo data, every page screenshotted at 360, 390, 430, 768, 1024, 1280, 1440 and
1920 px (Chromium), and inspected by eye. Measured per page: document overflow, overflow
inside any scroll container in `main`, console errors.

| Check | Result |
|---|---|
| Sideways scrolling, 11 pages × 8 widths | none |
| Inner overflow (tables, cards), 4 list pages × 11 widths | none (only the deliberately visually-hidden table caption) |
| Console errors | none, except the not-found page's own expected 404 |
| Visual review | consistent, restrained light UI; private incident absent from the public page, internal and public health differ as designed |

**Fixed:** the lifecycle stepper wrapped on phones with a connector starting the second
line (`components.css`).

Accessibility: the existing axe-core suite (WCAG 2.x A/AA tags, desktop and phone, menus
and dialogs open) and keyboard tests pass in all three engines; Lighthouse accessibility
100 on `/login` and `/status/:org`. **Not done:** manual screen-reader testing with
VoiceOver or NVDA; no automated tool replaces it.

## Phase 5 — Real-time

| Scenario | How verified | Result |
|---|---|---|
| Two users, same organization; an update reaches the other session | browser suite (Chromium, Firefox, WebKit) | pass |
| Another organization never receives it | browser suite + Socket.IO integration tests | pass |
| Disconnect, miss an event, catch up | browser suite | pass |
| Change made before the first connection | browser suite | pass |
| Refused handshake retried | browser suite | pass |
| Renames reach teammates (F14) | integration test | pass (failed before the fix) |
| Organization deleted while a member has the app open (access lost) | new browser test | page says Offline, next load signs out (failed before the F5 fix) |
| **Real server restart** (SIGTERM, new process) with a page open | script: `restart-test.mjs` against a real server process | page showed Reconnecting, Live again ~5 s after restart without reload, new change appeared, other organization's change did not, no page errors |

## Phase 6 — Security

No new vulnerabilities found. Checked in addition to the existing tests: the full header
set (CSP without `unsafe-inline`, `frame-ancestors 'self'`, HSTS, `nosniff`,
`no-referrer`, CORP/COOP); logs contain ids only (no bodies, passwords or tokens); the
production image runs as uid 1000, contains no `.env`, and only production packages
(`npm ls --omit=dev`). `npm audit`: 0 vulnerabilities after the dependency update.
Two limitations were added to `SECURITY.md` (registration reveals taken emails; an open
socket outlives its token without exposing data).

## Phase 7 — Testing and QA

**Performance** (local, PostgreSQL 18, 527 incidents / 53 services, 40 requests each):

| Endpoint | p50 ms | p95 ms | SQL statements |
|---|---|---|---|
| `GET /api/auth/me` | 0.9 | 2.0 | 2 |
| `GET /api/dashboard` | 10.1 | 16.4 | 7 |
| `GET /api/incidents?open=true&sort=priority&limit=25` | 12.6 | 17.4 | 7 |
| `GET /api/incidents?limit=100` | – | – | 7 |
| `GET /api/incidents/:id` | 2.9 | 4.4 | 11 |
| `GET /api/services?limit=100` | 5.9 | 7.1 | 4 |
| `GET /api/status` (public) | 15.6 | 17.0 | 9 |
| `GET /api/status/incidents` (public) | 5.8 | 7.0 | 6 |

Statement counts come from PostgreSQL's statement log and do not grow with page size, so
there is no N+1 query. Lighthouse 12.8.2 (simulated mobile): `/login` 100/100/100
(performance/accessibility/best practices), LCP 1.5 s, CLS 0, 84 KiB; `/status/:org`
98/100/100, LCP 2.3 s, CLS 0, 158 KiB.

**Flaky Firefox (F2), resolved.** With the same code and retries off, Playwright 1.62
failed 3 of 80 Firefox tests (navigation never reported); 1.65 failed 0 of 80. Playwright
upgraded to 1.65.0 (dev dependency). The newer WebKit logs an informational
cross-origin-isolation note on every page; the console check ignores exactly that message.

**Added:** sideways-scroll check at all 8 widths (F10); Offline-after-deletion test.

**Final browser runs (retries off), Playwright 1.65:**

| Engine | Where | Result |
|---|---|---|
| Chromium | macOS | 40 passed |
| WebKit | macOS | 40 passed |
| WebKit | Linux container | 40 passed |
| Firefox | Linux container | 40 passed (and 40 + 40 in two earlier runs) |
| Firefox | macOS | blocked: the OS refuses the browser's sandbox (see Phase 0) |

## Phase 8 — Deployment

| Check | Result |
|---|---|
| `docker build` | succeeds; runs as `node` (uid 1000); production packages only |
| Container against an empty PostgreSQL 16 | applies 8 migrations, starts in production mode, `/health` UP with the commit, Docker HEALTHCHECK `healthy` |
| Smoke journey against the container | **failed first**: found F15 (below). After the fix: passes and deletes its own data |
| Graceful shutdown with real signals | see Phase 3 |

**F15 — High — the smoke journey was broken by the redesign.** It looked for the old
`.timeline` element. CI only *listed* the smoke spec, so after merging, every production
deployment would have been marked failed by `production.yml`. Fixed (accessible-name
locator) and CI now runs the whole journey against the built image.

CI actions moved to their Node 24 majors (F11). The live deployment is verified after the
merge (Phase 10).

## Phase 9 — Documentation and cleanup

README gained architecture, data model, testing and deployment sections; API, architecture,
deployment, security and contributing docs corrected where they differed from the code
(details in commit `9fadbe3`). `docs/database.md` documents failed-migration recovery
(tested). All relative links and anchors in the 9 Markdown files resolve. Screenshots match
the current interface. Every file under `public/` is referenced; every dependency is used
(three only through scripts or config). Removed the scratch file `ff-tmp.mjs`.

## Phase 10 — Git consolidation

**Pre-merge CI found F16.** WebKit failed in CI on a documentation-only head (radio arrow
keys; a dialog that never opened), after passing on the previous code commit. Diagnosis:
live refreshes rebuilt unchanged pages, taking focus away and swallowing clicks that
straddled a rebuild (a real user-facing defect, see the audit). Fixed and covered by a
new test. After the fix, retries off: Chromium 41/41 (macOS), WebKit 41/41 and Firefox
41/41 (Linux); the two tests that had failed passed 15/15 each under repetition.

**WebKit CI, second attempt.** The documentation-only head `fa86caa` failed WebKit again:
two test-only races (axe measured the user menu mid-fade; the console check counted
requests the page aborts on purpose). Both fixed deterministically; then all five jobs
passed on `9d8be02` with no retries (one WebKit attempt had first stalled installing
the browser and was re-run).

**Merges.** PR #4 merged at `0aabca8` (→ `9a2db27`), PR #5 at `9d8be02` (→ `6ec5f38`); the
merged tree equals the tested head. All four old branches confirmed contained in `main`
(`git rev-list` 0, `git branch -d` accepted) and deleted on GitHub and locally.

**Production run on `6ec5f38` failed** at the smoke journey's final check: every functional
step passed on the live site, but over a real network it counted deliberately aborted
requests as failures. A fresh clone also showed that `npm run prisma:seed` could not find
`DATABASE_URL` (F17). Both fixed in PR #6, verified against the live site, CI green on
`d7eb102` (no retries), merged (→ `dc13db1`, tree identical), branch deleted.

## Phase 11 — Final verification

| Check | Result |
|---|---|
| Fresh clone of `dc13db1`, README steps, nothing patched | install, migrate, seed, dev server, seeded sign-in, lint (0), `npm test` 253/253, `npm run test:e2e` 41/41, `npm audit` 0 |
| Production workflow on `dc13db1` | success: live `/health` reported `dc13db1`, smoke journey passed on the live site, deployment 7609787240 marked successful |
| Live headers | CSP, HSTS, nosniff, frame and referrer policies present |
| CI on `dc13db1` | Lint and tests, minimum Node.js, WebKit, production image passed; Firefox stalled twice while apt downloaded system packages (runner issue) and was cancelled; the identical tree passed Firefox 41/41 on `d7eb102` |
| Follow-up | apt download timeouts and retries plus job time limits added to the workflows, with this report |

Final report: [FINAL_PROJECT_REPORT.md](FINAL_PROJECT_REPORT.md).
