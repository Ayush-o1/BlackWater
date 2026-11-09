# Frontend UI/UX: implementation guide

What changed in the frontend, how each part works, and why it was done that way.
Written so that you can explain any of it in an interview. File references are to the
branch `improvement/frontend-ui-ux`.

Read in this order: section 1 (the big picture), 2–4 (theming, the largest change),
5–6 (responsive work), then the rest as needed.

---

## 1. The big picture

BlackWater's interface is plain HTML, CSS and JavaScript modules with no framework
and no build step. Each URL has a tiny HTML file that loads three stylesheets and one
page module. The page module builds the DOM with a helper called `h()`
(`public/js/dom.js`) and fills it with data from the API.

This work kept that architecture and changed four kinds of thing:

| Area | What changed | Main files |
|---|---|---|
| Design system | Every colour became a named **token** (a CSS custom property) | `public/css/base.css` |
| Dark theme | A second set of token values, a no-flash start script, a theme module and a switcher | `base.css`, `public/js/theme-init.js`, `public/js/theme.js` |
| Responsive and touch | Overview grid, phone header buttons, public service rows, touch-sized controls, drawer focus | `layout.css`, `components.css`, `public/js/shell.js` |
| Small UX fixes | Definition list spacing, linked labels, `:user-invalid`, time zones, footer alignment, team rows | various |

Nothing in `src/` (the backend), the API or the database changed.

---

## 2. CSS architecture and design tokens

### The three stylesheets

| File | Holds | Rule of thumb |
|---|---|---|
| `public/css/base.css` | Tokens, reset, typography, tiny helpers (`.stack`, `.muted`) | Things every page needs |
| `public/css/layout.css` | Page frames: the app shell, sign-in pages, public status pages | Where things go |
| `public/css/components.css` | Buttons, forms, panels, badges, tables, dialogs, toasts | What things look like |

They load in that order, which matters: when two rules have the **same specificity**,
the later file wins. That caused one bug during this work (section 6.4).

### What a token is

A CSS custom property is a variable that CSS itself understands:

```css
:root { --surface: #ffffff; }               /* define it */
.panel { background: var(--surface); }      /* use it */
```

`:root` is the `<html>` element. Custom properties **inherit**, so a value defined on
`<html>` is visible to every element in the page.

### Semantic names, not colour names

