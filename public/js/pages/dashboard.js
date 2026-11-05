import { api } from '../api.js';
import { getSession, requireSession } from '../auth.js';
import { h, render } from '../dom.js';
import { icon } from '../icons.js';
import { subscribe } from '../realtime.js';
import { renderShell } from '../shell.js';
import {
  avatar, button, emptyState, errorState, healthLabel, loadingRows, setTitle, severityBadge, timeAgo, toast,
} from '../ui.js';

async function start() {
  setTitle('Dashboard');
  const main = renderShell({ active: 'dashboard' });
  const { user } = getSession();

  const content = h('div', { class: 'stack' });
  render(main, h('div', { class: 'page-header' }, h('div', {}, h('h1', {}, 'Dashboard'), h('p', {}, 'How your services are doing right now.'))), content);

  async function load() {
    try {
      const { data } = await api.get('/dashboard');
      render(content, summary(data), activeIncidents(data.recentActiveIncidents, data.activeIncidentCount), publicPagePanel(user.orgId));
    } catch (error) {
      render(content, h('div', { class: 'panel' }, errorState(error, load)));
    }
  }

  render(content, h('div', { class: 'panel' }, loadingRows(3)));
  load();
  subscribe(['incident:created', 'incident:updated', 'service:changed'], load);
}

function summary(data) {
  const stat = (label, value, extraClass = '') =>
    h('div', { class: 'panel stat' }, h('div', { class: 'stat-label' }, label), h('div', { class: `stat-value ${extraClass}` }, value));

  return h(
    'div',
    { class: 'stats' },
    stat('System status', healthLabel(data.overallStatus), 'status'),
    stat('Active incidents', data.activeIncidentCount),
    stat('Critical incidents', data.criticalIncidentCount),
    stat('Services', data.serviceCount)
  );
}

function activeIncidents(incidents, total) {
  const header = h(
    'div',
    { class: 'panel-header' },
    h('div', {}, h('h2', {}, 'Active incidents'), total > incidents.length && h('p', {}, `Showing the latest ${incidents.length} of ${total}`)),
    h('a', { class: 'btn btn-ghost btn-sm', href: '/incidents' }, 'View all')
  );

  if (incidents.length === 0) {
    return h('section', { class: 'panel' }, header, emptyState({ iconName: 'checkCircle', title: 'No active incidents', description: 'Everything is running smoothly. New incidents will show up here.' }));
  }

  return h(
    'section',
    { class: 'panel' },
    header,
    h(
      'div',
      { class: 'rows' },
      incidents.map((incident) =>
        h(
          'a',
          { class: 'row', href: `/incidents/${incident.id}` },
          h(
            'div',
            {},
            h('div', { class: 'row-title truncate' }, incident.title),
            h('div', { class: 'row-meta' }, h('span', {}, `Started ${timeAgo(incident.createdAt)}`), incident.assignee && h('span', { class: 'cluster' }, avatar(incident.assignee.name), incident.assignee.name))
          ),
          h('div', { class: 'row-side' }, severityBadge(incident.severity))
        )
      )
    )
  );
}

function publicPagePanel(orgId) {
  const url = `${location.origin}/status/${orgId}`;
  const copy = button('Copy link', {
    size: 'sm',
    iconName: 'copy',
    async onClick() {
      try {
        await navigator.clipboard.writeText(url);
        toast('Link copied');
      } catch {
        toast('Could not copy automatically. Select the link and copy it.', 'error');
      }
    },
  });

  return h(
    'section',
    { class: 'panel' },
    h('div', { class: 'panel-header' }, h('div', {}, h('h2', {}, 'Public status page'), h('p', {}, 'Customers see only the incidents you have published.'))),
    h(
      'div',
      { class: 'panel-body stack-sm' },
      h('div', { class: 'copy-box' }, h('input', { class: 'input', readonly: true, value: url, 'aria-label': 'Public status page link' }), copy, h('a', { class: 'btn btn-sm', href: url, target: '_blank', rel: 'noopener' }, icon('external', 'sm'), 'Open'))
    )
  );
}

if (requireSession()) start();
