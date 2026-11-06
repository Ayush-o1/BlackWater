import { api, getAll } from '../api.js';
import { canWrite, getSession, requireSession } from '../auth.js';
import { declareIncidentDialog, statusBanner } from '../components.js';
import { h, render } from '../dom.js';
import { icon } from '../icons.js';
import { subscribe } from '../realtime.js';
import { renderShell } from '../shell.js';
import {
  button, changeDetector, emptyState, errorState, healthLabel, incidentStatusBadge, loadingRows,
  person, setTitle, severityBadge, timeAgo, toast, toastError,
} from '../ui.js';

// The overview answers, top to bottom, the questions someone has when they open
// BlackWater: is anything broken, what needs attention first, which services are
// affected, who is on it, and what has just been dealt with. Every number on it is
// counted by the server; nothing is decorative.

// Worst health first, so an affected service is never below a healthy one.
const HEALTH_RANK = { MAJOR_OUTAGE: 0, PARTIAL_OUTAGE: 1, DEGRADED: 2, OPERATIONAL: 3 };
const ATTENTION_LIMIT = 8;

async function start() {
  setTitle('Overview');
  const main = renderShell({ active: 'dashboard' });
  const { user } = getSession();
  const writer = canWrite(user);

  const bannerHost = h('div');
  const gridHost = h('div');
  const attentionHost = h('section', { class: 'panel area-attention', 'aria-labelledby': 'attention-title' });
  const servicesHost = h('section', { class: 'panel area-services', 'aria-labelledby': 'services-title' });
  const resolvedHost = h('section', { class: 'panel area-resolved', 'aria-labelledby': 'resolved-title' });

  render(
    main,
    h(
      'div',
      { class: 'page-header' },
      h('div', {}, h('h1', {}, 'Overview'), h('p', {}, 'What is happening across your services right now.')),
      writer && h('div', { class: 'page-actions' }, button('Declare incident', { variant: 'primary', iconName: 'plus', onClick: () => declareIncidentDialog({ onCreated: (incident) => location.assign(`/incidents/${incident.id}`) }).catch(toastError) }))
    ),
    bannerHost,
    gridHost
  );
  // Until the data is here: a banner-sized placeholder and one loading panel. The
  // grid then goes in whole, so nothing already on screen moves (no layout shift).
  render(bannerHost, h('div', { class: 'banner-placeholder skeleton', 'aria-busy': 'true', 'aria-label': 'Loading' }));
  render(gridHost, h('div', { class: 'panel' }, loadingRows(3)));
  const shown = changeDetector();

  async function load() {
    try {
      const [{ data: summary }, { data: open }, services, { data: resolved }] = await Promise.all([
        api.get('/dashboard'),
        api.get('/incidents', { open: 'true', sort: 'priority', limit: ATTENTION_LIMIT }),
        getAll('/services'),
        api.get('/incidents', { status: 'RESOLVED', limit: 5 }),
      ]);
      if (!shown.changed({ summary, open, services, resolved })) return;
      render(bannerHost, statusBanner(summary.overallStatus, bannerDetail(summary), 'h2'));
      paintAttention(open, summary.activeIncidentCount);
      paintServices(services);
      paintResolved(resolved);
      // Grid areas, so a phone gets attention, services, resolved, public in that order.
      if (!gridHost.querySelector('.overview-grid')) render(gridHost, h('div', { class: 'overview-grid' }, attentionHost, servicesHost, resolvedHost, publicPagePanel(user.orgId)));
    } catch (error) {
      if (gridHost.querySelector('.overview-grid')) return; // a failed live refresh keeps the last good view
      shown.forget();
      render(bannerHost);
      render(gridHost, h('div', { class: 'panel' }, errorState(error, load)));
    }
  }

  function paintAttention(incidents, total) {
    const unassigned = incidents.filter((incident) => !incident.assignee).length;
    render(
      attentionHost,
      h(
        'div',
        { class: 'panel-header' },
        h('div', {}, h('h2', { id: 'attention-title' }, 'Needs attention'), h('p', {}, total === 0 ? 'No open incidents' : `${total} open, most severe first${unassigned ? ` · ${unassigned} unassigned` : ''}`)),
        total > 0 && h('a', { class: 'btn btn-ghost btn-sm', href: '/incidents' }, total > incidents.length ? `View all ${total}` : 'View list')
      ),
      incidents.length === 0
        ? emptyState({ iconName: 'checkCircle', title: 'Nothing needs attention', description: 'No incident is open. When one is declared it appears here, most severe first.' })
        : h('ul', { class: 'rows' }, incidents.map((incident) => h('li', {}, attentionRow(incident))))
    );
  }

  function paintServices(services) {
    const sorted = [...services].sort((a, b) => HEALTH_RANK[a.status] - HEALTH_RANK[b.status] || a.name.localeCompare(b.name));
    const affected = services.filter((service) => service.status !== 'OPERATIONAL').length;
    render(
      servicesHost,
      h(
        'div',
        { class: 'panel-header' },
        h('div', {}, h('h2', { id: 'services-title' }, 'Services'), h('p', {}, services.length === 0 ? 'None yet' : affected ? `${affected} of ${services.length} affected` : `All ${services.length} operational`)),
        h('a', { class: 'btn btn-ghost btn-sm', href: '/services' }, 'Manage')
      ),
      services.length === 0
        ? emptyState({ iconName: 'server', title: 'No services yet', description: 'Add the systems your customers depend on to track their health.', action: writer && h('a', { class: 'btn btn-sm', href: '/services' }, 'Add a service') })
        : h(
            'ul',
            { class: 'rows' },
            sorted.map((service) =>
              h('li', {}, h('a', { class: 'row', href: `/services/${service.id}` }, h('span', { class: 'row-title truncate' }, service.name), h('span', { class: 'row-side' }, healthLabel(service.status))))
            )
          )
    );
  }

  function paintResolved(incidents) {
    render(
      resolvedHost,
      h('div', { class: 'panel-header' }, h('div', {}, h('h2', { id: 'resolved-title' }, 'Recently resolved'), h('p', {}, 'Resolved and waiting to be closed'))),
      incidents.length === 0
        ? emptyState({ iconName: 'history', title: 'Nothing resolved recently', description: 'Resolved incidents appear here until someone closes them.' })
        : h(
            'ul',
            { class: 'rows' },
            incidents.map((incident) =>
              h(
                'li',
                {},
                h(
                  'a',
                  { class: 'row', href: `/incidents/${incident.id}` },
                  h('div', {}, h('div', { class: 'row-title' }, incident.title), h('div', { class: 'row-meta' }, h('span', {}, `Resolved ${timeAgo(incident.resolvedAt)}`))),
                  h('div', { class: 'row-side' }, severityBadge(incident.severity))
                )
              )
            )
          )
    );
  }

  load();
  subscribe(['incident:created', 'incident:updated', 'service:changed'], load);
}

