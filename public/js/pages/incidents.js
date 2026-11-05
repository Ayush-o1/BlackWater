import { api } from '../api.js';
import { canWrite, getSession, requireSession } from '../auth.js';
import { declareIncidentDialog, incidentRow } from '../components.js';
import { h, render } from '../dom.js';
import { subscribe } from '../realtime.js';
import { renderShell } from '../shell.js';
import { button, emptyState, errorState, loadMoreButton, loadingRows, selectField, setTitle, toastError } from '../ui.js';

const PAGE_SIZE = 20;

async function start() {
  setTitle('Incidents');
  const main = renderShell({ active: 'incidents' });
  const { user } = getSession();

  // The filters live in the address bar (?status=...), so a filtered list can
  // be bookmarked or shared and survives a reload.
  const params = new URLSearchParams(location.search);
  const filters = { status: params.get('status') ?? '', severity: params.get('severity') ?? '' };

  let incidents = [];
  let pagination = null;

  const listPanel = h('section', { class: 'panel' });

  const filterSelect = (name, label, options) =>
    selectField({ name, label: null, ariaLabel: `Filter by ${name}`, options: [{ value: '', label }, ...options], value: filters[name], small: true });

  const statusFilter = filterSelect('status', 'All statuses', [
    { value: 'TRIGGERED', label: 'Triggered' },
    { value: 'ACKNOWLEDGED', label: 'Acknowledged' },
    { value: 'RESOLVED', label: 'Resolved' },
    { value: 'CLOSED', label: 'Closed' },
  ]);
  const severityFilter = filterSelect('severity', 'All severities', [
    { value: 'CRITICAL', label: 'Critical' },
    { value: 'HIGH', label: 'High' },
    { value: 'MEDIUM', label: 'Medium' },
    { value: 'LOW', label: 'Low' },
  ]);

  for (const [field, control] of [['status', statusFilter], ['severity', severityFilter]]) {
    control.querySelector('select').addEventListener('change', (event) => {
      filters[field] = event.target.value;
      const next = new URLSearchParams(Object.entries(filters).filter(([, value]) => value));
      history.replaceState(null, '', next.size ? `?${next}` : location.pathname);
      load({ reset: true });
    });
  }

  const header = h(
    'div',
    { class: 'page-header' },
    h('div', {}, h('h1', {}, 'Incidents'), h('p', {}, 'Declare, triage and resolve incidents.')),
    canWrite(user) && h('div', { class: 'page-actions' }, button('Declare incident', { variant: 'primary', iconName: 'plus', onClick: () => declareIncidentDialog({ onCreated: (incident) => location.assign(`/incidents/${incident.id}`) }).catch(toastError) }))
  );

  render(main, header, h('div', { class: 'filters' }, statusFilter, severityFilter), listPanel);

  // Loads the first page (or, on a refresh, as many rows as are already on
  // screen, so a live update does not collapse a list the user scrolled through).
  async function load({ reset = false, append = false } = {}) {
    try {
      const query = { ...filters, limit: PAGE_SIZE };
      if (append) query.cursor = pagination.nextCursor;
      else if (!reset) query.limit = Math.min(100, Math.max(PAGE_SIZE, incidents.length));

      const { data, pagination: page } = await api.get('/incidents', query);
      incidents = append ? [...incidents, ...data] : data;
      pagination = page;
      paint();
    } catch (error) {
      render(listPanel, errorState(error, () => load({ reset: true })));
    }
  }

  function paint() {
    if (incidents.length === 0) {
      const filtered = filters.status || filters.severity;
      render(
        listPanel,
        emptyState({
          iconName: 'alert',
          title: filtered ? 'No incidents match these filters' : 'No incidents yet',
          description: filtered ? 'Try a different status or severity.' : 'When an incident is declared it shows up here for your team to triage.',
        })
      );
      return;
    }

    render(listPanel, h('div', { class: 'rows' }, incidents.map(incidentRow)), pagination?.hasMore && loadMoreButton(() => load({ append: true })));
  }

  render(listPanel, loadingRows());
  load({ reset: true });
  subscribe(['incident:created', 'incident:updated', 'service:changed'], () => load());
}

if (requireSession()) start();
