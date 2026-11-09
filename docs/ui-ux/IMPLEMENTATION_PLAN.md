# Frontend UI/UX: implementation plan

Written after the audit in [INITIAL_ASSESSMENT.md](INITIAL_ASSESSMENT.md). Finding codes
(U1, R1, A1 …) refer to that document. Branch: `improvement/frontend-ui-ux`.

## 1. Goal and constraints

Make BlackWater more polished, comfortable on phones and touch screens, and usable at
night, **without** changing what it is. Constraints that shape every phase:

- Vanilla HTML, CSS and ES modules; no framework, no build step, no new runtime
  dependencies.
- The Content-Security-Policy stays as strict as it is: no inline scripts, no inline
  styles, no `style` attributes.
- No backend, API or business-rule changes are planned. None of the findings needs one.
- Existing tests are not weakened. New behaviour gets new tests.

## 2. Research and design decisions

Products studied for specific decisions (not for their look): Linear and Vercel (dark
surfaces and theme switching), Atlassian Statuspage and current status-page guidance
(public page layout), Sentry and incident.io (incident timelines). Technical guidance:
MDN and web.dev on `color-scheme`, `inert` and `:user-invalid`; W3C's Understanding
document for WCAG 2.2 SC 2.5.8 (Target Size). Sources are listed in section 6.

| Decision | Why it fits BlackWater |
|---|---|
| **Dark theme as a second set of the same semantic tokens**, on `:root[data-theme='dark']` | Components already use tokens (`--surface`, `--text-2`, `--ok-text` …). Redefining the tokens, not the components, means one stylesheet and no duplicated selectors. |
| **Dark surfaces get lighter as they rise** (page < panel < menu/dialog), with a low-chroma blue-grey base | Shadows barely show on dark backgrounds, so elevation is carried by lightness, the approach Linear describes for its themes. A blue-grey base ("deep water") keeps the brand rather than going neutral black. |
| **Status colours are re-measured, not inverted** | Each dark status text colour is checked at ≥ 4.5:1 on its tint and on the panel; each solid mark at ≥ 3:1 (non-text contrast). Script: `tmp/contrast.mjs` during development; results in section 4. |
| **Three-way choice: System, Light, Dark; System is the default** | Respects the OS setting for people who never touch it, and gives a fixed choice to those who want one. Implemented as the existing `.segmented` radio group, so no new control type. |
| **Where the choice lives:** the user menu (app), the card footer (sign-in pages), the footer (public pages) | Theme is a personal preference, not navigation; it sits with "Profile and settings". Public visitors and signed-out users get the same control in the footer, where it is out of the way. |
| **No-flash start:** an external, synchronous `/js/theme-init.js` in `<head>` before the stylesheets | The usual advice is an inline script, but the CSP forbids inline scripts. A tiny same-origin classic script (not `type=module`, not `defer`) is allowed by `script-src 'self'` and still runs before first paint. |
| **`color-scheme` follows the theme** | Native checkboxes, scrollbars and select pop-ups then match the theme without custom styling. |
| **Drawer: `inert` on everything except the drawer** while it is open | Baseline (all engines since 2023). It removes the background from the Tab order and from assistive technology in one attribute, instead of a hand-written focus trap. |
| **Touch-sized controls under `@media (pointer: coarse)`** | WCAG 2.2 AA asks for 24 px and is already met; 40–44 px is the comfortable size for fingers. A pointer query enlarges targets on touch screens only, so the desktop keeps its density. |
| **`:user-invalid` for field errors** | Baseline widely available (2026). Marks a field red only after the person has interacted with it, never on page load. CSS only. |
| **Overview as two independent columns** on desktop, flattened to one ordered column on phones | Removes the row-height gap (U2) while keeping the phone order (attention, services, resolved, public). |
| **Public page: compact service rows; time-only history under day headings, with time zone** | Status-page guidance stresses scannable component lists and clear timestamps. A visitor from another country needs to know which time zone a time is in. |
| **Not adopted:** collapsible desktop sidebar, uptime bars, a new typeface, animation libraries | No data for uptime bars exists in the API (and inventing it is ruled out); the sidebar and type have no problem to solve; motion stays CSS-only. |

