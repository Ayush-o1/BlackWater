import { test, expect } from '@playwright/test';
import { PASSWORD, apiFor, closeOtherSessions, register, unique } from './helpers.js';

test.afterEach(closeOtherSessions);

test.describe('signing in', () => {
  test('registers an organization, survives a refresh, signs out and back in', async ({ page }) => {
    const { email } = await register(page);

    await page.reload();
    await expect(page.getByRole('heading', { name: 'Overview', level: 1 })).toBeVisible();

    await page.locator('.user-button').click(); // sign out lives in the user menu
    await page.getByRole('button', { name: 'Sign out' }).click();
    await expect(page).toHaveURL(/\/login/);

    await page.getByLabel('Email address').fill(email);
    await page.getByLabel('Password', { exact: true }).fill(PASSWORD);
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page.getByRole('heading', { name: 'Overview', level: 1 })).toBeVisible();
  });

  test('shows an error for a wrong password and keeps the user on the login page', async ({ page }) => {
    const { email } = await register(page);
    await page.locator('.user-button').click(); // sign out lives in the user menu
    await page.getByRole('button', { name: 'Sign out' }).click();

    await page.getByLabel('Email address').fill(email);
    await page.getByLabel('Password', { exact: true }).fill('not-the-password');
    await page.getByRole('button', { name: 'Sign in' }).click();

    await expect(page.getByRole('alert')).toContainText('Invalid credentials');
    await expect(page).toHaveURL(/\/login/);
  });

  test('sends a signed-out visitor to the login page and back to where they were going', async ({ page }) => {
    await page.goto('/services');
    await expect(page).toHaveURL(/\/login\?next=%2Fservices/);

    await page.getByRole('link', { name: 'Create an organization' }).click();
    await expect(page).toHaveURL(/\/register/);
  });

  test('does not follow a login redirect to another site', async ({ page, baseURL }) => {
    await page.goto('/login?next=https://evil.example/');
    await page.getByRole('link', { name: 'Create an organization' }).click();
    await register(page);
    await page.goto('/login?next=//evil.example');
    // Already signed in: sent to a same-site page, never off-site.
    await expect(page).toHaveURL(`${baseURL}/`);
  });
});

