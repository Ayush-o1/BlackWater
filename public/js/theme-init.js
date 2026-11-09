// Chooses the colour theme before the page is first drawn.
//
// Every HTML page loads this file in <head>, BEFORE its stylesheets, as an ordinary
// script (not type="module", not defer or async). Such a script blocks parsing
// until it has run, so <html data-theme="..."> is already set when the browser
// first paints, and a dark-mode user never sees a white flash. Module scripts run
// only after the page has been parsed, which would be too late.
//
// It is a file rather than an inline <script> because the Content-Security-Policy
// (src/app.js) forbids inline scripts. It is deliberately tiny and dependency-free;
// js/theme.js does everything else (the switcher, saving, following the OS).
//
// The stored preference is 'light', 'dark' or 'system' (or nothing, meaning
// 'system'). The storage key must match THEME_KEY in js/theme.js.

// A block, so these constants stay out of the global scope shared by classic scripts.
{
  let preference = null;
  try {
    preference = localStorage.getItem('blackwater.theme');
  } catch {
    // Storage blocked (some private modes): fall back to the system setting.
  }
  const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const dark = preference === 'dark' || (preference !== 'light' && systemDark);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
}
