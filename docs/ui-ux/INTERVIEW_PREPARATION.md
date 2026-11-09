# Frontend UI/UX work: interview preparation

For presenting the frontend improvements to BlackWater in a technical interview.
Everything here refers to code that exists on the `improvement/frontend-ui-ux` branch;
[IMPLEMENTATION_GUIDE.md](IMPLEMENTATION_GUIDE.md) has the full explanations.

---

## 1. The 60-second version

> BlackWater is an incident-management app with a public status page, built with plain
> HTML, CSS and JavaScript modules: no framework, no build step, and a strict
> Content-Security-Policy. I audited the frontend in the browser at seven viewport
> widths, then improved it without changing the architecture or the backend.
>
> The biggest piece was a dark theme. I first moved every hard-coded colour into
> semantic CSS custom properties, so the dark theme is just a second set of values for
> the same tokens. I measured every colour pair for WCAG contrast, and the axe checks
> now run in both themes. The theme is set by a tiny blocking script in the `<head>`
> so there is no flash on load. It had to be a file rather than inline code, because
> the CSP forbids inline scripts.
>
> I also fixed an accessibility bug where keyboard focus escaped the mobile navigation
> drawer (fixed with the `inert` attribute), made controls touch-sized only on touch
> screens using `pointer: coarse`, and fixed a dashboard layout gap with CSS Grid.
> Every change has a browser test, and I checked that the tests fail without the fix.
> The suite went from 42 to 57 browser tests, all passing in Chromium, Firefox and WebKit.

---

## 2. Learning checklist (in priority order)

Learn these in order; each one is used in the code.

### Must know (asked about almost certainly)

- [ ] **CSS custom properties**: definition on `:root`, `var()`, inheritance, redefining
      them under a selector (`:root[data-theme='dark']`). *Where:* `public/css/base.css`.
- [ ] **Semantic vs literal tokens**: why `--surface` instead of `--white`.
- [ ] **How the browser loads a page**: parsing, render-blocking CSS, classic scripts
      block the parser, `defer`, `async`, `type="module"` (deferred by default), first
      paint. *Where:* `public/js/theme-init.js` and the `<head>` of every HTML file.
- [ ] **`localStorage`**: per-origin, strings only, synchronous, can throw, the `storage`
      event. *Where:* `public/js/theme.js`.
- [ ] **`matchMedia`** in JavaScript and its `change` event. *Where:* `theme.js`,
      `shell.js`.
- [ ] **Media queries**: `max-width`, `prefers-color-scheme`, `prefers-reduced-motion`,
      `pointer: coarse`. Why breakpoints should come from the layout, not device names.
- [ ] **WCAG contrast**: 4.5:1 for normal text, 3:1 for large text and for UI parts
      (borders, focus rings, icons). What axe can and cannot detect.

### Should know (likely follow-ups)

- [ ] **CSS Grid**: `grid-template-areas`, spanning, `fr` units, `minmax(0, 1fr)`, and
      why a spanning item only grows flexible tracks. *Where:* `.overview-grid` in
      `layout.css`.
- [ ] **Flexbox**: `flex: 1 1 auto`, `flex-wrap`, and `min-width: 0` (flex items do not
      shrink below their content by default). *Where:* `.page-actions`, `.row-compact`,
      `.member-identity`.
- [ ] **Specificity and source order**: why `.sidebar .sidebar-close` beats `.btn`, and
      why the bug happened.
- [ ] **Focus management**: `inert`, native `<dialog>` and `showModal()`, returning focus
      to the trigger, `:focus-visible`.
- [ ] **Event delegation and bubbling**: one `change` listener on the fieldset.
- [ ] **Content-Security-Policy**: `script-src 'self'`, why inline scripts are blocked,
      how that shaped the no-flash script.

### Good to know (shows depth)

- [ ] `color-scheme` and what it changes (native controls, scrollbars, canvas).
- [ ] `:user-invalid` vs `:invalid`.
- [ ] `Intl.DateTimeFormat` options, `timeZoneName`, and why `dateStyle` cannot be
      combined with it.
- [ ] Forcing a style recalculation (`getComputedStyle`) and `requestAnimationFrame`.
- [ ] Playwright: locators by role and label, `emulateMedia`, `page.route`, contexts vs
      pages, `hasTouch`.

---

