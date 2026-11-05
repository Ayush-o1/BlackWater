import { api } from '../api.js';
import { getSession, saveSession } from '../auth.js';
import { authForm, renderAuthPage } from '../authLayout.js';
import { h } from '../dom.js';
import { setTitle, textField } from '../ui.js';

setTitle('Create account');

if (getSession()) {
  location.replace('/');
} else {
  const { form } = authForm({
    submitLabel: 'Create account',
    fields: [
      textField({ name: 'name', label: 'Your name', required: true, minlength: 2, maxlength: 100, autocomplete: 'name' }),
      textField({ name: 'email', label: 'Email address', type: 'email', required: true, autocomplete: 'username' }),
      textField({ name: 'password', label: 'Password', type: 'password', required: true, minlength: 8, maxlength: 72, autocomplete: 'new-password', hint: 'At least 8 characters.' }),
      textField({ name: 'orgName', label: 'Organization name', required: true, minlength: 2, maxlength: 200, hint: 'You will be its administrator. Invite your team from Settings.' }),
    ],
    async onSubmit(values) {
      const { data } = await api.post('/auth/register', values);
      saveSession(data, true);
      location.replace('/');
    },
  });

  renderAuthPage({
    title: 'Create your organization',
    lead: 'Set up BlackWater for your team in a minute.',
    content: form,
    footer: h('span', {}, 'Already have an account? ', h('a', { href: '/login' }, 'Sign in')),
  });
}
