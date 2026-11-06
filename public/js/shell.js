import { api } from './api.js';
import { getSession, signOut, updateSessionUser } from './auth.js';
import { h, render } from './dom.js';
import { icon } from './icons.js';
import { onConnectionChange, subscribe } from './realtime.js';
import { avatar } from './ui.js';

const NAV = [
  { key: 'dashboard', label: 'Overview', href: '/', icon: 'dashboard' },
  { key: 'incidents', label: 'Incidents', href: '/incidents', icon: 'alert' },
  { key: 'services', label: 'Services', href: '/services', icon: 'server' },
  { key: 'settings', label: 'Settings', href: '/settings', icon: 'settings' },
];

export const roleLabel = (role) => role.charAt(0) + role.slice(1).toLowerCase();

let breadcrumbHost = null;
let identity = null; // the sidebar's user name and organization name elements

// Settings calls this after a save, so the sidebar shows the new names at once.
export function updateShellIdentity({ userName, orgName } = {}) {
  if (!identity) return;
  if (userName !== undefined) identity.userName.textContent = userName;
  if (orgName !== undefined) identity.orgName.textContent = orgName;
}

// Pages that know more than their section (an incident's title, say) refine the
// breadcrumb once their data has loaded. The last item is the current page.
export function setBreadcrumb(items) {
  if (!breadcrumbHost) return;
  render(
    breadcrumbHost,
    h(
      'ol',
      {},
      items.map((item, index) =>
        h('li', {}, index === items.length - 1 ? h('span', { 'aria-current': 'page', class: 'truncate' }, item.label) : h('a', { href: item.href }, item.label))
      )
    )
  );
}

// Builds the frame every signed-in page shares (sidebar, top bar, content area)
// inside <div id="app"> and returns the <main> element for the page to fill.
export function renderShell({ active }) {
  const { user } = getSession();
  const section = NAV.find((item) => item.key === active);

  const app = h('div', { class: 'app' });
  const main = h('main', { class: 'page', id: 'main', tabindex: '-1' });

  // ---- Live connection state: words, not just a coloured dot.
  const liveText = h('span', {}, 'Connecting');
  const live = h('span', { class: 'live-indicator', 'data-state': 'connecting', 'aria-live': 'polite', title: 'Live updates from your team' }, h('span', { class: 'dot', 'aria-hidden': 'true' }), liveText);
  onConnectionChange((state) => {
    live.dataset.state = state;
    liveText.textContent = state === 'live' ? 'Live' : state === 'connecting' ? 'Reconnecting' : 'Offline';
  });

  // ---- Organization context: the name arrives with /auth/me (refreshUser below).
  const orgName = h('div', { class: 'org-context-name truncate' }, user.organization?.name ?? '');

  // ---- User menu: a disclosure (button + list of ordinary links), not an ARIA menu.
  const menuId = 'user-menu';
  const userMenu = h(
    'div',
    { class: 'user-menu', id: menuId, hidden: true },
    h('a', { href: '/settings' }, icon('settings', 'sm'), 'Profile and settings'),
    h('button', { type: 'button', onclick: signOut }, icon('logout', 'sm'), 'Sign out')
  );
  const userNameText = h('span', { class: 'user-name truncate' }, user.name);
  identity = { userName: userNameText, orgName };
  const userButton = h(
    'button',
    { class: 'user-button', type: 'button', 'aria-expanded': 'false', 'aria-controls': menuId },
    avatar(user.name),
    h('span', { class: 'user-text' }, userNameText, h('span', { class: 'user-role' }, roleLabel(user.role))),
    icon('chevronDown', 'sm')
  );
  const setMenu = (open) => {
    userMenu.hidden = !open;
    userButton.setAttribute('aria-expanded', String(open));
  };
  userButton.addEventListener('click', () => setMenu(userMenu.hidden));
  document.addEventListener('click', (event) => {
    if (!userMenu.hidden && !event.target.closest('.sidebar-footer')) setMenu(false);
  });

  const sidebar = h(
    'aside',
    { class: 'sidebar', id: 'sidebar' },
    h('a', { class: 'brand', href: '/' }, h('span', { class: 'brand-mark', 'aria-hidden': 'true' }, icon('activity')), 'BlackWater'),
    h('div', { class: 'org-context' }, h('div', { class: 'org-context-label' }, 'Organization'), orgName),
    h(
      'nav',
      { class: 'nav', 'aria-label': 'Main' },
      h('ul', { role: 'list' }, NAV.map((item) => h('li', {}, h('a', { class: 'nav-link', href: item.href, 'aria-current': item.key === active ? 'page' : null }, icon(item.icon), item.label))))
    ),
    h('div', { class: 'sidebar-footer' }, userMenu, userButton)
  );

  // ---- Phone drawer. Focus goes into it when it opens and back to the button when it closes.
  const menuButton = h('button', { class: 'btn btn-ghost btn-icon menu-button', type: 'button', 'aria-label': 'Open navigation', 'aria-controls': 'sidebar', 'aria-expanded': 'false' }, icon('menu'));
  const setNav = (open, { returnFocus = false } = {}) => {
    app.toggleAttribute('data-nav-open', open);
    menuButton.setAttribute('aria-expanded', String(open));
    if (open) sidebar.querySelector('.nav-link')?.focus();
    else if (returnFocus) menuButton.focus();
  };
  menuButton.addEventListener('click', () => setNav(!app.hasAttribute('data-nav-open')));

  breadcrumbHost = h('nav', { class: 'breadcrumb', 'aria-label': 'Breadcrumb' });
  const topbar = h('header', { class: 'topbar' }, menuButton, breadcrumbHost, h('div', { class: 'topbar-end' }, live));

  app.append(
    h('a', { class: 'skip-link', href: '#main' }, 'Skip to content'),
    sidebar,
    h('div', { class: 'sidebar-backdrop', onclick: () => setNav(false) }),
    h('div', { class: 'main-column' }, topbar, main)
  );

  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    if (!userMenu.hidden) {
      setMenu(false);
      userButton.focus();
    } else if (app.hasAttribute('data-nav-open')) {
      setNav(false, { returnFocus: true });
    }
  });

  render(document.getElementById('app'), app);
  setBreadcrumb([{ label: section?.label ?? '' }]);

  watchForRoleChanges(user, orgName);
  return main;
}

// An admin can change someone's role while they are using the app. The server
// already applies the new role on their next request; this makes the interface
// (which buttons it shows) catch up straight away instead of after a reload.
async function refreshUser(knownUser, orgName) {
  try {
    const { data: fresh } = await api.get('/auth/me');
    updateSessionUser(fresh);
    orgName.textContent = fresh.organization?.name ?? '';
    const changed = fresh.role !== knownUser.role || fresh.name !== knownUser.name;
    // Reload only if the fresh profile was really saved: otherwise the reloaded
    // page would see the same "change" again and reload forever.
    const saved = getSession()?.user?.role === fresh.role && getSession()?.user?.name === fresh.name;
    if (changed && saved) location.reload();
  } catch {
    /* a rejected token is handled centrally by the API client */
  }
}

function watchForRoleChanges(user, orgName) {
  refreshUser(user, orgName);
  subscribe(['team:changed'], () => refreshUser(getSession()?.user ?? user, orgName));
}
