import { test, expect } from '@playwright/test';
import { register } from './helpers.js';

// The colour theme: System (the default) follows the operating system; Light or
// Dark is a saved choice that wins over it. See public/js/theme.js.

const theme = (page) => page.evaluate(() => document.documentElement.dataset.theme);
const pageBackground = (page) => page.evaluate(() => getComputedStyle(document.body).backgroundColor);
const DARK_BG = 'rgb(12, 18, 24)'; // --bg in the dark theme
const LIGHT_BG = 'rgb(245, 246, 248)'; // --bg in the light theme

test.describe('colour theme', () => {
  test('follows the operating system by default, and keeps following it while the page is open', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.goto('/login');
    expect(await theme(page)).toBe('dark');
    expect(await pageBackground(page)).toBe(DARK_BG);

    await page.emulateMedia({ colorScheme: 'light' });
    await expect.poll(() => theme(page)).toBe('light');
    expect(await pageBackground(page)).toBe(LIGHT_BG);
  });

  test('a chosen theme overrides the system, survives navigation and reloads, and System hands control back', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light' });
    await register(page);

    await page.locator('.user-button').click();
    await page.getByRole('radio', { name: 'Dark' }).check();
    expect(await theme(page)).toBe('dark');
    expect(await pageBackground(page)).toBe(DARK_BG);

    await page.goto('/incidents');
    expect(await theme(page)).toBe('dark');
    await page.reload();
    expect(await theme(page)).toBe('dark');

    // An operating-system change does not override an explicit choice.
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.emulateMedia({ colorScheme: 'light' });
    expect(await theme(page)).toBe('dark');

    // The switcher shows the saved choice, and System follows the OS again.
    await page.locator('.user-button').click();
    await expect(page.getByRole('radio', { name: 'Dark' })).toBeChecked();
    await page.getByRole('radio', { name: 'System' }).check();
    expect(await theme(page)).toBe('light');
    expect(await page.evaluate(() => localStorage.getItem('blackwater.theme'))).toBeNull();
  });

  test('the theme is set before any page script runs, so the page never flashes the wrong theme', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('blackwater.theme', 'dark'));
    // Block every page module: only the synchronous script in <head> can set the theme.
    await page.route('**/js/pages/**', (route) => route.abort());
    await page.goto('/login');
    expect(await theme(page)).toBe('dark');
    expect(await pageBackground(page)).toBe(DARK_BG);
  });

  test('open tabs switch together', async ({ page, context }) => {
    await page.emulateMedia({ colorScheme: 'light' });
    await page.goto('/login');
    const other = await context.newPage();
    await other.emulateMedia({ colorScheme: 'light' });
    await other.goto('/register');

    await page.getByRole('radio', { name: 'Dark' }).check();
    await expect.poll(() => theme(other)).toBe('dark');
    await expect(other.getByRole('radio', { name: 'Dark' })).toBeChecked();
  });

  test('a visitor to the public status page can choose a theme, which persists', async ({ page, browser }) => {
    const { orgId } = await register(page);
    const context = await browser.newContext({ colorScheme: 'light' });
    const visitor = await context.newPage();
    await visitor.goto(`/status/${orgId}`);
    await expect(visitor.getByRole('heading', { level: 1 })).toBeVisible();

    await visitor.getByRole('radio', { name: 'Dark' }).check();
    expect(await theme(visitor)).toBe('dark');
    await visitor.reload();
    expect(await theme(visitor)).toBe('dark');
    await context.close();
  });

  test('the switcher is operated with the arrow keys like any radio group', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light' });
    await page.goto('/login');
    await page.getByRole('radio', { name: 'System' }).focus();
    await page.keyboard.press('ArrowRight');
    await expect(page.getByRole('radio', { name: 'Light' })).toBeChecked();
    await page.keyboard.press('ArrowRight');
    await expect(page.getByRole('radio', { name: 'Dark' })).toBeChecked();
    expect(await theme(page)).toBe('dark');
  });
});
