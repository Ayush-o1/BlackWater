// Shared by the browser specs: every test registers its own organization.
import { expect } from '@playwright/test';

export const unique = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
export const PASSWORD = 'CorrectHorse!9';

export async function register(page, { name = 'Aarav Sharma' } = {}) {
  const id = unique();
  const email = `e2e-${id}@blackwater.test`;

  await page.goto('/register');
  await page.getByLabel('Your name').fill(name);
  await page.getByLabel('Email address').fill(email);
  await page.getByLabel('Password', { exact: true }).fill(PASSWORD);
  await page.getByLabel('Organization name').fill(`E2E Org ${id}`);
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page.getByRole('heading', { name: 'Overview', level: 1 })).toBeVisible();

  const session = await page.evaluate(() => JSON.parse(localStorage.getItem('blackwater.session')));
  return { email, name, orgId: session.user.orgId, token: session.token };
}

// Direct API calls with the signed-in user's token, for setting things up quickly.
export const apiFor = (page, token) => ({
  post: (path, data) => page.request.post(`/api${path}`, { data, headers: { Authorization: `Bearer ${token}` } }),
  patch: (path, data) => page.request.patch(`/api${path}`, { data, headers: { Authorization: `Bearer ${token}` } }),
});

// Tests that need a second person open their own browser context. Close those when
// the test ends: left open, their pages keep refreshing and holding live connections
// for the rest of the run, and in Firefox and WebKit (one browser process shared by
// every context) that slows later tests until they time out.
export async function closeOtherSessions({ browser, page }) {
  await Promise.all(browser.contexts().filter((context) => context !== page.context()).map((context) => context.close()));
}
