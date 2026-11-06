import { defineConfig, devices } from '@playwright/test';

// End-to-end tests drive the real interface in a real browser against the real
// API and the disposable test database (.env.test), exactly as in the backend
// integration tests. Every test registers its own organization.
export default defineConfig({
  testDir: './e2e',
  testIgnore: 'smoke.spec.js', // needs a running deployment: see playwright.smoke.config.js
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'list' : [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: 'http://localhost:8001',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'npm run test:migrate && npx dotenv -e .env.test -- node src/server.js',
    url: 'http://localhost:8001/health',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    // The suite signs in and registers far more often than the production limit allows.
    env: { AUTH_RATE_LIMIT: '100000', API_RATE_LIMIT: '100000' },
  },
  // Chromium always; Firefox and WebKit (Safari's engine) too with ALL_BROWSERS=1.
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    ...(process.env.ALL_BROWSERS
      ? [
          { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
          { name: 'webkit', use: { ...devices['Desktop Safari'] } },
        ]
      : []),
  ],
});
