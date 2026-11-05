import { defineConfig, devices } from '@playwright/test';

// Runs e2e/smoke.spec.js against a deployment that is already running:
//   SMOKE_URL=https://your-app.example.com npm run smoke
// No server is started and no test database is touched.
const baseURL = process.env.SMOKE_URL;
if (!baseURL) {
  throw new Error('Set SMOKE_URL to the address of the deployment to test, e.g. SMOKE_URL=https://blackwater-app.onrender.com');
}

export default defineConfig({
  testDir: './e2e',
  testMatch: 'smoke.spec.js',
  workers: 1,
  retries: 0,
  // A sleeping free-tier host can take a minute to answer the first request.
  timeout: 240_000,
  expect: { timeout: 20_000 },
  reporter: [['list']],
  use: { baseURL: baseURL.replace(/\/$/, ''), trace: 'retain-on-failure' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