## 3. Questions and answers

### Basic

**Q: What are CSS custom properties, and how did you use them?**
Variables that CSS itself resolves at runtime, written `--name: value` and read with
`var(--name)`. They inherit like other properties, so values defined on `:root` (the
`<html>` element) are available everywhere. BlackWater defines semantic tokens on
`:root` (`--surface`, `--text-2`, `--ok-text` …) and components only use those. The
dark theme redefines the same names on `:root[data-theme='dark']`.

**Q: How does a user switch theme?**
In the user menu (or the footer on public and sign-in pages) there is a System / Light
/ Dark choice made of radio buttons. Choosing one saves it to `localStorage` and sets
`data-theme` on `<html>`. The CSS for that attribute redefines the colour tokens, and
the browser repaints. No component re-renders.

**Q: Why three options and not a toggle?**
"System" respects the operating system setting, including when it changes at sunset,
and is the right default for people who never touch the setting. A two-state toggle
would force everyone into a fixed choice the moment they used it, with no way back to
following the OS.

**Q: What is `prefers-color-scheme`?**
A media feature reporting the OS light/dark setting. In CSS it is
`@media (prefers-color-scheme: dark)`; in JS, `matchMedia('(prefers-color-scheme:
dark)').matches`, plus a `change` event when it changes.

**Q: What does `inert` do?**
Makes an element and its subtree non-interactive: no focus, no clicks, and hidden from
assistive technology. I set it on the page behind the open mobile drawer so Tab cannot
reach controls hidden under the backdrop.

### Intermediate

**Q: How do you avoid the flash of the wrong theme on load?**
The page module runs too late: module scripts are deferred until the HTML is parsed,
and the browser can paint before then. So every page loads a tiny classic script in
`<head>` before the stylesheets. Classic scripts without `defer`/`async` block the
parser, so `data-theme` is set before the first paint. It reads `localStorage`, falls
back to `matchMedia`, and sets the attribute. Nothing else.

**Q: Why not an inline script, which is the usual advice?**
The app's Content-Security-Policy forbids inline scripts (`script-src 'self'` without
`'unsafe-inline'`). That is a core XSS defence and I did not want to weaken it, for
example with a hash or nonce exception, for a theme. A same-origin file is allowed and
blocks parsing the same way. The cost is one extra small request, cached after the
first page.

**Q: How did you make sure the dark theme is accessible?**
Three ways. I measured every text/background pair with a contrast script before writing
the CSS (40 pairs; one failed and I changed the colour). The axe suite now runs on every
page in both themes at desktop and phone width, with menus and dialogs open. And I
reviewed screenshots of every page at seven widths in dark mode, which is how I found
issues axe does not flag, such as a hover state that was too subtle.

**Q: Why are dark surfaces lighter for elevated elements?**
In light mode, elevation is shown with shadows. On a dark background a shadow is barely
visible, so elevation is shown by lightness instead: page, then panel, then menu or
dialog, each slightly lighter.

**Q: Explain the overview layout fix.**
The grid had two rows, and a row is as tall as its tallest item. A long services list
made row 1 tall and left a gap under the short "Needs attention" panel beside it. I made
the services panel span three rows and made only the last row flexible (`1fr`). When an
item spans a flexible track, the grid algorithm grows only that flexible track, so the
fixed rows on the left stay tight. I kept the HTML order, so on phones (one column) the
order and the Tab order are unchanged.

**Q: Why `pointer: coarse` instead of a width breakpoint for touch targets?**
Width does not tell you the input device. A large tablet is touched with a finger; a
narrow desktop window is used with a mouse. `pointer: coarse` matches when the main
pointer is imprecise, so touch screens get 44px controls while desktops keep the denser
36px ones.

### Follow-up and edge cases

**Q: What happens if `localStorage` throws?**
Every access is in `try`/`catch`. `theme-init.js` falls back to the OS preference;
`getThemePreference()` returns `system`; `setThemePreference()` applies the choice to
the current page even though it cannot be saved.

**Q: What if the user widens the window while the mobile drawer is open?**
The drawer becomes a normal sidebar above 900px, but the page would still be inert,
which would make the whole app unusable. A `matchMedia('(max-width: 900px)')` listener
closes the drawer when the width crosses the breakpoint. There is a test that does
exactly this resize and then clicks a button on the page.

