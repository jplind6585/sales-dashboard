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

## 🏗️ BUILD-EVERYTHING from PLATFORM_REVIEW (2026-06-29) — wave-based, deploy each after E2E green
James checked ~55 items + cross-team + ROI + M2/M3/M4/M5. **M1 (Apollo) DEFERRED** per his note (scope more; human-in-the-loop / queue-for-SDR-review, not auto-send). Blocked-on-James (code built + flagged): 2.1 Gong secret, 2.9 HubSpot key, 2.6/2.7 Gmail send scope, M2/M4 external APIs+budget.
- **Wave 1 ✅ deployed** (937c5dc): brand tokens (Tailwind+globals+Poppins/Inter+_document), one stage-color system, lib/metrics.js, lib/stageHistory.js, lib/accountMatch.js, lib/moduleRegistry.js, components/ui kit. Migration 20260629_foundation applied (account_stage_history.changed_by; lead_pipeline.account_id/match_confidence/match_method).
- **Wave 2a ✅ deployed** (a12e2ad, 11/11 E2E): fixed verified bugs — Monday exec brief field names (§6.5), Team Dashboard talk-ratio+objections (§6), HubSpot sync records stage moves (§6.1/§8.1).
- **Wave 2b ✅ deployed** (6e49688): assistant grounding — lib/accountContext.js injected into /api/assistant so the write-capable assistant answers from real calls/tasks/MEDDIC (§1.9).
- **Wave 2c ✅ deployed** (d8bb842, 11/11 E2E): **account write-back (North Star output a — 1.8/2.2)**: analyzer now emits meddicc/stakeholders/information_gaps; lib/accountWriteback.js persists them per confidently-linked sales call (MEDDICC merge-safe, stakeholders upsert, gaps dedup) — DB round-trip verified. **Task quality filter (§2.4)**: reject filler + Jaccard-dedup near-identical next-steps/commitments. Fixed nonexistent `is_champion` column usage in new libs + the pre-existing accounts/chat.js (was erroring every request).
- **Wave 2d ✅ deployed** (f1ca96d, 11/11 E2E): CEO Dashboard rebuilt on lib/metrics — open+weighted pipeline in $, per-stage $ bars (coherent colors), quarter forecast, win rate by close_date (§6.4/§6.3). New /api/pipeline/cohort-funnel — true reached→converted + median dwell from account_stage_history (§6.2). New call_script content type (§2.3).
- **Remaining Wave 2:** assistant task/touch actions 2.8/3.10 (touches execute.js write path — do with care/review), prep push 2.5. Deferred to Integrations phase: 2.6 commitment-verify + 2.7 gmail-draft (need Gmail send scope), 2.9 HubSpot write-back (need key), 2.1 (need Gong secret).
- **Wave 3a ✅ deployed** (3c7011b, 12/12 E2E): ⌘K command palette (§3.1) — global fuzzy account/module search via lib/moduleRegistry + /api/search, mounted in _app.
- **Wave 3b ✅ deployed** (cb34a59, 12/12 E2E): nav single-sourced from lib/moduleRegistry (ModulesNav + /modules grid + Sales Reports grid), deleted shadow pages/modules.js (route collision), killed red "Live" pill + rainbow gradients on Sales Reports grid (§1.10/§3.4/§5.7/§5.5/§5.10).
- **Wave 3c ✅ deployed** (032dbdc, 12/12 E2E): Call Queue outcome capture + coral rebrand + removed stale migration copy (§3.5); unified account Timeline tab + /api/accounts/timeline (§1.3).
- **Remaining Wave 3:** tasks toolbar (3.2) + inline task actions (3.3) [tasks.js is 127KB — do carefully], last-call rows (3.7), queue merge into today (1.6/3.8), touch consolidation (1.4/2.10), pursuit/outbound→Supabase (1.7 — needs migration + CRUD), chart fixes on bottleneck/stage-analytics (5.6), broader brand application. **Moving to Wave 4 (coaching/process — greenfield endpoints, lower risk) next, will return to the risky big-file Wave 3 items.**
- **Wave 4a ✅ deployed** (4e07f06, 13/13 E2E): Coaching Lab module — best-call library /api/gong/best-calls (§7.2) + disqualification-discipline queue /api/pipeline/dq-queue (§8.4). Registered in nav.
- **Wave 4b ✅ deployed** (847d296, 13/13 E2E): objection & rebuttal library /api/gong/rebuttals (§7.5) — "Objection playbook" section in Coaching Lab.
- **Remaining Wave 4:** 7.1 coaching-focus persistence+deltas, 7.3 team benchmark deltas (add team avg to rep-coaching), 7.4 AI drills, 8.2 stage-exit gate (touches write paths — care), 8.3 CS handoff, 8.5 cadence SLAs.
- **Wave 5a ✅ deployed** (b7ae2fc, 14/14 E2E): ROI Tracker — initiatives table + /api/initiatives (attributed pipeline/revenue, ROI, CAC) + page. Migration 20260718 applied.
- **Wave 5b ✅ deployed** (a7b3372, 15/15 E2E): cross-team Work Requests — work_requests table + /api/work-requests + page; auto-snapshots account context (lib/accountContext) for the fulfiller.
- **Wave 5c ✅ deployed** (9cc46b2, 15/15 E2E, public flow curl-verified): **Moonshot M5 Living Deal Room** — deal_rooms table (migrated) + /api/deal-room + public /api/public/deal-room + branded /share/deal-room/[token] microsite (engagement views tracked; ROI grounded in account metrics × deck benchmarks via lib/dealValue, qualitative fallback when no data). Gated assistant/palette off /share/* in _app. Content Studio: added call_script type UI + Deal Room create/copy card.
- **Remaining Wave 5 moonshots:** M3 Deal OS nightly cron (NOTE: heavily overlaps existing nightly-deal-insights/score-deal-risk/reengagement-picks — consider consolidation not duplication), M2 gift engine + M4 intent radar (need external APIs/budget — will scaffold + flag, not fully build).
- **Wave 4c ✅ deployed** (6d5af88, 15/15 E2E): AI practice drills /api/gong/drills + "Work on this" section in Coaching Lab (§7.4); coherent coral funnel colors on Bottleneck + Stage Analytics (§5.6).
- **Remaining Wave 4:** 7.1 coaching-focus deltas (needs new table + coaching.js edit), 7.3 benchmark deltas (rep-coaching read), 8.2 stage-exit gate (write-path — care), 8.3 CS handoff (write-path). 8.5 cadence SLA — SKIP as largely redundant with the shipped DQ queue (8.4). **Remaining Wave 3 (risky big files):** tasks toolbar/inline (3.2/3.3 — tasks.js 127KB), pursuit/outbound→Supabase (1.7 — new tables + CRUD rewrite).
- **Wave 3d ✅ deployed** (6790c2a, 15/15 E2E, visually checked): Tasks page — sticky filter toolbar (status + count + select-all) + inline task/account search wired into the filter chain, coral rebrand (§3.2). NOTE for future: tasks.js already had filters, grouped/by-account/focus views, and inline complete/dismiss on TaskRow (§3.3 mostly pre-existing); snooze deferred (needs onSnooze/due-date handler threaded through RepView/ByAccountView/FocusListView). tasks.js header buttons + GlobalAssistant FAB still blue/indigo — broader rebrand pass outstanding (§5.8).
- **~35 of ~61 items + 2 systems + 1 moonshot shipped, all green (commits 937c5dc→6790c2a).** Remaining = needs-James (integrations keys/scopes, M2/M4 budget), redundant (M3, 8.5), or careful big-file work (pursuit/outbound→Supabase 1.7; 7.1 coaching deltas needs new table + coaching.js; 8.2/8.3 write-path).
- **~30 of ~61 items + both scoped systems shipped, all deployed + green (commits 937c5dc→a7b3372).**

## 🔌 INTEGRATIONS PHASE (2026-07-18) — all code built + deployed; 16/16 E2E green; endpoints degrade gracefully (503/428, no 500s)
Research done via workflow (Apollo uses X-Api-Key not Bearer + search-then-enrich + master key; Clay has no REST API = webhook-in + callback-out; Gmail drafts = base64url MIME + gmail.compose; HubSpot deals PATCH + /pipelines/deals for IDs).
- **Health monitor ✅ LIVE** (e4b8fdb + 3a6bfd5): Settings → Integrations widget + /api/integrations/status. Live prod state: Gong ✅(webhook secret unset), **HubSpot ✅ (key valid!)**, Gmail/Calendar ✅(user OAuth), Claude ✅; **Slack shows NOT-configured — SLACK_BOT_TOKEN appears absent from prod env (digests may be silently failing — CHECK)**; Apollo/Clay await keys.
- **HubSpot two-way ✅ LIVE** (3a6bfd5): lib/hubspotPush + /api/hubspot/push-stage + /pipeline-stages; wired into assistant execute.js. Maps 7 stages. **FINDING: HubSpot Sales pipeline has NO intro_scheduled/demo stage — those app-only stages have no HubSpot target and are correctly skipped (nothing for James to set). Real stage IDs pulled + confirmed.**
- **Gmail ✅** (1d0430a): /api/gmail/create-draft (needs gmail.compose scope) + /api/gmail/verify-sent (readonly, for §2.6). "Create draft" button in Content Studio.
- **Apollo ✅** (b5358c3): /api/apollo/search + enrich + import; Prospecting page (human-in-the-loop). Needs APOLLO_API_KEY (MASTER key).
- **Clay ✅** (cdf4757): /api/clay/enrich (→CLAY_WEBHOOK_URL) + /api/clay/callback (Bearer CLAY_CALLBACK_SECRET) + clay_enrichments table. Needs Clay table + webhook URL.
- **Gong webhook** = already built (webhook.js); needs GONG_WEBHOOK_SECRET + Gong rule.
- **JAMES ACTIVATION (env vars in Vercel):** APOLLO_API_KEY (master), CLAY_WEBHOOK_URL (+CLAY_WEBHOOK_AUTH, CLAY_CALLBACK_SECRET), GONG_WEBHOOK_SECRET (+Gong rule), and add Gmail `gmail.compose` scope in Supabase Google provider (users re-auth once). HubSpot already live. Check SLACK_BOT_TOKEN presence.

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
