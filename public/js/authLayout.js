import { h, render } from './dom.js';
import { icon } from './icons.js';

// The centred card shared by the login, registration and invitation pages.
export function renderAuthPage({ title, lead, content, footer }) {
  render(
    document.getElementById('app'),
    h(
      'main',
      { class: 'auth-page' },
      h(
        'div',
        { class: 'auth-card' },
        h('div', { class: 'auth-brand' }, icon('activity'), 'BlackWater'),
        h('h1', {}, title),
        lead && h('p', { class: 'lead' }, lead),
        h('div', { class: 'panel' }, h('div', { class: 'panel-body' }, content)),
        footer && h('p', { class: 'auth-switch' }, footer)
      )
    )
  );
}

// Builds the standard form-with-error-box used by the auth pages. `onSubmit`
// receives the entered values; a thrown error is shown above the form.
export function authForm({ fields, submitLabel, onSubmit }) {
  const errorBox = h('div', { class: 'form-error', role: 'alert', hidden: true });
  const submit = h('button', { class: 'btn btn-primary btn-block', type: 'submit' }, submitLabel);
  const form = h('form', { class: 'form' }, errorBox, fields, submit);

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    errorBox.hidden = true;
    submit.setAttribute('aria-busy', 'true');
    try {
      await onSubmit(Object.fromEntries(new FormData(form)), form);
    } catch (error) {
      errorBox.textContent = error.message;
      errorBox.hidden = false;
      submit.removeAttribute('aria-busy');
    }
  });

  return { form, showError(message) { errorBox.textContent = message; errorBox.hidden = false; } };
}
