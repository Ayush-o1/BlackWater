# Frontend UI/UX: verification report

Date: 2026-11-09. Branch `improvement/frontend-ui-ux`. Final code commit `4261eb6`
(later commits change only documentation and screenshots). Every result below was
observed; anything not verified is listed in section 6.

Environment: macOS, Node.js 24.22, PostgreSQL 18 (local), Playwright 1.65. Firefox
cannot start on this Mac (a macOS sandbox refusal, known from the previous audit), so
it was run in Playwright's official Linux image `mcr.microsoft.com/playwright:v1.65.0-noble`
against PostgreSQL 16, the same setup CI uses, on the committed tree (`git archive`).

## 1. Test suites

| Suite | Command | Baseline (`main` 2a4dda6) | Final (`4261eb6`) |
|---|---|---|---|
| Lint | `npm run lint` | 0 problems | 0 problems |
| Unit + integration | `npm test` | 27 files, 253 passed | 27 files, **266 passed** (+13: theme script on every page) |
| Browser, Chromium | `CI=1 npx playwright test --project=chromium` | 41 passed, 1 flaky | **57 passed**, no retries |
| Browser, WebKit | `CI=1 ALL_BROWSERS=1 npx playwright test --project=webkit` | 42 passed (run overlapped early edits; see note) | **57 passed**, no retries |
| Browser, Firefox (Linux container) | `npx playwright test --project=firefox` | not run at baseline | **57 passed**, no retries |
| Smoke journey (production check) | `SMOKE_URL=http://localhost:8001 npm run smoke` | — | **passed** (the journey CI runs against the Docker image) |

Note on the WebKit baseline: that run started before Phase 2 and overlapped its CSS
edits, so it is not a clean baseline. The previous audit (`docs/FINAL_PROJECT_REPORT.md`)
records 42/42 in WebKit on `main`.

The baseline's flaky Chromium test ("invites a viewer … gains write access when
promoted", `e2e/app.spec.js:178`) failed once at line 226 before any file was changed
and passed 5/5 when repeated. It is a pre-existing timing issue in a live-update
assertion and was not modified.

### New tests (15 browser, 13 integration)

| Test | File | Proves |
|---|---|---|
| follows the operating system by default, and keeps following it | `e2e/theme.spec.js` | System default; live OS changes |
| a chosen theme overrides the system, survives navigation and reloads, and System hands control back | same | Persistence; precedence; reset |
| the theme is set before any page script runs | same | No flash (page modules blocked; page still dark) |
| open tabs switch together | same | `storage` event sync |
| a visitor to the public status page can choose a theme, which persists | same | Public pages, signed out |
| the switcher is operated with the arrow keys | same | Keyboard |
| a long services list does not push the panels on the left apart | `e2e/layout.spec.js` | Overview gap fixed (exactly one 24px grid gap) |
| on a phone the panels are one column, most urgent first | same | Phone order unchanged |
| controls are large enough for a fingertip | same | 44/40px under a coarse pointer |
| a fine pointer keeps the compact desktop sizes | same | Desktop density unchanged |
| the open navigation drawer keeps focus inside it … | `e2e/accessibility.spec.js` | `inert`, close button, resize release, no close button on desktop |
| axe on every page, desktop and phone, **dark theme** (4 tests) | same | WCAG 2.2 AA automated checks in dark |
| every page sets the colour theme before its stylesheets load (11 routed pages + not-found), and the script is served as JavaScript | `tests/integration/pages.test.js` | Script present, blocking, first |

**The tests detect the bugs they cover.** With the pre-fix `layout.css` and `shell.js`
restored temporarily, the overview test and the drawer test both failed; with the fixes
they pass.

## 2. Visual and responsive checks

A Playwright script registered an organization through the real API (6 services,
admin/member/viewer, 5 incidents in every lifecycle state, internal notes, public updates,
a pending invitation) and captured 11 pages × 7 viewports × 2 themes = **154 captures**
of the final code.

| Check | Result |
|---|---|
| Horizontal overflow (`scrollWidth − clientWidth`) at 320, 375, 430, 768, 1366, 1440, 1920 px, light and dark | **0 px on all 154** |
| Console errors | **None**, except the not-found page's own expected 404 |
| Light theme unchanged by the tokenisation (Phase 2) | Pixel diff of 70 captures: only the intended `<dl>` spacing and per-run text (timestamps, generated emails) differed |
| Every page reviewed by eye in dark mode, plus open user menu, dialog and drawer | Done; found and fixed: invisible ghost-button hover, read-only fields that looked editable, close button visible on desktop |

Curated before/after screenshots: [`screenshots/baseline/`](screenshots/baseline/) and
[`screenshots/after/`](screenshots/after/).

### Measurements

| Item | Value |
|---|---|
| Dark-theme contrast pairs measured | 40, all at or above their WCAG AA threshold (table in `IMPLEMENTATION_PLAN.md`) |
| Control heights, touch (Pixel 7 emulation) | buttons 44px, tabs 44px, small selects 40px |
| Control heights, desktop | buttons 36px, tabs 42px, small selects 32px (unchanged) |
| Drawer, 8 Tab presses after opening | before: 4 stops in the drawer then onto hidden page controls; after: drawer, browser UI, back to drawer |

## 3. Roles and states

| Scenario | Covered by |
|---|---|
| Admin, member and viewer see the right controls | existing `app.spec.js` tests (all passing) |
| Viewer promoted to member live | existing test (the known flaky one; passing in the final runs) |
| Logged out: sign-in, registration, invitation, public pages | `theme.spec.js`, `accessibility.spec.js`, existing tests |
| Loading, empty and error states | existing failure-handling tests; empty states seen in screenshots |
| Keyboard: skip link, user menu, dialogs, drawer, radios | `accessibility.spec.js` |

## 4. No regression to business behaviour

- `git diff main -- src prisma package.json package-lock.json .github` is **empty**: no
  backend, schema, dependency or CI change.
- No API call was added or changed. The public pages request the same endpoints and show
  the same allow-listed fields; only their formatting changed (time zone, compact rows).
- No `innerHTML`, inline script, inline style or `style` attribute was added; the CSP
  tests in `tests/integration/pages.test.js` still pass.
- The existing 42 browser tests pass unmodified, apart from the axe suite gaining dark
  variants and one new test.

## 5. Performance

- One new blocking script, `theme-init.js`: 1,358 bytes, most of it comments, from the
  same origin and cached after the first page. It does one storage read and one
  `matchMedia` call.
- One new module, `theme.js` (~110 lines). No new dependency of any kind.
- Switching theme changes one attribute; no page content is re-rendered.

## 6. Not verified, and limitations

- **No manual screen-reader pass** (VoiceOver/NVDA). Accessibility evidence is automated
  (axe, in both themes) plus keyboard tests.
- **No real touch device.** Touch sizing was verified with Playwright's touch emulation
  in Chromium, WebKit and Firefox, all of which report `pointer: coarse`.
- **Firefox on macOS** cannot run here; it was run on Linux, as in CI.
- **CI on GitHub** for this branch: see the pull request.
- The baseline's flaky Chromium test is a pre-existing timing issue and was left as it is.
