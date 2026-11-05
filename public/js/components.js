import { api, getAll } from './api.js';
import { h } from './dom.js';
import {
  avatar, checkboxField, formDialog, healthLabel, incidentStatusBadge, selectField,
  severityBadge, textField, textareaField, timeAgo, titleCase, toast, formatDateTime, visibilityBadge,
} from './ui.js';

// Pieces of the interface that more than one page uses.

// ---------- Rows ----------

export function incidentRow(incident) {
  const affected = incident.affectedServices ?? [];

  return h(
    'a',
    { class: 'row', href: `/incidents/${incident.id}` },
    h(
      'div',
      {},
      h('div', { class: 'row-title truncate' }, incident.title),
      h(
        'div',
        { class: 'row-meta' },
        h('span', {}, `Started ${timeAgo(incident.createdAt)}`),
        incident.assignee ? h('span', { class: 'cluster' }, avatar(incident.assignee.name), incident.assignee.name) : h('span', {}, 'Unassigned'),
        affected.length > 0 && h('span', { class: 'truncate' }, affected.map((service) => service.name).join(', '))
      )
    ),
    h('div', { class: 'row-side' }, visibilityBadge(incident.isPublic), severityBadge(incident.severity), incidentStatusBadge(incident.status))
  );
}

export function serviceRow(service) {
  return h(
    'a',
    { class: 'row', href: `/services/${service.id}` },
    h('div', {}, h('div', { class: 'row-title' }, service.name), service.description && h('div', { class: 'row-meta' }, h('span', { class: 'truncate' }, service.description))),
    h('div', { class: 'row-side' }, healthLabel(service.status))
  );
}

// ---------- Audit timeline ----------

const person = (reference) => (reference?.name ? reference.name : 'someone');

// Turns one timeline event into words. The wording lives here (not on the
// server) so the API stays a plain record of what happened.
export function describeEvent(event) {
  const m = event.metadata ?? {};

  switch (event.eventType) {
    case 'INCIDENT_CREATED':
      return { title: 'Incident declared', detail: `${titleCase(m.severity ?? '')} severity${m.isPublic ? ', published to the status page' : ''}` };

    case 'STATUS_CHANGED':
      return { title: 'Status changed', detail: `${titleCase(m.oldStatus ?? '?')} → ${titleCase(m.newStatus ?? '?')}` };

    case 'ASSIGNEE_CHANGED': {
      if ('to' in m || 'from' in m) {
        if (!m.to) return { title: 'Unassigned', detail: m.from ? `Was ${person(m.from)}` : null };
        return { title: `Assigned to ${person(m.to)}`, detail: m.from ? `Previously ${person(m.from)}` : null };
      }
      return { title: 'Assignee changed', detail: null }; // events recorded before names were stored
    }

    case 'INCIDENT_EDITED': {
      const changes = m.changes ?? {};
      const lines = [];
      if (changes.title) lines.push(`Title: “${changes.title.from}” → “${changes.title.to}”`);
      if (changes.severity) lines.push(`Severity: ${titleCase(changes.severity.from)} → ${titleCase(changes.severity.to)}`);
      if (changes.description) lines.push('Description updated');
      if (changes.services?.added?.length) lines.push(`Added ${changes.services.added.map((s) => s.name).join(', ')}`);
      if (changes.services?.removed?.length) lines.push(`Removed ${changes.services.removed.map((s) => s.name).join(', ')}`);
      return { title: 'Incident edited', detail: lines };
    }

    case 'UPDATE_ADDED':
      return { title: m.isPublic ? 'Public update posted' : 'Internal note added', detail: null };

    case 'VISIBILITY_CHANGED':
      return { title: m.isPublic ? 'Published to the status page' : 'Removed from the status page', detail: null };

    default:
      return { title: titleCase(event.eventType), detail: null };
  }
}

// The internal timeline. Each entry says what changed and who did it; an event
// without an actor is a system event (or one recorded before actors were tracked).
export function timeline(events) {
  return h(
    'ol',
    { class: 'timeline' },
    events.map((event) => {
      const { title, detail } = describeEvent(event);
      const lines = Array.isArray(detail) ? detail : detail ? [detail] : [];

      return h(
        'li',
        { class: 'timeline-item' },
        h('span', { class: 'dot' }),
        h('div', { class: 'timeline-head' }, h('span', { class: 'timeline-title' }, title), h('time', { class: 'timeline-time', datetime: event.createdAt, title: formatDateTime(event.createdAt) }, timeAgo(event.createdAt))),
        lines.map((line) => h('div', { class: 'timeline-detail' }, line)),
        h('div', { class: 'timeline-detail subtle' }, event.actor ? `by ${event.actor.name}` : 'by System')
      );
    })
  );
}