The tokens describe a *role*, not a colour: `--surface` (a panel's background),
`--text-3` (the quietest text), `--ok-text` (text on a green tint), `--on-accent` (text
on a filled blue button). That is what makes theming possible: in the dark theme
`--surface` is a dark blue-grey, but every component that says
`background: var(--surface)` is still correct.

### What Phase 2 did

Before this work, about 20 colours were written directly in components, for example
`.toast { background: var(--text); color: #fff; }` or a banner border `#bfe3cd`. Each
of these would have been wrong in a dark theme (the toast would have become white
text on a light background). They were moved into tokens such as `--toast-bg`,
`--toast-text`, `--ok-border`, `--avatar-bg`, `--focus-ring`, `--surface-raised` and
`--ghost-hover`, with **exactly the same light values**, so the light theme did not
change. A pixel comparison of every page before and after confirmed it (only the
intended `<dl>` spacing fix differed).

Only the sign-in page's navy brand panel keeps literal colours, on purpose: it is the
brand, the same in both themes.

### One special case: the select arrow

A `<select>` draws its arrow as an SVG background image, and an image cannot inherit
the text colour. So the whole image is a token:

```css
--select-chevron: url("data:image/svg+xml,...stroke='%235b6676'...");
.select { background-image: var(--select-chevron); }
```

The dark theme supplies the same SVG with a lighter stroke (`%23909dab`; `%23` is an
encoded `#`).

---

## 3. How light and dark mode work

### The mechanism in one sentence

`<html>` carries `data-theme="light"` or `data-theme="dark"`, and the dark values of
the tokens are defined for `:root[data-theme='dark']`.

```css
/* base.css */
:root {                         /* light, the default */
  color-scheme: light;
  --bg: #f5f6f8;
  --surface: #ffffff;
  ...
}
:root[data-theme='dark'] {      /* same names, dark values */
  color-scheme: dark;
  --bg: #0c1218;
  --surface: #121a22;
  ...
}
```

Changing the attribute changes every token at once, and the browser recolours the page.
No JavaScript re-renders anything.

### `color-scheme`

`color-scheme: dark` tells the browser to draw **its own** parts dark: scrollbars,
checkboxes, the drop-down list of a `<select>`, the page canvas. Without it you get a
dark page with white scrollbars.

### How the dark colours were chosen (not inverted)

- **Elevation by lightness.** In light mode a dialog stands out with a shadow. Shadows
  hardly show on a dark background, so in dark mode things get *lighter* as they rise:
  page `#0c1218` < panel `#121a22` < menu or dialog `#18212b` (`--surface-raised`).
- **A blue-grey base**, not black, so the "deep water" brand carries over.
- **Every pair was measured.** A small script computed the WCAG contrast ratio for 40
  text/background pairs. Text needs 4.5:1; input borders, focus rings and status marks
  need 3:1. One proposal failed (white on the hover blue, 4.37:1), so the dark hover
  was made darker instead of lighter. The table is in `IMPLEMENTATION_PLAN.md`.
- **Status icons flip.** Inside a green/amber/red health mark the icon is white in light
  mode and dark in dark mode (`--on-status`), because the dark-theme marks are brighter.
- axe (the automated accessibility checker) now runs on every page **in both themes**,
  so a contrast regression fails the test suite.

---

## 4. How the theme preference persists, without a flash

There are three possible preferences: `system` (the default), `light`, `dark`.

### Saving it: `localStorage`

`localStorage` is a small key/value store the browser keeps per site, across reloads
and restarts. The key is `blackwater.theme`. "System" is stored by *removing* the key,
so "nothing stored" and "system" mean the same thing.

Every access is wrapped in `try … catch`, because some browsers' private modes throw
when you touch storage. The fallback is the system setting.

### The flash problem

If the theme were applied by the normal page module, the browser would first paint the
page in light colours (the default), and then switch to dark a moment later: a white
flash on every page load.

Why? `<script type="module">` is **deferred** by default: it runs only after the HTML
has been parsed, and the browser may paint before that.

### The fix: `public/js/theme-init.js`

An **ordinary** (classic) script in `<head>`, **before** the stylesheets:

```html
<script src="/js/theme-init.js"></script>
<link rel="stylesheet" href="/css/base.css" />
```

A classic script without `defer` or `async` blocks the HTML parser until it has run,
so `data-theme` is set before anything can be painted. The script is 10 lines and does
only that:

```js
{
  let preference = null;
  try { preference = localStorage.getItem('blackwater.theme'); } catch {}
  const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const dark = preference === 'dark' || (preference !== 'light' && systemDark);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
}
```

Two details worth knowing:

- **Why a file and not inline `<script>…</script>`?** The usual advice is an inline
  script. BlackWater's Content-Security-Policy (`src/app.js`, via helmet) forbids inline
  scripts, which is an important XSS defence. A same-origin file is allowed by
  `script-src 'self'`, and still blocks parsing.
- **Why the `{ … }` block?** Top-level `const`/`let` in classic scripts share one global
  scope across all classic scripts on the page. The block keeps them private.

`tests/integration/pages.test.js` checks every HTML page for this tag, its position
and the absence of `type="module"`, `defer` and `async`. A browser test
(`e2e/theme.spec.js`, "set before any page script runs") blocks every page module and
proves the page is still dark.

### The module: `public/js/theme.js`

| Function | Line | What it does |
|---|---|---|
| `getThemePreference()` | 25 | Reads the stored choice; anything invalid or missing means `system` |
| `resolveTheme(preference)` | 35 | Turns `system` into `light` or `dark` using `matchMedia` |
| `applyTheme()` | 37 | Sets `data-theme` on `<html>` (and suppresses transitions, below) |
| `setThemePreference(p)` | 52 | Saves the choice and applies it |
| `themeSwitcher()` | 89 | Builds the System / Light / Dark control |

**Following the operating system live** (line 68): `matchMedia('(prefers-color-scheme:
dark)')` returns an object that fires `change` when the OS switches (for example at
sunset). The handler is `applyTheme`, which re-reads the preference, so it only has an
effect while the preference is `system`.

**Keeping tabs in step** (line 72): when one tab writes to `localStorage`, the browser
fires a `storage` event in every *other* tab of the same site. The handler re-applies
the theme and updates the radios.

**No flicker while switching** (`applyTheme`): buttons and rows have short colour
transitions for hover. Without care, each would fade separately to the new theme. The
function adds a `theme-changing` class whose CSS turns transitions off, sets the
attribute, forces the browser to apply styles (`getComputedStyle(root).color`), and
removes the class two animation frames later, after the new colours are drawn.

### The switcher

It reuses the existing `.segmented` control: real radio buttons inside labels.
Radios give keyboard support for free (Tab into the group, arrow keys move and choose).
The options show icons only, to fit in the user menu; each has a visually hidden text
label (what a screen reader announces) and a `title` (a tooltip for mouse users). The
group is a `<fieldset>` with a `<legend>`, the native way to name a group of radios.
Browsers lay legends out specially, so the visible word "Theme" next to the control is
a separate element marked `aria-hidden` (so it is not read twice).

One `change` listener sits on the fieldset, not on each radio: `change` **bubbles** up
from the radio that was chosen, and `event.target.value` says which one.

It appears in three places, chosen because theme is a personal preference rather than
navigation:

- the user menu (`public/js/shell.js:71`), between "Profile and settings" and "Sign out";
- under the sign-in, registration and invitation forms (`public/js/authLayout.js`);
- in the public status page footer (`public/js/publicLayout.js`). A visitor defaults
  to their own OS setting.

---

## 5. How the responsive breakpoints work

### Media queries

A media query applies rules only when a condition holds:

```css
@media (max-width: 900px) { /* only at 900px wide or less */ }
```

The breakpoints in this codebase come from where the *layout* stops working, not from
device names:

| Width | What changes | Why there |
|---|---|---|
| ≤ 1080px | Overview and incident page become one column | Two columns plus a 240px sidebar no longer fit |
| ≤ 900px | Sidebar becomes a drawer behind a menu button | Sidebar plus content no longer fit |
| ≤ 760px | Incidents and services tables become stacked rows | Five table columns no longer fit |
| ≤ 600px | Rows wrap, header actions share the width, toolbar stacks | Phone widths |

### Input, not width: `(pointer: coarse)`

Width says nothing about *how* someone is pointing. A 1000px-wide tablet is touched with
a finger; a narrow laptop window still has a mouse. So touch sizing uses a different
media feature:

```css
@media (pointer: coarse) { .btn, .input, .select { min-height: 44px; } ... }
```

`pointer: coarse` matches when the main pointing device is imprecise (a finger).
`components.css:522` grows buttons, inputs, selects, tabs, nav links and menu items to
40–44px there, and leaves the compact desktop sizes alone everywhere else. WCAG 2.2's
minimum (24px) was already met; 44px is the comfortable size for a fingertip.

### Grid: the overview layout (`layout.css:205`)

Before: two rows, `'attention services' / 'resolved public'`. A grid row is as tall
as its tallest item, so a long services list made row 1 tall and opened a gap under
"Needs attention".

After:

```css
.overview-grid {
  grid-template-columns: minmax(0, 1fr) 340px;
  grid-template-areas:
    'attention services'
    'resolved  services'
    'public    services';
  grid-template-rows: auto auto 1fr;
}
```

Services now **spans** all three rows, and only the last row is flexible (`1fr`). The
grid sizing algorithm handles an item that spans a flexible track by growing only the
flexible track. So rows 1 and 2 stay exactly as tall as the panels on the left, which
then stack with no gap.

Why not two wrapper columns? That would change the HTML order, so on a phone (one
column) the order would become attention, resolved, services, public. Fixing that
with CSS `order` would make the visual order differ from the keyboard and
screen-reader order (a WCAG problem). The grid solution keeps the DOM order, the phone
order and the Tab order identical.

`minmax(0, 1fr)` rather than `1fr`: a plain `1fr` column refuses to shrink below its
content's minimum width, so one long unbroken word could widen the page. `minmax(0, …)`
lets it shrink.

### Flexbox: small layouts

Flexbox lays things out along one line, wrapping if allowed. Examples from this work:

- **Phone header actions** (`layout.css:184`): `.page-actions > .btn { flex: 1 1 auto; }`.
  `flex: grow shrink basis`: each button starts at its natural width (`auto`) and may
  grow (`1`) to share the line's leftover space. Three buttons now fill two lines evenly
  instead of leaving a lone, narrow third button.
- **Compact public service rows** (`components.css:196`): on phones, rows normally wrap
  their badges onto a second line. A service's health label is short, so `.row-compact`
  sets `flex-wrap: nowrap` to keep it beside the name, even at 320px.
- **Team member rows** (`components.css:362`): the avatar used to sit alone on a line
  above the name on phones, because its container allowed wrapping. `.member-identity`
  does not wrap, and its text column has `min-width: 0` so long emails shrink and wrap
  inside it instead of pushing the row wider (flex items default to `min-width: auto`,
  which refuses to shrink below content).

### `min()` for the footer

`.public-footer { width: min(820px - 2 * var(--space-6), 100% - 2 * var(--space-6)); }`
means "the content width of the main column, or the screen minus its padding, whichever
is smaller". The footer's top border now lines up with the content above it.

---

## 6. How the mobile navigation works

The code is `renderShell()` in `public/js/shell.js` (around lines 90–145).

### 6.1 Opening and closing

At 900px or less the sidebar is `position: fixed`, moved off-screen with
`transform: translateX(-100%)` and hidden with `visibility: hidden`. The menu button
toggles a `data-nav-open` attribute on the app root, and CSS slides it in:

```css
.app[data-nav-open] .sidebar { transform: none; visibility: visible; }
```

`transform` is used for the movement because the browser can animate it on the
compositor without recalculating layout. `visibility: hidden` (not just off-screen)
matters: hidden elements cannot receive focus, so a keyboard user cannot Tab into a
closed drawer.

### 6.2 `setNav(open)` and `inert` (`shell.js:117`)

The bug found in the audit: with the drawer open, Tab moved focus out of the drawer onto
buttons hidden behind the dimmed backdrop.

The fix is one attribute:

```js
mainColumn.inert = open;
skipLink.inert = open;
```

`inert` makes an element and everything inside it non-interactive: it cannot be
focused or clicked, and screen readers skip it. This is what a native `<dialog>` does
to the rest of the page automatically. Here it is done by hand, because the drawer is
not a `<dialog>`. Focus can still go to the browser's own controls (address bar),
which is expected, and then comes back into the drawer.

### 6.3 Consequences handled

- **A way out.** The menu button lives in the top bar, which is now inert, so it cannot
  close the drawer. Escape and a tap on the backdrop still work, but a screen-reader
  user on a phone reaches neither. So the drawer has its own "Close navigation" button
  (`shell.js:95`), shown only at drawer widths.
- **Resizing.** If the window is widened past 900px while the drawer is open, the drawer
  becomes an ordinary sidebar, but the page would stay inert. `matchMedia('(max-width:
  900px)')` fires `change` when the width crosses 900px, and the handler closes the
  drawer (`shell.js:134`).
- **Focus management.** Opening moves focus to the first navigation link; closing with
  Escape or the close button returns it to the menu button, so a keyboard user is never
  left on `<body>`.

### 6.4 A specificity bug, found by screenshot

The close button first showed on desktop too. It has the classes `btn … sidebar-close`;
`layout.css` said `.sidebar-close { display: none }`, but `components.css` (loaded later)
says `.btn { display: inline-flex }`. Same specificity (one class each), so the later
file won. The fix uses two classes, `.sidebar .sidebar-close`, which outranks one. The
drawer test now asserts the button is hidden on desktop.

---

## 7. Important new or modified JavaScript

| Where | What | Why |
|---|---|---|
| `js/theme-init.js` | Sets `data-theme` before first paint | No flash; CSP-compatible |
| `js/theme.js` | Preference, OS following, tab sync, switcher | Section 4 |
| `js/shell.js` `setNav` | `inert`, close button, resize handler | Section 6 |
| `js/shell.js` user menu | Contains the theme switcher | Personal preference lives with the profile |
| `js/ui.js:22-25` | `formatTimeWithZone`, `formatDateTimeWithZone` | Public pages name the time zone |
| `js/pages/status.js` | History rows show time only; `row-compact` services | Day is already the heading |
| `js/pages/settings.js` | Labels linked with `for`/`id`; `member-identity` | Clicking a label focuses its field |
| `js/icons.js` | `sun`, `moon`, `monitor` | Switcher icons |

### `Intl.DateTimeFormat` and time zones

`new Intl.DateTimeFormat(undefined, {...})` formats dates in the **visitor's** locale
and time zone (`undefined` means "the browser's default"). With
`timeZoneName: 'short'` it appends the zone ("9:34 AM GMT+5:30"). One gotcha:
`dateStyle`/`timeStyle` cannot be combined with `timeZoneName` (it throws), so the
public formatters list the fields explicitly.

---

## 8. Reusable UI pieces

| Piece | Where | Used by |
|---|---|---|
| Tokens | `base.css` | Everything |
| `.segmented` radio group | `components.css` | Update visibility (internal/public), theme switcher |
| `themeSwitcher()` | `theme.js` | Shell, sign-in pages, public pages |
| `.row`, `.row-compact` | `components.css` | Every list; compact for service/health rows |
| `.member-identity` | `components.css` | Team rows |

The rule followed: extend an existing component with a modifier class
(`.segmented-icons`, `.row-compact`) instead of creating a near-duplicate.

---

## 9. Accessibility improvements

| Change | Why it matters |
|---|---|
| Drawer focus contained with `inert`, plus a close button | Keyboard and screen-reader users cannot get lost behind the backdrop (WCAG 2.4.3, 2.4.11) |
| Settings labels tied to inputs with `for`/`id` | The visible label *is* the accessible name; clicking it focuses the field (WCAG 1.3.1, 2.5.3) |
| Dark theme measured to AA, and axe runs in both themes | Contrast cannot silently regress (WCAG 1.4.3, 1.4.11) |
| `color-scheme` follows the theme | Native controls stay readable |
| Theme switcher is native radios in a fieldset | Arrow keys, focus ring and announcements work with no ARIA |
| Touch-sized controls on coarse pointers | Easier for everyone on a phone, essential for people with tremors |
| `:user-invalid` | A field is marked red only after interaction, never on a fresh form |
| Read-only fields use the neutral tint | They never look editable, in either theme |

ARIA was added in one place only (`aria-hidden` on the duplicate "Theme" word).
Everything else uses native HTML, as the WAI's first rule of ARIA recommends.

---

## 10. Animation and transition decisions

- No animation library, and no new animations.
- The existing ones are short (120–180ms) and use `transform` and `opacity`, which the
  browser animates without recalculating layout.
- Theme changes **switch off** transitions for a frame (section 4), because a theme
  change is not something to watch.
- `prefers-reduced-motion: reduce` already sets every animation and transition to
  ~0ms in `base.css`. Everything added here inherits that.

---

## 11. Files to revisit

1. `public/css/base.css`: the two token blocks. Read the light block and the dark
   block side by side.
2. `public/js/theme-init.js` and `public/js/theme.js`: the whole theme feature, ~120
   lines.
3. `public/js/shell.js`, `setNav` and the drawer comments.
4. `public/css/layout.css`, `.overview-grid` and its comment.
5. `public/css/components.css`, the `@media (pointer: coarse)` block at the end.
6. `e2e/theme.spec.js`, `e2e/layout.spec.js` and the new drawer test in
   `e2e/accessibility.spec.js`, to see how each behaviour is proven.

---

## 12. How to change the theme in the future

- **Change a colour everywhere:** edit its token in `base.css`, in the light block, the
  dark block, or both. Never put a colour literal in a component.
- **Add a new colour:** add a token to *both* blocks, then use `var(--your-token)`.
  Measure its contrast in both themes (text 4.5:1, borders and icons 3:1).
- **Re-brand the accent:** change `--accent`, `--accent-hover`, `--accent-soft`,
  `--accent-text`, `--accent-border`, `--focus` and `--focus-ring` in both blocks.
  White text on `--accent` and `--accent-hover` must stay at 4.5:1 or more.
- **Add a third theme** (e.g. high contrast): add `:root[data-theme='contrast'] { … }`,
  allow the value in `PREFERENCES` and `resolveTheme` (`theme.js`) and in
  `theme-init.js`, and add an option to `themeSwitcher()`.
- **Check your work:** `npx playwright test e2e/accessibility.spec.js` runs axe on every
  page in both themes, at desktop and phone width.
