import { test, expect } from '@playwright/test';

const unique = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const PASSWORD = 'CorrectHorse!9';

async function register(page, { name = 'Ananya Gupta' } = {}) {
  const id = unique();
  const email = `e2e-${id}@blackwater.test`;

  await page.goto('/register');
  await page.getByLabel('Your name').fill(name);
  await page.getByLabel('Email address').fill(email);
  await page.getByLabel('Password', { exact: true }).fill(PASSWORD);
  await page.getByLabel('Organization name').fill(`E2E Org ${id}`);
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();

  const session = await page.evaluate(() => JSON.parse(localStorage.getItem('blackwater.session')));
  return { email, name, orgId: session.user.orgId, token: session.token };
}

// Direct API calls with the signed-in user's token, for setting things up quickly.
const apiFor = (page, token) => ({
  post: (path, data) => page.request.post(`/api${path}`, { data, headers: { Authorization: `Bearer ${token}` } }),
  patch: (path, data) => page.request.patch(`/api${path}`, { data, headers: { Authorization: `Bearer ${token}` } }),
});

test.describe('signing in', () => {
  test('registers an organization, survives a refresh, signs out and back in', async ({ page }) => {
    const { email } = await register(page);

    await page.reload();
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();

    await page.getByRole('button', { name: 'Sign out' }).click();
    await expect(page).toHaveURL(/\/login/);

    await page.getByLabel('Email address').fill(email);
    await page.getByLabel('Password').fill(PASSWORD);
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
  });

  test('shows an error for a wrong password and keeps the user on the login page', async ({ page }) => {
    const { email } = await register(page);
    await page.getByRole('button', { name: 'Sign out' }).click();

    await page.getByLabel('Email address').fill(email);
    await page.getByLabel('Password').fill('not-the-password');
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

  test('does not follow a login redirect to another site', async ({ page }) => {
    await page.goto('/login?next=https://evil.example/');
    await page.getByRole('link', { name: 'Create an organization' }).click();
    await register(page);
    await page.goto('/login?next=//evil.example');
    // Already signed in: sent to a same-site page, never off-site.
    await expect(page).toHaveURL(/localhost:8001\/$/);
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
    await expect(page.getByRole('link', { name: /Payments API/ })).toContainText('Operational');

    // Declare a critical, private incident on it.
    await page.goto('/incidents');
    await expect(page.getByText('No incidents yet')).toBeVisible();
    await page.getByRole('button', { name: 'Declare incident' }).click();
    await page.getByLabel('Title').fill(title);
    await page.getByLabel('Severity').selectOption('CRITICAL');
    await page.getByLabel('Payments API').check();
    await page.getByRole('dialog').getByRole('button', { name: 'Declare incident' }).click();
    await expect(page.getByRole('heading', { name: title })).toBeVisible();
    await expect(page.getByText('Private')).toBeVisible();
    const incidentUrl = page.url();
    const incidentId = incidentUrl.split('/').pop();

    // The team sees the real health; the dashboard agrees.
    await expect(page.getByText('Major outage')).toBeVisible();
    await page.goto('/');
    await expect(page.locator('.stat', { hasText: 'System status' })).toContainText('Major outage');
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
    await page.getByLabel('Who can see this').selectOption('false');
    await page.getByRole('button', { name: 'Post', exact: true }).click();
    await expect(page.getByText('Internal note added')).toBeVisible();

    await page.getByLabel('Update message').fill('We are investigating failing payments.');
    await page.getByLabel('Who can see this').selectOption('true');
    await page.getByRole('button', { name: 'Post', exact: true }).click();
    await expect(page.getByText('Public update posted')).toBeVisible();

    // Edit: a lower severity changes the health.
    await page.getByRole('button', { name: 'Edit' }).click();
    await page.getByLabel('Severity').selectOption('HIGH');
    await page.getByRole('dialog').getByRole('button', { name: 'Save' }).click();
    await expect(page.getByText('Severity: Critical → High')).toBeVisible();
    await expect(page.getByText('Partial outage')).toBeVisible();

    // Publish (with confirmation): now visitors see it, but never the internal note.
    await page.getByRole('button', { name: 'Publish' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Publish' }).click();
    await expect(page.locator('#main').getByText('Published to the status page')).toBeVisible();

    await visitor.goto(`/status/${orgId}`);
    await expect(visitor.getByText('Partial outage').first()).toBeVisible();
    await visitor.getByRole('link', { name: new RegExp(title) }).first().click();
    await expect(visitor.getByRole('heading', { name: title })).toBeVisible();
    await expect(visitor.getByText('We are investigating failing payments.')).toBeVisible();
    await expect(visitor.getByText('Root cause')).toHaveCount(0);
    await expect(visitor.getByText('Ananya')).toHaveCount(0);

    // Unpublish: gone again.
    await page.getByRole('button', { name: 'Unpublish' }).click();
    await expect(page.locator('#main').getByText('Removed from the status page')).toBeVisible();
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
    await expect(page.getByRole('link', { name: /Payments API/ })).toContainText('Operational');
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
    await page.getByLabel('Title').fill(hostile);
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
    await viewer.getByLabel('Your name').fill('Vikram Shah');
    await viewer.getByLabel('Email address').fill(`viewer-${unique()}@blackwater.test`);
    await viewer.getByLabel('Choose a password').fill(PASSWORD);
    await viewer.getByRole('button', { name: 'Join' }).click();
    await expect(viewer.getByRole('heading', { name: 'Dashboard' })).toBeVisible();

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
    await page.getByLabel('Title').fill(title);
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
    await expect(member.getByRole('heading', { name: 'Dashboard' })).toBeVisible();

    await member.goto('/settings');
    await expect(member.getByRole('heading', { name: 'Team' })).toBeVisible();
    await expect(member.getByRole('button', { name: 'Invite someone' })).toHaveCount(0);
    await expect(member.getByLabel(/^Role of/)).toHaveCount(0);
    await expect(member.getByLabel('Organization name')).toHaveJSProperty('readOnly', true);
  });
});

test.describe('lists and layout', () => {
  test('pages through more than one page of services with Load more', async ({ page }) => {
    const { token } = await register(page);
    const api = apiFor(page, token);
    for (let i = 1; i <= 23; i += 1) {
      await api.post('/services', { name: `Service ${String(i).padStart(2, '0')}` });
    }

    await page.goto('/services');
    await expect(page.locator('a.row')).toHaveCount(20);
    await page.getByRole('button', { name: 'Load more' }).click();
    await expect(page.locator('a.row')).toHaveCount(23);
    await expect(page.getByRole('button', { name: 'Load more' })).toHaveCount(0);

    await page.goto('/');
    await expect(page.locator('.stat', { hasText: 'Services' })).toContainText('23'); // counted by the server, not by the first page
  });

  test('filters incidents and keeps the filter in the address bar', async ({ page }) => {
    const { token } = await register(page);
    const api = apiFor(page, token);
    await api.post('/incidents', { title: 'A low priority thing', severity: 'LOW' });
    await api.post('/incidents', { title: 'A critical outage here', severity: 'CRITICAL' });

    await page.goto('/incidents');
    await expect(page.locator('a.row')).toHaveCount(2);
    await page.locator('select[name=severity]').selectOption('CRITICAL');
    await expect(page.locator('a.row')).toHaveCount(1);
    await expect(page).toHaveURL(/severity=CRITICAL/);

    await page.reload();
    await expect(page.locator('select[name=severity]')).toHaveValue('CRITICAL');
    await expect(page.locator('a.row')).toHaveCount(1);
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
