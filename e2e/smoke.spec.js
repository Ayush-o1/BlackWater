import { test, expect } from '@playwright/test';

// The critical workflows, driven through the real interface of a RUNNING
// deployment (`npm run smoke`, with SMOKE_URL set). Unlike the main browser suite
// it starts no server and uses no test database, so it can be pointed at a
// container or at the live site.
//
// It creates two organizations named "Smoke test ..." and deletes exactly those
// two when it finishes, each through its own administrator (the only way the API
// allows an organization to be deleted), then checks they are really gone. It
// cannot touch any other organization. Set SMOKE_KEEP_DATA=1 to keep them for
// inspection. It registers only three accounts, which stays under the default
// login/registration rate limit (20 per 15 minutes per IP).
//
// Set EXPECT_COMMIT to a commit SHA to also require that /health reports it, i.e.
// that the version just deployed (not an older one) is what answered.

const PASSWORD = 'CorrectHorse!9';
const stamp = () => `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

// Organizations this run created, for the clean-up in afterEach.
const created = [];

// Everything the watched pages reported. Printed when the journey fails, so a failure
// explains itself (a 429, a failed request, a console error) instead of only naming
// the assertion that happened to time out.
const problems = [];

test.afterEach(async (_fixtures, testInfo) => {
  if (testInfo.status !== testInfo.expectedStatus) console.log(`PROBLEMS SEEN BY THE PAGES: ${JSON.stringify(problems, null, 1)}`);
});

test.afterEach(async ({ request }) => {
  if (process.env.SMOKE_KEEP_DATA) return;
  for (const { token, name, orgId } of created.splice(0)) {
    const res = await request.delete('/api/organizations/me', { headers: { Authorization: `Bearer ${token}` }, data: { password: PASSWORD, confirmName: name } });
    expect(res.status(), `deleting ${name}`).toBe(200);
    // Verified, not assumed: the public page of the deleted organization is gone.
    expect((await request.get('/api/status', { params: { orgId } })).status(), `${name} should be gone`).toBe(404);
  }
});

// Everything the admin's and the invited member's pages do must be free of
// console errors, uncaught exceptions, failed requests and HTTP errors. Visitors
// and the outsider are deliberately not watched: they probe things that are
// supposed to answer 404.
const apiCalls = {};

function watch(page, label, problems) {
  page.on('request', (request) => {
    if (new URL(request.url()).pathname.startsWith('/api/')) apiCalls[label] = (apiCalls[label] ?? 0) + 1;
  });
  page.on('console', (message) => {
    if (['error', 'warning'].includes(message.type())) problems.push(`${label} console ${message.type()}: ${message.text()}`);
  });
  page.on('pageerror', (error) => problems.push(`${label} uncaught: ${error.message}`));
  page.on('requestfailed', (request) => problems.push(`${label} request failed: ${request.url()}`));
  page.on('response', (response) => {
    if (response.status() >= 400) problems.push(`${label} HTTP ${response.status()}: ${response.url()}`);
  });
}

const sessionOf = (page) => page.evaluate(() => JSON.parse(localStorage.getItem('blackwater.session')));
const asUser = (token) => ({ Authorization: `Bearer ${token}` });

test('critical workflows on the deployed application', async ({ browser, baseURL, request }) => {
  test.setTimeout(240_000);
  problems.length = 0;
  const id = stamp();

  // ---- The server and its headers ----
  await test.step('health check, security headers, no CORS', async () => {
    const health = await request.get('/health');
    expect(health.status()).toBe(200);
    const body = await health.json();
    expect(body).toMatchObject({ status: 'UP', database: 'UP' });
    if (process.env.EXPECT_COMMIT) expect(body.commit, 'the deployed commit').toBe(process.env.EXPECT_COMMIT);

    const page = await request.get('/login');
    expect(page.headers()['content-security-policy']).toContain("script-src 'self'");
    expect(page.headers()['access-control-allow-origin']).toBeUndefined();

    const api = await request.get('/api/status', { params: { orgId: '00000000-0000-4000-8000-000000000000' } });
    expect(api.status()).toBe(404);
    expect(api.headers()['cache-control']).toBe('no-store');
  });

  // ---- The administrator registers an organization ----
  const adminContext = await browser.newContext();
  const admin = await adminContext.newPage();
  watch(admin, 'admin', problems);
  let adminSession;

  await test.step('register an organization and land on the dashboard', async () => {
    await admin.goto('/register');
    await admin.getByLabel('Your name').fill('Ananya Gupta');
    await admin.getByLabel('Email address').fill(`smoke-admin-${id}@blackwater.test`);
    await admin.getByLabel('Password', { exact: true }).fill(PASSWORD);
    await admin.getByLabel('Organization name').fill(`Smoke test ${id}`);
    await admin.getByRole('button', { name: 'Create account' }).click();
    await expect(admin.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
    adminSession = await sessionOf(admin);
    expect(adminSession.user.role).toBe('ADMIN');
  });
  const orgId = adminSession.user.orgId;
  created.push({ token: adminSession.token, name: `Smoke test ${id}`, orgId });

  await test.step('create a service', async () => {
    await admin.goto('/services');
    await admin.getByRole('button', { name: 'Add service' }).first().click();
    await admin.getByLabel('Name').fill('Payments API');
    await admin.getByLabel('Description').fill('Takes card payments');
    await admin.getByRole('dialog').getByRole('button', { name: 'Add service' }).click();
    await expect(admin.getByRole('link', { name: /Payments API/ })).toContainText('Operational');
  });

  // ---- Invitation: link, acceptance, single use, role ----
  const memberContext = await browser.newContext();
  const member = await memberContext.newPage();
  watch(member, 'member', problems);
  let memberSession;

  await test.step('invite a viewer, who joins once with the invited role', async () => {
    await admin.goto('/settings');
    await admin.getByRole('button', { name: 'Invite someone' }).click();
    await admin.getByLabel('Role', { exact: true }).selectOption('VIEWER');
    await admin.getByRole('button', { name: 'Create invitation link' }).click();
    const link = await admin.getByLabel('Invitation link').inputValue();
    expect(link).toContain('/invite#');
    await admin.getByRole('dialog').getByRole('button', { name: 'Done' }).click();

    await member.goto(link);
    await expect(member.getByRole('heading', { name: /^Join Smoke test/ })).toBeVisible();
    await member.getByLabel('Your name').fill('Meera Iyer');
    await member.getByLabel('Email address').fill(`smoke-member-${id}@blackwater.test`);
    await member.getByLabel('Choose a password').fill(PASSWORD);
    await member.getByRole('button', { name: 'Join' }).click();
    await expect(member.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
    memberSession = await sessionOf(member);
    expect(memberSession.user.role).toBe('VIEWER');
    expect(memberSession.user.orgId).toBe(orgId);

    // The same link is dead afterwards.
    const second = await (await browser.newContext()).newPage();
    await second.goto(link);
    await expect(second.getByText('This link is no longer valid')).toBeVisible();
  });

  await test.step('a viewer cannot write, in the interface or the API', async () => {
    await member.goto('/incidents');
    await expect(member.getByRole('heading', { name: 'Incidents', exact: true })).toBeVisible();
    await expect(member.getByRole('button', { name: 'Declare incident' })).toHaveCount(0);
    const refused = await request.post('/api/incidents', { headers: asUser(memberSession.token), data: { title: 'Not allowed here', severity: 'LOW' } });
    expect(refused.status()).toBe(403);
  });

  // ---- A second organization, connected before anything happens ----
  const outsiderContext = await browser.newContext();
  const outsiderRegistration = await outsiderContext.request.post('/api/auth/register', {
    data: { name: 'Olivia Park', email: `smoke-outsider-${id}@blackwater.test`, password: PASSWORD, orgName: `Smoke test other ${id}` },
  });
  expect(outsiderRegistration.status()).toBe(201);
  const outsiderSession = (await outsiderRegistration.json()).data;
  created.push({ token: outsiderSession.token, name: `Smoke test other ${id}`, orgId: outsiderSession.user.orgId });
  const outsider = await (async () => {
    await outsiderContext.addInitScript(([key, value]) => localStorage.setItem(key, value), ['blackwater.session', JSON.stringify(outsiderSession)]);
    const page = await outsiderContext.newPage();
    await page.goto('/incidents');
    await expect(page.locator('.live-indicator')).toContainText('Live');
    return page;
  })();

  // ---- Real-time: the role change reaches the open page ----
  await test.step('promoting the viewer updates their open page without a reload', async () => {
    await expect(member.locator('.live-indicator')).toContainText('Live');
    await admin.goto('/settings');
    await admin.getByLabel('Role of Meera Iyer').selectOption('MEMBER');
    await expect(admin.getByText('Meera Iyer is now Member')).toBeVisible();
    await expect(member.getByRole('button', { name: 'Declare incident' })).toBeVisible();
  });

  // ---- The incident, end to end ----
  const title = `Checkout failing ${id}`;
  let incidentUrl;
  let incidentId;

  await test.step('declare a private critical incident; health follows', async () => {
    await admin.goto('/incidents');
    await admin.getByRole('button', { name: 'Declare incident' }).click();
    await admin.getByLabel('Title').fill(title);
    await admin.getByLabel('Severity', { exact: true }).selectOption('CRITICAL');
    await admin.getByLabel('Payments API').check();
    await admin.getByRole('dialog').getByRole('button', { name: 'Declare incident' }).click();
    await expect(admin.getByRole('heading', { name: title })).toBeVisible();
    await expect(admin.getByText('Private')).toBeVisible();
    await expect(admin.getByText('Major outage')).toBeVisible();
    incidentUrl = admin.url();
    incidentId = incidentUrl.split('/').pop();
  });

  await test.step('the member sees the new incident on an open page, the outsider does not', async () => {
    await member.goto('/incidents');
    await expect(member.getByText(title)).toBeVisible();
    await member.goto(incidentUrl);
    await expect(member.locator('.header-badges')).toContainText('Triggered');
  });

  await test.step('work the incident: acknowledge, assign, edit, notes', async () => {
    await admin.getByRole('button', { name: 'Acknowledge' }).click();
    // The member's open incident page changes without a reload.
    await expect(member.locator('.header-badges')).toContainText('Acknowledged');

    await admin.getByLabel('Assignee').selectOption({ label: 'Meera Iyer' });
    await expect(admin.getByText('Assigned to Meera Iyer')).toBeVisible();
    await expect(member.getByLabel('Assignee')).toHaveValue(/.+/);

    await admin.getByRole('button', { name: 'Edit' }).click();
    await admin.getByLabel('Severity', { exact: true }).selectOption('HIGH');
    await admin.getByRole('dialog').getByRole('button', { name: 'Save' }).click();
    await expect(admin.getByText('Severity: Critical → High')).toBeVisible();

    await admin.getByLabel('Update message').fill('Root cause: expired certificate. Internal only.');
    await admin.getByLabel('Who can see this').selectOption('false');
    await admin.getByRole('button', { name: 'Post', exact: true }).click();
    await expect(admin.getByText('Internal note added')).toBeVisible();

    await admin.getByLabel('Update message').fill('We are investigating failing payments.');
    await admin.getByLabel('Who can see this').selectOption('true');
    await admin.getByRole('button', { name: 'Post', exact: true }).click();
    await expect(admin.getByText('Public update posted')).toBeVisible();
    await expect(member.getByText('Public update posted')).toBeVisible();
  });

  await test.step('the audit trail names who did what', async () => {
    const timeline = admin.locator('.timeline');
    for (const entry of ['Incident declared', 'Status changed', 'Assigned to Meera Iyer', 'Incident edited']) {
      await expect(timeline.getByText(entry).first()).toBeVisible();
    }
    await expect(timeline.getByText('by Ananya Gupta').first()).toBeVisible();
  });

  // ---- Public visibility ----
  await test.step('visitors see nothing while the incident is private, then only what is published', async () => {
    const visitor = await (await browser.newContext()).newPage();
    await visitor.goto(`/status/${orgId}`);
    await expect(visitor.getByText('All systems operational')).toBeVisible();
    await expect(visitor.getByText(title)).toHaveCount(0);
    await visitor.goto(`/status/${orgId}/incidents/${incidentId}`);
    await expect(visitor.getByText('Incident not found')).toBeVisible();

    await admin.getByRole('button', { name: 'Publish' }).click();
    await admin.getByRole('dialog').getByRole('button', { name: 'Publish' }).click();
    await expect(admin.locator('#main').getByText('Published to the status page')).toBeVisible();

    await visitor.goto(`/status/${orgId}`);
    await expect(visitor.getByText('Partial outage').first()).toBeVisible();
    await visitor.getByRole('link', { name: new RegExp(title) }).first().click();
    await expect(visitor.getByRole('heading', { name: title })).toBeVisible();
    await expect(visitor.getByText('We are investigating failing payments.')).toBeVisible();
    await expect(visitor.getByText('Root cause')).toHaveCount(0);
    await expect(visitor.getByText('Meera')).toHaveCount(0);
    await expect(visitor.getByText('Ananya')).toHaveCount(0);

    await admin.getByRole('button', { name: 'Unpublish' }).click();
    await expect(admin.locator('#main').getByText('Removed from the status page')).toBeVisible();
    await visitor.reload();
    await expect(visitor.getByText('Incident not found')).toBeVisible();
  });

  await test.step('resolve, reopen, resolve again; the service recovers', async () => {
    await admin.getByRole('button', { name: 'Resolve incident' }).click();
    await expect(admin.locator('.header-badges')).toContainText('Resolved');
    await expect(member.locator('.header-badges')).toContainText('Resolved');
    await admin.getByRole('button', { name: 'Reopen' }).click();
    await expect(admin.locator('.header-badges')).toContainText('Triggered');
    await admin.getByRole('button', { name: 'Resolve', exact: true }).click();
    await expect(admin.locator('.header-badges')).toContainText('Resolved');
    await admin.goto('/services');
    await expect(admin.getByRole('link', { name: /Payments API/ })).toContainText('Operational');
  });

  // ---- Isolation between organizations ----
  await test.step('another organization sees none of it, in the API or the interface', async () => {
    const headers = asUser(outsiderSession.token);
    expect((await request.get(`/api/incidents/${incidentId}`, { headers })).status()).toBe(404);
    expect((await request.patch(`/api/incidents/${incidentId}/status`, { headers, data: { status: 'CLOSED' } })).status()).toBe(404);
    expect((await request.get('/api/incidents', { headers })).status()).toBe(200);
    expect((await (await request.get('/api/incidents', { headers })).json()).data).toEqual([]);
    expect((await (await request.get('/api/users', { headers })).json()).data.map((user) => user.email)).toEqual([outsiderSession.user.email]);

    // The outsider's socket was live throughout and heard nothing relevant: their own
    // incident arrives, the other organization's never does.
    const ownTitle = `Their own incident ${id}`;
    const created = await request.post('/api/incidents', { headers, data: { title: ownTitle, severity: 'LOW' } });
    expect(created.status()).toBe(201);
    await expect(outsider.getByText(ownTitle)).toBeVisible();
    await expect(outsider.getByText(title)).toHaveCount(0);
    await outsider.goto(incidentUrl);
    await expect(outsider.getByText('Incident not found')).toBeVisible();
  });

  // ---- Phone ----
  await test.step('the member sees a usable layout on a phone', async () => {
    const phoneContext = await browser.newContext({ viewport: { width: 375, height: 812 }, isMobile: true });
    // Seeded once: the app keeps the stored profile current (the member was promoted
    // since joining), and an init script that rewrote it on every load would undo that.
    await phoneContext.addInitScript(([key, value]) => { if (!localStorage.getItem(key)) localStorage.setItem(key, value); }, ['blackwater.session', JSON.stringify(memberSession)]);
    const phone = await phoneContext.newPage();
    watch(phone, 'phone', problems);
    for (const path of ['/', '/incidents', incidentUrl.replace(baseURL, ''), '/services', '/settings']) {
      await phone.goto(path);
      await phone.waitForLoadState('networkidle');
      const overflow = await phone.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow, `${path} scrolls sideways`).toBeLessThanOrEqual(0);
    }
    await phone.getByRole('button', { name: 'Open navigation' }).click();
    await expect(phone.getByRole('link', { name: 'Incidents' })).toBeVisible();
  });

  // Informational: how much API traffic a real session generates, for sizing API_RATE_LIMIT.
  console.log(`API requests during the journey: ${JSON.stringify(apiCalls)}`);

  expect(problems).toEqual([]);
});
