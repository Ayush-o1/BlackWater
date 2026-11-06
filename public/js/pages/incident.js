import { api, getAll } from '../api.js';
import { canWrite, getSession, requireSession } from '../auth.js';
import { activityFeed, editIncidentDialog } from '../components.js';
import { h, render } from '../dom.js';
import { icon } from '../icons.js';
import { subscribe } from '../realtime.js';
import { renderShell, setBreadcrumb } from '../shell.js';
import {
  busy, button, confirmDialog, emptyState, errorState, formatDateTime, healthLabel, incidentStatusBadge,
  loadingRows, person, setTitle, severityBadge, toast, toastError, visibilityBadge,
} from '../ui.js';

const incidentId = location.pathname.split('/')[2];

// The lifecycle in the order an incident moves through it. RESOLVED can go back to
// TRIGGERED (reopen); CLOSED is final. The server enforces the same rules.
const LIFECYCLE = ['TRIGGERED', 'ACKNOWLEDGED', 'RESOLVED', 'CLOSED'];
const LIFECYCLE_LABEL = { TRIGGERED: 'Triggered', ACKNOWLEDGED: 'Acknowledged', RESOLVED: 'Resolved', CLOSED: 'Closed' };

async function start() {
  const main = renderShell({ active: 'incidents' });
  const { user } = getSession();
  const mayWrite = canWrite(user);

  let incident = null;
  let team = [];

  // These regions are repainted when data changes. The update form is built once
  // and never repainted, so a half-written note survives a live refresh.
  const headerHost = h('div', { class: 'stack-sm' });
  const descriptionHost = h('div');
  const composerHost = h('div');
  const feedHost = h('div', { class: 'panel-body' });
  const detailsHost = h('div', { class: 'panel-body' });

  const layout = h(
    'div',
    { class: 'split split-facts-first' },
    h(
      'div',
      { class: 'stack' },
      descriptionHost,
      h('section', { class: 'panel', 'aria-labelledby': 'activity-title' }, h('div', { class: 'panel-header' }, h('div', {}, h('h2', { id: 'activity-title' }, 'Activity'), h('p', {}, 'Every change and update, newest first'))), composerHost, feedHost)
    ),
    h('aside', { class: 'split-aside', 'aria-label': 'Incident details' }, h('section', { class: 'panel' }, h('div', { class: 'panel-header' }, h('h2', {}, 'Details')), detailsHost))
  );

  render(main, h('div', { class: 'panel' }, loadingRows(3)));

  async function load() {
    try {
      const { data } = await api.get(`/incidents/${incidentId}`);
      incident = data;
      if (mayWrite && team.length === 0) team = await getAll('/users');

      if (!main.contains(layout)) render(main, headerHost, layout);
      setTitle(incident.title);
      setBreadcrumb([{ label: 'Incidents', href: '/incidents' }, { label: incident.title }]);
      paint();
    } catch (error) {
      if (error.status === 404 || error.status === 400) {
        setBreadcrumb([{ label: 'Incidents', href: '/incidents' }, { label: 'Not found' }]);
        render(main, h('div', { class: 'panel' }, emptyState({
          iconName: 'alert',
          title: 'Incident not found',
          description: 'It may belong to another organization, or the link is wrong.',
          action: h('a', { class: 'btn', href: '/incidents' }, 'Back to incidents'),
          level: 1,
        })));
      } else {
        render(main, h('div', { class: 'panel' }, errorState(error, load)));
      }
    }
  }

  // ---------- Actions ----------

  async function act(trigger, request, successMessage) {
    await busy(trigger, async () => {
      await request();
      if (successMessage) toast(successMessage);
      await load();
    });
  }

  const setStatus = (status, message) => (trigger) => act(trigger, () => api.patch(`/incidents/${incident.id}/status`, { status }), message);

  async function togglePublic(trigger) {
    if (!incident.isPublic) {
      const confirmed = await confirmDialog({
        title: 'Publish to the status page?',
        message: 'Anyone with the link will see this incident’s title, severity, status, affected services and its public updates. Descriptions, internal notes and people are never shown.',
        confirmLabel: 'Publish',
      });
      if (!confirmed) return;
    }
    await act(trigger, () => api.patch(`/incidents/${incident.id}/visibility`, { isPublic: !incident.isPublic }), incident.isPublic ? 'Removed from the status page' : 'Published to the status page');
  }

  async function closeIncident(trigger) {
    const confirmed = await confirmDialog({
      title: 'Close this incident?',
      message: 'A closed incident is a finished record. It can no longer be changed, reopened or updated.',
      confirmLabel: 'Close incident',
      danger: true,
    });
    if (confirmed) await setStatus('CLOSED', 'Incident closed')(trigger);
  }

  // One primary action: the next step in the lifecycle. Everything else is secondary.
  function lifecycleActions() {
    switch (incident.status) {
      case 'TRIGGERED':
        return [button('Acknowledge', { variant: 'primary', onClick: setStatus('ACKNOWLEDGED', 'Acknowledged: the team knows you are on it') }), button('Resolve', { onClick: setStatus('RESOLVED', 'Incident resolved') })];
      case 'ACKNOWLEDGED':
        return [button('Resolve incident', { variant: 'primary', onClick: setStatus('RESOLVED', 'Incident resolved') })];
      case 'RESOLVED':
        return [button('Close', { variant: 'primary', onClick: closeIncident }), button('Reopen', { onClick: setStatus('TRIGGERED', 'Incident reopened') })];
      default:
        return [];
    }
  }

  // ---------- Painting ----------

  function paint() {
    const closed = incident.status === 'CLOSED';

    render(
      headerHost,
      h(
        'div',
        { class: 'page-header' },
        h(
          'div',
          { class: 'stack-sm' },
          h('h1', { class: 'pre-wrap' }, incident.title),
          h('div', { class: 'cluster header-badges' }, incidentStatusBadge(incident.status), severityBadge(incident.severity), visibilityBadge(incident.isPublic)),
          h('p', { class: 'small' }, `Declared ${formatDateTime(incident.createdAt)}${incident.creator ? ` by ${incident.creator.name}` : ''}`)
        ),
        mayWrite &&
          h(
            'div',
            { class: 'page-actions' },
            lifecycleActions(),
            !closed && button('Edit', { iconName: 'pencil', onClick: () => editIncidentDialog({ incident, onSaved: load }).catch(toastError) }),
            button(incident.isPublic ? 'Unpublish' : 'Publish', { iconName: 'globe', onClick: togglePublic })
          )
      ),
      lifecycleStepper(incident.status)
    );

    render(
      descriptionHost,
      incident.description && h('section', { class: 'panel', 'aria-labelledby': 'description-title' }, h('div', { class: 'panel-header' }, h('h2', { id: 'description-title' }, 'Description')), h('div', { class: 'panel-body' }, h('p', { class: 'pre-wrap' }, incident.description)))
    );

    render(feedHost, incident.timelineEvents.length ? activityFeed(incident) : h('p', { class: 'muted' }, 'No history recorded for this incident.'));
    render(detailsHost, detailsList(closed));
    paintComposer(closed);
  }

  function lifecycleStepper(status) {
    const current = LIFECYCLE.indexOf(status);
    return h(
      'ol',
      { class: 'lifecycle', 'aria-label': 'Lifecycle' },
      LIFECYCLE.map((step, index) =>
        h('li', { class: index < current ? 'done' : null, 'aria-current': index === current ? 'step' : null }, h('span', { class: 'step-dot', 'aria-hidden': 'true' }), LIFECYCLE_LABEL[step])
      )
    );
  }

  function detailsList(closed) {
    const assigneeControl = () => {
      if (!mayWrite || closed) return person(incident.assignee);

      const select = h(
        'select',
        { class: 'select select-sm', 'aria-label': 'Assignee' },
        h('option', { value: '' }, 'Unassigned'),
        team.map((member) => h('option', { value: member.id }, member.id === user.id ? `${member.name} (you)` : member.name))
      );
      select.value = incident.assigneeId ?? '';
      select.addEventListener('change', async () => {
        try {
          await api.patch(`/incidents/${incident.id}/assign`, { assigneeId: select.value || null });
          toast(select.value ? 'Assignee updated' : 'Incident unassigned');
          await load();
        } catch (error) {
          toastError(error);
          select.value = incident.assigneeId ?? ''; // the server refused; show the truth
        }
      });
      return select;
    };

    const row = (label, value) => value && h('div', {}, h('dt', {}, label), h('dd', {}, value));

    return h(
      'dl',
      { class: 'details' },
      row('Assignee', assigneeControl()),
      row(
        'Affected services',
        incident.affectedServices.length === 0
          ? h('span', { class: 'muted' }, 'None linked')
          : h('div', {}, incident.affectedServices.map((service) => h('a', { class: 'detail-service', href: `/services/${service.id}` }, h('span', { class: 'truncate' }, service.name), healthLabel(service.status))))
      ),
      row(
        'Visibility',
        incident.isPublic
          ? h('div', { class: 'stack-sm' }, h('span', {}, 'Published to the status page'), h('a', { href: `/status/${user.orgId}/incidents/${incident.id}`, target: '_blank', rel: 'noopener' }, icon('external', 'sm'), 'View public page'))
          : h('span', {}, 'Private: your team only')
      ),
      row('Declared', h('span', {}, formatDateTime(incident.createdAt), incident.creator && h('span', { class: 'subtle' }, ` by ${incident.creator.name}`))),
      incident.acknowledgedAt && row('Acknowledged', formatDateTime(incident.acknowledgedAt)),
      incident.resolvedAt && row('Resolved', formatDateTime(incident.resolvedAt))
    );
  }

  // The composer is created on first paint and then only shown, hidden or re-hinted.
  let composer = null;
  let publicHint = null;

  function paintComposer(closed) {
    if (!mayWrite) {
      render(composerHost);
      return;
    }
    if (closed) {
      composer = null;
      render(composerHost, h('div', { class: 'panel-body muted' }, 'This incident is closed and can no longer be updated.'));
      return;
    }

    if (!composer) {
      const message = h('textarea', { class: 'textarea', name: 'message', required: true, maxlength: 5000, rows: 3, placeholder: 'What is happening? What are you doing about it?', 'aria-label': 'Update message' });
      publicHint = h('p', { class: 'hint', id: 'visibility-hint' });
      const choice = (value, label, iconName, checked) =>
        h('label', {}, h('input', { type: 'radio', name: 'visibility', value, checked, 'aria-describedby': 'visibility-hint' }), icon(iconName, 'sm'), label);
      const visibility = h(
        'fieldset',
        { class: 'field' },
        h('legend', { class: 'visually-hidden' }, 'Who can see this'),
        h('div', { class: 'segmented' }, choice('internal', 'Internal note', 'lock', true), choice('public', 'Public update', 'globe', false))
      );
      const post = h('button', { class: 'btn btn-primary', type: 'submit' }, 'Post');

      visibility.addEventListener('change', refreshHint);
      composer = h('form', { class: 'form', 'aria-label': 'Add a note or update' }, message, h('div', { class: 'composer-actions' }, h('div', { class: 'stack-sm' }, visibility, publicHint), post));
      composer.addEventListener('submit', async (event) => {
        event.preventDefault();
        await busy(post, async () => {
          const isPublic = composer.elements.visibility.value === 'public';
          await api.post(`/incidents/${incident.id}/updates`, { message: message.value, isPublic });
          message.value = '';
          toast(isPublic ? 'Public update posted' : 'Internal note added');
          await load();
        });
      });
    }

    render(composerHost, h('div', { class: 'panel-body composer' }, composer));
    refreshHint();
  }

  function refreshHint() {
    if (!publicHint) return;
    const wantsPublic = composer.elements.visibility.value === 'public';
    publicHint.textContent =
      wantsPublic && !incident.isPublic
        ? 'This incident is private, so a public update stays hidden until you publish the incident.'
        : wantsPublic
          ? 'Visitors to the status page will see this message.'
          : 'Only your team can see this.';
  }

  load();
  subscribe(['incident:updated', 'service:changed'], load);
  // A new teammate should appear in the assignee list without a reload.
  subscribe(['team:changed'], () => {
    team = [];
    load();
  });
}

if (requireSession()) start();
