import { api } from '../api.js';
import { h, render } from '../dom.js';
import { icon } from '../icons.js';
import { refreshPeriodically, renderPublicLayout } from '../publicLayout.js';
import {
  emptyState, errorState, formatDateTime, healthLabel, incidentStatusBadge, loadingRows,
  severityBadge, titleCase,
} from '../ui.js';

const [, , orgId, , incidentId] = location.pathname.split('/');

const { main, setOrganizationName, markChecked } = renderPublicLayout();
let loaded = false;

render(main, h('div', { class: 'panel' }, loadingRows(3)));

// One feed for visitors: what happened (status changes) and what the team said
// (public updates), newest first. Internal notes and people never reach this page:
// the API only sends public fields.
function feedOf(incident) {
  const items = [];
  for (const event of incident.timeline) {
    if (event.eventType === 'INCIDENT_CREATED') items.push({ at: event.createdAt, title: 'Incident reported', iconName: 'flag' });
    else if (event.eventType === 'STATUS_CHANGED') items.push({ at: event.createdAt, title: `Marked ${titleCase(event.newStatus ?? '?')}`, iconName: 'chevronRight' });
  }
  for (const update of incident.updates) items.push({ at: update.createdAt, title: 'Update', message: update.message, iconName: 'message' });
  return items.sort((a, b) => new Date(b.at) - new Date(a.at));
}

function paint(incident) {
  document.title = `${incident.title} · Status`;
  const feed = feedOf(incident);

  render(
    main,
    h('a', { class: 'small link-target', href: `/status/${orgId}` }, icon('arrowLeft', 'sm'), 'All systems'),
    h(
      'div',
      { class: 'stack-sm' },
      h('h1', { class: 'pre-wrap' }, incident.title),
      h('div', { class: 'cluster header-badges' }, incidentStatusBadge(incident.status), severityBadge(incident.severity)),
      h('p', { class: 'small muted' }, `Started ${formatDateTime(incident.createdAt)}`, incident.resolvedAt && ` · Resolved ${formatDateTime(incident.resolvedAt)}`)
    ),
    incident.affectedServices.length > 0 &&
      h(
        'section',
        { class: 'panel', 'aria-labelledby': 'affected-title' },
        h('div', { class: 'panel-header' }, h('h2', { id: 'affected-title' }, 'Affected services')),
        h('ul', { class: 'rows' }, incident.affectedServices.map((service) => h('li', { class: 'row' }, h('div', { class: 'row-title' }, service.name), h('div', { class: 'row-side' }, healthLabel(service.status)))))
      ),
    h(
      'section',
      { class: 'panel', 'aria-labelledby': 'updates-title' },
      h('div', { class: 'panel-header' }, h('div', {}, h('h2', { id: 'updates-title' }, 'Updates'), h('p', {}, 'Newest first'))),
      h(
        'div',
        { class: 'panel-body' },
        feed.length === 0
          ? h('p', { class: 'muted' }, 'No updates yet.')
          : h(
              'ol',
              { class: 'feed' },
              feed.map((item) =>
                h(
                  'li',
                  { class: item.message ? 'feed-item feed-item-public' : 'feed-item' },
                  h('span', { class: 'feed-mark', 'aria-hidden': 'true' }, icon(item.iconName)),
                  h(
                    'div',
                    { class: 'stack-sm' },
                    h('div', { class: 'feed-event' }, h('strong', {}, item.title), h('time', { class: 'feed-time', datetime: item.at }, formatDateTime(item.at))),
                    item.message && h('div', { class: 'note note-public' }, h('p', { class: 'note-body' }, item.message))
                  )
                )
              )
            )
      )
    )
  );
  markChecked();
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
            level: 1,
            description: 'It may not be published, or the link is wrong.',
            action: h('a', { class: 'btn', href: `/status/${orgId}` }, 'View current status'),
          })
        : errorState(error, load))
    );
  }
}

load();
refreshPeriodically(load);
