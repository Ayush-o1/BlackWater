import { api } from '../api.js';
import { saveSession } from '../auth.js';
import { authForm, renderAuthPage } from '../authLayout.js';
import { h } from '../dom.js';
import { emptyState, setTitle, textField, titleCase } from '../ui.js';

setTitle('Join your team');

// The invitation token lives in the URL fragment (#...). Browsers never send the
// fragment to the server, so the token stays out of server logs and Referer
// headers. It is removed from the address bar (so it does not linger in the
// history or a screenshot) and kept for this tab only in sessionStorage, so a
// refresh does not turn a still-valid link into "no longer valid".
const STORAGE_KEY = 'blackwater.invite';

function readToken() {
  const fromLink = location.hash.slice(1);
  try {
    if (fromLink) sessionStorage.setItem(STORAGE_KEY, fromLink);
    return fromLink || sessionStorage.getItem(STORAGE_KEY) || '';
  } catch {
    return fromLink; // storage blocked: the link still works, just not across a refresh
  }
}

function forgetToken() {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    /* nothing to forget */
  }
}

const token = readToken();
history.replaceState(null, '', location.pathname);

function showUnusable(description) {
  renderAuthPage({
    title: 'Invitation unavailable',
    content: emptyState({
      iconName: 'xCircle',
      title: 'This link is no longer valid',
      description,
      level: 2, // the auth card already has an h1
      action: h('a', { class: 'btn', href: '/login' }, 'Go to sign in'),
    }),
  });
}

async function start() {
  // Nothing to look up (the page was opened without a link): do not ask the server.
  if (!token) {
    showUnusable('The invitation link is incomplete. Open the full link your administrator sent you.');
    return;
  }

  let invitation;
  try {
    ({ data: invitation } = await api.post('/invitations/preview', { token }));
  } catch (error) {
    if (error.status === 410 || error.status === 400) forgetToken();
    showUnusable(
      error.status === 410 || error.status === 400
        ? 'It may have expired or already been used. Ask your administrator for a new invitation link.'
        : error.message
    );
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
      forgetToken();
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
