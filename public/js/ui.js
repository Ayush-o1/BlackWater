import { h } from './dom.js';
import { icon } from './icons.js';
import { ApiError } from './api.js';

// ---------- Text and time ----------

export function setTitle(title) {
  document.title = title ? `${title} · BlackWater` : 'BlackWater';
}

const dateTime = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' });
const dateOnly = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' });
const relative = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });

export const formatDateTime = (iso) => (iso ? dateTime.format(new Date(iso)) : '—');
export const formatDate = (iso) => (iso ? dateOnly.format(new Date(iso)) : '—');

// "3 minutes ago", "yesterday". Falls back to the date after a week.
export function timeAgo(iso) {
  const seconds = Math.round((new Date(iso).getTime() - Date.now()) / 1000);
  const distance = Math.abs(seconds);

  if (distance < 45) return 'just now';
  if (distance < 3600) return relative.format(Math.round(seconds / 60), 'minute');
  if (distance < 86400) return relative.format(Math.round(seconds / 3600), 'hour');
  if (distance < 7 * 86400) return relative.format(Math.round(seconds / 86400), 'day');
  return formatDate(iso);
}

export const titleCase = (value) => value.charAt(0) + value.slice(1).toLowerCase().replaceAll('_', ' ');

function initials(name) {
  return (name ?? '?').trim().split(/\s+/).slice(0, 2).map((word) => word[0]?.toUpperCase() ?? '').join('') || '?';
}

export const avatar = (name, large = false) =>
  h('span', { class: large ? 'avatar avatar-lg' : 'avatar', 'aria-hidden': 'true' }, initials(name));

// ---------- Badges and status ----------
// Every status is shown as a word with a shape as well as a colour, so it reads in
// greyscale, to colour-blind users and to screen readers alike.

const SEVERITY_LABEL = { CRITICAL: 'Critical', HIGH: 'High', MEDIUM: 'Medium', LOW: 'Low' };
const INCIDENT_STATUS_LABEL = { TRIGGERED: 'Triggered', ACKNOWLEDGED: 'Acknowledged', RESOLVED: 'Resolved', CLOSED: 'Closed' };
export const SERVICE_STATUS_LABEL = { OPERATIONAL: 'Operational', DEGRADED: 'Degraded', PARTIAL_OUTAGE: 'Partial outage', MAJOR_OUTAGE: 'Major outage' };
const HEALTH_ICON = { OPERATIONAL: 'check', DEGRADED: 'minus', PARTIAL_OUTAGE: 'alertMark', MAJOR_OUTAGE: 'close' };

// Severity as signal bars (1 to 4) plus the word: the order reads without colour.
export function severityBadge(severity) {
  const label = SEVERITY_LABEL[severity] ?? severity;
  return h(
    'span',
    { class: `severity severity-${String(severity).toLowerCase()}`, title: `${label} severity` },
    h('span', { class: 'severity-bars', 'aria-hidden': 'true' }, h('span'), h('span'), h('span'), h('span')),
    label
  );
}

export const incidentStatusBadge = (status) =>
  h('span', { class: `badge status status-${String(status).toLowerCase()}` }, INCIDENT_STATUS_LABEL[status] ?? status);

export function visibilityBadge(isPublic) {
  return h(
    'span',
    { class: isPublic ? 'badge visibility-public' : 'badge', title: isPublic ? 'Shown on the public status page' : 'Visible to your team only' },
    icon(isPublic ? 'globe' : 'lock', 'sm'),
    isPublic ? 'Public' : 'Private'
  );
}

export function healthLabel(status) {
  return h(
    'span',
    { class: `health health-${String(status).toLowerCase()}` },
    h('span', { class: 'health-mark', 'aria-hidden': 'true' }, icon(HEALTH_ICON[status] ?? 'minus')),
    SERVICE_STATUS_LABEL[status] ?? status
  );
}

export function person(user) {
  return user ? h('span', { class: 'person' }, avatar(user.name), h('span', { class: 'truncate' }, user.name)) : h('span', { class: 'unassigned' }, 'Unassigned');
}

// ---------- Toasts ----------

function toastContainer() {
  let container = document.querySelector('.toasts');
  if (!container) {
    container = h('div', { class: 'toasts', role: 'status', 'aria-live': 'polite' });
    document.body.append(container);
  }
  return container;
}

export function toast(message, type = 'success') {
  const element = h('div', { class: `toast toast-${type}` }, icon(type === 'error' ? 'alert' : 'checkCircle', 'sm'), h('span', {}, message));
  toastContainer().append(element);
  setTimeout(() => element.remove(), type === 'error' ? 6000 : 3500);
}

