import { api } from './api.js';
import { getSession, signOut, updateSessionUser } from './auth.js';
import { h, render } from './dom.js';
import { icon } from './icons.js';
import { onConnectionChange, subscribe } from './realtime.js';
import { avatar, button } from './ui.js';

const NAV = [
  { key: 'dashboard', label: 'Dashboard', href: '/', icon: 'dashboard' },
  { key: 'incidents', label: 'Incidents', href: '/incidents', icon: 'alert' },
  { key: 'services', label: 'Services', href: '/services', icon: 'server' },
  { key: 'settings', label: 'Settings', href: '/settings', icon: 'settings' },
];

// Builds the frame every signed-in page shares (sidebar, top bar, content area)
// inside <div id="app"> and returns the <main> element for the page to fill.
export function renderShell({ active }) {
  const { user } = getSession();

  const app = h('div', { class: 'app' });
  const main = h('main', { class: 'page', id: 'main' });

  const liveText = h('span', {}, 'Connecting');
  const liveDot = h('span', { class: 'dot' });
  const live = h('span', { class: 'live-indicator', 'data-state': 'connecting', title: 'Live updates' }, liveDot, liveText);

  onConnectionChange((state) => {
    live.dataset.state = state;
    liveDot.className = state === 'live' ? 'dot dot-success' : 'dot';
    liveText.textContent = state === 'live' ? 'Live' : state === 'connecting' ? 'Reconnecting' : 'Offline';
  });

  const closeNav = () => app.removeAttribute('data-nav-open');

  const sidebar = h(
    'aside',
    { class: 'sidebar', id: 'sidebar', 'aria-label': 'Main navigation' },
    h('a', { class: 'brand', href: '/' }, icon('activity'), 'BlackWater'),
    h(
      'nav',
      { class: 'nav' },
      NAV.map((item) =>
        h('a', { class: 'nav-link', href: item.href, 'aria-current': item.key === active ? 'page' : null }, icon(item.icon), item.label)
      )
    ),
    h(
      'div',
      { class: 'sidebar-footer stack-sm' },
      h(
        'div',
        { class: 'cluster' },
        avatar(user.name),
        h('div', { class: 'sidebar-user small' }, h('div', { class: 'sidebar-user-name truncate' }, user.name), h('div', { class: 'subtle' }, roleLabel(user.role)))
      ),
      button('Sign out', { variant: 'ghost', size: 'sm', iconName: 'logout', onClick: signOut })
    )
  );

  const topbar = h(
    'header',
    { class: 'topbar' },
    h('button', {
      class: 'btn btn-ghost btn-icon menu-button',
      type: 'button',
      'aria-label': 'Open navigation',
      'aria-controls': 'sidebar',
      onclick: () => app.toggleAttribute('data-nav-open'),
    }, icon('menu')),
    h('div', { class: 'topbar-end' }, live)
  );

  app.append(
    sidebar,
    h('div', { class: 'sidebar-backdrop', onclick: closeNav }),
    h('div', { class: 'main-column' }, topbar, main)
  );
  document.addEventListener('keydown', (event) => event.key === 'Escape' && closeNav());

  render(document.getElementById('app'), app);

  watchForRoleChanges(user);
  return main;
}

export const roleLabel = (role) => role.charAt(0) + role.slice(1).toLowerCase();

// An admin can change someone's role while they are using the app. The server
// already applies the new role on their next request; this makes the interface
// (which buttons it shows) catch up straight away instead of after a reload.
async function refreshUser(knownUser) {
  try {
    const { data: fresh } = await api.get('/auth/me');
    updateSessionUser(fresh);
    if (fresh.role !== knownUser.role || fresh.name !== knownUser.name) location.reload();
  } catch {
    /* a rejected token is handled centrally by the API client */
  }
}

function watchForRoleChanges(user) {
  refreshUser(user);
  subscribe(['team:changed'], () => refreshUser(getSession()?.user ?? user));
}
