import { api } from '../api.js';
import { statusBanner } from '../components.js';
import { h, render } from '../dom.js';
import { refreshPeriodically, renderPublicLayout } from '../publicLayout.js';
import {
  emptyState, errorState, formatDate, formatDateTime, healthLabel, incidentStatusBadge, loadMoreButton,
  severityBadge, timeAgo,
} from '../ui.js';

const orgId = location.pathname.split('/')[2];
const { main, setOrganizationName, markChecked } = renderPublicLayout();

let overview = null;
let history = [];
let historyPage = null;
let latestUpdates = new Map();

const bannerHost = h('div');
const activeHost = h('div');
const servicesHost = h('section', { class: 'panel', 'aria-labelledby': 'components-title' });
const historyHost = h('section', { class: 'panel', 'aria-labelledby': 'history-title' });

render(main, bannerHost, activeHost, servicesHost, historyHost);
// Until the first answer arrives: a placeholder the size of the banner and nothing
// else, so nothing on screen moves when the real page is painted (no layout shift).
render(bannerHost, h('div', { class: 'banner-placeholder skeleton', 'aria-busy': 'true', 'aria-label': 'Loading' }));

function bannerDetail() {
  const count = overview.activeIncidents.length;
  if (count === 0) return 'Everything is running normally.';
  return `We are working on ${count === 1 ? 'one incident' : `${count} incidents`}. Details below.`;
}

function paint() {
  setOrganizationName(overview.organization.name);
  document.title = `${overview.organization.name} status`;
  render(bannerHost, statusBanner(overview.overallStatus, bannerDetail(), 'h1'));

  render(
    activeHost,
    overview.activeIncidents.length > 0 &&
      h(
        'section',
        { class: 'panel', 'aria-labelledby': 'active-title' },
        h('div', { class: 'panel-header' }, h('h2', { id: 'active-title' }, 'Current incidents')),
        h('ul', { class: 'rows' }, overview.activeIncidents.map((incident) => h('li', {}, activeIncident(incident))))
      )
  );

  render(
    servicesHost,
    h('div', { class: 'panel-header' }, h('h2', { id: 'components-title' }, 'Services')),
    overview.services.length === 0
      ? emptyState({ iconName: 'server', title: 'No services listed', description: 'This organization has not listed any services yet.' })
      : h(
          'ul',
          { class: 'rows' },
          overview.services.map((service) =>
            h('li', { class: 'row' }, h('div', {}, h('div', { class: 'row-title' }, service.name), service.description && h('div', { class: 'row-meta' }, service.description)), h('div', { class: 'row-side' }, healthLabel(service.status)))
          )
        )
  );
  markChecked();
}

// An active incident with the last thing the team told customers about it.
function activeIncident(incident) {
  const latest = latestUpdates.get(incident.id);
  return h(
    'a',
    { class: 'row', href: `/status/${orgId}/incidents/${incident.id}` },
    h(
      'div',
      { class: 'stack-sm' },
      h('div', { class: 'row-title' }, incident.title),
      latest && h('p', { class: 'small muted pre-wrap' }, latest.message),
      h('div', { class: 'row-meta' }, h('span', {}, latest ? `Updated ${timeAgo(latest.createdAt)}` : `Started ${timeAgo(incident.createdAt)}`), incident.affectedServices.length > 0 && h('span', {}, incident.affectedServices.map((service) => service.name).join(', ')))
    ),
    h('div', { class: 'row-side' }, severityBadge(incident.severity), incidentStatusBadge(incident.status))
  );
}

// History, grouped by the day each incident started, newest first.
function paintHistory() {
  const groups = [];
  for (const incident of history) {
    const day = formatDate(incident.createdAt);
    if (groups.at(-1)?.day !== day) groups.push({ day, incidents: [] });
    groups.at(-1).incidents.push(incident);
  }

  render(
    historyHost,
    h('div', { class: 'panel-header' }, h('h2', { id: 'history-title' }, 'Incident history')),
    history.length === 0
      ? emptyState({ iconName: 'checkCircle', title: 'No incidents to show', description: 'Published incidents will be listed here.' })
      : h(
          'div',
          {},
          groups.map((group) =>
            h(
              'div',
              {},
              h('h3', { class: 'section-label history-day' }, group.day),
              h(
                'ul',
                { class: 'rows' },
                group.incidents.map((incident) =>
                  h(
                    'li',
                    {},
                    h(
                      'a',
                      { class: 'row', href: `/status/${orgId}/incidents/${incident.id}` },
                      h('div', {}, h('div', { class: 'row-title' }, incident.title), h('div', { class: 'row-meta' }, h('time', { datetime: incident.createdAt }, formatDateTime(incident.createdAt)), incident.resolvedAt && h('span', {}, `Resolved ${timeAgo(incident.resolvedAt)}`))),
                      h('div', { class: 'row-side' }, severityBadge(incident.severity), incidentStatusBadge(incident.status))
                    )
                  )
                )
              )
            )
          )
        ),
    historyPage?.hasMore && loadMoreButton(() => loadHistory({ append: true }))
  );
}

async function fetchHistory({ append = false } = {}) {
  // Like the private lists: a refresh reloads what is already on screen.
  const query = { orgId, limit: append ? 10 : Math.min(100, Math.max(10, history.length)) };
  if (append) query.cursor = historyPage.nextCursor;

  const { data, pagination } = await api.get('/status/incidents', query);
  history = append ? [...history, ...data] : data;
  historyPage = pagination;
}

async function loadHistory(options) {
  await fetchHistory(options);
  paintHistory();
}

// The latest public update of each active incident (there are rarely more than a few).
async function loadLatestUpdates() {
  const entries = await Promise.all(
    overview.activeIncidents.slice(0, 5).map(async (incident) => {
      // One incident failing (unpublished a moment ago, say) must not blank the page.
      try {
        const { data } = await api.get(`/status/incidents/${incident.id}`, { orgId });
        return [incident.id, data.updates.at(-1)];
      } catch {
        return [incident.id, null];
      }
    })
  );
  latestUpdates = new Map(entries.filter(([, update]) => update));
}

async function load() {
  try {
    // History does not depend on the overview, so both are fetched at once, and the
    // page is painted in one pass when everything has arrived.
    const [{ data }] = await Promise.all([api.get('/status', { orgId }), fetchHistory()]);
    overview = data;
    await loadLatestUpdates();
    paint();
    paintHistory();
  } catch (error) {
    // After the first successful load a failed refresh keeps showing the last good data.
    if (overview) return;
    render(
      main,
      h('div', { class: 'panel' }, error.status === 404 || error.status === 400
        ? emptyState({ iconName: 'search', title: 'Status page not found', level: 1, description: 'This status page does not exist or is no longer available.' })
        : errorState(error, load))
    );
  }
}

load();
refreshPeriodically(load);
