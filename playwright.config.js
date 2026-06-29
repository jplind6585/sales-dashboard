// Playwright E2E — runs against PROD using a saved login session (e2e/auth.json).
// Scoped to read/navigation smoke + non-destructive checks (see e2e/ specs).
const { defineConfig, devices } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './e2e',
  timeout: 60000,
  retries: 1,
  reporter: [['list']],
  use: {
    // The saved session's auth cookies live on the Vercel project domain (that's where the
    // OAuth redirect landed), not the six-rosy alias — so E2E must target this origin.
    baseURL: 'https://sales-dashboard-james-projects-87ec0089.vercel.app',
    storageState: 'e2e/auth.json',
    headless: true,
    actionTimeout: 15000,
    navigationTimeout: 45000,
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
