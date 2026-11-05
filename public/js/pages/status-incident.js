import { api } from '../api.js';
import { h, render } from '../dom.js';
import { refreshPeriodically, renderPublicLayout } from '../publicLayout.js';
import {
  emptyState, errorState, formatDateTime, healthLabel, incidentStatusBadge, loadingRows,
  severityBadge, titleCase,
} from '../ui.js';

const [, , orgId, , incidentId] = location.pathname.split('/');

const { main, setOrganizationName } = renderPublicLayout();
let loaded = false;

render(main, h('div', { class: 'panel' }, loadingRows(3)));

// One feed for visitors: what happened (status changes) and what the team said
// (public updates), newest first.
function feedOf(incident) {
  const items = [];

  for (const event of incident.timeline) {
    if (event.eventType === 'INCIDENT_CREATED') {
      items.push({ at: event.createdAt, title: 'Incident reported' });
    } else if (event.eventType === 'STATUS_CHANGED') {
      items.push({ at: event.createdAt, title: `Status: ${titleCase(event.oldStatus ?? '?')} → ${titleCase(event.newStatus ?? '?')}` });
    }
  }
  for (const update of incident.updates) {
    items.push({ at: update.createdAt, title: 'Update', message: update.message });
  }

  return items.sort((a, b) => new Date(b.at) - new Date(a.at));
}

function paint(incident) {
  document.title = `${incident.title} · Status`;
  const feed = feedOf(incident);

  render(
    main,
    h(
      'div',
      { class: 'stack' },
      h('a', { class: 'small', href: `/status/${orgId}` }, '← All systems'),
      h(
        'div',
        {},
        h('h1', {}, incident.title),
        h('div', { class: 'cluster header-badges' }, incidentStatusBadge(incident.status), severityBadge(incident.severity)),
        h('p', { class: 'muted public-times' }, `Started ${formatDateTime(incident.createdAt)}`, incident.resolvedAt && ` · Resolved ${formatDateTime(incident.resolvedAt)}`)
      ),
      incident.affectedServices.length > 0 &&
        h(
          'section',
          { class: 'panel' },
          h('div', { class: 'panel-header' }, h('h2', {}, 'Affected services')),
          h('div', { class: 'rows' }, incident.affectedServices.map((service) => h('div', { class: 'row' }, h('div', { class: 'row-title' }, service.name), h('div', { class: 'row-side' }, healthLabel(service.status)))))
        ),
      h(
        'section',
        { class: 'panel' },
        h('div', { class: 'panel-header' }, h('h2', {}, 'Updates')),
        h(
          'div',
          { class: 'panel-body' },
          feed.length === 0
            ? h('p', { class: 'muted' }, 'No updates yet.')
            : h(
                'ol',
                { class: 'timeline' },
                feed.map((item) =>
                  h(
                    'li',
                    { class: 'timeline-item' },
                    h('span', { class: 'dot' }),
                    h('div', { class: 'timeline-head' }, h('span', { class: 'timeline-title' }, item.title), h('time', { class: 'timeline-time', datetime: item.at }, formatDateTime(item.at))),
                    item.message && h('p', { class: 'pre-wrap timeline-message' }, item.message)
                  )
                )
              )
        )
      )
    )
  );
}

async function load() {
  try {
    const { data: incident } = await api.get(`/status/incidents/${incidentId}`, { orgId });
    loaded = true;
    paint(incident);
    // The organization name comes from the overview; the header is optional polish.
    api.get('/status', { orgId }).then(({ data }) => setOrganizationName(data.organization.name)).catch(() => {});
  } catch (error) {
    if (loaded) return;
    render(
      main,
      h('div', { class: 'panel' }, error.status === 404 || error.status === 400
        ? emptyState({
            iconName: 'search',
            title: 'Incident not found',
            description: 'It may not be published, or the link is wrong.',
            action: h('a', { class: 'btn', href: `/status/${orgId}` }, 'View current status'),
          })
        : errorState(error, load))
    );
  }
}

load();
refreshPeriodically(load);
