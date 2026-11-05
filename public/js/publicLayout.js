import { h, render } from './dom.js';
import { icon } from './icons.js';

// The frame of the public status pages: no navigation and no sign-in, just the
// organization's name and a footer. Returns the <main> to fill and a function to
// set the name once it is known.
export function renderPublicLayout() {
  const name = h('span', { class: 'public-title' }, 'Status');
  const main = h('main', { class: 'public-main', id: 'main' });

  render(
    document.getElementById('app'),
    h('header', { class: 'public-header' }, h('div', { class: 'public-header-inner' }, name, h('span', { class: 'subtle small cluster' }, icon('activity', 'sm'), 'System status'))),
    main,
    h('footer', { class: 'public-footer' }, 'Powered by BlackWater')
  );

  return {
    main,
    setOrganizationName(organizationName) {
      name.textContent = organizationName;
      document.title = `${organizationName} Status`;
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