function bannerDetail(summary) {
  if (summary.activeIncidentCount === 0) return `No open incidents across ${summary.serviceCount} ${summary.serviceCount === 1 ? 'service' : 'services'}.`;
  const critical = summary.criticalIncidentCount ? `, ${summary.criticalIncidentCount} critical` : '';
  return `${summary.activeIncidentCount} open ${summary.activeIncidentCount === 1 ? 'incident' : 'incidents'}${critical}.`;
}

function attentionRow(incident) {
  const services = incident.affectedServices ?? [];
  return h(
    'a',
    { class: 'row', href: `/incidents/${incident.id}` },
    h(
      'div',
      {},
      h('div', { class: 'row-title' }, incident.title),
      h(
        'div',
        { class: 'row-meta' },
        h('span', {}, `Started ${timeAgo(incident.createdAt)}`),
        person(incident.assignee),
        services.length > 0 && h('span', { class: 'truncate' }, services.map((service) => service.name).join(', '))
      )
    ),
    h('div', { class: 'row-side' }, severityBadge(incident.severity), incidentStatusBadge(incident.status))
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
    { class: 'panel area-public', 'aria-labelledby': 'public-title' },
    h('div', { class: 'panel-header' }, h('div', {}, h('h2', { id: 'public-title' }, 'Public status page'), h('p', {}, 'Shows only what you publish'))),
    h(
      'div',
      { class: 'panel-body stack-sm' },
      h('input', { class: 'input', readonly: true, value: url, 'aria-label': 'Public status page link' }),
      h('div', { class: 'cluster' }, copy, h('a', { class: 'btn btn-sm', href: url, target: '_blank', rel: 'noopener' }, icon('external', 'sm'), 'Open'))
    )
  );
}

if (requireSession()) start();
