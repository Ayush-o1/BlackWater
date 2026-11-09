import { h, render } from './dom.js';
import { icon } from './icons.js';
import { themeSwitcher } from './theme.js';

// What BlackWater does, stated plainly. These are real capabilities, not marketing
// numbers, and the panel is hidden on small screens where the form matters most.
const POINTS = [
  ['flag', 'One place for every incident', 'Declare, assign and work an incident from triggered to closed, with a full audit trail.'],
  ['globe', 'Tell customers what they need to know', 'Publish an incident and its public updates to your status page. Internal notes never leave your team.'],
  ['users', 'Everyone sees the same thing, live', 'Changes appear on your teammates’ screens as they happen.'],
];

const brand = (extraClass = '') => h('div', { class: `brand ${extraClass}` }, h('span', { class: 'brand-mark', 'aria-hidden': 'true' }, icon('activity')), 'BlackWater');

// The frame shared by the sign-in, registration and invitation pages.
export function renderAuthPage({ title, lead, content, footer }) {
  render(
    document.getElementById('app'),
    h(
      'div',
      { class: 'auth-page' },
      h(
        'aside',
        { class: 'auth-aside' },
        brand(),
        h('div', { class: 'auth-statement' }, h('h2', {}, 'Incident response your whole team can follow.'), h('p', {}, 'From the first alert to the last status update.')),
        h('ul', { class: 'auth-points' }, POINTS.map(([iconName, heading, text]) => h('li', {}, icon(iconName), h('span', {}, h('strong', {}, heading), text))))
      ),
      h(
        'main',
        { class: 'auth-main', id: 'main' },
        h(
          'div',
          { class: 'auth-card' },
          brand('auth-mobile-brand'),
          h('div', { class: 'stack-sm' }, h('h1', {}, title), lead && h('p', { class: 'lead' }, lead)),
          content,
          footer && h('p', { class: 'auth-switch' }, footer),
          h('div', { class: 'auth-theme' }, themeSwitcher())
        )
      )
    )
  );
}

// Builds the standard form-with-message-box used by the auth pages. `onSubmit`
// receives the entered values; a thrown error is shown above the form, and what
// the person typed is kept so they can correct it rather than start again.
export function authForm({ fields, submitLabel, onSubmit }) {
  const messageBox = h('div', { class: 'form-error', role: 'alert', hidden: true });
  const submit = h('button', { class: 'btn btn-primary btn-block', type: 'submit' }, submitLabel);
  const form = h('form', { class: 'form' }, messageBox, fields, submit);

  const show = (message, kind) => {
    messageBox.className = kind === 'notice' ? 'form-notice' : 'form-error';
    messageBox.textContent = message;
    messageBox.hidden = false;
  };

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    messageBox.hidden = true;
    submit.setAttribute('aria-busy', 'true');
    try {
      await onSubmit(Object.fromEntries(new FormData(form)), form);
    } catch (error) {
      show(error.message, 'error');
      submit.removeAttribute('aria-busy');
      form.querySelector('input:not([type=hidden])')?.focus();
    }
  });

  return { form, showError: (message) => show(message, 'error'), showNotice: (message) => show(message, 'notice') };
}
