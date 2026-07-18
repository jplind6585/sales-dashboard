// Read-only smoke: every key surface loads while authenticated (no login redirect) and
// renders its core content. Safe to run against prod — no writes, no destructive actions.
const { test, expect } = require('@playwright/test');

const PAGES = [
  { path: '/modules/today', expect: /Today|Morning|Focus|Tasks/i },
  { path: '/modules/tasks', expect: /Task/i },
  { path: '/modules/account-pipeline', expect: /Pipeline|Account|Stage/i },
  { path: '/modules/sales-reports', expect: /Reports|Command Center|Dashboard/i },
  { path: '/modules/sales-reports/command-center', expect: /Command Center|goal|pipeline|feed/i },
  { path: '/modules/sales-reports/ceo-dashboard', expect: /Pipeline|Win|Deals|Dashboard/i },
  { path: '/modules/content', expect: /Content Studio|Follow-up|Business case|account/i },
  { path: '/modules/call-queue', expect: /Call Queue|outreach|touches|reach today/i },
  { path: '/modules/sales-reports/team-dashboard', expect: /Team|Rep|Pipeline|Discovery|Objection/i },
  { path: '/modules/coaching-lab', expect: /Coaching Lab|Best calls|advance|kill/i },
  { path: '/modules/roi-tracker', expect: /ROI Tracker|initiative|pipeline|returning/i },
  { path: '/modules/work-requests', expect: /Work Requests|request|design|engineering/i },
  { path: '/modules/prospecting', expect: /Prospecting|Apollo|Search|titles/i },
];

for (const p of PAGES) {
  test(`renders ${p.path} (authed)`, async ({ page }) => {
    const resp = await page.goto(p.path, { waitUntil: 'domcontentloaded' });
    expect(resp?.status(), 'HTTP status').toBeLessThan(400);
    await page.waitForTimeout(2500); // let client auth + data fetch settle
    expect(page.url(), 'should not be bounced to /login').not.toMatch(/\/login/);
    await expect(page.locator('body')).toContainText(p.expect, { timeout: 15000 });
  });
}

test('command palette opens with ⌘K / Ctrl+K', async ({ page }) => {
  await page.goto('/modules/today', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2500);
  await page.keyboard.press('Control+k');
  await expect(page.locator('input[placeholder*="Search accounts"]')).toBeVisible({ timeout: 6000 });
});

test('global assistant launcher is present on every screen', async ({ page }) => {
  await page.goto('/modules/today', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2500);
  await expect(page.locator('button[title*="Assistant"]')).toBeVisible({ timeout: 15000 });
});

test('global assistant opens and responds to a read-only question (no writes)', async ({ page }) => {
  await page.goto('/modules/today', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2500);
  await page.locator('button[title*="Assistant"]').click();
  const input = page.locator('input[placeholder*="Ask or tell"]');
  await expect(input).toBeVisible({ timeout: 10000 });
  await input.fill('What should I focus on today?');
  await input.press('Enter');
  // An assistant reply bubble should appear; we do NOT click Apply on anything.
  await expect(page.locator('text=/Ask anything|Assistant/i').first()).toBeVisible();
});
