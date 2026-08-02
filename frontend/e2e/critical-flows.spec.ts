import { test, expect, type Page } from '@playwright/test';

const unique = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

async function register(page: Page, overrides: { name?: string; email?: string; orgName?: string } = {}) {
  const id = unique();
  const name = overrides.name ?? 'Ananya Gupta';
  const email = overrides.email ?? `e2e-${id}@blackwater.test`;
  const orgName = overrides.orgName ?? `E2E Org ${id}`;

  await page.goto('/register');
  await page.getByLabel('Full Name').fill(name);
  await page.getByLabel('Email address').fill(email);
  await page.getByLabel('Password').fill('CorrectHorse!9');
  await page.getByLabel('Organization Name').fill(orgName);
  await page.getByRole('button', { name: 'Create Account' }).click();

  await expect(page).toHaveURL('/');
  return { name, email, orgName };
}

test.describe('authentication', () => {
  test('registers an organization, and the session survives a page refresh', async ({ page }) => {
    await register(page);
    await expect(page.getByRole('heading', { name: /dashboard/i })).toBeVisible();

    await page.reload();
    await expect(page).toHaveURL('/');
    await expect(page.getByRole('heading', { name: /dashboard/i })).toBeVisible();
  });

  test('logs back in with the registered credentials after logging out', async ({ page }) => {
    const { email } = await register(page);

    // Clearing storage is the simplest reliable way to end the session in this
    // app (there's no visible "Log out" affordance covered by the other E2E
    // flows), then prove the same credentials work from a clean slate.
    await page.context().clearCookies();
    await page.evaluate(() => localStorage.clear());
    await page.goto('/login');

    await page.getByLabel('Email address').fill(email);
    await page.getByLabel('Password').fill('CorrectHorse!9');
    await page.getByRole('button', { name: 'Sign in' }).click();

    await expect(page).toHaveURL('/');
    await expect(page.getByRole('heading', { name: /dashboard/i })).toBeVisible();
  });

  test('rejects an incorrect password with a visible error', async ({ page }) => {
    const { email } = await register(page);
    await page.context().clearCookies();
    await page.evaluate(() => localStorage.clear());
    await page.goto('/login');

    await page.getByLabel('Email address').fill(email);
    await page.getByLabel('Password').fill('WrongPassword!1');
    await page.getByRole('button', { name: 'Sign in' }).click();

    await expect(page.getByRole('alert')).toHaveText(/invalid credentials/i);
    await expect(page).toHaveURL('/login');
  });
});

test.describe('incident lifecycle', () => {
  test.describe.configure({ mode: 'serial' });

  let page: Page;
  let orgId: string;
  let incidentId: string;
  let incidentTitle: string;

  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage();
    await register(page);
  });

  test.afterAll(async () => {
    await page.close();
  });

  test('declares a new incident', async () => {
    incidentTitle = `Elevated latency on checkout ${unique()}`;

    await page.goto('/incidents');
    await page.getByRole('button', { name: 'Declare Incident' }).click();

    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('Incident Title').fill(incidentTitle);
    await dialog.getByLabel('Description').fill('Checkout requests are taking longer than usual.');
    await dialog.getByLabel('Severity').selectOption('HIGH');

    // The incidents list overlays a visually-hidden link per row (see
    // Incidents.tsx), so its accessible name is "View incident" rather than
    // the title — reading the id back from the create response is more
    // robust than trying to click a same-named row.
    const [response] = await Promise.all([
      page.waitForResponse((res) => res.url().endsWith('/incidents') && res.request().method() === 'POST'),
      dialog.getByRole('button', { name: 'Declare Incident' }).click(),
    ]);
    incidentId = (await response.json()).data.id;

    await expect(dialog).not.toBeVisible();
    await page.goto(`/incidents/${incidentId}`);
    await expect(page.getByRole('heading', { name: incidentTitle })).toBeVisible();
  });

  test('assigns the incident to the current user', async () => {
    await page.goto(`/incidents/${incidentId}`);
    await expect(page.getByText('Unassigned')).toBeVisible();
    await page.getByRole('button', { name: 'Assign to Me' }).click();
    await expect(page.getByText('Unassigned')).not.toBeVisible();
  });

  test('walks the incident through every status transition', async () => {
    await page.goto(`/incidents/${incidentId}`);
    await expect(page.getByText('Triggered', { exact: true })).toBeVisible();

    await page.getByRole('button', { name: 'Acknowledge' }).click();
    await expect(page.getByText('Acknowledged', { exact: true })).toBeVisible();

    await page.getByRole('button', { name: 'Resolve Incident' }).click();
    await expect(page.getByText('Resolved', { exact: true })).toBeVisible();
  });

  test('posts both an internal note and a public update', async () => {
    await page.goto(`/incidents/${incidentId}`);
    await page.getByLabel('Update message').fill('Root cause confirmed: internal only.');
    await page.getByLabel('Update visibility').selectOption('false');
    await page.getByRole('button', { name: 'Post Update' }).click();
    await expect(page.getByText('Root cause confirmed: internal only.')).toBeVisible();

    // Reload before the second submission: the form's local state doesn't
    // depend on this, but it avoids racing the first mutation's own
    // in-flight cache invalidation with the second `fill`.
    await page.reload();
    await page.getByLabel('Update message').fill('Checkout latency has returned to normal.');
    await page.getByLabel('Update visibility').selectOption('true');
    await page.getByRole('button', { name: 'Post Update' }).click();
    await expect(page.getByText('Checkout latency has returned to normal.')).toBeVisible();
  });

  test('reflects the incident on the public status page without leaking the internal note', async () => {
    // The org id lives in the JWT payload, not anywhere visible in the UI —
    // decode it from the token the app stored on login instead of scraping DOM.
    const token = await page.evaluate(() => localStorage.getItem('blackwater-auth-storage'));
    const parsed = JSON.parse(token!);
    orgId = parsed.state.user.orgId;

    // The incident was already resolved in the previous step, so it no longer
    // appears in the overview's "Active Incidents" list (that's by design —
    // see StatusService.getOverview, which only returns non-resolved
    // incidents) — assert on its permanent public detail page instead.
    await page.goto(`/status/${orgId}`);
    await expect(page.getByRole('heading', { name: /status/i })).toBeVisible();

    await page.goto(`/status/${orgId}/incidents/${incidentId}`);
    await expect(page.getByRole('heading', { name: incidentTitle })).toBeVisible();
    await expect(page.getByText('Checkout latency has returned to normal.')).toBeVisible();
    await expect(page.getByText('Root cause confirmed: internal only.')).toHaveCount(0);
  });

  test('closes the incident via the API and confirms the UI removes every mutating control', async () => {
    // There's no "Close" action in the UI (RESOLVED -> CLOSED is a backend-only
    // transition today), so drive it directly through the API the same way an
    // external integration would, then verify the incident-details page reacts
    // correctly to a CLOSED incident.
    const token = await page.evaluate(
      () => JSON.parse(localStorage.getItem('blackwater-auth-storage')!).state.token
    );

    const response = await page.request.patch(`http://localhost:8001/incidents/${incidentId}/status`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { status: 'CLOSED' },
    });
    expect(response.ok()).toBe(true);

    await page.goto(`/incidents/${incidentId}`);
    await expect(page.getByText('Closed', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Reopen' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Assign to Me' })).toHaveCount(0);
    await expect(page.getByText('This incident is closed and can no longer be updated.')).toBeVisible();
  });
});
