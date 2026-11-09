import { test, expect } from '@playwright/test';
import { apiFor, register } from './helpers.js';

// Layout behaviour that a screenshot would show but a functional test would not.

const panelTitles = ['Needs attention', 'Services', 'Recently resolved', 'Public status page'];

async function overviewWithManyServices(page) {
  const { token } = await register(page);
  const api = apiFor(page, token);
  // Many services make the services list much taller than "Needs attention".
  for (let i = 1; i <= 10; i += 1) await api.post('/services', { name: `Service ${i}` });
  await api.post('/incidents', { title: 'Something is slow', severity: 'LOW' });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Recently resolved' })).toBeVisible();
}

const panelBox = (page, title) => page.locator('section.panel', { has: page.getByRole('heading', { name: title, exact: true }) }).boundingBox();

test.describe('overview layout', () => {
  test('on a desktop, a long services list does not push the panels on the left apart', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await overviewWithManyServices(page);
    const attention = await panelBox(page, 'Needs attention');
    const resolved = await panelBox(page, 'Recently resolved');
    const services = await panelBox(page, 'Services');

    expect(services.height).toBeGreaterThan(attention.height); // the situation that used to open a gap
    expect(services.x).toBeGreaterThan(attention.x + attention.width); // services is beside, not below
    // "Recently resolved" starts one grid gap (24px) below "Needs attention".
    expect(Math.round(resolved.y - (attention.y + attention.height))).toBe(24);
  });

  test('on a phone the panels are one column, most urgent first', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await overviewWithManyServices(page);
    const tops = [];
    for (const title of panelTitles) tops.push((await panelBox(page, title)).y);
    expect([...tops].sort((a, b) => a - b)).toEqual(tops); // shown top to bottom in this order
  });
});

test.describe('touch screens', () => {
  // A touch screen is detected by its coarse pointer, not by its width.
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

  test('controls are large enough for a fingertip', async ({ page }) => {
    await register(page);
    await page.goto('/incidents');
    const coarse = await page.evaluate(() => matchMedia('(pointer: coarse)').matches);
    test.skip(!coarse, 'this browser does not report a coarse pointer for an emulated touch screen');

    const height = (locator) => locator.evaluate((element) => element.getBoundingClientRect().height);
    expect(await height(page.getByRole('button', { name: 'Declare incident' }))).toBeGreaterThanOrEqual(44);
    expect(await height(page.getByRole('button', { name: 'Open', exact: true }))).toBeGreaterThanOrEqual(44); // a tab
    expect(await height(page.getByLabel('Sort incidents'))).toBeGreaterThanOrEqual(40);
    expect(await height(page.getByRole('button', { name: 'Open navigation' }))).toBeGreaterThanOrEqual(44);
  });
});

test.describe('mouse and trackpad', () => {
  test('a fine pointer keeps the compact desktop sizes', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await register(page);
    await page.goto('/incidents');
    expect(await page.evaluate(() => matchMedia('(pointer: coarse)').matches)).toBe(false);
    const box = await page.getByRole('button', { name: 'Declare incident' }).boundingBox();
    expect(box.height).toBe(36);
  });
});
