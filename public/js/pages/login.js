import { api } from '../api.js';
import { getSession, safeNextPath, saveSession } from '../auth.js';
import { authForm, renderAuthPage } from '../authLayout.js';
import { h } from '../dom.js';
import { checkboxField, setTitle, textField } from '../ui.js';

setTitle('Sign in');

const params = new URLSearchParams(location.search);

if (getSession()) {
  location.replace(safeNextPath(params.get('next')));
} else {
  const { form, showError } = authForm({
    submitLabel: 'Sign in',
    fields: [
      textField({ name: 'email', label: 'Email address', type: 'email', required: true, autocomplete: 'username', placeholder: 'you@company.com' }),
      textField({ name: 'password', label: 'Password', type: 'password', required: true, autocomplete: 'current-password' }),
      checkboxField({ name: 'remember', label: 'Keep me signed in on this device', checked: true }),
    ],
    async onSubmit(values, formElement) {
      const { data } = await api.post('/auth/login', { email: values.email, password: values.password });
      saveSession(data, formElement.elements.remember.checked);
      location.replace(safeNextPath(params.get('next')));
    },
  });

  if (params.has('expired')) showError('Your session has ended. Please sign in again.');
  if (params.has('deleted')) showError('The organization was deleted. Its accounts no longer exist.');

  renderAuthPage({
    title: 'Sign in to BlackWater',
    lead: 'Incident response for your team.',
    content: form,
    footer: h('span', {}, 'New here? ', h('a', { href: '/register' }, 'Create an organization')),
  });
}