## 3. Phases

Each phase ends with lint, the relevant tests and a visual check before the next one.
A phase is committed on its own.

### Phase 0: audit and baseline (done)
Output: `INITIAL_ASSESSMENT.md`, curated baseline screenshots in
`screenshots/baseline/`, baseline test results.

### Phase 1: research and direction (done; this document)

### Phase 2: foundation, tokens and design system
- Move every hard-coded colour in the three stylesheets into named tokens
  (`--on-accent`, `--surface-raised`, `--ok-border`, `--toast-bg`, `--avatar-bg`,
  `--select-chevron`, `--focus-ring`, `--topbar-bg` …), with identical light values.
- Reset `dl`/`dd` margins (U3).
- Acceptance: light theme pixel-identical in intent (screens compared side by side);
  `grep` finds no colour literal outside the token blocks except the auth brand panel,
  which is fixed in both themes by design; all tests green.

### Phase 3: main application screens
- Overview two-column layout (U2).
- Incident header actions on phones (U4).
- Settings labels linked to inputs (A2).
- Field feedback with `:user-invalid` (U8).
- Acceptance: no gap under "Needs attention" at 1366–1920 px; phone order unchanged;
  clicking a Settings label focuses its field; a required field turns red only after
  interaction.

### Phase 4: public status page
- Compact service rows on phones (U5), time-only history with time zone (U6), footer
  alignment (U7).
- Acceptance: one line per service at 320 px with no overflow; the public API calls and
  their fields are unchanged (no code path reads anything new).

### Phase 5: dark mode
- `theme-init.js` (classic script) and `theme.js` (module: read, save, apply, follow the
  OS while "System", the toggle component). Dark token set. Toggle in the user menu,
  auth card footer and public footer. Script tag in all 12 HTML pages.
- Acceptance: every page in both themes at desktop and phone; the choice survives
  navigation and reload; "System" follows an OS change live; no light flash when loading
  a page in dark; axe passes in dark at desktop and phone.

### Phase 6: mobile and touch
- Drawer focus containment with `inert` (A1/R1); touch-sized targets (R2).
- Acceptance: Tab never leaves the open drawer; Escape and the backdrop still close it
  and return focus; on a touch device buttons, nav links, tabs and selects are ≥ 40 px
  tall; no overflow at 320–1920 px.

### Phase 7: interactions and polish
- Theme switch without transitions flashing across the page; check every transition
  still respects reduced motion; check hover/focus states in dark.
- Acceptance: no new animation library; nothing moves when `prefers-reduced-motion`.

### Phase 8: quality assurance
- `npm run lint`, `npm test`, `npm run test:e2e` (Chromium), WebKit locally, Firefox in
  the Linux Playwright container (it cannot start on this Mac), the Docker image job via
  CI.
- New tests: theme persistence, system following, no-flash attribute before scripts,
  axe in dark mode, drawer focus containment, overview order on phones, touch target
  size under a coarse pointer.
- Screenshot harness again, light and dark, 7 viewports; overflow and console errors.

### Phase 9: documentation
- `IMPLEMENTATION_GUIDE.md`, `VERIFICATION_REPORT.md`, `INTERVIEW_PREPARATION.md`;
  README screenshots refreshed if they changed materially; README mentions dark mode.

### Phase 10: release readiness
- Review the whole diff (no backend changes, no secrets, no generated files), rerun
  every suite, push the branch, open a pull request into `main` (not merged), confirm CI.

## 4. Proposed tokens

Light values are the existing ones (unchanged) plus names for previously hard-coded
colours. Dark values were measured with a WCAG contrast script (40 pairs, all passing).