**Q: Once the page behind the drawer is inert, how does a screen-reader user close it?**
The menu button is behind it and now inert, the backdrop is not focusable, and
VoiceOver on a phone has no Escape key. So I added a "Close navigation" button inside
the drawer, shown only at drawer widths. That consequence of `inert` is easy to miss.

**Q: Two tabs are open and the user changes the theme in one. What happens?**
The browser fires a `storage` event in the *other* tab. The handler re-applies the theme
and updates that tab's radios. There is a test with two pages in one browser context.

**Q: Why switch off transitions while changing theme?**
Buttons and rows have 120ms colour transitions for hover. On a theme change, each would
fade separately, which looks like a flicker. I add a class that disables transitions,
apply the theme, force a style recalculation, and remove the class two animation frames
later.

**Q: Tell me about a bug you introduced and caught.**
The drawer's new close button appeared on desktop too. I had hidden it with
`.sidebar-close { display: none }` in `layout.css`, but `components.css` loads later and
says `.btn { display: inline-flex }`: same specificity, so the later rule won. I
caught it reviewing screenshots of every page. The fix was `.sidebar .sidebar-close`
(two classes outrank one), plus a test assertion that the button is hidden on desktop.
Lesson: with plain CSS, source order is part of the API.

### Questions an interviewer might ask after reading the code

**Q: `theme.js` has `getComputedStyle(root).color;` on a line by itself. Why?**
Reading a computed style forces the browser to apply pending style changes now. Without
it, the browser might batch adding the "no transitions" class and changing the theme
into the same style pass as removing the class, and the transitions would still run.

**Q: Why is `theme-init.js` wrapped in `{ … }`?**
Top-level `let`/`const` in classic scripts live in one global scope shared by every
classic script on the page. The block keeps the variables private. Modules do not need
this because each has its own scope.

**Q: Why is the visible word "Theme" `aria-hidden`?**
The group's accessible name comes from a visually hidden `<legend>` (the native way to
name a radio group). Browsers lay out legends specially, so the visible word is a
separate element; hiding it from assistive technology stops it being read twice.

**Q: Why not just use `@media (prefers-color-scheme: dark)` in CSS and skip the JS?**
That alone follows the OS but cannot remember a choice that differs from the OS. The
choice must be stored somewhere, and CSS cannot read `localStorage`. A server-side
alternative is a cookie read when rendering HTML, but these pages are static files.

**Q: How do you know your tests test anything?**
For the two layout and focus fixes, I temporarily restored the old CSS and JS and ran
the new tests: both failed. Then I restored the fixed code and they passed.

---

## 4. Trade-offs to be ready to defend

| Choice | Alternative | Why this one |
|---|---|---|
| External blocking script for the theme | Inline script with a CSP hash | Keeps the CSP simple and strict; the cost is one small cached request |
| Tokens redefined per theme | Separate dark stylesheet | One source of truth; no duplicated selectors to drift apart |
| `inert` | A JavaScript focus trap | Native, one line, also hides content from screen readers; supported in all engines since 2023 |
| `pointer: coarse` | Bigger controls everywhere | Keeps desktop density for a tool used for hours |
| No collapsible sidebar | Adding one | The sidebar has four links and the content never needed the width |
| No uptime bars on the status page | Common on status pages | The API has no uptime data, and inventing it would be dishonest |

---

## 5. Honest resume guidance

Claims you can make and back up with this repository:

- "Added a dark theme to a vanilla-JS web app using semantic CSS custom properties,
  with WCAG AA contrast verified by automated axe tests in both themes."
- "Eliminated the theme flash on load under a strict Content-Security-Policy, using a
  render-blocking same-origin script instead of an inline one."
- "Fixed a keyboard-focus escape in the mobile navigation drawer using the `inert`
  attribute, and added touch-sized controls for coarse pointers."
- "Extended the Playwright suite from 42 to 57 browser tests, run in Chromium, Firefox
  and WebKit."

Fold these into one or two bullets under the BlackWater project, not separate jobs.

Do **not** claim: user numbers, performance percentages, adoption or engagement
improvements, or "redesigned the UI". There are no users or measurements to support
them, and this was a refinement of an existing design, not a redesign. If asked about
performance, the honest answer is that the work added one 1.4 KB script (mostly comments) and no
dependencies, and that is the evidence.
