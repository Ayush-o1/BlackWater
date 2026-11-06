import AxeBuilder from '@axe-core/playwright';
import { test, expect } from '@playwright/test';
import { apiFor, register } from './helpers.js';

// Automated WCAG checks with axe-core on every page, at desktop and phone width,
// with the menus and dialogs open as well as closed. axe finds a useful share of
// problems, not all of them: the keyboard tests below cover what it cannot.
const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

async function audit(page, label) {
  // Let entrance animations finish so colors are measured at rest.
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(300);
  const { violations } = await new AxeBuilder({ page }).withTags(TAGS).analyze();
  const report = violations.map((v) => `${v.id} (${v.impact}): ${v.help}\n  ${v.nodes.slice(0, 3).map((n) => n.target.join(' ')).join('\n  ')}`);
  expect(report, `${label} has accessibility violations`).toEqual([]);
}

async function seed(page) {
  const session = await register(page);
  const api = apiFor(page, session.token);
  const service = (await (await api.post('/services', { name: 'Payments API', description: 'Card payments and refunds' })).json()).data;
  await api.post('/services', { name: 'Search' });
  const incident = (await (await api.post('/incidents', { title: 'Card payments failing', description: 'Some card payments return an error.', severity: 'HIGH', serviceIds: [service.id], isPublic: true })).json()).data;
  await api.post(`/incidents/${incident.id}/updates`, { message: 'We are investigating.', isPublic: true });
  await api.post(`/incidents/${incident.id}/updates`, { message: 'Looks like the card gateway.', isPublic: false });
  const resolved = (await (await api.post('/incidents', { title: 'Slow search', severity: 'LOW', isPublic: true })).json()).data;
  await api.patch(`/incidents/${resolved.id}/status`, { status: 'RESOLVED' });
  return { ...session, service, incident };
}

for (const viewport of [{ name: 'desktop', width: 1280, height: 800 }, { name: 'phone', width: 390, height: 844 }]) {
  test.describe(`accessibility at ${viewport.name} width`, () => {
    test.use({ viewport: { width: viewport.width, height: viewport.height } });

    test('signed-out pages', async ({ page }) => {
      for (const path of ['/login', '/register', '/no-such-page']) {
        await page.goto(path);
        await audit(page, path);
      }
    });

    test('every signed-in page, with menus and dialogs open', async ({ page }) => {
      const { orgId, service, incident } = await seed(page);

      for (const path of ['/', '/incidents', `/incidents/${incident.id}`, '/services', `/services/${service.id}`, '/settings']) {
        await page.goto(path);
        await audit(page, path);
      }

      await page.goto('/');
      if (viewport.name === 'phone') {
        await page.getByRole('button', { name: 'Open navigation' }).click();
        await audit(page, 'navigation drawer');
      }
      await page.locator('.user-button').click();
      await audit(page, 'user menu');

      await page.goto('/incidents');
      await page.getByRole('button', { name: 'Declare incident' }).click();
      await expect(page.getByRole('dialog')).toBeVisible();
      await audit(page, 'declare incident dialog');

      await page.goto('/settings');
      await page.getByRole('button', { name: 'Invite someone' }).click();
      await expect(page.getByRole('dialog')).toBeVisible();
      await audit(page, 'invite dialog');

      await page.goto(`/status/${orgId}`);
      await audit(page, 'public status page');
      await page.goto(`/status/${orgId}/incidents/${incident.id}`);
      await audit(page, 'public incident page');
    });
  });
}

test.describe('keyboard', () => {
  // Safari (WebKit) only moves focus to links with Option+Tab unless the user turns on
  // "Press Tab to highlight each item"; Option+Tab is the Safari user's way to reach them.
  let TAB = 'Tab';
  test.beforeEach(({ browserName }) => {
    TAB = browserName === 'webkit' ? 'Alt+Tab' : 'Tab';
  });

  test('the skip link is the first stop and moves focus to the content', async ({ page }) => {
    await register(page);
    await page.goto('/incidents');
    await page.keyboard.press(TAB);
    await expect(page.getByRole('link', { name: 'Skip to content' })).toBeFocused();
    await page.keyboard.press('Enter');
    await page.keyboard.press(TAB);
    // The next stop is inside the main content, not back in the sidebar.
    expect(await page.evaluate(() => document.querySelector('#main').contains(document.activeElement))).toBe(true);
  });

  test('the user menu opens, closes with Escape and returns focus', async ({ page }) => {
    await register(page);
    const button = page.locator('.user-button');
    await button.focus();
    await page.keyboard.press('Enter');
    await expect(button).toHaveAttribute('aria-expanded', 'true');
    await page.keyboard.press(TAB);
    await expect(page.getByRole('link', { name: 'Profile and settings' })).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(button).toHaveAttribute('aria-expanded', 'false');
    await expect(button).toBeFocused();
  });

  test('a dialog takes focus, never lets Tab reach the page behind it, and gives focus back on Escape', async ({ page }) => {
    await register(page);
    await page.goto('/incidents');
    const trigger = page.getByRole('button', { name: 'Declare incident' });
    await trigger.focus();
    await page.keyboard.press('Enter');
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    for (let i = 0; i < 15; i += 1) {
      await page.keyboard.press(TAB);
      // A native modal dialog makes the page inert; Tab may pass to the browser's own
      // controls (focus on <body>), but never to an element of the page behind it.
      const where = await dialog.evaluate((node) => (node.contains(document.activeElement) ? 'dialog' : document.activeElement === document.body ? 'browser' : document.activeElement.outerHTML.slice(0, 80)));
      expect(['dialog', 'browser']).toContain(where);
    }
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(trigger).toBeFocused();
  });

  test('on a phone the navigation drawer is reachable, closes with Escape and returns focus', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await register(page);
    const menu = page.getByRole('button', { name: 'Open navigation' });
    await menu.focus();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('navigation', { name: 'Main' }).getByRole('link').first()).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('navigation', { name: 'Main' })).toBeHidden();
    await expect(menu).toBeFocused();
  });

  test('every interactive element on the incident page shows a visible focus ring', async ({ page }) => {
    const { incident } = await seed(page);
    await page.goto(`/incidents/${incident.id}`);
    await page.waitForLoadState('networkidle');
    const missing = [];
    for (let i = 0; i < 40; i += 1) {
      await page.keyboard.press(TAB);
      const info = await page.evaluate(() => {
        const el = document.activeElement;
        if (!el || el === document.body) return null;
        const style = getComputedStyle(el);
        const ring = (style.outlineStyle !== 'none' && parseFloat(style.outlineWidth) > 0) || style.boxShadow !== 'none';
        return { ring, name: `${el.tagName} ${el.getAttribute('aria-label') ?? el.textContent.trim().slice(0, 30)}` };
      });
      if (info && !info.ring) missing.push(info.name);
    }
    expect(missing).toEqual([]);
  });
});
