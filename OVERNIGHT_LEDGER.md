# Overnight Build Ledger

_Started 2026-06-28 evening. Honest running log of what shipped, what's staged, what's untested. Updated each build cycle._

## Operating rules this run
- **Loop:** build module → adversarial review workflow → fix all must-fixes → build-verify → deploy-or-stage → log here → continue.
- **Testing reality:** Verification = `next build` + multi-agent code review + logic reasoning + **Playwright E2E (NOW LIVE ✅)**.
  - E2E runs against the **Vercel project domain** `https://sales-dashboard-james-projects-87ec0089.vercel.app` (NOT six-rosy — the saved login session's auth cookies live on the project domain; six-rosy only got the PKCE verifier). baseURL is set in `playwright.config.js`.
  - Run with `npx playwright test --project=chromium` from `sales-dashboard/`. Session = `e2e/auth.json` (gitignored).
  - **2026-06-28: 8/8 smoke passing** — today, tasks, account-pipeline, sales-reports, command-center, ceo-dashboard all render authed; global assistant launcher present + opens + responds.
  - SCOPE/SAFETY: navigation/render smoke + the assistant *preview* step only. Do NOT click Apply on writes, do NOT bulk-move real stages, do NOT fire Slack/HubSpot, do NOT delete. Add a smoke check for each new screen as modules ship.
- **Deploy posture:** additive/new surfaces that pass review → auto-deployed to prod (Vercel `main`). Changes to existing critical paths → committed but flagged ⚠️ NEEDS-REVIEW below, not auto-deployed.
- **Migrations:** I cannot run Supabase migrations (MCP disconnected). Any new schema is delivered as a migration FILE under `supabase/migrations/` and listed under "RUN THESE" below. Code degrades gracefully until you run them.

## RUN THESE migrations (in order) before relying on the new features
1. `20260628_task_engine_vision.sql` ✅ (you ran this)
2. `20260628_gong_call_analyses_columns.sql` ✅ (you ran this)
3. _(any new ones added overnight will be appended here with the exact SQL)_

---

## Shipped & deployed (reviewed, build-green)
- **Playwright E2E harness** — `playwright.config.js` + `e2e/smoke.spec.js`, runs against your saved session. 8/8 smoke green. The loop now click-tests each new screen.
- **Phase 1 — de-Jamesed engine** (repConfig governance, CS-filtered analytics, centralized coaching, retired-model fix, ~2k lines dead code removed).
- **Task engine "never blank"** — every Gong/calendar task arrives with a pre-generated AI draft; Work-in-Claude opens on it.
- **Reporting Command Center** — revenue/pipeline scorecard vs goal, live feed, prospect-voice, AI working/not-working synthesis.
- **Calendar triggers** — prep + follow-up tasks with drafts; dedup'd.
- **Global action-capable assistant (⌘J on every screen)** — answers grounded in pipeline; proposes account/task actions you confirm; hardened write path (authz, ownership, ambiguity-fails-closed, governed team fan-out, idempotency). 28-agent review, all 4 must-fixes fixed.

## In progress / queued (audit-prioritized)
1. Real-time Gong webhook (T1) — calls → tasks/coaching within minutes, not the hourly tick.
2. Content + RFP automation — auto-draft emails, sequences, one-pagers, RFP responses from account context.
3. SDR engine — ICP-ranked dial lists from HubSpot by last-contacted; sequences; auto follow-ups.
4. Deeper reporting + the data→action feedback loop (talk tracks, demo improvements, per-rep coaching deltas).
5. Recurring/template task editor (rep + admin editable).

## ⚠️ NEEDS-REVIEW (committed, NOT auto-deployed — your call in the morning)
_(none yet)_

## Known caveats
- No live UX test this run (no auth session). First thing to check each shipped UI: does it render + the happy path work.
- The assistant writes to prod data on confirm — try it on a throwaaway account first.
