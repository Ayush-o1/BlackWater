import { api } from '../api.js';
import { canWrite, getSession, requireSession } from '../auth.js';
import { declareIncidentDialog } from '../components.js';
import { h, render } from '../dom.js';
import { icon } from '../icons.js';
import { subscribe } from '../realtime.js';
import { renderShell } from '../shell.js';
import {
  button, emptyState, errorState, formatDateTime, incidentStatusBadge, loadMoreButton, loadingRows, person,
  setTitle, severityBadge, timeAgo, toastError, visibilityBadge,
} from '../ui.js';

const PAGE_SIZE = 25;

// Views, PagerDuty-style: the default is what still needs work, most severe first.
const VIEWS = [
  { key: 'open', label: 'Open', query: { open: 'true' } },
  { key: 'resolved', label: 'Resolved', query: { status: 'RESOLVED' } },
  { key: 'closed', label: 'Closed', query: { status: 'CLOSED' } },
  { key: 'all', label: 'All', query: {} },
];
const SEVERITIES = [['', 'Any severity'], ['CRITICAL', 'Critical'], ['HIGH', 'High'], ['MEDIUM', 'Medium'], ['LOW', 'Low']];
const SORTS = [['priority', 'Most severe first'], ['newest', 'Newest first']];

// Everything that defines the list lives in the address bar, so a view can be
// bookmarked or sent to a colleague, and the back button works.
function readState() {
  const params = new URLSearchParams(location.search);
  return {
    view: VIEWS.some((view) => view.key === params.get('view')) ? params.get('view') : 'open',
    q: params.get('q') ?? '',
    severity: params.get('severity') ?? '',
    sort: params.get('sort') === 'newest' ? 'newest' : 'priority',
  };
}

function writeState(state) {
  const params = new URLSearchParams();
  if (state.view !== 'open') params.set('view', state.view);
  if (state.q) params.set('q', state.q);
  if (state.severity) params.set('severity', state.severity);
  if (state.sort !== 'priority') params.set('sort', state.sort);
  history.replaceState(null, '', params.size ? `?${params}` : location.pathname);
}