export const toastError = (error) => toast(error instanceof ApiError || error instanceof Error ? error.message : String(error), 'error');

// ---------- Buttons ----------

// Runs an async action while showing the button as busy, so a double click
// cannot send the request twice. Errors are shown as a toast.
// Live refreshes refetch data that usually has not changed (every page refetches once
// when its socket first connects, for one). Rebuilding the page anyway replaces the
// elements under the user's pointer and focus: a click whose press and release
// straddle the rebuild is lost, and a focused control drops its focus. Pages ask
// `changed(data)` before painting and skip the repaint when the answer is no. A
// failure is passed through it too (its status and message), so a refresh that fails
// the same way again leaves the error and its retry button alone.
export function changeDetector() {
  let last = null;
  return {
    changed(data) {
      const json = JSON.stringify(data);
      if (json === last) return false;
      last = json;
      return true;
    },
  };
}

export async function busy(button, action) {
  if (button.getAttribute('aria-busy') === 'true') return;
  button.setAttribute('aria-busy', 'true');
  try {
    return await action();
  } catch (error) {
    toastError(error);
  } finally {
    button.removeAttribute('aria-busy');
  }
}

export function button(label, { variant = '', size = '', onClick, type = 'button', iconName, ...rest } = {}) {
  const classes = ['btn', variant && `btn-${variant}`, size && `btn-${size}`].filter(Boolean).join(' ');
  const element = h('button', { class: classes, type, ...rest }, iconName && icon(iconName, 'sm'), label);
  if (onClick) element.addEventListener('click', () => onClick(element));
  return element;
}

// ---------- Form fields ----------

let fieldCounter = 0;
const nextId = () => `field-${++fieldCounter}`;

function fieldWrapper({ label, hint, control, id }) {
  return h('div', { class: 'field' }, label && h('label', { for: id }, label), control, hint && h('span', { class: 'hint' }, hint));
}

export function textField({ name, label, type = 'text', value = '', placeholder, required, maxlength, minlength, hint, autocomplete, readonly }) {
  const id = nextId();
  const control = h('input', { class: 'input', id, name, type, value, placeholder, required, maxlength, minlength, autocomplete, readonly });
  if (type !== 'password') return fieldWrapper({ label, hint, control, id });

  // Show/hide: people mistype passwords, and on a phone they cannot see what they typed.
  const toggle = h('button', { class: 'password-toggle', type: 'button', 'aria-controls': id, 'aria-pressed': 'false' }, 'Show');
  toggle.addEventListener('click', () => {
    const showing = control.type === 'text';
    control.type = showing ? 'password' : 'text';
    toggle.textContent = showing ? 'Show' : 'Hide';
    toggle.setAttribute('aria-pressed', String(!showing));
    toggle.setAttribute('aria-label', showing ? 'Show password' : 'Hide password');
  });
  toggle.setAttribute('aria-label', 'Show password');
  return fieldWrapper({ label, hint, control: h('div', { class: 'password-field' }, control, toggle), id });
}

export function textareaField({ name, label, value = '', placeholder, required, maxlength, hint, rows }) {
  const id = nextId();
  const control = h('textarea', { class: 'textarea', id, name, value, placeholder, required, maxlength, rows });
  return fieldWrapper({ label, hint, control, id });
}

// A select without a visible label (a filter) must still have an accessible
// name, so pass `ariaLabel` whenever `label` is null.
export function selectField({ name, label, ariaLabel, options, value, hint, small = false }) {
  const id = nextId();
  const control = h(
    'select',
    { class: small ? 'select select-sm' : 'select', id, name, value, 'aria-label': label ? null : ariaLabel },
    options.map((option) => h('option', { value: option.value }, option.label))
  );
  return fieldWrapper({ label, hint, control, id });
}

export function checkboxField({ name, label, checked = false }) {
  return h('label', { class: 'check' }, h('input', { type: 'checkbox', name, checked }), label);
}

// ---------- Dialogs ----------