// ---------- Dialogs ----------

// A scrollable list of checkboxes, one per service.
function serviceChecklist(services, selectedIds = []) {
  return h(
    'div',
    { class: 'field' },
    h('span', { class: 'label' }, 'Affected services'),
    services.length === 0
      ? h('p', { class: 'hint' }, 'No services yet. Add some under Services to link them to incidents.')
      : h(
          'div',
          { class: 'choice-list' },
          services.map((service) =>
            h('label', { class: 'check' }, h('input', { type: 'checkbox', name: 'serviceIds', value: service.id, checked: selectedIds.includes(service.id) }), service.name)
          )
        ),
    h('span', { class: 'hint' }, 'Their health follows the incident until it is resolved.')
  );
}

const SEVERITY_OPTIONS = [
  { value: 'CRITICAL', label: 'Critical: major outage' },
  { value: 'HIGH', label: 'High: partial outage' },
  { value: 'MEDIUM', label: 'Medium: degraded' },
  { value: 'LOW', label: 'Low: minor, degraded' },
];

export async function declareIncidentDialog({ onCreated }) {
  const services = await getAll('/services');

  formDialog({
    title: 'Declare an incident',
    submitLabel: 'Declare incident',
    fields: [
      textField({ name: 'title', label: 'Title', required: true, minlength: 5, maxlength: 200, placeholder: 'Checkout is returning errors' }),
      selectField({ name: 'severity', label: 'Severity', options: SEVERITY_OPTIONS, value: 'MEDIUM' }),
      textareaField({ name: 'description', label: 'Description', maxlength: 5000, hint: 'Internal. Never shown on the status page.' }),
      serviceChecklist(services),
      checkboxField({ name: 'isPublic', label: 'Publish to the public status page now' }),
    ],
    async onSubmit(values) {
      const { data } = await api.post('/incidents', {
        title: values.title,
        severity: values.severity,
        description: values.description.trim() || undefined,
        serviceIds: values.serviceIds ?? [],
        isPublic: values.isPublic,
      });
      toast('Incident declared');
      onCreated(data);
    },
  });
}

export async function editIncidentDialog({ incident, onSaved }) {
  const services = await getAll('/services');

  formDialog({
    title: 'Edit incident',
    fields: [
      textField({ name: 'title', label: 'Title', value: incident.title, required: true, minlength: 5, maxlength: 200 }),
      selectField({ name: 'severity', label: 'Severity', options: SEVERITY_OPTIONS, value: incident.severity }),
      textareaField({ name: 'description', label: 'Description', value: incident.description ?? '', maxlength: 5000 }),
      serviceChecklist(services, incident.affectedServices.map((service) => service.id)),
    ],
    async onSubmit(values) {
      await api.patch(`/incidents/${incident.id}`, {
        title: values.title,
        severity: values.severity,
        description: values.description.trim() || null,
        serviceIds: values.serviceIds ?? [],
      });
      toast('Incident updated');
      onSaved();
    },
  });
}

export function serviceDialog({ service, onSaved }) {
  const editing = Boolean(service);

  formDialog({
    title: editing ? 'Edit service' : 'Add a service',
    submitLabel: editing ? 'Save changes' : 'Add service',
    fields: [
      textField({ name: 'name', label: 'Name', value: service?.name ?? '', required: true, minlength: 2, maxlength: 200, placeholder: 'Payments API' }),
      textareaField({ name: 'description', label: 'Description', value: service?.description ?? '', maxlength: 2000, hint: 'Shown on the public status page.', rows: 3 }),
    ],
    async onSubmit(values) {
      const body = { name: values.name, description: values.description };
      if (editing) {
        await api.patch(`/services/${service.id}`, body);
        toast('Service updated');
      } else {
        await api.post('/services', body);
        toast('Service added');
      }
      onSaved();
    },
  });
}
