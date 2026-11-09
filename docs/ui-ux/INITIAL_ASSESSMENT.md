# Frontend UI/UX: initial assessment (Phase 0)

Date: 2026-11-09. Branch `improvement/frontend-ui-ux`, cut from `main` at `2a4dda6`
(clean working tree, no uncommitted work).

Every finding below comes from reading the code or from the running application.
Where a finding was measured, the method is given. Nothing here is a guess about what
a file "probably" does.

## How this was inspected

- **Code read in full:** every file in `public/` (12 HTML pages, 3 stylesheets, 21 ES
  modules), `src/app.js` (CSP and static serving), `src/pages.js`, the ordering in
  `src/services/status.service.js`, all three Playwright specs, the Playwright and ESLint
  configs, `.github/workflows/ci.yml`, the README and the previous audit and final report
  in `docs/`.
- **Running application:** the server was started against the disposable test database
  (`.env.test`; the development database was not touched, because the seed deletes all
  data). An organization ("Northwind Payments") was created through the real API with
  6 services, 3 people (admin, member, viewer), 5 incidents in every lifecycle state,
  internal notes and public updates, and a pending invitation.
- **Screenshots:** 11 pages × 7 viewports (320, 375, 430, 768, 1366, 1440 and 1920 px
  wide) were captured with Playwright, which also measured horizontal overflow and
  collected console errors for each page. A curated set is in
  [`screenshots/baseline/`](screenshots/baseline/).
- **Keyboard checks:** a script tabbed through the phone navigation drawer and recorded
  where focus went.
- **Research:** see the Implementation Plan, section 2.

## Baseline results

