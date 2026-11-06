import { getSession } from '../auth.js';
import { h, render } from '../dom.js';
import { emptyState, setTitle } from '../ui.js';

setTitle('Page not found');

render(
  document.getElementById('app'),
  h(
    'main',
    { class: 'auth-page' },
    emptyState({
      iconName: 'search',
      title: 'Page not found',
      level: 1,
      description: 'The page you are looking for does not exist or has moved.',
      action: h('a', { class: 'btn', href: getSession() ? '/' : '/login' }, getSession() ? 'Go to dashboard' : 'Go to sign in'),
    })
  )
);
