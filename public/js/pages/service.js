import { api } from '../api.js';
import { canWrite, getSession, isAdmin, requireSession } from '../auth.js';
import { incidentRow, serviceDialog } from '../components.js';
import { h, render } from '../dom.js';
import { subscribe } from '../realtime.js';
import { renderShell } from '../shell.js';
import { busy, button, confirmDialog, emptyState, errorState, formatDate, healthLabel, loadingRows, setTitle, toast } from '../ui.js';

const serviceId = location.pathname.split('/')[2];

async function start() {
  const main = renderShell({ active: 'services' });
  const { user } = getSession();

  render(main, h('div', { class: 'panel' }, loadingRows(3)));

  async function load() {
    try {
      const { data: service } = await api.get(`/services/${serviceId}`);
      setTitle(service.name);
      paint(service);
    } catch (error) {
      if (error.status === 404 || error.status === 400) {
        render(main, h('div', { class: 'panel' }, emptyState({
          iconName: 'server',
          title: 'Service not found',
          description: 'It may have been deleted, or the link is wrong.',
          action: h('a', { class: 'btn', href: '/services' }, 'Back to services'),
        })));
      } else {
        render(main, h('div', { class: 'panel' }, errorState(error, load)));
      }
    }
  }

  async function remove(trigger, service) {
    const confirmed = await confirmDialog({
      title: `Delete ${service.name}?`,
      message: 'It is removed from every incident it was linked to. Incident history is kept.',
      confirmLabel: 'Delete service',
      danger: true,
    });
    if (!confirmed) return;

    await busy(trigger, async () => {
      await api.delete(`/services/${service.id}`);
      toast('Service deleted');
      location.assign('/services');
    });
  }

  function paint(service) {
    const incidents = service.incidents;

    render(
      main,
      h(
        'div',
        { class: 'page-header' },
        h('div', {}, h('h1', {}, service.name), h('div', { class: 'header-badges' }, healthLabel(service.status)), service.description && h('p', {}, service.description)),
        h(
          'div',
          { class: 'page-actions' },
          canWrite(user) && button('Edit', { iconName: 'pencil', onClick: () => serviceDialog({ service, onSaved: load }) }),
          isAdmin(user) && button('Delete', { variant: 'danger', iconName: 'trash', onClick: (trigger) => remove(trigger, service) })
        )
      ),
      h(
        'section',
        { class: 'panel' },
        h('div', { class: 'panel-header' }, h('div', {}, h('h2', {}, 'Recent incidents'), h('p', {}, `Added ${formatDate(service.createdAt)}`))),
        incidents.length === 0
          ? emptyState({ iconName: 'checkCircle', title: 'No incidents', description: 'Nothing has been reported against this service.' })
          : h('div', { class: 'rows' }, incidents.map(incidentRow)),
        h('div', { class: 'panel-body muted small' }, 'Health is calculated from open incidents: Critical is a major outage, High a partial outage, Medium and Low degrade it.')
      )
    );
  }

  load();
  subscribe(['incident:created', 'incident:updated', 'service:changed'], load);
}

if (requireSession()) start();