| Token | Light | Dark | Measured (dark) |
|---|---|---|---|
| `--bg` | `#f5f6f8` | `#0c1218` | text 15.8:1 |
| `--surface` | `#ffffff` | `#121a22` | text 14.8:1, text-3 6.4:1 |
| `--surface-sunken` | `#f0f2f5` | `#0f161d` | text-3 6.6:1 |
| `--surface-raised` (menus, dialogs, active segment) | `#ffffff` | `#18212b` | text-3 5.9:1 |
| `--border` / `--border-strong` | `#e2e5ea` / `#cdd2da` | `#243039` / `#334250` | decorative |
| `--border-input` | `#848e9d` | `#66778a` | 3.8:1 on surface (≥ 3) |
| `--text` / `--text-2` / `--text-3` | unchanged | `#e6ecf2` / `#b4c0cc` / `#909dab` | ≥ 5.8:1 on every surface |
| `--accent` (button fill, white text) | `#0b5f99` | `#2370b0` | 5.2:1 |
| `--accent-hover` | `#084c7b` | `#1b5f97` | ≥ 4.5:1 |
| `--accent-text` (links) | `#0a5a91` | `#7ab8ec` | 8.3:1 |
| `--focus` | `#1a73c6` | `#5aa8ea` | 6.9:1 (≥ 3) |
| `--ok-text` / `--ok-bg` / `--ok` | unchanged | `#62d394` / `#0f2a1d` / `#2ea56a` | 8.2:1; mark 5.6:1 |
| `--degraded-*` | unchanged | `#e9b949` / `#2a2110` / `#d39b16` | 8.7:1; mark 7.1:1 |
| `--partial-*` | unchanged | `#f4a06a` / `#2e1c11` / `#e2702a` | 7.8:1; mark 5.5:1 |
| `--major-*` | unchanged | `#f5948b` / `#341716` / `#e5483d` | 7.4:1; mark 4.5:1 |
| `--danger` (button fill) | `#c0261c` | `#c4312a` | 5.5:1 |
| `--on-status` (icon inside a health mark) | `#ffffff` | `#0c1218` | ≥ 4.7:1 on every mark |
| `--toast-bg` | `#111a24` | `#243241` | 13.1:1 |
| `--avatar-bg` / `--avatar-text` | `#dfe8f1` / `#24405b` | `#22384d` / `#d3e3f2` | 9.2:1 |

## 5. Risks

| Risk | Mitigation |
|---|---|
| A colour missed in dark mode | `grep` for literals; axe in dark on every page with menus and dialogs open; screenshots of every page in dark |
| `theme-init.js` fails (storage blocked) | Every storage access in `try`; the fallback is the OS preference, then light |
| `inert` left on after the drawer closes | Removed in the same function that closes it; Escape, backdrop and the button all go through it; tested |
| Coarse-pointer rules change desktop layout | They apply only under `(pointer: coarse)`; desktop Playwright projects use a fine pointer; a separate test emulates touch |
| Overview column change reorders content for screen readers | DOM order is attention, resolved (main column), services, public (side column) on desktop; on phones the columns become `display: contents` and CSS `order` restores attention, services, resolved, public. Both orders are logical; the phone order is tested |

## 6. Sources

- MDN, `HTMLElement.inert`: <https://developer.mozilla.org/docs/Web/API/HTMLElement/inert>
- web.dev, "The inert attribute": <https://web.dev/articles/inert>
- MDN, `:user-invalid`: <https://developer.mozilla.org/docs/Web/CSS/:user-invalid>
- web.dev, Baseline digest May 2026: <https://web.dev/blog/baseline-digest-may-2026>
- W3C, Understanding SC 2.5.8 Target Size (Minimum): <https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html>
- Linear, "How we redesigned the Linear UI": <https://linear.app/blog/how-we-redesigned-the-linear-ui>
- CSS-Tricks and Maxime Heckel on avoiding the dark-mode flash: <https://blog.maximeheckel.com/posts/switching-off-the-lights-part-2-fixing-dark-mode-flashing-on-servered-rendered-website/>
- `color-scheme` mechanics: <https://camoa.github.io/dev-guides/css/modern-css/color-scheme-dark-mode/>
- Status page guidance: <https://www.openstatus.dev/docs/concept/best-practices-status-page.md>, <https://isdown.app/blog/status-page-examples>