test.describe('incident lifecycle', () => {
  test('runs an incident from declaration to closure, with visibility and health along the way', async ({ page, browser }) => {
    const { orgId } = await register(page);
    const title = `Checkout failing ${unique()}`;

    // A service to attach.
    await page.goto('/services');
    await expect(page.getByText('No services yet')).toBeVisible();
    await page.getByRole('button', { name: 'Add service' }).first().click();
    await page.getByLabel('Name').fill('Payments API');
    await page.getByLabel('Description').fill('Takes card payments');
    await page.getByRole('dialog').getByRole('button', { name: 'Add service' }).click();
    await expect(page.getByRole('row', { name: /Payments API/ })).toContainText('Operational');

    // Declare a critical, private incident on it.
    await page.goto('/incidents');
    await expect(page.getByText('No open incidents')).toBeVisible();
    await page.getByRole('button', { name: 'Declare incident' }).click();
    await page.getByLabel('Title', { exact: true }).fill(title);
    await page.getByLabel('Severity', { exact: true }).selectOption('CRITICAL');
    await page.getByLabel('Payments API').check();
    await page.getByRole('dialog').getByRole('button', { name: 'Declare incident' }).click();
    await expect(page.getByRole('heading', { name: title })).toBeVisible();
    await expect(page.getByText('Private', { exact: true })).toBeVisible();
    const incidentUrl = page.url();
    const incidentId = incidentUrl.split('/').pop();

    // The team sees the real health; the dashboard agrees.
    await expect(page.getByText('Major outage')).toBeVisible();
    await page.goto('/');
    await expect(page.locator('.banner')).toContainText('Major outage');
    await page.goto(incidentUrl);

    // Visitors see nothing: the incident is private.
    const visitor = await (await browser.newContext()).newPage();
    await visitor.goto(`/status/${orgId}`);
    await expect(visitor.getByText('All systems operational')).toBeVisible();
    await expect(visitor.getByText(title)).toHaveCount(0);
    await visitor.goto(`/status/${orgId}/incidents/${incidentId}`);
    await expect(visitor.getByText('Incident not found')).toBeVisible();

    // Work the incident.
    await page.getByRole('button', { name: 'Acknowledge' }).click();
    await expect(page.getByText('Acknowledged').first()).toBeVisible();
    await page.getByLabel('Assignee').selectOption({ label: 'Ananya Gupta (you)' });
    await expect(page.getByText('Assigned to Ananya Gupta')).toBeVisible();

    await page.getByLabel('Update message').fill('Root cause: expired certificate. Internal only.');
    await page.getByLabel('Internal note').check();
    await page.getByRole('button', { name: 'Post', exact: true }).click();
    await expect(page.getByRole('status').getByText('Internal note added')).toBeVisible();

    await page.getByLabel('Update message').fill('We are investigating failing payments.');
    await page.getByLabel('Public update').check();
    await page.getByRole('button', { name: 'Post', exact: true }).click();
    await expect(page.getByRole('status').getByText('Public update posted')).toBeVisible();

    // Edit: a lower severity changes the health.
    await page.getByRole('button', { name: 'Edit' }).click();
    await page.getByLabel('Severity', { exact: true }).selectOption('HIGH');
    await page.getByRole('dialog').getByRole('button', { name: 'Save' }).click();
    await expect(page.getByText('Severity: Critical → High')).toBeVisible();
    await expect(page.getByText('Partial outage')).toBeVisible();

    // Publish (with confirmation): now visitors see it, but never the internal note.
    await page.getByRole('button', { name: 'Publish' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Publish' }).click();
    await expect(page.getByLabel('Incident details').getByText('Published to the status page')).toBeVisible();

    await visitor.goto(`/status/${orgId}`);
    await expect(visitor.getByText('Partial outage').first()).toBeVisible();
    await visitor.getByRole('link', { name: new RegExp(title) }).first().click();
    await expect(visitor.getByRole('heading', { name: title })).toBeVisible();
    await expect(visitor.getByText('We are investigating failing payments.')).toBeVisible();
    await expect(visitor.getByText('Root cause')).toHaveCount(0);
    await expect(visitor.getByText('Ananya')).toHaveCount(0);

    // Unpublish: gone again.
    await page.getByRole('button', { name: 'Unpublish' }).click();
    await expect(page.getByLabel('Incident details').getByText('Private: your team only')).toBeVisible();
    await visitor.reload();
    await expect(visitor.getByText('Incident not found')).toBeVisible();

    // Resolve, reopen, resolve: health follows.
    await page.getByRole('button', { name: 'Resolve incident' }).click();
    await expect(page.getByText('Resolved').first()).toBeVisible();
    await page.getByRole('button', { name: 'Reopen' }).click();
    await expect(page.getByText('Triggered').first()).toBeVisible();
    await page.getByRole('button', { name: 'Resolve', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Close', exact: true })).toBeVisible();
    await page.goto('/services');
    await expect(page.getByRole('row', { name: /Payments API/ })).toContainText('Operational');
    await page.goto(incidentUrl);

    // Close (with confirmation): nothing can be changed any more.
    await page.getByRole('button', { name: 'Close', exact: true }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Close incident' }).click();
    await expect(page.getByText('This incident is closed and can no longer be updated.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Edit' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Reopen' })).toHaveCount(0);
  });

  test('shows user-supplied text as text, never as markup', async ({ page }) => {
    await register(page);
    const hostile = '<img src=x onerror="window.__pwned = true"> <b>bold?</b>';

    await page.goto('/incidents');
    await page.getByRole('button', { name: 'Declare incident' }).click();
    await page.getByLabel('Title', { exact: true }).fill(hostile);
    await page.getByLabel('Description').fill('<script>window.__pwned = true</script>');
    await page.getByRole('dialog').getByRole('button', { name: 'Declare incident' }).click();

    await expect(page.getByRole('heading', { level: 1 })).toHaveText(hostile);
    await expect(page.getByText('<script>window.__pwned = true</script>')).toBeVisible();
    expect(await page.evaluate(() => window.__pwned)).toBeUndefined();
    expect(await page.locator('h1 img, h1 b').count()).toBe(0);

    await page.goto('/incidents');
    await expect(page.getByText(hostile)).toBeVisible();
    expect(await page.evaluate(() => window.__pwned)).toBeUndefined();
  });
});

test.describe('team and invitations', () => {
  test('invites a viewer, who joins once, sees live updates, and gains write access when promoted', async ({ page, browser }) => {
    await register(page, { name: 'Ananya Gupta' });

    await page.goto('/settings');
    await page.getByRole('button', { name: 'Invite someone' }).click();
    await page.getByLabel('Role', { exact: true }).selectOption('VIEWER');
    await page.getByRole('button', { name: 'Create invitation link' }).click();
    const link = await page.getByLabel('Invitation link').inputValue();
    expect(link).toMatch(/\/invite#[\w-]{40,}$/);
    await page.getByRole('dialog').getByRole('button', { name: 'Done' }).click();
    await expect(page.getByText('Viewer invitation')).toBeVisible();

    // The invitee opens the link in their own browser.
    const viewerContext = await browser.newContext();
    const viewer = await viewerContext.newPage();
    await viewer.goto(link);
    await expect(viewer.getByRole('heading', { name: /^Join E2E Org/ })).toBeVisible();
    await expect(viewer.getByText('invited as Viewer')).toBeVisible();
    expect(viewer.url()).not.toContain('#'); // the token is removed from the address bar
    await viewer.reload(); // a refresh must not invalidate a link that has not been used
    await expect(viewer.getByRole('heading', { name: /^Join E2E Org/ })).toBeVisible();
    await viewer.getByLabel('Your name').fill('Vikram Shah');
    await viewer.getByLabel('Email address').fill(`viewer-${unique()}@blackwater.test`);
    await viewer.getByLabel('Choose a password').fill(PASSWORD);
    await viewer.getByRole('button', { name: 'Join' }).click();
    await expect(viewer.getByRole('heading', { name: 'Overview', level: 1 })).toBeVisible();

    // The link cannot be used again.
    const second = await (await browser.newContext()).newPage();
    await second.goto(link);
    await expect(second.getByText('This link is no longer valid')).toBeVisible();

    // The viewer can look but not change anything.
    await viewer.goto('/incidents');
    await expect(viewer.getByRole('heading', { name: 'Incidents', exact: true })).toBeVisible();
    await expect(viewer.getByRole('button', { name: 'Declare incident' })).toHaveCount(0);

    // Live: an incident declared by the admin appears on the viewer's open page without a reload.
    const title = `Live incident ${unique()}`;
    await page.goto('/incidents');
    await page.getByRole('button', { name: 'Declare incident' }).click();
    await page.getByLabel('Title', { exact: true }).fill(title);
    await page.getByRole('dialog').getByRole('button', { name: 'Declare incident' }).click();
    await expect(page.getByRole('heading', { name: title })).toBeVisible();
    await expect(viewer.getByText(title)).toBeVisible();

    // The admin promotes the viewer; the open page updates by itself.
    await page.goto('/settings');
    await page.getByLabel('Role of Vikram Shah').selectOption('MEMBER');
    await expect(page.getByText('Vikram Shah is now Member')).toBeVisible();
    await expect(viewer.getByRole('button', { name: 'Declare incident' })).toBeVisible();

    // The admin cannot demote themselves while they are the only admin.
    await page.getByLabel('Role of Ananya Gupta').selectOption('MEMBER');
    await expect(page.getByText(/at least one ADMIN/)).toBeVisible();
    await expect(page.getByLabel('Role of Ananya Gupta')).toHaveValue('ADMIN');
  });

  test('a revoked invitation stops working', async ({ page, browser }) => {
    await register(page);
    await page.goto('/settings');
    await page.getByRole('button', { name: 'Invite someone' }).click();
    await page.getByRole('button', { name: 'Create invitation link' }).click();
    const link = await page.getByLabel('Invitation link').inputValue();
    await page.getByRole('dialog').getByRole('button', { name: 'Done' }).click();

    await page.getByRole('button', { name: 'Revoke' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Revoke' }).click();
    await expect(page.getByText('No pending invitations.')).toBeVisible();

    const visitor = await (await browser.newContext()).newPage();
    await visitor.goto(link);
    await expect(visitor.getByText('This link is no longer valid')).toBeVisible();
  });

  test('members only see what they may use: settings shows no admin controls', async ({ page, browser }) => {
    await register(page);
    await page.goto('/settings');
    await page.getByRole('button', { name: 'Invite someone' }).click();
    await page.getByRole('button', { name: 'Create invitation link' }).click();
    const link = await page.getByLabel('Invitation link').inputValue();

    const member = await (await browser.newContext()).newPage();
    await member.goto(link);
    await member.getByLabel('Your name').fill('Meera Iyer');
    await member.getByLabel('Email address').fill(`member-${unique()}@blackwater.test`);
    await member.getByLabel('Choose a password').fill(PASSWORD);
    await member.getByRole('button', { name: 'Join' }).click();
    await expect(member.getByRole('heading', { name: 'Overview', level: 1 })).toBeVisible();

    await member.goto('/settings');
    await expect(member.getByRole('heading', { name: 'Team' })).toBeVisible();
    await expect(member.getByRole('button', { name: 'Invite someone' })).toHaveCount(0);
    await expect(member.getByLabel(/^Role of/)).toHaveCount(0);
    await expect(member.getByLabel('Organization name')).toHaveJSProperty('readOnly', true);
  });
});

test.describe('lists and layout', () => {
  test('uses every page without console errors, policy violations or failed requests', async ({ page, browser }) => {
    const problems = [];
    // Recent WebKit builds note on every page that it is not cross-origin isolated. That
    // only matters to pages using SharedArrayBuffer or precise timers; this app uses
    // neither, so the note is ignored rather than answered with a header it does not need.
    const informational = /^This document is not cross-origin isolated because the Cross-Origin-Embedder-Policy header is missing/;
    const watch = (target) => {
      target.on('console', (message) => {
        if (!['error', 'warning'].includes(message.type()) || informational.test(message.text())) return;
        problems.push(`console ${message.type()}: ${message.text()}`);
      });
      target.on('pageerror', (error) => problems.push(`uncaught: ${error.message}`));
      // A request cancelled because the test moved to the next page did not fail; the
      // page aborts its own unfinished requests when it is left (see api.js).
      target.on('requestfailed', (request) => {
        const reason = request.failure()?.errorText ?? '';
        if (!/abort|cancel/i.test(reason)) problems.push(`request failed (${reason}): ${request.url()}`);
      });
      target.on('response', (response) => {
        if (response.status() >= 400) problems.push(`HTTP ${response.status()}: ${response.url()}`);
      });
    };

    // Signed-out pages first, in a clean context.
    const signedOut = await (await browser.newContext()).newPage();
    watch(signedOut);
    for (const path of ['/login', '/register', '/invite']) {
      await signedOut.goto(path);
      await signedOut.waitForLoadState('networkidle');
    }

    watch(page);
    const { orgId, token } = await register(page);
    const api = apiFor(page, token);
    const service = (await (await api.post('/services', { name: 'Search' })).json()).data;
    const incident = (await (await api.post('/incidents', { title: 'Search is slow today', severity: 'HIGH', serviceIds: [service.id], isPublic: true })).json()).data;
    await api.post(`/incidents/${incident.id}/updates`, { message: 'Looking into it', isPublic: true });

    for (const path of ['/', '/incidents', `/incidents/${incident.id}`, '/services', `/services/${service.id}`, '/settings', `/status/${orgId}`, `/status/${orgId}/incidents/${incident.id}`]) {
      await page.goto(path);
      await page.waitForLoadState('networkidle');
    }
    // Dialogs are built on demand, so open each one.
    await page.goto('/incidents');
    await page.getByRole('button', { name: 'Declare incident' }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.keyboard.press('Escape');
    await page.goto('/services');
    await page.getByRole('button', { name: 'Add service' }).first().click();
    await expect(page.getByRole('dialog')).toBeVisible();

    expect(problems).toEqual([]);
  });

  test('can be operated with the keyboard alone: dialogs keep focus off the page behind them, Escape closes them and focus returns', async ({ page }) => {
    await register(page);
    await page.goto('/incidents');

    const trigger = page.getByRole('button', { name: 'Declare incident' }).first();
    await trigger.focus();
    await page.keyboard.press('Enter');

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    // Focus starts inside the dialog. Tabbing may leave the page for the browser's
    // own controls (activeElement is then <body>) but never reaches the page behind.
    expect(await page.evaluate(() => Boolean(document.activeElement?.closest('dialog')))).toBe(true);
    for (let i = 0; i < 12; i += 1) {
      await page.keyboard.press('Tab');
      expect(await page.evaluate(() => document.activeElement === document.body || Boolean(document.activeElement?.closest('dialog')))).toBe(true);
    }

    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    await expect(trigger).toBeFocused();

    // The sidebar is reachable and operable by keyboard: Tab to a link, Enter follows it.
    await page.getByRole('link', { name: 'Services' }).focus();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/\/services$/);
  });

  test('pages through more than one page of services with Load more', async ({ page }) => {
    const { token } = await register(page);
    const api = apiFor(page, token);
    for (let i = 1; i <= 23; i += 1) {
      await api.post('/services', { name: `Service ${String(i).padStart(2, '0')}` });
    }

    await page.goto('/services');
    await expect(page.locator('tbody tr')).toHaveCount(20);
    await page.getByRole('button', { name: 'Load more' }).click();
    await expect(page.locator('tbody tr')).toHaveCount(23);
    await expect(page.getByRole('button', { name: 'Load more' })).toHaveCount(0);

    await page.goto('/');
    await expect(page.locator('.banner')).toContainText('across 23 services'); // counted by the server, not by the first page
  });

  test('the public status page pages through its incident history with Load more', async ({ page, browser }) => {
    const { orgId, token } = await register(page);
    const api = apiFor(page, token);
    const titles = Array.from({ length: 12 }, (_, i) => `Published incident number ${String(i + 1).padStart(2, '0')}`);
    for (const title of titles) {
      const res = await api.post('/incidents', { title, severity: 'LOW', isPublic: true });
      expect(res.status()).toBe(201);
    }
    await api.post('/incidents', { title: 'A private incident that must stay hidden', severity: 'LOW' });

    const visitor = await (await browser.newContext()).newPage();
    await visitor.goto(`/status/${orgId}`);
    const history = visitor.locator('section.panel', { has: visitor.getByRole('heading', { name: 'Incident history' }) });
    await expect(history.locator('a.row')).toHaveCount(10);

    await history.getByRole('button', { name: 'Load more' }).click();
    await expect(history.locator('a.row')).toHaveCount(12);
    await expect(history.getByRole('button', { name: 'Load more' })).toHaveCount(0);

    // Every published incident appears exactly once, newest first, and the private one never does.
    const shown = await history.locator('.row-title').allTextContents();
    expect(shown).toEqual([...titles].reverse());
    await expect(visitor.getByText('A private incident that must stay hidden')).toHaveCount(0);
  });

  test('filters, searches and orders incidents, and keeps the view in the address bar', async ({ page }) => {
    const { token } = await register(page);
    const api = apiFor(page, token);
    await api.post('/incidents', { title: 'A low priority thing', severity: 'LOW' });
    await api.post('/incidents', { title: 'A critical outage here', severity: 'CRITICAL' });
    const done = (await (await api.post('/incidents', { title: 'An old resolved problem', severity: 'HIGH' })).json()).data;
    await api.patch(`/incidents/${done.id}/status`, { status: 'RESOLVED' });

    // The default view is what still needs work, most severe first.
    await page.goto('/incidents');
    const titles = page.locator('tbody .cell-title a');
    await expect(titles).toHaveText(['A critical outage here', 'A low priority thing']);

    await page.locator('select[name=severity]').selectOption('CRITICAL');
    await expect(titles).toHaveText(['A critical outage here']);
    await expect(page).toHaveURL(/severity=CRITICAL/);
    await page.reload();
    await expect(page.locator('select[name=severity]')).toHaveValue('CRITICAL');
    await expect(titles).toHaveText(['A critical outage here']);
    await page.locator('select[name=severity]').selectOption('');

    // Tabs and search.
    await page.getByRole('button', { name: 'Resolved', exact: true }).click();
    await expect(titles).toHaveText(['An old resolved problem']);
    await expect(page).toHaveURL(/view=resolved/);
    await page.getByRole('button', { name: 'All', exact: true }).click();
    await page.getByLabel('Search incidents by title').fill('outage');
    await expect(titles).toHaveText(['A critical outage here']);
    await expect(page).toHaveURL(/q=outage/);
    await page.getByLabel('Search incidents by title').fill('nothing like this');
    await expect(page.getByText('No incidents match')).toBeVisible();
  });

  test('works on a phone: navigation opens as a drawer', async ({ page }) => {
    await register(page);
    await page.setViewportSize({ width: 390, height: 780 });

    await expect(page.getByRole('link', { name: 'Incidents' })).toBeHidden();
    await page.getByRole('button', { name: 'Open navigation' }).click();
    await expect(page.getByRole('link', { name: 'Incidents' })).toBeVisible();
    await page.getByRole('link', { name: 'Incidents' }).click();
    await expect(page.getByRole('heading', { name: 'Incidents', exact: true })).toBeVisible();
  });

  test('shows friendly pages for things that do not exist', async ({ page }) => {
    const { orgId } = await register(page);

    await page.goto('/incidents/3f2b8c1e-6a4d-4f5b-9c7e-1a2b3c4d5e6f');
    await expect(page.getByText('Incident not found')).toBeVisible();
    await page.goto('/services/not-a-uuid');
    await expect(page.getByText('Service not found')).toBeVisible();
    await page.goto('/no/such/page');
    await expect(page.getByText('Page not found')).toBeVisible();
    await page.goto('/status/3f2b8c1e-6a4d-4f5b-9c7e-1a2b3c4d5e6f');
    await expect(page.getByText('Status page not found')).toBeVisible();
    await page.goto(`/status/${orgId}`);
    await expect(page.getByText('All systems operational')).toBeVisible();
  });
});

test.describe('service and profile management', () => {
  test('an admin edits and deletes a service; a viewer sees neither control', async ({ page, browser }) => {
    const { token } = await register(page);
    const api = apiFor(page, token);
    const created = await (await api.post('/services', { name: 'Billing', description: 'Invoices' })).json();

    await page.goto(`/services/${created.data.id}`);
    await page.getByRole('button', { name: 'Edit' }).click();
    await page.getByLabel('Name').fill('Billing API');
    await page.getByLabel('Description').fill('Invoices and receipts');
    await page.getByRole('dialog').getByRole('button', { name: 'Save changes' }).click();
    await expect(page.getByRole('heading', { name: 'Billing API' })).toBeVisible();
    await expect(page.getByText('Invoices and receipts')).toBeVisible();

    // A viewer joins and looks at the same service.
    await page.goto('/settings');
    await page.getByRole('button', { name: 'Invite someone' }).click();
    await page.getByLabel('Role', { exact: true }).selectOption('VIEWER');
    await page.getByRole('button', { name: 'Create invitation link' }).click();
    const link = await page.getByLabel('Invitation link').inputValue();
    const viewer = await (await browser.newContext()).newPage();
    await viewer.goto(link);
    await viewer.getByLabel('Your name').fill('Vera Viewer');
    await viewer.getByLabel('Email address').fill(`vera-${unique()}@blackwater.test`);
    await viewer.getByLabel('Choose a password').fill(PASSWORD);
    await viewer.getByRole('button', { name: 'Join' }).click();
    await expect(viewer.getByRole('heading', { name: 'Overview', level: 1 })).toBeVisible();
    await viewer.goto(`/services/${created.data.id}`);
    await expect(viewer.getByRole('heading', { name: 'Billing API' })).toBeVisible();
    await expect(viewer.getByRole('button', { name: 'Edit' })).toHaveCount(0);
    await expect(viewer.getByRole('button', { name: 'Delete' })).toHaveCount(0);
    await viewer.goto('/services');
    await expect(viewer.getByRole('button', { name: 'Add service' })).toHaveCount(0);

    // The admin deletes it.
    await page.goto(`/services/${created.data.id}`);
    await page.getByRole('button', { name: 'Delete' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Delete service' }).click();
    await expect(page).toHaveURL(/\/services$/);
    await expect(page.getByText('No services yet')).toBeVisible();
  });

  test('profile and organization changes are saved', async ({ page }) => {
    await register(page, { name: 'Ananya Gupta' });
    await page.goto('/settings');

    await page.getByLabel('Your name').fill('Ananya G. Rao');
    await page.locator('form', { has: page.getByLabel('Your name') }).getByRole('button', { name: 'Save' }).click();
    await expect(page.getByText('Profile saved')).toBeVisible();
    await expect(page.locator('.user-name')).toHaveText('Ananya G. Rao');

    await page.getByLabel('Organization name').fill('Renamed Org');
    await page.locator('form', { has: page.getByLabel('Organization name') }).getByRole('button', { name: 'Save' }).click();
    await expect(page.getByText('Organization saved')).toBeVisible();
    await expect(page.locator('.org-context-name')).toHaveText('Renamed Org');

    await page.reload();
    await expect(page.getByLabel('Your name')).toHaveValue('Ananya G. Rao');
    await expect(page.getByLabel('Organization name')).toHaveValue('Renamed Org');
  });
});

test.describe('deleting an organization', () => {
  test('needs the exact name and the password; afterwards the accounts no longer exist', async ({ page, browser }) => {
    const { email, orgId } = await register(page, { name: 'Ananya Gupta' });
    const orgName = await page.evaluate(async () => (await (await fetch('/api/organizations/me', { headers: { Authorization: `Bearer ${JSON.parse(localStorage.getItem('blackwater.session')).token}` } })).json()).data.name);

    await page.goto('/settings');
    await page.getByRole('button', { name: 'Delete organization' }).click();
    const dialog = page.getByRole('dialog');

    // A wrong password is refused, the dialog stays open and what was typed is kept.
    await dialog.getByLabel(/Type the organization name/).fill(orgName);
    await dialog.getByLabel('Your password').fill('not-my-password');
    await dialog.getByRole('button', { name: 'Delete organization permanently' }).click();
    await expect(dialog.getByRole('alert')).toContainText('Incorrect password');
    await expect(dialog.getByLabel(/Type the organization name/)).toHaveValue(orgName);

    // The right password and name delete it and sign the administrator out.
    await dialog.getByLabel('Your password').fill(PASSWORD);
    await dialog.getByRole('button', { name: 'Delete organization permanently' }).click();
    await expect(page).toHaveURL(/\/login\?deleted=1/);
    await expect(page.getByText('The organization was deleted')).toBeVisible();

    // Nothing is left to sign in to, and the public page is gone.
    await page.getByLabel('Email address').fill(email);
    await page.getByLabel('Password', { exact: true }).fill(PASSWORD);
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page.getByText('Invalid credentials')).toBeVisible();
    const visitor = await (await browser.newContext()).newPage();
    await visitor.goto(`/status/${orgId}`);
    await expect(visitor.getByText('Status page not found')).toBeVisible();
  });

  test('a teammate who has the app open is cut off: the page says Offline, and the next load signs them out', async ({ page, browser }) => {
    const admin = await register(page);
    const orgName = (await (await page.request.get('/api/organizations/me', { headers: { Authorization: `Bearer ${admin.token}` } })).json()).data.name;
    const invitation = await (await apiFor(page, admin.token).post('/invitations', { role: 'MEMBER' })).json();
    const joined = await (await page.request.post('/api/invitations/accept', { data: { token: invitation.data.token, name: 'Meera Iyer', email: `member-${unique()}@blackwater.test`, password: PASSWORD } })).json();
    // The session is stored once (not by an init script, which would put it back after sign-out).
    const member = await (await browser.newContext()).newPage();
    await member.goto('/login');
    await member.evaluate((session) => localStorage.setItem('blackwater.session', session), JSON.stringify(joined.data));
    await member.goto('/incidents');
    await expect(member.locator('.live-indicator')).toHaveText('Live');

    await page.request.delete('/api/organizations/me', { data: { password: PASSWORD, confirmName: orgName }, headers: { Authorization: `Bearer ${admin.token}` } });

    // The server closed the connection on purpose; it will not come back, so not "Reconnecting".
    await expect(member.locator('.live-indicator')).toHaveText('Offline');
    await member.reload();
    await expect(member).toHaveURL(/\/login\?expired=1/);
  });

  test('a member or viewer is not offered the option', async ({ page, browser }) => {
    const admin = await register(page);
    const invitation = await (await page.request.post('/api/invitations', { data: { role: 'MEMBER' }, headers: { Authorization: `Bearer ${admin.token}` } })).json();
    const joined = await (await page.request.post('/api/invitations/accept', { data: { token: invitation.data.token, name: 'Meera Iyer', email: `member-${unique()}@blackwater.test`, password: PASSWORD } })).json();
    const context = await browser.newContext();
    await context.addInitScript(([k, v]) => { if (!localStorage.getItem(k)) localStorage.setItem(k, v); }, ['blackwater.session', JSON.stringify(joined.data)]);
    const member = await context.newPage();
    await member.goto('/settings');
    await expect(member.getByRole('heading', { name: 'Organization', exact: true })).toBeVisible();
    await expect(member.getByRole('button', { name: 'Delete organization' })).toHaveCount(0);
  });
});

test.describe('failure handling', () => {
  test('an expired or invalid session sends the user to the login page with an explanation', async ({ page }) => {
    await register(page);
    await page.evaluate(() => {
      const session = JSON.parse(localStorage.getItem('blackwater.session'));
      localStorage.setItem('blackwater.session', JSON.stringify({ ...session, token: 'not-a-valid-token' }));
    });

    await page.goto('/incidents');

    await expect(page).toHaveURL(/\/login\?expired=1/);
    await expect(page.getByRole('alert')).toContainText('session has ended');
    expect(await page.evaluate(() => localStorage.getItem('blackwater.session'))).toBeNull();
  });

  test('shows an error with a retry when the server cannot be reached, and recovers', async ({ page }) => {
    await register(page);
    let failing = true;
    await page.route('**/api/incidents?*', (route) => (failing ? route.abort('failed') : route.continue()));
    // No live connection: its refresh on connecting could recover the page by itself
    // before the click, and this test is about the Try again button.
    await page.routeWebSocket(/socket\.io/, () => {});

    await page.goto('/incidents');
    await expect(page.getByText('Something went wrong')).toBeVisible();
    await expect(page.getByText('Cannot reach the server')).toBeVisible();

    failing = false;
    await page.getByRole('button', { name: 'Try again' }).click();
    await expect(page.getByText('No open incidents')).toBeVisible();
  });

  test('a refresh that fails the same way leaves the error and its retry button alone', async ({ page }) => {
    await register(page);
    await page.route('**/api/incidents?*', (route) => route.abort('failed'));
    await page.goto('/incidents');
    const retry = page.getByRole('button', { name: 'Try again' });
    await expect(retry).toBeVisible();
    await retry.evaluate((button) => { button.dataset.original = 'yes'; });

    // Connecting refreshes the page; the request fails again in the same way.
    const refetched = page.waitForRequest((request) => request.url().includes('/api/incidents?'));
    await expect(page.locator('.live-indicator')).toHaveText('Live');
    await refetched;
    await page.waitForTimeout(300);
    await expect(retry).toHaveAttribute('data-original', 'yes'); // the same button, not a re-rendered one
  });

  test('shows the server\'s explanation when an action is refused', async ({ page }) => {
    const { token } = await register(page);
    const api = apiFor(page, token);
    const incident = (await (await api.post('/incidents', { title: 'Will be closed soon', severity: 'LOW' })).json()).data;
    // This page never gets its live connection, so it really is stale: otherwise the
    // live update would (correctly) remove the button before the click.
    await page.routeWebSocket(/socket\.io/, () => {});
    await page.goto(`/incidents/${incident.id}`);
    await expect(page.getByRole('button', { name: 'Acknowledge' })).toBeVisible();

    // Someone else resolves and closes it while this page is open and stale.
    await api.patch(`/incidents/${incident.id}/status`, { status: 'RESOLVED' });
    await api.patch(`/incidents/${incident.id}/status`, { status: 'CLOSED' });
    await page.getByRole('button', { name: 'Acknowledge' }).click();

    await expect(page.getByText(/closed and cannot be modified/)).toBeVisible();
  });
});

test.describe('responsive layout', () => {
  test('no page scrolls sideways at any common width, even with very long unbroken text', async ({ page }) => {
    test.setTimeout(150_000); // 8 widths x 8 pages, each loaded until the network is idle
    const { orgId, token } = await register(page);
    const api = apiFor(page, token);
    const long = 'A'.repeat(180);
    const service = (await (await api.post('/services', { name: `S${long}`, description: long })).json()).data;
    const incident = (await (await api.post('/incidents', { title: `T${long}`, description: long, severity: 'HIGH', serviceIds: [service.id], isPublic: true })).json()).data;
    await api.post(`/incidents/${incident.id}/updates`, { message: long, isPublic: true });

    // Phones (360-430), tablet portrait and landscape, laptop and desktop sizes.
    const widths = [360, 390, 430, 768, 1024, 1280, 1440, 1920];
    const paths = ['/', '/incidents', `/incidents/${incident.id}`, '/services', `/services/${service.id}`, '/settings', `/status/${orgId}`, `/status/${orgId}/incidents/${incident.id}`];
    for (const width of widths) {
      await page.setViewportSize({ width, height: 800 });
      for (const path of paths) {
        await page.goto(path);
        await page.waitForLoadState('networkidle');
        const { scrollWidth, innerWidth } = await page.evaluate(() => ({ scrollWidth: document.documentElement.scrollWidth, innerWidth: window.innerWidth }));
        expect(scrollWidth, `${path} is wider than the screen at ${width} px`).toBeLessThanOrEqual(innerWidth);
      }
    }
  });
});

test.describe('live updates across sessions', () => {
  // A session is a separate browser context (its own storage and socket), signed in
  // by planting the token the app would have stored, so the test spends its time
  // on what it is about rather than on signing in four times.
  async function openSession(browser, { token, user }, path) {
    const context = await browser.newContext();
    await context.addInitScript(([key, value]) => localStorage.setItem(key, value), ['blackwater.session', JSON.stringify({ token, user })]);
    const page = await context.newPage();
    await page.goto(path);
    return page;
  }

  const post = async (request, token, path, data) => {
    const response = await request.post(`/api${path}`, { data, headers: { Authorization: `Bearer ${token}` } });
    return (await response.json()).data;
  };
  const patch = (request, token, path, data) => request.patch(`/api${path}`, { data, headers: { Authorization: `Bearer ${token}` } });

  test('open pages in other sessions update by themselves, and never for another organization', async ({ page, browser }) => {
    // The admin's own organization, plus a member and a viewer invited into it.
    const admin = await register(page, { name: 'Ananya Gupta' });
    const request = page.request;
    const join = async (role, name) => {
      const invitation = await post(request, admin.token, '/invitations', { role });
      return post(request, '', '/invitations/accept', { token: invitation.token, name, email: `${role.toLowerCase()}-${unique()}@blackwater.test`, password: PASSWORD });
    };
    const member = await join('MEMBER', 'Meera Iyer');
    const viewer = await join('VIEWER', 'Vikram Shah');

    // A second, unrelated organization.
    const outsiderContext = await browser.newContext();
    const outsiderSession = await post(outsiderContext.request, '', '/auth/register', { name: 'Olivia Park', email: `outsider-${unique()}@blackwater.test`, password: PASSWORD, orgName: `Other Org ${unique()}` });

    const service = await post(request, admin.token, '/services', { name: 'Checkout' });
    const title = `Cart is empty after login ${unique()}`;
    const incident = await post(request, admin.token, '/incidents', { title, severity: 'CRITICAL', serviceIds: [service.id] });

    // Everyone opens a page and leaves it alone from here on: no reloads, no navigation.
    const memberOnIncident = await openSession(browser, member, `/incidents/${incident.id}`);
    const viewerOnService = await openSession(browser, viewer, `/services/${service.id}`);
    const viewerOnDashboard = await openSession(browser, viewer, '/');
    const outsiderOnIncidents = await openSession(browser, outsiderSession, '/incidents');

    await expect(memberOnIncident.locator('.header-badges')).toContainText('Triggered');
    await expect(viewerOnService.getByRole('heading', { name: 'Checkout' })).toBeVisible();
    await expect(viewerOnService.getByText('Major outage').first()).toBeVisible();
    await expect(viewerOnDashboard.locator('.banner')).toContainText('Major outage');
    await expect(memberOnIncident.locator('.live-indicator')).toContainText('Live');
    await expect(outsiderOnIncidents.locator('.live-indicator')).toContainText('Live');

    // The admin acknowledges and assigns: the member sees both on the open incident.
    await patch(request, admin.token, `/incidents/${incident.id}/status`, { status: 'ACKNOWLEDGED' });
    await expect(memberOnIncident.locator('.header-badges')).toContainText('Acknowledged');
    await patch(request, admin.token, `/incidents/${incident.id}/assign`, { assigneeId: member.user.id });
    await expect(memberOnIncident.getByLabel('Assignee')).toHaveValue(member.user.id);
    await expect(memberOnIncident.getByText('Assigned to Meera Iyer')).toBeVisible();

    // Lowering the severity changes the health a viewer sees on the service and the dashboard.
    await patch(request, admin.token, `/incidents/${incident.id}`, { severity: 'HIGH' });
    await expect(viewerOnService.getByText('Partial outage').first()).toBeVisible();
    await expect(viewerOnDashboard.locator('.banner')).toContainText('Partial outage');

    // Resolving clears the service and the dashboard.
    await patch(request, admin.token, `/incidents/${incident.id}/status`, { status: 'RESOLVED' });
    await expect(viewerOnService.getByText('Operational').first()).toBeVisible();
    await expect(viewerOnDashboard.locator('.banner')).toContainText('All systems operational');

    // A new incident from the member shows up in the viewer's open dashboard counter.
    await post(request, member.token, '/incidents', { title: `Second incident ${unique()}`, severity: 'LOW', serviceIds: [service.id] });
    await expect(viewerOnDashboard.locator('.banner')).toContainText('1 open incident');

    // The outsider's socket is live (their own change arrives)...
    const ownTitle = `Their own incident ${unique()}`;
    await post(outsiderContext.request, outsiderSession.token, '/incidents', { title: ownTitle, severity: 'LOW' });
    await expect(outsiderOnIncidents.getByText(ownTitle)).toBeVisible();
    // ...and by now has heard everything the admin did, yet shows nothing of it.
    await expect(outsiderOnIncidents.getByText(title)).toHaveCount(0);
    await expect(outsiderOnIncidents.getByText('Second incident')).toHaveCount(0);
  });

  test('a session that loses its connection misses a change, then catches up by itself', async ({ page, browser }) => {
    const admin = await register(page, { name: 'Ananya Gupta' });
    const request = page.request;
    const incident = await post(request, admin.token, '/incidents', { title: `Offline test ${unique()}`, severity: 'LOW' });
    const invitation = await post(request, admin.token, '/invitations', { role: 'VIEWER' });
    const viewer = await post(request, '', '/invitations/accept', { token: invitation.token, name: 'Vikram Shah', email: `viewer-${unique()}@blackwater.test`, password: PASSWORD });

    const context = await browser.newContext();
    await context.addInitScript(([key, value]) => { if (!localStorage.getItem(key)) localStorage.setItem(key, value); }, ['blackwater.session', JSON.stringify(viewer)]);
    const watcher = await context.newPage();

    // Every WebSocket the page opens passes through here, so the test can cut the
    // connection and refuse new ones (emulated "offline" does not touch an open socket).
    let connectionUp = true;
    let openSocket = null;
    await watcher.routeWebSocket(/socket\.io/, (socket) => {
      if (!connectionUp) {
        socket.close();
        return;
      }
      openSocket = socket;
      socket.connectToServer();
    });

    await watcher.goto(`/incidents/${incident.id}`);
    await expect(watcher.locator('.live-indicator')).toContainText('Live');
    await expect(watcher.locator('.header-badges')).toContainText('Triggered');

    // The connection drops; the admin keeps working.
    connectionUp = false;
    await openSocket.close();
    await expect(watcher.locator('.live-indicator')).not.toContainText('Live');
    await patch(request, admin.token, `/incidents/${incident.id}/status`, { status: 'ACKNOWLEDGED' });
    await expect(watcher.locator('.header-badges')).toContainText('Triggered'); // it cannot know yet

    // The connection returns: the socket reconnects and every open page refetches once.
    connectionUp = true;
    await expect(watcher.locator('.live-indicator')).toContainText('Live', { timeout: 30_000 });
    await expect(watcher.locator('.header-badges')).toContainText('Acknowledged');
  });

  test('a change made before the page\'s first live connection is not missed', async ({ page, browser }) => {
    // The page loads its data, and only then does its WebSocket connect. A change that
    // lands in that gap is announced to nobody who is listening yet, so the first
    // connection has to refresh the page too, not only reconnections.
    const admin = await register(page, { name: 'Ananya Gupta' });
    const request = page.request;
    const incident = await post(request, admin.token, '/incidents', { title: `Gap test ${unique()}`, severity: 'LOW' });
    const invitation = await post(request, admin.token, '/invitations', { role: 'VIEWER' });
    const viewer = await post(request, '', '/invitations/accept', { token: invitation.token, name: 'Vikram Shah', email: `viewer-${unique()}@blackwater.test`, password: PASSWORD });

    const context = await browser.newContext();
    await context.addInitScript(([key, value]) => { if (!localStorage.getItem(key)) localStorage.setItem(key, value); }, ['blackwater.session', JSON.stringify(viewer)]);
    const watcher = await context.newPage();

    // Hold the socket back so the page has loaded but is not connected yet.
    let release;
    const held = new Promise((resolve) => { release = resolve; });
    await watcher.routeWebSocket(/socket\.io/, async (socket) => {
      await held;
      socket.connectToServer();
    });

    await watcher.goto(`/incidents/${incident.id}`);
    await expect(watcher.locator('.header-badges')).toContainText('Triggered');
    await expect(watcher.locator('.live-indicator')).not.toContainText('Live');

    // The change happens while nobody is listening.
    await patch(request, admin.token, `/incidents/${incident.id}/status`, { status: 'ACKNOWLEDGED' });
    await expect(watcher.locator('.header-badges')).toContainText('Triggered');

    release();
    await expect(watcher.locator('.live-indicator')).toContainText('Live');
    await expect(watcher.locator('.header-badges')).toContainText('Acknowledged');
  });

  test('a refused handshake (a server hiccup) is retried until the page is live', async ({ page, browser }) => {
    // When the server's handshake middleware refuses a connection, Socket.IO does not
    // reconnect by itself. A page that gave up there would show stale data for good.
    const admin = await register(page, { name: 'Ananya Gupta' });
    const request = page.request;
    const incident = await post(request, admin.token, '/incidents', { title: `Handshake test ${unique()}`, severity: 'LOW' });
    const invitation = await post(request, admin.token, '/invitations', { role: 'VIEWER' });
    const viewer = await post(request, '', '/invitations/accept', { token: invitation.token, name: 'Vikram Shah', email: `viewer-${unique()}@blackwater.test`, password: PASSWORD });

    const context = await browser.newContext();
    await context.addInitScript(([key, value]) => { if (!localStorage.getItem(key)) localStorage.setItem(key, value); }, ['blackwater.session', JSON.stringify(viewer)]);
    const watcher = await context.newPage();

    // The first two connection attempts are answered the way the server does when its
    // database lookup fails: an engine "open" packet, then a Socket.IO CONNECT_ERROR
    // (type 44). Later attempts go through to the real server.
    let refused = 0;
    await watcher.routeWebSocket(/socket\.io/, (socket) => {
      if (refused >= 2) {
        socket.connectToServer();
        return;
      }
      refused += 1;
      socket.send('0{"sid":"refused","upgrades":[],"pingInterval":25000,"pingTimeout":20000,"maxPayload":1000000}');
      socket.onMessage((message) => {
        if (String(message).startsWith('40')) socket.send('44{"message":"Temporarily unavailable, retrying"}');
      });
    });

    await watcher.goto(`/incidents/${incident.id}`);
    await expect(watcher.locator('.live-indicator')).toContainText('Live', { timeout: 30_000 });
    expect(refused).toBe(2);

    await patch(request, admin.token, `/incidents/${incident.id}/status`, { status: 'ACKNOWLEDGED' });
    await expect(watcher.locator('.header-badges')).toContainText('Acknowledged');
  });

  test('a teammate\'s change elsewhere does not take the keyboard focus away from someone writing an update', async ({ page }) => {
    const admin = await register(page);
    const mine = await post(page.request, admin.token, '/incidents', { title: 'Incident being written about', severity: 'HIGH' });
    const elsewhere = await post(page.request, admin.token, '/incidents', { title: 'Some other incident', severity: 'LOW' });
    await page.goto(`/incidents/${mine.id}`);
    await expect(page.locator('.live-indicator')).toHaveText('Live');

    // Each step makes an unrelated change and waits for this page to refetch because of it.
    const changeElsewhere = async (message) => {
      const refetched = page.waitForResponse((response) => response.url().endsWith(`/api/incidents/${mine.id}`));
      await post(page.request, admin.token, `/incidents/${elsewhere.id}/updates`, { message });
      await refetched;
    };

    const message = page.getByLabel('Update message');
    await message.click();
    await page.keyboard.type('Half written');
    await changeElsewhere('first unrelated change');
    await expect(message).toBeFocused();
    await page.keyboard.type(' and finished');
    await expect(message).toHaveValue('Half written and finished');

    // The details panel is rebuilt on every refresh; the assignee picker keeps the focus.
    const assignee = page.getByLabel('Assignee');
    await assignee.focus();
    await changeElsewhere('second unrelated change');
    await expect(page.getByLabel('Assignee')).toBeFocused();
  });
});
