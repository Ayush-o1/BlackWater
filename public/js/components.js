import { api, getAll } from './api.js';
import { h } from './dom.js';
import { icon } from './icons.js';
import {
  avatar, checkboxField, formDialog, selectField, textField, textareaField, timeAgo, titleCase, toast, formatDateTime,
} from './ui.js';

// Pieces of the interface that more than one page uses.

// ---------- Status banner ----------

// One sentence for the overall state, used by the overview and the public status
// page so both always describe the same state in the same words. Each state has its
// own icon as well as its colour.
const BANNER = {
  OPERATIONAL: ['checkCircle', 'All systems operational'],
  DEGRADED: ['info', 'Degraded performance'],
  PARTIAL_OUTAGE: ['alert', 'Partial outage'],
  MAJOR_OUTAGE: ['xCircle', 'Major outage'],
};

export function statusBanner(status, detail, headingLevel = 'h2') {
  const [iconName, title] = BANNER[status] ?? BANNER.OPERATIONAL;
  return h(
    'div',
    { class: `banner banner-${String(status).toLowerCase()}` },
    icon(iconName, 'lg'),
    h('div', {}, h(headingLevel, {}, title), detail && h('p', {}, detail))
  );
}

// ---------- Audit timeline ----------

const personName = (reference) => (reference?.name ? reference.name : 'someone');

// Turns one timeline event into words. The wording lives here (not on the
// server) so the API stays a plain record of what happened.
function describeEvent(event) {
  const m = event.metadata ?? {};

  switch (event.eventType) {
    case 'INCIDENT_CREATED':
      return { title: 'Incident declared', detail: `${titleCase(m.severity ?? '')} severity${m.isPublic ? ', published to the status page' : ''}` };

    case 'STATUS_CHANGED':
      return { title: 'Status changed', detail: `${titleCase(m.oldStatus ?? '?')} → ${titleCase(m.newStatus ?? '?')}` };

    case 'ASSIGNEE_CHANGED': {
      if ('to' in m || 'from' in m) {
        if (!m.to) return { title: 'Unassigned', detail: m.from ? `Was ${personName(m.from)}` : null };
        return { title: `Assigned to ${personName(m.to)}`, detail: m.from ? `Previously ${personName(m.from)}` : null };
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

// What kind of mark each event gets in the feed: its icon says what happened.
const EVENT_ICON = {
  INCIDENT_CREATED: 'flag',
  STATUS_CHANGED: 'chevronRight',
  ASSIGNEE_CHANGED: 'users',
  INCIDENT_EDITED: 'pencil',
  UPDATE_ADDED: 'message',
  VISIBILITY_CHANGED: 'globe',
};

// The incident's activity in one chronological column, newest first: changes are
// compact one-line events, while notes and updates are messages and get a card.
// An "update posted" event and the update it refers to are shown as one entry, so
// the message appears exactly where it happened. An event with no actor is a system
// event (or one recorded before actors were tracked).
export function activityFeed(incident) {
  const updatesById = new Map(incident.updates.map((update) => [update.id, update]));
  const events = [...incident.timelineEvents].reverse();

  return h(
    'ol',
    { class: 'feed', 'aria-label': 'Activity, newest first' },
    events.map((event) => {
      const { title, detail } = describeEvent(event);
      const lines = Array.isArray(detail) ? detail : detail ? [detail] : [];
      const update = event.eventType === 'UPDATE_ADDED' ? updatesById.get(event.metadata?.updateId) : null;
      const isPublicUpdate = update?.isPublic;

      return h(
        'li',
        { class: isPublicUpdate ? 'feed-item feed-item-public' : 'feed-item' },
        h('span', { class: 'feed-mark', 'aria-hidden': 'true' }, icon(EVENT_ICON[event.eventType] ?? 'info')),
        h(
          'div',
          { class: 'stack-sm' },
          h(
            'div',
            { class: 'feed-event' },
            h('strong', {}, title),
            h('span', {}, event.actor ? `by ${event.actor.name}` : 'by System'),
            h('time', { class: 'feed-time', datetime: event.createdAt, title: formatDateTime(event.createdAt) }, timeAgo(event.createdAt)),
            lines.map((line) => h('span', { class: 'feed-detail' }, line))
          ),
          update &&
            h(
              'div',
              { class: isPublicUpdate ? 'note note-public' : 'note' },
              h(
                'div',
                { class: 'note-head' },
                h('span', { class: 'note-author' }, avatar(update.user?.name ?? '?'), update.user?.name ?? 'Unknown'),
                isPublicUpdate
                  ? h('span', { class: 'badge visibility-public' }, icon('globe', 'sm'), 'Public update')
                  : h('span', { class: 'badge' }, icon('lock', 'sm'), 'Internal note')
              ),
              h('p', { class: 'note-body' }, update.message)
            )
        )
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