| Check | Command | Result |
|---|---|---|
| Lint | `npm run lint` | 0 problems |
| Unit + integration | `npm test` | 27 files, **253 passed** |
| Browser, Chromium | `CI=1 npx playwright test --project=chromium` | **41 passed, 1 flaky** (passed on retry) |
| Flaky test in isolation | same, `-g "invites a viewer" --repeat-each=5 --retries=0` | 5/5 passed |
| Browser, WebKit | `ALL_BROWSERS=1 npx playwright test --project=webkit` | see the Verification Report |
| Browser, Firefox | — | cannot launch on this Mac (known: macOS sandbox refusal); covered by CI's Linux job |
| Horizontal overflow | screenshot harness, 77 page/viewport pairs | **0 px on every page at every width** |
| Console errors | same | none (the not-found page's own 404 is expected) |

The flaky test (`e2e/app.spec.js:178`, "invites a viewer … gains write access when
promoted") failed at line 226, waiting for a viewer's open page to show "Declare
incident" after a live role change. It is timing-dependent and pre-existing: it was seen
before any file was changed.

## 1. What BlackWater does

An incident-management tool with a public status page. A team lists the services it
runs; when something breaks, someone declares an incident, links affected services,
and moves it through `TRIGGERED → ACKNOWLEDGED → RESOLVED → CLOSED` (a resolved incident
can be reopened; a closed one is final). Every change is recorded in an audit timeline.
Incidents are private until published; visitors to `/status/:orgId` see only published
incidents and their public updates. Service health is never typed in: the server derives
it from the worst open incident on each service. Three roles (admin, member, viewer)
control what each person may do, and open pages refresh live over Socket.IO.

## 2. Frontend architecture as found

- **No framework, no build step.** Each URL is a small HTML file (`public/*.html`, 18–19
  lines) that loads three stylesheets and one ES module from `public/js/pages/`.
- **Rendering.** `dom.js` exports `h(tag, props, ...children)` and `render(parent, ...)`.
  Nothing uses `innerHTML`; user text only ever becomes a text node. This, together with
  the Content-Security-Policy in `src/app.js` (no inline scripts, **no inline styles**,
  no `style` attributes), is the XSS defence. Any new feature must keep within that CSP.
- **Shared modules.** `api.js` (fetch wrapper, 401 handling, cancels requests on
  `pagehide`), `auth.js` (session in local/sessionStorage, role helpers), `shell.js`
  (sidebar, top bar, drawer, user menu, live indicator), `ui.js` (badges, fields,
  dialogs, toasts, states), `components.js` (status banner, activity feed, incident and
  service dialogs), `realtime.js` (Socket.IO "doorbell"), `authLayout.js`,
  `publicLayout.js`, `icons.js` (inline SVG icon set).
- **Live updates.** The server only says "incident X changed"; pages refetch through the
  API. `changeDetector()` in `ui.js` skips repainting when data is unchanged, so focus and
  clicks are not lost (finding F16 of the previous audit). Any change to page painting
  must keep that.
- **Roles in the UI.** `canWrite` / `isAdmin` in `auth.js` only decide which controls to
  show; the server enforces the same rules on every request.

## 3. Page and component structure

| Page | Module | Main components |
|---|---|---|
| Overview `/` | `pages/dashboard.js` | status banner, "Needs attention", Services, "Recently resolved", public link panel |
| Incidents `/incidents` | `pages/incidents.js` | view tabs, search, severity filter, sort, table (stacked below 761 px), Load more |
| Incident `/incidents/:id` | `pages/incident.js` | header with lifecycle actions, lifecycle stepper, description, composer (internal/public), activity feed, details aside |
| Services, Service | `pages/services.js`, `pages/service.js` | table; detail with open/earlier incidents and "how health is set" |
| Settings `/settings` | `pages/settings.js` | profile, organization, team with role selects, pending invitations, invite dialog, delete organization |
| Sign in, register, invite | `pages/login.js`, `register.js`, `invite.js` | `authLayout.js`: brand panel + form card |
| Public status, public incident | `pages/status.js`, `status-incident.js` | `publicLayout.js`: org header, banner, current incidents, services, day-grouped history, public update feed |
| Not found | `pages/not-found.js` | empty state |

Shared CSS: `base.css` (tokens, reset, helpers), `layout.css` (shell, auth, public
frames), `components.css` (buttons, forms, panels, rows, table, badges, banner, feed,
dialog, toast, states).

## 4. Visual design and branding

- **Identity:** "BlackWater" wordmark with a pulse-line mark on a deep navy square
  (`--brand: #0c2b45`); one interaction accent, "deep water" blue (`--accent: #0b5f99`).
- **Tone:** light-first, calm, neutral cool-slate surfaces, colour reserved for status.
  `base.css` documents this direction explicitly.
- **Type:** system font stack, 12–24 px scale, tabular numbers for times.
- **Status language:** every state has a word, a shape and a colour: severity as signal
  bars, lifecycle status as dot / ring / check / dash, health as a coloured mark with its
  own icon. This is the strongest part of the design.

## 5. Strengths worth preserving

1. A real token system already exists (`:root` in `base.css`): colours, type scale,
   4 px spacing grid, radii, shadows, motion. Contrast was chosen deliberately (each
   status text colour passes 4.5:1).
2. Status never relies on colour alone (shape + word + colour).
3. Responsive behaviour is already deliberate: the incidents table becomes stacked rows
   below 761 px, the overview grid reorders by `grid-template-areas`, long unbroken user
   text wraps (`overflow-wrap: anywhere`), and there is **no horizontal overflow at any
   tested width from 320 to 1920 px**.
4. Native `<dialog>` for every modal (focus containment and Escape for free), skip links,
   visible `:focus-visible` rings, `prefers-reduced-motion` support, live-region toasts.
5. Internal vs public is visually unmistakable on the incident page: public updates have
   a blue left rule and a "Public update" badge; the composer explains what each choice
   means and warns when a public update would stay hidden on a private incident.
6. An automated accessibility suite (axe at desktop and phone, with menus and dialogs
   open) and keyboard tests already run in three engines in CI.

These are kept as they are. The work below refines; it does not replace.

## 6. UI/UX problems found

| # | Severity | Problem | Evidence |
|---|---|---|---|
| U1 | Medium | **No dark mode.** A tool that is opened during incidents, often at night, has no dark theme and ignores the operating system's preference. | No `prefers-color-scheme` or theme code anywhere in `public/` |
| U2 | Medium | **Overview leaves a large gap on desktop.** The grid has two rows (`'attention services' / 'resolved public'`); row 1 is as tall as the Services panel, so "Recently resolved" starts far below a short "Needs attention" list. | `layout.css` `.overview-grid`; screenshot `dashboard-1440.png` (≈90 px of empty space with 3 open incidents and 6 services; it grows with the number of services) |
| U3 | Low | **Unwanted space in definition lists.** `<dl>` keeps the browser's default `1em` top and bottom margin (the reset covers `h1–h4, p, ul, ol` only), so the incident "Details" panel has extra space above "Assignee" and the service "How health is set" list is pushed down. | `base.css` reset; `incident-1440.png`, `incident-375.png` |
| U4 | Low | **Phone header actions wrap unevenly.** On the incident page at 375 px, "Resolve incident" and "Edit" share a row and "Unpublish" sits alone below, each sized to its text. | `incident-375.png` |
| U5 | Low | **Public status page on a phone: each service takes two lines.** The general rule "on a phone a row's badges go under its text" also applies to the public service list, where a name and a short health label fit on one line even at 320 px. The list is twice as tall as needed. | `components.css` `@media (max-width: 600px) .row`; `status-375.png` |
| U6 | Low | **History repeats the date.** Public history rows are grouped under a day heading ("Nov 9, 2026") but each row repeats the full date and time. | `status.js` `paintHistory`; `status-1440.png` |
| U7 | Low | **Public footer is misaligned.** The footer's top border spans 24 px wider on each side than the content above it (`max-width: 820px` applied to a padded box). | `layout.css` `.public-footer`; `status-1440.png` |
| U8 | Low | **No field-level invalid styling.** Invalid fields rely on the browser's validation bubble only; `[aria-invalid]` styling exists but nothing sets it. | `components.css`; no `aria-invalid` in `public/js` |

Not problems (checked, and left alone):
- Public active incidents are ordered newest first by the API
  (`status.service.js`, `NEWEST_FIRST`), which is the usual status-page convention.
- The sidebar ends part-way down in full-page screenshots: it is `position: sticky;
  height: 100vh`, so in a real browser it always fills the viewport.

## 7. Mobile and tablet responsiveness

- **No overflow anywhere** (measured, 320–1920 px). Tables stack, toolbars wrap, long
  strings wrap.
- **R1 (accessibility, Medium): the navigation drawer does not contain focus.** With the
  drawer open at 375 px, the fifth Tab leaves the drawer and lands on the hidden
  "Open navigation" button, then "Declare incident", "Manage" … all behind the dimmed
  backdrop (script output: `IN … IN … OUT:BUTTON … OUT:BUTTON:Declare incident`). A
  keyboard or switch user loses their place, and focused elements are obscured (WCAG
  2.4.11 Focus Not Obscured).
- **R2 (Low): touch targets are desktop-sized on touch screens.** Small buttons are 30 px
  tall, small selects 32 px, nav links 36 px, the password toggle 30 px. All pass WCAG 2.2
  AA (24 px minimum, axe's `target-size` passes), but on a phone 40–44 px is markedly
  easier to hit.
- **U4, U5** above.
- Tablet (768 px) uses the drawer navigation and a single-column overview. That works
  and reads well; no change needed.

## 8. Desktop layout

- **U2** (overview gap) is the only real desktop layout problem.
- Content width (1160 px) and sidebar (240 px) suit 1366–1920 px: at 1366 px the
  content area is 1126 px, so nothing is cramped. **A collapsible desktop sidebar was
  considered and is not justified**: the sidebar holds four links and the content never
  needs more width, so it would add state, a control and tests for no gain.

## 9. Accessibility improvements needed

| # | Issue | WCAG |
|---|---|---|
| A1 | Drawer focus escapes behind the backdrop (R1) | 2.4.3, 2.4.11 |
| A2 | Settings labels "Name", "Email", "Name" have no `for`; inputs are named with a duplicate `aria-label`, and clicking the label does not focus the field | 1.3.1, 3.3.2 (good practice) |
| A3 | Theme and contrast: any dark theme must be measured, not eyeballed, and covered by the axe suite | 1.4.3, 1.4.11 |
| A4 | Native form controls (checkbox, scrollbars, select popups) must follow the theme (`color-scheme`) | 1.4.3 |

Already good: skip links, landmarks, headings, `aria-current`, live regions, native
dialogs, focus rings, reduced motion, colour-independent status.

## 10. Performance

- Three stylesheets (~970 lines total) and ~2,900 lines of JavaScript as ES modules, no
  framework, no web fonts, no images except an SVG favicon. Pages are fast.
- Module waterfall: a page module imports shared modules, which import `dom.js`/`icons.js`.
  At this size (a dozen small files over HTTP/1.1 or 2 from the same origin) this is not a
  measurable problem, and adding a bundler would contradict "no build step".
- Animations use `transform`/`opacity` only (except the skeleton shimmer, which animates
  `background-position` on small elements). No layout-thrashing JS was found.
- Constraint for new work: a theme script must be tiny and synchronous (it blocks first
  paint by design), and theme changes must not re-render pages.

## 11. Frontend technical debt

- ~20 hard-coded colours outside the token block (button text `#fff`, banner and error
  borders, the public-note tint, avatar colours, skeleton highlight, toast colours, the
  translucent top bar, the focus glow, the select chevron's SVG stroke). Harmless in one
  theme; each one is a dark-mode bug.
- `.header-badges` is used in three pages but has no CSS (harmless; a hook).
- Row markup is written out separately in several pages (attention row, service incident
  row, public rows). They are similar but not identical, and each is short. Not worth
  abstracting now.

## 12. Regressions to watch

- `changeDetector` and `repaintKeepingFocus`: live refreshes must still skip unchanged
  repaints and keep focus (two browser tests guard this).
- The CSP: no inline `<script>`, no `style` attributes, no inline styles. A theme script
  must be an external file.
- Locators the tests rely on: "Open navigation", `.user-button`, "Profile and settings",
  "Skip to content", role and label names on every form.
- The overview's phone order (attention, services, resolved, public) is asserted in
  spirit by the responsive tests and is deliberate.
- The public pages must keep showing only public fields: no change touches the API.

## 13. Recommended improvements, ranked

1. **Dark mode with semantic tokens** (U1, A3, A4): tokenise the ~20 hard-coded colours,
   add a measured dark palette, a System / Light / Dark choice that persists, no flash
   on load, and the axe suite run in dark too.
2. **Drawer focus containment** (A1/R1): make the rest of the page `inert` while the
   drawer is open.
3. **Overview layout** (U2): two independent columns on desktop, same order on phones.
4. **Touch-sized controls on touch screens** (R2): larger targets under
   `(pointer: coarse)` only, so desktop density is unchanged.
5. **Small layout fixes** (U3, U4, U5, U7): `dl` reset, phone action buttons, compact
   public service rows, footer alignment.
6. **Form feedback** (U8, A2): `:user-invalid` styling and linked labels.
7. **Public history timestamps** (U6): time only under each day, with the time zone.

Deliberately **not** recommended: a collapsible desktop sidebar (section 8), a new
typeface (the system stack is fast and suits a tool), animation libraries, decorative
charts or statistics the API does not provide, and restyling components that already
work.
