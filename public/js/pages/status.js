import { api } from '../api.js';
import { h, render } from '../dom.js';
import { icon } from '../icons.js';
import { refreshPeriodically, renderPublicLayout } from '../publicLayout.js';
import {
  emptyState, errorState, healthLabel, incidentStatusBadge, loadMoreButton, loadingRows,
  severityBadge, timeAgo,
} from '../ui.js';

const orgId = location.pathname.split('/')[2];

const BANNERS = {
  OPERATIONAL: ['success', 'checkCircle', 'All systems operational', 'Everything is working as expected.'],
  DEGRADED: ['warning', 'alert', 'Some services are degraded', 'We are aware and working on it.'],
  PARTIAL_OUTAGE: ['orange', 'alert', 'Partial outage', 'Some services are not working. We are working on it.'],
  MAJOR_OUTAGE: ['danger', 'xCircle', 'Major outage', 'Services are down. We are working to restore them.'],
};

const { main, setOrganizationName } = renderPublicLayout();

let history = [];
let historyPage = null;
let overview = null;

const bannerHost = h('div');
const activeHost = h('div');
const servicesHost = h('section', { class: 'panel' });
const historyHost = h('section', { class: 'panel' });
const checkedHost = h('p', { class: 'subtle small centered' });

render(main, h('div', { class: 'stack' }, bannerHost, activeHost, servicesHost, historyHost, checkedHost));
render(servicesHost, loadingRows(3));

const incidentLink = (incident) =>
  h(
    'a',
    { class: 'row', href: `/status/${orgId}/incidents/${incident.id}` },
    h('div', {}, h('div', { class: 'row-title' }, incident.title), h('div', { class: 'row-meta' }, h('span', {}, `Started ${timeAgo(incident.createdAt)}`), incident.resolvedAt && h('span', {}, `Resolved ${timeAgo(incident.resolvedAt)}`))),
    h('div', { class: 'row-side' }, severityBadge(incident.severity), incidentStatusBadge(incident.status))
  );

function paint() {
  const [tone, iconName, title, text] = BANNERS[overview.overallStatus];
  setOrganizationName(overview.organization.name);

  render(bannerHost, h('div', { class: `banner banner-${tone}` }, icon(iconName, 'lg'), h('div', {}, h('h1', {}, title), h('p', {}, text))));

  render(
    activeHost,
    overview.activeIncidents.length > 0 &&
      h('section', { class: 'panel' }, h('div', { class: 'panel-header' }, h('h2', {}, 'Current incidents')), h('div', { class: 'rows' }, overview.activeIncidents.map(incidentLink)))
  );

  render(
    servicesHost,
    h('div', { class: 'panel-header' }, h('h2', {}, 'Services')),
    overview.services.length === 0
      ? emptyState({ iconName: 'server', title: 'No services listed', description: 'This organization has not added any services yet.' })
      : h(
          'div',
          { class: 'rows' },
          overview.services.map((service) =>
            h('div', { class: 'row' }, h('div', {}, h('div', { class: 'row-title' }, service.name), service.description && h('div', { class: 'row-meta' }, service.description)), h('div', { class: 'row-side' }, healthLabel(service.status)))
          )
        )
  );

  checkedHost.textContent = `Last checked ${new Date().toLocaleTimeString()}. This page refreshes automatically.`;
}

function paintHistory() {
  render(
    historyHost,
    h('div', { class: 'panel-header' }, h('h2', {}, 'Incident history')),
    history.length === 0
      ? emptyState({ iconName: 'checkCircle', title: 'No incidents to show', description: 'Published incidents will be listed here.' })
      : h('div', { class: 'rows' }, history.map(incidentLink)),
    historyPage?.hasMore && loadMoreButton(() => loadHistory({ append: true }))
  );
}

async function loadHistory({ append = false } = {}) {
  // Like the private lists: a refresh reloads what is already on screen.
  const query = { orgId, limit: append ? 10 : Math.min(100, Math.max(10, history.length)) };
  if (append) query.cursor = historyPage.nextCursor;

  const { data, pagination } = await api.get('/status/incidents', query);
  history = append ? [...history, ...data] : data;
  historyPage = pagination;
  paintHistory();
}

async function load() {
  try {
    ({ data: overview } = await api.get('/status', { orgId }));
    paint();
    await loadHistory();
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
