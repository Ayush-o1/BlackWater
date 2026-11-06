import { api } from '../api.js';
import { canWrite, getSession, requireSession } from '../auth.js';
import { serviceDialog } from '../components.js';
import { h, render } from '../dom.js';
import { subscribe } from '../realtime.js';
import { renderShell } from '../shell.js';
import { button, changeDetector, emptyState, errorState, healthLabel, loadMoreButton, loadingRows, setTitle } from '../ui.js';

const PAGE_SIZE = 20;

async function start() {
  setTitle('Services');
  const main = renderShell({ active: 'services' });
  const { user } = getSession();

  let services = [];
  let pagination = null;
  const listPanel = h('section', { class: 'panel', 'aria-label': 'Service list' });

  const addService = () => serviceDialog({ onSaved: () => load() });

  render(
    main,
    h(
      'div',
      { class: 'page-header' },
      h('div', {}, h('h1', {}, 'Services'), h('p', {}, 'The parts of your platform. Their health follows your open incidents.')),
      canWrite(user) && h('div', { class: 'page-actions' }, button('Add service', { variant: 'primary', iconName: 'plus', onClick: addService }))
    ),
    listPanel
  );

  const shown = changeDetector();
  async function load({ append = false } = {}) {
    try {
      // On a refresh, reload as many rows as are already shown (see incidents.js).
      const query = { limit: append ? PAGE_SIZE : Math.min(100, Math.max(PAGE_SIZE, services.length)) };
      if (append) query.cursor = pagination.nextCursor;

      const { data, pagination: page } = await api.get('/services', query);
      services = append ? [...services, ...data] : data;
      pagination = page;
      if (!shown.changed({ services, pagination })) return;
      paint();
    } catch (error) {
      if (!shown.changed({ failed: error.status, message: error.message })) return; // already showing this failure
      render(listPanel, errorState(error, () => load()));
    }
  }

  function paint() {
    if (services.length === 0) {
      render(
        listPanel,
        emptyState({
          iconName: 'server',
          title: 'No services yet',
          description: 'Add the components you run (an API, a database, a website) to track their health.',
          action: canWrite(user) ? button('Add your first service', { onClick: addService }) : null,
        })
      );
      return;
    }
    render(
      listPanel,
      h(
        'table',
        { class: 'table' },
        h('caption', { class: 'visually-hidden' }, 'Services'),
        h('thead', {}, h('tr', {}, ['Service', 'Health', 'Open incidents'].map((heading) => h('th', { scope: 'col' }, heading)))),
        h('tbody', {}, services.map(serviceTableRow))
      ),
      pagination?.hasMore && loadMoreButton(() => load({ append: true }))
    );
  }

  render(listPanel, loadingRows());
  load();
  subscribe(['incident:created', 'incident:updated', 'service:changed'], () => load());
}

function serviceTableRow(service) {
  return h(
    'tr',
    { class: 'row-link' },
    h('td', { class: 'cell-title' }, h('a', { href: `/services/${service.id}` }, service.name), service.description && h('div', { class: 'cell-sub' }, service.description)),
    h('td', { class: 'cell-nowrap cell-badges' }, healthLabel(service.status)),
    h('td', { class: 'cell-nowrap num', 'data-label': 'Open incidents' }, service.openIncidentCount === 0 ? h('span', { class: 'subtle' }, 'None') : String(service.openIncidentCount))
  );
}

if (requireSession()) start();
