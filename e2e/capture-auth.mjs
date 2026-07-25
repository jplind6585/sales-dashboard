// Recapture the Playwright login session so automated E2E can run again.
// Opens a real browser window — sign in with your @withbanner.com Google account once, and it saves
// the session to e2e/auth.json (gitignored, never committed). Run from the repo root:
//   node e2e/capture-auth.mjs
import { chromium } from '@playwright/test'

const BASE = 'https://sales-dashboard-james-projects-87ec0089.vercel.app'
const OUT = 'e2e/auth.json'
const TIMEOUT_MS = 240000 // 4 minutes to complete sign-in

// Prefer real Google Chrome — Google often blocks OAuth in the bundled test browser.
let browser
try { browser = await chromium.launch({ headless: false, channel: 'chrome' }) }
catch { browser = await chromium.launch({ headless: false }) }
const context = await browser.newContext()
const page = await context.newPage()
await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' }).catch(() => {})

console.log('\n>>> A browser window opened. Sign in with your @withbanner.com Google account.')
console.log('>>> Waiting for you to reach the app (up to 4 minutes)…\n')

const deadline = Date.now() + TIMEOUT_MS
let ok = false
while (Date.now() < deadline) {
  let url = ''
  try { url = page.url() } catch {}
  if (url.startsWith(BASE) && !url.includes('/login')) { ok = true; break }
  await new Promise((r) => setTimeout(r, 1500))
}

if (ok) {
  await page.waitForTimeout(3000) // let the session settle
  await context.storageState({ path: OUT })
  console.log(`\n✅ Saved ${OUT} — automated E2E can run again. You can close the window.`)
} else {
  console.error('\n❌ Timed out waiting for sign-in. Re-run: node e2e/capture-auth.mjs')
}
await browser.close()
process.exit(ok ? 0 : 1)
