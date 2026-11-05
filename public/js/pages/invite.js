import { api } from '../api.js';
import { saveSession } from '../auth.js';
import { authForm, renderAuthPage } from '../authLayout.js';
import { h } from '../dom.js';
import { emptyState, setTitle, textField, titleCase } from '../ui.js';

setTitle('Join your team');

// The invitation token lives in the URL fragment (#...). Browsers never send the
// fragment to the server, so the token stays out of server logs and Referer
// headers. It is read once and removed from the address bar.
const token = location.hash.slice(1);
history.replaceState(null, '', location.pathname);

async function start() {
  let invitation;
  try {
    ({ data: invitation } = await api.post('/invitations/preview', { token }));
  } catch (error) {
    renderAuthPage({
      title: 'Invitation unavailable',
      content: emptyState({
        iconName: 'xCircle',
        title: 'This link is no longer valid',
        description:
          error.status === 410 || error.status === 400
            ? 'It may have expired or already been used. Ask your administrator for a new invitation link.'
            : error.message,
        action: h('a', { class: 'btn', href: '/login' }, 'Go to sign in'),
      }),
    });
    return;
  }

  const { form } = authForm({
    submitLabel: 'Join',
    fields: [
      textField({ name: 'name', label: 'Your name', required: true, minlength: 2, maxlength: 100, autocomplete: 'name' }),
      textField({ name: 'email', label: 'Email address', type: 'email', required: true, autocomplete: 'username' }),
      textField({ name: 'password', label: 'Choose a password', type: 'password', required: true, minlength: 8, maxlength: 72, autocomplete: 'new-password', hint: 'At least 8 characters.' }),
    ],
    async onSubmit(values) {
      const { data } = await api.post('/invitations/accept', { token, ...values });
      saveSession(data, true);
      location.replace('/');
    },
  });

  renderAuthPage({
    title: `Join ${invitation.organizationName}`,
    lead: `You have been invited as ${titleCase(invitation.role)}.`,
    content: form,
    footer: h('span', {}, 'Already have an account? ', h('a', { href: '/login' }, 'Sign in')),
  });
}

start();