async function start() {
  setTitle('Incidents');
  const main = renderShell({ active: 'incidents' });
  const { user } = getSession();
  const state = readState();

  let incidents = [];
  let pagination = null;
  let latestRequest = 0;

  const listHost = h('div');
  const countText = h('span', { class: 'result-count', 'aria-live': 'polite' });

  // ---- Controls
  const tabs = h(
    'div',
    { class: 'tabs', role: 'group', 'aria-label': 'Which incidents' },
    VIEWS.map((view) => {
      const tab = h('button', { class: 'tab', type: 'button', 'aria-pressed': String(view.key === state.view), 'data-view': view.key }, view.label);
      tab.addEventListener('click', () => {
        state.view = view.key;
        tabs.querySelectorAll('.tab').forEach((other) => other.setAttribute('aria-pressed', String(other === tab)));
        changed();
      });
      return tab;
    })
  );

  const search = h('input', { class: 'input', type: 'search', name: 'q', value: state.q, placeholder: 'Search titles', 'aria-label': 'Search incidents by title', autocomplete: 'off' });
  let searchTimer;
  search.addEventListener('input', () => {
    // Waits for a pause in typing so each keystroke is not a request.
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      state.q = search.value.trim();
      changed();
    }, 250);
  });

  const select = (name, options, value, label) => {
    const element = h('select', { class: 'select select-sm', name, 'aria-label': label }, options.map(([optionValue, text]) => h('option', { value: optionValue }, text)));
    element.value = value;
    element.addEventListener('change', () => {
      state[name] = element.value;
      changed();
    });
    return element;
  };

  const toolbar = h(
    'div',
    { class: 'toolbar' },
    h('div', { class: 'search-field' }, icon('search', 'sm'), search),
    select('severity', SEVERITIES, state.severity, 'Filter by severity'),
    h('div', { class: 'toolbar-end' }, countText, select('sort', SORTS, state.sort, 'Sort incidents'))
  );

  render(
    main,
    h(
      'div',
      { class: 'page-header' },
      h('div', {}, h('h1', {}, 'Incidents'), h('p', {}, 'Declare, triage and resolve incidents.')),
      canWrite(user) && h('div', { class: 'page-actions' }, button('Declare incident', { variant: 'primary', iconName: 'plus', onClick: () => declareIncidentDialog({ onCreated: (incident) => location.assign(`/incidents/${incident.id}`) }).catch(toastError) }))
    ),
    h('section', { class: 'panel', 'aria-label': 'Incident list' }, tabs, toolbar, listHost)
  );

  function changed() {
    writeState(state);
    load({ reset: true });
  }

  function query({ append, reset }) {
    const view = VIEWS.find((candidate) => candidate.key === state.view);
    const parameters = { ...view.query, sort: state.sort, limit: PAGE_SIZE };
    if (state.q) parameters.q = state.q;
    if (state.severity) parameters.severity = state.severity;
    if (append) parameters.cursor = pagination.nextCursor;
    // A live refresh reloads as many rows as are on screen, so the list a person
    // scrolled through does not collapse back to one page.
    else if (!reset) parameters.limit = Math.min(100, Math.max(PAGE_SIZE, incidents.length));
    return parameters;
  }

  async function load({ reset = false, append = false } = {}) {
    // Requests can finish out of order (a slow search followed by a fast one); only
    // the most recently started one may paint.
    const request = ++latestRequest;
    try {
      const { data, pagination: page } = await api.get('/incidents', query({ append, reset }));
      if (request !== latestRequest) return;
      incidents = append ? [...incidents, ...data] : data;
      pagination = page;
      paint();
    } catch (error) {
      if (request !== latestRequest) return;
      render(listHost, errorState(error, () => load({ reset: true })));
    }
  }

  function paint() {
    countText.textContent = incidents.length === 0 ? '' : `${incidents.length}${pagination?.hasMore ? '+' : ''} shown`;

    if (incidents.length === 0) {
      const filtered = state.q || state.severity;
      const messages = {
        open: ['No open incidents', 'Nothing is being worked on right now.'],
        resolved: ['No resolved incidents', 'Incidents that have been resolved but not closed appear here.'],
        closed: ['No closed incidents', 'Closed incidents are the finished record.'],
        all: ['No incidents yet', 'When an incident is declared it shows up here for your team to triage.'],
      };
      const [title, description] = filtered ? ['No incidents match', 'Try a different search or severity.'] : messages[state.view];
      render(listHost, emptyState({ iconName: filtered ? 'search' : 'checkCircle', title, description }));
      return;
    }

    render(
      listHost,
      h(
        'table',
        { class: 'table' },
        h('caption', { class: 'visually-hidden' }, 'Incidents'),
        h('thead', {}, h('tr', {}, ['Incident', 'Severity', 'Status', 'Assignee', 'Started', 'Visibility'].map((heading) => h('th', { scope: 'col' }, heading)))),
        h('tbody', {}, incidents.map(incidentTableRow))
      ),
      pagination?.hasMore && loadMoreButton(() => load({ append: true }))
    );
  }

  render(listHost, loadingRows(5));
  load({ reset: true });
  subscribe(['incident:created', 'incident:updated', 'service:changed'], () => load());
}

function incidentTableRow(incident) {
  const services = incident.affectedServices ?? [];
  return h(
    'tr',
    { class: 'row-link' },
    h(
      'td',
      { class: 'cell-title' },
      h('a', { href: `/incidents/${incident.id}` }, incident.title),
      services.length > 0 && h('div', { class: 'cell-sub' }, services.map((service) => service.name).join(', '))
    ),
    h('td', { class: 'cell-nowrap cell-badges' }, severityBadge(incident.severity)),
    h('td', { class: 'cell-nowrap cell-badges' }, incidentStatusBadge(incident.status)),
    h('td', { 'data-label': 'Assignee' }, person(incident.assignee)),
    h('td', { class: 'cell-nowrap', 'data-label': 'Started' }, h('time', { datetime: incident.createdAt, title: formatDateTime(incident.createdAt) }, timeAgo(incident.createdAt))),
    h('td', { class: 'cell-nowrap' }, visibilityBadge(incident.isPublic))
  );
}

if (requireSession()) start();
