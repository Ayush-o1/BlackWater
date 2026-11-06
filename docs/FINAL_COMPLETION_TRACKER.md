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
| 4. Frontend and UX | Not started |
| 5. Real-time / Socket.IO | Not started |
| 6. Security | Not started |
| 7. Testing and QA | Not started |
| 8. Deployment | Not started |
| 9. Documentation and cleanup | Not started |
| 10. Git consolidation | Not started |
| 11. Final verification | Not started |

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

**Remaining:** everything from Phase 1 onward.

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
