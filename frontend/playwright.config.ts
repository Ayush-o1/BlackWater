import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, devices } from '@playwright/test';

const dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(dirname, '..');

// End-to-end suite drives the real app against a disposable test database
// (the same `blackwater_test` database and `.env.test` the backend's own
// integration tests use — see ../TESTING.md). Every test registers its own
// organization, so runs don't depend on — or collide with — leftover state.
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'list' : 'html',
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'retain-on-failure',
  },
  webServer: [
    {
      command: 'npm run test:migrate && npx dotenv -e .env.test -- npm run dev',
      cwd: repoRoot,
      url: 'http://localhost:8001/health',
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
    {
      command: 'npm run dev -- --port 5173 --strictPort',
      cwd: dirname,
      env: { VITE_API_URL: 'http://localhost:8001' },
      url: 'http://localhost:5173',
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
  ],
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
