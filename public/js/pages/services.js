import { api } from '../api.js';
import { canWrite, getSession, requireSession } from '../auth.js';
import { serviceDialog, serviceRow } from '../components.js';
import { h, render } from '../dom.js';
import { subscribe } from '../realtime.js';
import { renderShell } from '../shell.js';
import { button, emptyState, errorState, loadMoreButton, loadingRows, setTitle } from '../ui.js';

const PAGE_SIZE = 20;

async function start() {
  setTitle('Services');
  const main = renderShell({ active: 'services' });
  const { user } = getSession();

  let services = [];
  let pagination = null;
  const listPanel = h('section', { class: 'panel' });

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

  async function load({ append = false } = {}) {
    try {
      // On a refresh, reload as many rows as are already shown (see incidents.js).
      const query = { limit: append ? PAGE_SIZE : Math.min(100, Math.max(PAGE_SIZE, services.length)) };
      if (append) query.cursor = pagination.nextCursor;

      const { data, pagination: page } = await api.get('/services', query);
      services = append ? [...services, ...data] : data;
      pagination = page;
      paint();
    } catch (error) {
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
    render(listPanel, h('div', { class: 'rows' }, services.map(serviceRow)), pagination?.hasMore && loadMoreButton(() => load({ append: true })));
  }

  render(listPanel, loadingRows());
  load();
  subscribe(['incident:created', 'incident:updated', 'service:changed'], () => load());
}

if (requireSession()) start();
