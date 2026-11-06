import { api } from '../api.js';
import { canWrite, getSession, isAdmin, requireSession } from '../auth.js';
import { serviceDialog } from '../components.js';
import { h, render } from '../dom.js';
import { subscribe } from '../realtime.js';
import { renderShell, setBreadcrumb } from '../shell.js';
import {
  busy, button, changeDetector, confirmDialog, emptyState, errorState, formatDate, healthLabel,
  incidentStatusBadge, loadingRows, person, setTitle, severityBadge, timeAgo, toast,
} from '../ui.js';

const serviceId = location.pathname.split('/')[2];
const OPEN = ['TRIGGERED', 'ACKNOWLEDGED'];

async function start() {
  const main = renderShell({ active: 'services' });
  const { user } = getSession();

  render(main, h('div', { class: 'panel' }, loadingRows(3)));
  const shown = changeDetector();

  async function load() {
    try {
      const { data: service } = await api.get(`/services/${serviceId}`);
      if (!shown.changed(service)) return;
      setTitle(service.name);
      setBreadcrumb([{ label: 'Services', href: '/services' }, { label: service.name }]);
      paint(service);
    } catch (error) {
      shown.forget();
      if (error.status === 404 || error.status === 400) {
        setBreadcrumb([{ label: 'Services', href: '/services' }, { label: 'Not found' }]);
        render(main, h('div', { class: 'panel' }, emptyState({
          iconName: 'server',
          title: 'Service not found',
          description: 'It may have been deleted, or the link is wrong.',
          action: h('a', { class: 'btn', href: '/services' }, 'Back to services'),
          level: 1,
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
    const open = service.incidents.filter((incident) => OPEN.includes(incident.status));
    const past = service.incidents.filter((incident) => !OPEN.includes(incident.status));

    render(
      main,
      h(
        'div',
        { class: 'page-header' },
        h('div', { class: 'stack-sm' }, h('h1', {}, service.name), h('div', { class: 'header-badges' }, healthLabel(service.status)), service.description && h('p', {}, service.description)),
        h(
          'div',
          { class: 'page-actions' },
          canWrite(user) && button('Edit', { iconName: 'pencil', onClick: () => serviceDialog({ service, onSaved: load }) }),
          isAdmin(user) && button('Delete', { variant: 'danger', iconName: 'trash', onClick: (trigger) => remove(trigger, service) })
        )
      ),
      h(
        'div',
        { class: 'split split-facts-first' },
        h(
          'div',
          { class: 'stack' },
          incidentPanel('Open incidents', 'Affecting this service now', open, { iconName: 'checkCircle', title: 'Nothing open', description: 'No open incident affects this service, so it is operational.' }),
          incidentPanel('Earlier incidents', 'Resolved and closed, most recent first', past, { iconName: 'history', title: 'No earlier incidents', description: 'Nothing has been reported against this service before.' })
        ),
        h(
          'aside',
          { class: 'split-aside', 'aria-label': 'About this service' },
          h(
            'section',
            { class: 'panel' },
            h('div', { class: 'panel-header' }, h('h2', {}, 'How health is set')),
            h(
              'div',
              { class: 'panel-body stack-sm small' },
              h('p', { class: 'muted' }, 'Health follows the worst open incident on this service. Nobody sets it by hand.'),
              h('dl', { class: 'details' }, [
                ['Critical', 'Major outage'],
                ['High', 'Partial outage'],
                ['Medium or Low', 'Degraded'],
                ['Nothing open', 'Operational'],
              ].map(([cause, effect]) => h('div', { class: 'cluster-between' }, h('dt', {}, cause), h('dd', {}, effect)))),
              h('p', { class: 'subtle' }, `Added ${formatDate(service.createdAt)}`)
            )
          )
        )
      )
    );
  }

  function incidentPanel(title, subtitle, incidents, empty) {
    return h(
      'section',
      { class: 'panel' },
      h('div', { class: 'panel-header' }, h('div', {}, h('h2', {}, title), h('p', {}, subtitle))),
      incidents.length === 0
        ? emptyState(empty)
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
                  h('div', {}, h('div', { class: 'row-title' }, incident.title), h('div', { class: 'row-meta' }, h('span', {}, `Started ${timeAgo(incident.createdAt)}`), person(incident.assignee))),
                  h('div', { class: 'row-side' }, severityBadge(incident.severity), incidentStatusBadge(incident.status))
                )
              )
            )
          )
    );
  }

  load();
  subscribe(['incident:created', 'incident:updated', 'service:changed'], load);
}

if (requireSession()) start();
