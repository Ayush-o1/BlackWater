import { h } from './dom.js';
import { icon } from './icons.js';

// Light and dark themes.
//
// How it fits together:
// - The colours are CSS custom properties ("tokens") in css/base.css. Light values
//   are on :root; the dark theme redefines the same tokens on
//   :root[data-theme='dark']. Components only ever use the tokens, so changing one
//   attribute on <html> recolours everything, with no re-rendering.
// - js/theme-init.js sets that attribute before the first paint (no flash).
// - This module lets people choose System, Light or Dark, saves the choice,
//   and keeps the page in step with the operating system while "System" is chosen.

// Must match the key read by js/theme-init.js.
const THEME_KEY = 'blackwater.theme';
const PREFERENCES = ['system', 'light', 'dark'];
const systemDark = window.matchMedia('(prefers-color-scheme: dark)');

// Every switcher on the page, so a change made elsewhere (another tab) can be
// reflected in their radios.
const switchers = new Set();

// What the person chose: 'system' (the default), 'light' or 'dark'.
export function getThemePreference() {
  try {
    const stored = localStorage.getItem(THEME_KEY);
    return PREFERENCES.includes(stored) ? stored : 'system';
  } catch {
    return 'system'; // storage blocked: behave as if nothing was chosen
  }
}

// The theme actually shown: a preference of 'system' resolves to light or dark.
const resolveTheme = (preference) => (preference === 'system' ? (systemDark.matches ? 'dark' : 'light') : preference);

function applyTheme() {
  const theme = resolveTheme(getThemePreference());
  const root = document.documentElement;
  if (root.dataset.theme === theme) return;

  // Buttons, links and rows have short colour transitions for hover. Without this,
  // every one of them would fade separately to the new theme, which looks like a
  // flicker. The class switches transitions off (css/base.css), the new colours are
  // applied, and the class is removed after the browser has drawn them.
  root.classList.add('theme-changing');
  root.dataset.theme = theme;
  getComputedStyle(root).color; // forces the style change to be applied now
  requestAnimationFrame(() => requestAnimationFrame(() => root.classList.remove('theme-changing')));
}

export function setThemePreference(preference) {
  if (!PREFERENCES.includes(preference)) return;
  try {
    // 'system' is the default, so it is stored by removing the key.
    if (preference === 'system') localStorage.removeItem(THEME_KEY);
    else localStorage.setItem(THEME_KEY, preference);
  } catch {
    // Not saved, but still applied for this page.
    document.documentElement.dataset.theme = resolveTheme(preference);
    return;
  }
  applyTheme();
}

// While "System" is chosen, follow the operating system as it changes (for
// example when it switches to dark mode at sunset).
systemDark.addEventListener('change', applyTheme);

// Another tab changed the preference: localStorage fires 'storage' in every other
// tab of the same site, so all open BlackWater tabs switch together.
addEventListener('storage', (event) => {
  if (event.key !== THEME_KEY && event.key !== null) return;
  applyTheme();
  const preference = getThemePreference();
  switchers.forEach((group) => {
    const radio = group.querySelector(`input[value="${preference}"]`);
    if (radio) radio.checked = true;
  });
});

let switcherCount = 0;

// The System / Light / Dark choice, as the existing segmented control (a group of
// real radio buttons). Being radios, it works with the keyboard for free: Tab
// reaches the group, the arrow keys move between options and choose them.
// The options show icons only, to fit a small menu; each still has a text label
// for screen readers (visually hidden) and a tooltip (title) for mouse users.
export function themeSwitcher() {
  const current = getThemePreference();
  const name = `theme-${++switcherCount}`; // radios are grouped by name, so it must be unique on the page

  const option = (value, label, iconName) =>
    h('label', { title: label }, h('input', { type: 'radio', name, value, checked: value === current }), icon(iconName, 'sm'), h('span', { class: 'visually-hidden' }, label));

  const group = h(
    'fieldset',
    { class: 'theme-switcher' },
    // The legend names the group for assistive technology. Browsers lay out a legend
    // specially, so the visible word beside the control is a separate, hidden-from-
    // screen-readers copy instead of the legend itself.
    h('legend', { class: 'visually-hidden' }, 'Theme'),
    h('span', { class: 'theme-switcher-label', 'aria-hidden': 'true' }, 'Theme'),
    h('div', { class: 'segmented segmented-icons' }, option('system', 'System', 'monitor'), option('light', 'Light', 'sun'), option('dark', 'Dark', 'moon'))
  );
  // One listener on the group: 'change' bubbles up from whichever radio was chosen.
  group.addEventListener('change', (event) => setThemePreference(event.target.value));
  switchers.add(group);
  return group;
}
