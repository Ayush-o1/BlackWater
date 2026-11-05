import { api, getAll } from '../api.js';
import { canWrite, getSession, requireSession } from '../auth.js';
import { editIncidentDialog, timeline } from '../components.js';
import { h, render } from '../dom.js';
import { subscribe } from '../realtime.js';
import { renderShell } from '../shell.js';
import {
  avatar, busy, button, confirmDialog, emptyState, errorState, formatDateTime, healthLabel,
  incidentStatusBadge, loadingRows, severityBadge, setTitle, timeAgo, toast, toastError,
  visibilityBadge,
} from '../ui.js';

const incidentId = location.pathname.split('/')[2];

async function start() {
  const main = renderShell({ active: 'incidents' });
  const { user } = getSession();
  const mayWrite = canWrite(user);

  let incident = null;
  let team = [];

  // Four regions are repainted when data changes. The "add update" form is built
  // once and never repainted, so a half-written note survives a live refresh.
  const headerEl = h('div', { class: 'page-header' });
  const detailsBody = h('div', { class: 'panel-body' });
  const timelineBody = h('div', { class: 'panel-body' });
  const updatesBody = h('div', { class: 'panel-body' });
  const updateFormHost = h('div');

  const layout = h(
    'div',
    { class: 'split' },
    h(
      'div',
      { class: 'stack' },
      h('section', { class: 'panel' }, h('div', { class: 'panel-header' }, h('h2', {}, 'Timeline')), timelineBody),
      updateFormHost
    ),
    h(
      'div',
      { class: 'stack' },
      h('section', { class: 'panel' }, h('div', { class: 'panel-header' }, h('h2', {}, 'Details')), detailsBody),
      h('section', { class: 'panel' }, h('div', { class: 'panel-header' }, h('h2', {}, 'Notes and updates')), updatesBody)
    )
  );

  render(main, h('div', { class: 'panel' }, loadingRows(3)));

  async function load() {
    try {
      const { data } = await api.get(`/incidents/${incidentId}`);
      incident = data;
      if (mayWrite && team.length === 0) team = await getAll('/users');

      if (!main.contains(layout)) render(main, headerEl, layout);
      setTitle(incident.title);
      paint();
    } catch (error) {
      if (error.status === 404 || error.status === 400) {
        render(main, h('div', { class: 'panel' }, emptyState({
          iconName: 'alert',
          title: 'Incident not found',
          description: 'It may belong to another organization, or the link is wrong.',
          action: h('a', { class: 'btn', href: '/incidents' }, 'Back to incidents'),
        })));
      } else {
        render(main, h('div', { class: 'panel' }, errorState(error, load)));
      }
    }
  }

  // ---------- Actions ----------

  async function act(triggerButton, request, successMessage) {
    await busy(triggerButton, async () => {
      await request();
      if (successMessage) toast(successMessage);
      await load();
    });
  }

  const setStatus = (status) => (trigger) =>
    act(trigger, () => api.patch(`/incidents/${incident.id}/status`, { status }), 'Status updated');

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
    if (confirmed) await setStatus('CLOSED')(trigger);
  }

  function statusActions() {
    switch (incident.status) {
      case 'TRIGGERED':
        return [button('Acknowledge', { onClick: setStatus('ACKNOWLEDGED') }), button('Resolve', { variant: 'primary', onClick: setStatus('RESOLVED') })];
      case 'ACKNOWLEDGED':
        return [button('Resolve incident', { variant: 'primary', onClick: setStatus('RESOLVED') })];
      case 'RESOLVED':
        return [button('Reopen', { onClick: setStatus('TRIGGERED') }), button('Close', { variant: 'danger', onClick: closeIncident })];
      default:
        return [];
    }
  }

  // ---------- Painting ----------

  function paint() {
    const closed = incident.status === 'CLOSED';

    render(
      headerEl,
      h(
        'div',
        {},
        h('h1', {}, incident.title),
        h('div', { class: 'cluster header-badges' }, incidentStatusBadge(incident.status), severityBadge(incident.severity), visibilityBadge(incident.isPublic)),
        h('p', {}, `Declared ${formatDateTime(incident.createdAt)}${incident.creator ? ` by ${incident.creator.name}` : ''}`)
      ),
      mayWrite &&
        h(
          'div',
          { class: 'page-actions' },
          statusActions(),
          !closed && button('Edit', { iconName: 'pencil', onClick: () => editIncidentDialog({ incident, onSaved: load }).catch(toastError) }),
          button(incident.isPublic ? 'Unpublish' : 'Publish', { iconName: 'globe', onClick: togglePublic })
        )
    );

    render(detailsBody, detailsList(closed));

    render(
      timelineBody,
      incident.timelineEvents.length ? timeline(incident.timelineEvents) : h('p', { class: 'muted' }, 'No history recorded for this incident.')
    );

    const updates = [...incident.updates].reverse();
    render(
      updatesBody,
      updates.length === 0
        ? h('p', { class: 'muted' }, 'No notes or updates yet.')
        : updates.map((update) =>
            h(
              'div',
              { class: 'note' },
              h('div', { class: 'note-head' }, h('span', { class: 'note-author' }, avatar(update.user?.name ?? '?'), update.user?.name ?? 'Unknown'), h('span', { class: update.isPublic ? 'badge badge-info' : 'badge' }, update.isPublic ? 'Public' : 'Internal')),
              h('p', { class: 'pre-wrap small' }, update.message),
              h('div', { class: 'subtle small' }, timeAgo(update.createdAt))
            )
          )
    );

    paintUpdateForm(closed);
  }

  function detailsList(closed) {
    const assigneeControl = () => {
      if (!mayWrite || closed) {
        return incident.assignee ? h('span', { class: 'cluster' }, avatar(incident.assignee.name), incident.assignee.name) : h('span', { class: 'muted' }, 'Unassigned');
      }

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
          select.value = incident.assigneeId ?? '';
        }
      });
      return select;
    };

    return h(
      'dl',
      { class: 'details' },
      h('div', {}, h('dt', {}, 'Assignee'), h('dd', {}, assigneeControl())),
      h(
        'div',
        {},
        h('dt', {}, 'Affected services'),
        h(
          'dd',
          { class: 'stack-sm' },
          incident.affectedServices.length === 0
            ? h('span', { class: 'muted' }, 'None linked')
            : incident.affectedServices.map((service) =>
                h('a', { class: 'cluster-between detail-service', href: `/services/${service.id}` }, h('span', {}, service.name), healthLabel(service.status))
              )
        )
      ),
      incident.description && h('div', {}, h('dt', {}, 'Description'), h('dd', {}, h('p', { class: 'pre-wrap' }, incident.description))),
      incident.acknowledgedAt && h('div', {}, h('dt', {}, 'Acknowledged'), h('dd', {}, formatDateTime(incident.acknowledgedAt))),
      incident.resolvedAt && h('div', {}, h('dt', {}, 'Resolved'), h('dd', {}, formatDateTime(incident.resolvedAt))),
      incident.isPublic &&
        h('div', {}, h('dt', {}, 'Status page'), h('dd', {}, h('a', { href: `/status/${user.orgId}/incidents/${incident.id}`, target: '_blank', rel: 'noopener' }, 'View public page')))
    );
  }

  // The form is created on first paint and then only toggled/hinted.
  let updateForm = null;
  let publicHint = null;

  function paintUpdateForm(closed) {
    if (!mayWrite) {
      render(updateFormHost);
      return;
    }

    if (closed) {
      updateForm = null;
      render(updateFormHost, h('section', { class: 'panel' }, h('div', { class: 'panel-body muted' }, 'This incident is closed and can no longer be updated.')));
      return;
    }

    if (!updateForm) {
      const message = h('textarea', { class: 'textarea', name: 'message', required: true, maxlength: 5000, placeholder: 'What is happening? What are you doing about it?', 'aria-label': 'Update message' });
      const visibility = h('select', { class: 'select', name: 'isPublic', 'aria-label': 'Who can see this' }, h('option', { value: 'false' }, 'Internal note: team only'), h('option', { value: 'true' }, 'Public update: shown on the status page'));
      publicHint = h('p', { class: 'hint' });
      const post = h('button', { class: 'btn btn-primary', type: 'submit' }, 'Post');

      visibility.addEventListener('change', refreshHint);

      updateForm = h(
        'form',
        { class: 'form' },
        message,
        visibility,
        publicHint,
        h('div', { class: 'form-actions' }, post)
      );
      updateForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        await busy(post, async () => {
          await api.post(`/incidents/${incident.id}/updates`, { message: message.value, isPublic: visibility.value === 'true' });
          message.value = '';
          toast('Posted');
          await load();
        });
      });
    }

    render(updateFormHost, h('section', { class: 'panel' }, h('div', { class: 'panel-header' }, h('h2', {}, 'Add a note or update')), h('div', { class: 'panel-body' }, updateForm)));
    refreshHint();
  }

  function refreshHint() {
    if (!publicHint) return;
    const wantsPublic = updateForm.elements.isPublic.value === 'true';
    publicHint.textContent =
      wantsPublic && !incident.isPublic
        ? 'This incident is private, so a public update stays hidden until you publish the incident.'
        : wantsPublic
          ? 'Visitors to the status page will see this message.'
          : 'Only your team can see this.';
  }

  load();
  subscribe(['incident:updated', 'service:changed'], load);
}

if (requireSession()) start();
