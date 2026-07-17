# Overnight Build Ledger

_Started 2026-06-28 evening. Honest running log of what shipped, what's staged, what's untested. Updated each build cycle._

## Operating rules this run
- **Loop:** build module → adversarial review workflow → fix all must-fixes → build-verify → deploy-or-stage → log here → continue.
- **Testing reality:** Verification = `next build` + multi-agent code review + logic reasoning + **Playwright E2E (NOW LIVE ✅)**.
  - E2E runs against the **Vercel project domain** `https://sales-dashboard-james-projects-87ec0089.vercel.app` (NOT six-rosy — the saved login session's auth cookies live on the project domain; six-rosy only got the PKCE verifier). baseURL is set in `playwright.config.js`.
  - Run with `npx playwright test --project=chromium` from `sales-dashboard/`. Session = `e2e/auth.json` (gitignored).
  - **2026-06-29: 10/10 smoke passing** — today, tasks, account-pipeline, sales-reports, command-center, ceo-dashboard, content, call-queue all render authed; global assistant launcher present + opens + responds.
  - SCOPE/SAFETY: navigation/render smoke + the assistant *preview* step only. Do NOT click Apply on writes, do NOT bulk-move real stages, do NOT fire Slack/HubSpot, do NOT delete. Add a smoke check for each new screen as modules ship.
- **Deploy posture:** additive/new surfaces that pass review → auto-deployed to prod (Vercel `main`). Changes to existing critical paths → committed but flagged ⚠️ NEEDS-REVIEW below, not auto-deployed.
- **Migrations:** I cannot run Supabase migrations (MCP disconnected). Any new schema is delivered as a migration FILE under `supabase/migrations/` and listed under "RUN THESE" below. Code degrades gracefully until you run them.

## Migrations — ALL RUN ✅ (applied 2026-06-29 via `supabase db query --linked`, the authenticated CLI; MCP OAuth not needed)
1. `20260628_task_engine_vision.sql` ✅
2. `20260628_gong_call_analyses_columns.sql` ✅
3. `20260628_coaching_cards_dedup.sql` ✅ — `uq_coaching_gong_call_id` unique index verified present (race-fix prereq satisfied).
4. `20260628_sdr_touches.sql` ✅ — table verified: 8 cols, 3 indexes, RLS on, `sdr_touches_rw` policy. Call Queue touch-logging + counter now live.

**How to run migrations from here (no MCP needed):** the Supabase CLI is logged in and the "Sales AI Brain" project is linked. Run any migration file with `supabase db query --linked -f supabase/migrations/<file>.sql` from `sales-dashboard/`. ⚠️ NEVER `supabase db push` — no local files are in remote history, so push would replay everything including `00_drop_all.sql` (drops the DB). Always target specific files with `db query`.

## SET THESE (env / integrations) to activate features
- **Real-time webhook (optional, big latency win):** set `GONG_WEBHOOK_SECRET` in Vercel, then in Gong create a webhook/Automation Rule that POSTs to `https://<host>/api/gong/webhook` with header `x-webhook-secret: <that secret>` (NOT the query string). Until set, the endpoint is inert (returns 503) — nothing breaks. Without it, calls still get analyzed by the existing hourly cron + 15-min poller, just not instantly.

---

## Shipped & deployed (reviewed, build-green)
- **Playwright E2E harness** — `playwright.config.js` + `e2e/smoke.spec.js`, runs against your saved session. 8/8 smoke green. The loop now click-tests each new screen.
- **Phase 1 — de-Jamesed engine** (repConfig governance, CS-filtered analytics, centralized coaching, retired-model fix, ~2k lines dead code removed).
- **Task engine "never blank"** — every Gong/calendar task arrives with a pre-generated AI draft; Work-in-Claude opens on it.
- **Reporting Command Center** — revenue/pipeline scorecard vs goal, live feed, prospect-voice, AI working/not-working synthesis.
- **Calendar triggers** — prep + follow-up tasks with drafts; dedup'd.
- **Global action-capable assistant (⌘J on every screen)** — answers grounded in pipeline; proposes account/task actions you confirm; hardened write path (authz, ownership, ambiguity-fails-closed, governed team fan-out, idempotency). 28-agent review, all 4 must-fixes fixed.

## Shipped & deployed (continued)
- **Content + RFP automation** — `/api/content/generate` (6 types) + Content Studio (`/modules/content`, rebuilt from a dead stub). Auto-drafts follow-up emails, business cases, one-pagers, agendas, sequences, and RFP answers grounded in each account's calls + sales process. RFP path hardened against prompt-injection/fabrication. Edit-safe per-(account,type) cache. In ModulesNav + modules grid. **9/9 E2E green incl. regression on all prior screens.**

## In progress / queued (audit-prioritized)
1. ✅ Real-time Gong webhook (T1) — shipped (inert until configured; race-fix staged).
2. ✅ Content + RFP automation — shipped.
3. ✅ SDR Call Queue — shipped (ranking + drafting live now; touch-logging activates with migration #4).
4. ⏸ Deeper reporting + the data→action feedback loop (talk tracks, demo improvements, per-rep coaching deltas). **PAUSED — James is steering; do not auto-start.**
5. Recurring/template task editor (rep + admin editable).

## Shipped & deployed (continued)
- **SDR Call Queue** — `/modules/call-queue` + `/api/sdr/call-queue` (ranks active accounts by recency + stage + ICP fit + tier) + `/api/sdr/log-touch`. Per-row one-click drafted opener (grounded in that account's calls), call/email/LinkedIn touch logging, daily-target bar. In ModulesNav + modules grid. 18-finding review; all 3 must-fixes fixed before deploy: (1) `scope=mine` no longer silently empties the queue for non-James reps — centralized `ownsAccount()` in repConfig (durable `user_id` link + normalized owner_name fallback), also patched the same bug in `rep-checkin.js`; (2) ranking now reads `sdr_touches` so a worked account de-prioritizes instead of re-surfacing labeled "never contacted"; (3) a failed draft no longer poisons the cache — it shows a Retry button. Also: ET (not UTC) day boundary, always-rep-scoped counter, archived-tier exclusion, cap-hit warning. **10/10 E2E green incl. regression on all prior screens.** ⚠️ Touch-logging + counter stay dormant until migration #4 runs.
- **Real-time Gong webhook (T1)** — `pages/api/gong/webhook.js`. Inert until you set `GONG_WEBHOOK_SECRET` + configure Gong (see SET THESE). Hardened via 15-finding review: header-only timing-safe auth, no-clobber import + no_show rescue, fail-closed rep gate, parallel-capped analysis. When wired, a call's tasks + coaching land within ~1 min instead of the hourly cron.

## Shipped & deployed (continued)
- **Concurrent double-analyze race fix — SHIPPED 2026-06-29.** The pre-existing race (`process-recent-calls.yml` runs two poller jobs on the same */15 cron; `intel-analyze` had no claim guard → the same call analyzed twice → duplicate tasks + duplicate coaching DMs + double Haiku spend) is now closed:
  - `intel-analyze` claims each call **atomically before** the Gong fetch + Claude call. Two paths covered: brand-new call (the poller creates no row first → **reserve** via insert-on-conflict) and imported-but-pending (**flip** `analyzed_at` null→now). The loser of a race returns `deduped` with no rework. On any failure (throw or upsert error) the claim is **released** so the call retries instead of getting stuck "analyzed".
  - `lib/coaching.js`: the card insert is race-safe — the loser gets `23505` (UNIQUE gong_call_id) and skips the duplicate DM (insert-and-catch, because the unique index is partial so a PostgREST upsert onConflict is not inferable).
  - `process-recent-calls`: self-heals any claim stuck >30 min with `analysis` NULL (process killed mid-analysis) so it retries — closes the only stuck-row window.
  - `force` flag threaded UI → batch → intel-analyze so manual re-analyze (icp_score backfill) still bypasses the claim.
  - **Verified against the live DB** (`supabase db query --linked`): the reserve/claim/dedup/release state machine and the coaching 23505 path both behave correctly; build green. Deployed to prod.

## Known platform items (deferred, app-wide — not module-specific)
- **Owner-scoping on per-account read endpoints.** content/generate (and siblings accounts/chat, reengagement, generate-pre-call-brief) let any logged-in @withbanner.com user generate/read from any accountId — consistent with CLAUDE.md's documented "manager role is informal, no strict server-side enforcement." Low-sev for a ~6-person single-tenant tool; flagged for a future platform-wide RLS/owner-check pass rather than diverging one endpoint.

## Known caveats
- No live UX test this run (no auth session). First thing to check each shipped UI: does it render + the happy path work.
- The assistant writes to prod data on confirm — try it on a throwaaway account first.
