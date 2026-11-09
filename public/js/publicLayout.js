import { h, render } from './dom.js';
import { icon } from './icons.js';
import { themeSwitcher } from './theme.js';

// The frame of the public status pages. It is deliberately not the application
// shell: no navigation, no sign-in, nothing internal. A customer should see whose
// status this is, how things are, and when this page last checked.
export function renderPublicLayout() {
  const name = h('span', { class: 'public-org' }, 'Status');
  const checked = h('span', { 'aria-live': 'polite' }, '');
  const main = h('main', { class: 'public-main', id: 'main' });
  // Shown with the first content, so it appears once instead of sliding down the
  // screen as the page fills in (which would count as layout shift).
  // Visitors follow their own system setting by default, and can override it here.
  const footer = h('footer', { class: 'public-footer', hidden: true }, checked, h('div', { class: 'public-footer-end' }, themeSwitcher(), h('span', {}, 'Powered by BlackWater')));

  render(
    document.getElementById('app'),
    h('a', { class: 'skip-link', href: '#main' }, 'Skip to content'),
    h('header', { class: 'public-header' }, h('div', { class: 'public-header-inner' }, name, h('span', { class: 'public-tag cluster' }, icon('activity', 'sm'), 'System status'))),
    main,
    footer
  );

  return {
    main,
    setOrganizationName(organizationName) {
      name.textContent = organizationName;
    },
    markChecked() {
      footer.hidden = false;
      checked.textContent = `Last checked ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}. This page refreshes automatically.`;
    },
  };
}

// Calls `reload` every `seconds`, and again whenever the tab becomes visible
// after being in the background. Public visitors have no live connection, so
// this is how the page stays current.
export function refreshPeriodically(reload, seconds = 30) {
  setInterval(() => {
    if (!document.hidden) reload();
  }, seconds * 1000);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) reload();
  });
}