// Opens a native <dialog>, which gives focus trapping, Escape-to-close and a
// blocked background for free. The element removes itself when closed.
export function openDialog({ title, content }) {
  const titleId = nextId();
  const dialog = h(
    'dialog',
    { class: 'dialog', 'aria-labelledby': titleId },
    h(
      'div',
      { class: 'dialog-header' },
      h('h2', { id: titleId }, title),
      h('button', { class: 'btn btn-ghost btn-icon btn-sm', type: 'button', 'aria-label': 'Close', onclick: () => dialog.close() }, icon('close'))
    ),
    h('div', { class: 'dialog-body' }, content)
  );

  // A click on the dimmed backdrop lands on the <dialog> element itself.
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) dialog.close();
  });
  dialog.addEventListener('close', () => dialog.remove());

  document.body.append(dialog);
  dialog.showModal();
  return dialog;
}

// A dialog containing a form. `fields` are nodes from the field helpers;
// `onSubmit(values, form)` receives the entered values and may throw an
// ApiError, whose message is shown inside the dialog.
export function formDialog({ title, fields, submitLabel = 'Save', onSubmit, danger = false }) {
  const errorBox = h('div', { class: 'form-error', role: 'alert', hidden: true });
  const submit = h('button', { class: danger ? 'btn btn-danger' : 'btn btn-primary', type: 'submit' }, submitLabel);
  let dialog;

  const form = h(
    'form',
    { class: 'form' },
    errorBox,
    fields,
    h('div', { class: 'form-actions' }, h('button', { class: 'btn btn-ghost', type: 'button', onclick: () => dialog.close() }, 'Cancel'), submit)
  );

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    errorBox.hidden = true;
    submit.setAttribute('aria-busy', 'true');
    try {
      await onSubmit(readForm(form), form);
      dialog.close();
    } catch (error) {
      errorBox.textContent = error.message;
      errorBox.hidden = false;
    } finally {
      submit.removeAttribute('aria-busy');
    }
  });

  dialog = openDialog({ title, content: form });
  form.querySelector('input:not([type=hidden]), textarea, select')?.focus();
  return dialog;
}

// Resolves true if the user confirms, false if they cancel or dismiss.
export function confirmDialog({ title, message, confirmLabel = 'Confirm', danger = false }) {
  return new Promise((resolve) => {
    let confirmed = false;
    const confirm = h('button', { class: danger ? 'btn btn-danger' : 'btn btn-primary', type: 'button' }, confirmLabel);
    const cancel = h('button', { class: 'btn btn-ghost', type: 'button' }, 'Cancel');

    const dialog = openDialog({
      title,
      content: h('div', { class: 'stack-sm' }, h('p', {}, message), h('div', { class: 'form-actions' }, cancel, confirm)),
    });

    confirm.addEventListener('click', () => {
      confirmed = true;
      dialog.close();
    });
    cancel.addEventListener('click', () => dialog.close());
    dialog.addEventListener('close', () => resolve(confirmed));
    cancel.focus();
  });
}

// Plain object of the form's values. A checkbox with a value attribute is one
// choice in a group and the group becomes an array of the checked values (empty
// when none, even for a group of one); a checkbox without one is a yes/no switch.
function readForm(form) {
  const values = {};
  for (const element of form.elements) {
    if (!element.name || element.disabled) continue;

    if (element.type === 'checkbox' && element.hasAttribute('value')) {
      values[element.name] ??= [];
      if (element.checked) values[element.name].push(element.value);
    } else if (element.type === 'checkbox') {
      values[element.name] = element.checked;
    } else {
      values[element.name] = element.value;
    }
  }
  return values;
}

// ---------- States ----------

export const loadingRows = (count = 4) =>
  h('div', { class: 'skeleton-rows', 'aria-busy': 'true', 'aria-label': 'Loading' }, Array.from({ length: count }, () => h('div', { class: 'skeleton skeleton-block' })));

// `level` is the heading level of the title: 3 inside a panel under a page's own
// h1/h2, but 1 or 2 when the state IS the page (not found, unusable link).
export function emptyState({ iconName = 'search', title, description, action, level = 3 }) {
  return h('div', { class: 'state' }, icon(iconName, 'lg'), h(`h${level}`, { class: 'state-title' }, title), description && h('p', {}, description), action);
}

export function errorState(error, onRetry) {
  return h(
    'div',
    { class: 'state', role: 'alert' },
    icon('alert', 'lg'),
    h('h3', { class: 'state-title' }, 'Something went wrong'),
    h('p', {}, error?.message ?? 'The request failed.'),
    onRetry && button('Try again', { variant: '', onClick: onRetry })
  );
}

// Lazy "Load more" control for cursor-paginated lists.
export function loadMoreButton(onClick) {
  const element = button('Load more', { variant: 'ghost', size: 'sm' });
  element.addEventListener('click', () => busy(element, onClick));
  return h('div', { class: 'load-more' }, element);
}
