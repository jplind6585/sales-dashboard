# Platform Audit — Sales Dashboard vs Vision

_Generated 2026-06-27 via 47-agent parallel audit (8 subsystem auditors -> per-claim verification -> synthesis). 3.2M tokens._

## Headline

The platform is far more built than a skeptic would expect — a real call-intelligence engine, a feature-dense Tasks daily-driver, a working deal-risk scorer, and a Supabase-backed lead funnel all exist and run. But it is built FOR James and only honestly delivers for James: auto-tasks, the coaching DM, and the recent-call poller are all hardcoded to one rep, so the moment Mark and the SDRs come on, the engine analyzes their calls but pushes them nothing. It also misses three of its four north-star pillars at the architecture level: there is no Gong webhook (so 'real-time' is polling), the Gong pipeline never writes MEDDICC/stakeholders back to the account (so 'one analysis, four outputs' is really three-and-a-half), and the assistant can write in exactly one place. CS calls silently pollute every coaching/CEO/competitive metric. None of this is a rewrite — the gaps are wiring, governance, and consolidation, not missing foundations.

## Vision Scorecard

| Grade | Pillar | Note |
|---|---|---|
| **C** | AI-first / push-don't-pull | Tasks Focus tab genuinely pushes (morning brief, AI top-3, call commitments, auto-prep tasks). But the engine's pushes are James-only (auto-tasks AUTO_TASK_REP_USER_IDS, coaching DM via James-gated poller) and the fresh-call Slack goes to the manager channel, not the rep's DM. For everyone but James, push silently fails. |
| **D** | Assistant everywhere + action-capable | Only the account-pipeline AISidebar can write, and only to the one selected account. Three other surfaces (ChatTab Deal Advisor, platform-assistant, intel-chat) are read-only. No global/persistent assistant (not in _app.js). The richest-context surface (ChatTab) cannot act; the acting surface has thin context. 'Update these 6 accounts to stage X' is impossible. |
| **C** | Call-intel as the engine (one analysis -> four outputs) | Engine is real and substantial: ingestion, ignore-ledger, fuzzy+HubSpot-email matching, rich Haiku scoring all persist. But it's three-and-a-half outputs: (a) MEDDICC/stakeholder/gap write-back to the account NEVER fires from the Gong pipeline (that logic lives in a disconnected client-side analyze-transcript flow). (b) tasks and (d) coaching are James-only. |
| **F** | Real-time (<30min webhook) | No Gong webhook anywhere. All polling: 15-min GitHub Actions + an hourly Vercel cron mislabeled 'nightly' running FULL 150-day mode every hour. Floor latency ~15min best case, often longer, and only James gets the recent-poll path. T1 (the stated highest-impact feature) is structurally absent. |
| **C** | Coaching 3-layer | L1 mostly wired and L3 module is built (longitudinal metrics, 12-wk sparklines, focus tracker) — NOT empty. But undermined: talk_ratio/call_title field-name bugs null out the prompt and evidence rows; CS calls pollute metrics; coaching DM fires James-only; account name always null on cards; 30-day improvement tracking is localStorage-only. L2 (account-level 'N calls, still no economic buyer') does not exist. |
| **F** | T1 Real-Time Pipeline | Does not exist. No webhook. Highest daily-use-impact feature unbuilt. |
| **C** | T2 Coaching Loop w/ memory | Per-call card generation works and persists to call_coaching_cards (no migration file though); filler-word detection is real. But delivery is James-only, improvement tracking is localStorage, no manager weekly digest of coaching trends, sent_at read/ordered but never written. |
| **D** | T3 Lead-to-Close Engine | Lead Intelligence (Sheets->lead_pipeline, cron-synced, funnel dashboard) is the strong real foundation. But SDR tools (Outbound, Pursuit, Today SDR view) are 100% localStorage — unshared, no manager visibility, no AI. No sourced_by attribution. No auto handoff brief. match-leads writes to columns that don't exist in the migration. meeting_quality_scores table exists but is never touched. |
| **C** | T4 Predictive Deal Risk | Genuinely built: risk_score/risk_factors columns, nightly score-deal-risk cron, manual rescore, badges in Pipeline Overview + CEO Dashboard. But THREE divergent formulas — and the two transcripts-based copies (deal-risk-alerts, intel-risk) read a sparsely-populated table and falsely report 'No calls recorded.' No paired interventions. One number on the badge, a different number in the Slack alert. |
| **F** | T5 Autonomous Outreach Queue | Not built. SDR workflow is entirely manual button-and-form entry; no 7am top-3 ranked queue, no Claude-drafted opener, no approve/edit/skip loop. |
| **C** | Code health / handoff-readiness | Shared apiUtils layer exists and is widely used; .next/node_modules correctly gitignored. But four god-components (tasks.js 3008, call-intelligence.js 2931, today.js 1820, OverviewTab.jsx 1758), a deprecated Sonnet model id as the wrapper default, confirmed dead files, near-zero test coverage (1 test file for 129 endpoints), and a 5-month-stale schema.sql. Risky to hand to a small team as-is. |

## Biggest Gaps (ranked by impact)

### The engine is hardcoded to James — auto-tasks (AUTO_TASK_REP_USER_IDS), the per-call coaching Slack DM (only fires from the James-gated process-recent-calls poller), and the recent-call analysis path all exclude every other rep. Mark/SDRs get analysis rows but zero tasks and zero coaching.
- **Impact:** high · **Effort:** M
- **Why now:** The app is being handed to the team imminently. Right now the 'push, don't pull' promise silently breaks for everyone but James the day they log in. This is the single biggest blocker to the handoff being real.

### CS calls pollute every analytics/coaching surface. call_category='cs' is computed and stored at intel-analyze.js:476 but filtered in ZERO endpoints (rep-coaching, rep-coaching-trend, competitive-analytics, intel-aggregate, ceo-dashboard).
- **Impact:** high · **Effort:** S
- **Why now:** Mark is AE+CS, so his onboarding/QBR calls will drag down his discovery scores, talk ratios and next-step rates — corrupting exactly the coaching numbers that are the data foundation for Layer 3, and the CEO metrics James reports on. One .neq() per query.

### No Gong webhook — T1 real-time pipeline cannot exist on polling. Floor latency is the 15-min GHA poll (James-only, 2h lookback) plus an hourly full-mode Vercel cron.
- **Impact:** high · **Effort:** M
- **Why now:** Vision names real-time post-call as the highest daily-use-impact feature. A webhook receiver that triggers intel-analyze on call-end is the highest-leverage net-new build, and it also fixes the per-rep freshness problem the poller has.

### Output (a) is missing: the Gong pipeline never writes MEDDICC/stakeholders/gaps back to the account. intel-analyze only links account_id and inserts a transcript row; the real extraction lives in a disconnected client-side analyze-transcript flow that persists nothing server-side.
- **Impact:** high · **Effort:** L
- **Why now:** This is the most valuable of the four outputs — keeping each account's MEDDICC/stakeholders current automatically. Reps still rely on the manual paste-and-analyze TranscriptsTab. Closing it is what makes call-intel actually the engine underneath the CRM rather than a sidecar.

### Assistant is neither everywhere nor broadly action-capable. One write surface (AISidebar), scoped to a single selected account; three other surfaces are read-only; nothing is mounted globally in _app.js. 'Update these 6 accounts to stage X' / 'add a task for the team' is impossible.
- **Impact:** high · **Effort:** L
- **Why now:** This is a hard requirement in the vision, not a nice-to-have, and the endgame is conversational-replaces-buttons. The component (AISidebar) and a 16-action write path already exist, so the lift is mounting it globally and broadening the action vocabulary to cross-account + tasks.

### Deal-risk has no single source of truth. score-deal-risk/rescore (DB-persisted, reads gong_call_analyses) vs deal-risk-alerts + intel-risk (read the sparse transcripts table, a different formula) — the nightly Slack alert and the at-risk widget can disagree with the badge on the same account and falsely report 'No calls recorded.'
- **Impact:** med · **Effort:** S
- **Why now:** T4 trust collapses when the number on the deal differs from the number in the alert. Pointing the two alert/widget paths at the stored accounts.risk_score is a small change that makes one number appear everywhere.

### SDR/Outbound/Pursuit are 100% localStorage — per-device, unshared, invisible to the manager, untouched by AI. The Supabase tables to fix this (account_pursuit_lists, account_touches) were migrated but never wired. No sourced_by attribution; no handoff brief.
- **Impact:** med · **Effort:** L
- **Why now:** Contradicts 'this is a team tool' for the entire SDR seat. Lead Intelligence already proves the team-shared Supabase pattern works; the SDR daily tools need to move onto it before SDR adoption is meaningful.

## Cleanup Plan (verified, ROI-ordered)

- **[S effort / low risk]** Add call_category != 'cs' (null-safe) to the five analytics queries: rep-coaching.js, rep-coaching-trend.js, competitive-analytics.js, intel-aggregate.js, ceo-dashboard.js.
  - _Payoff:_ Stops CS/onboarding calls from corrupting every coaching, competitive, and CEO metric — the field is already populated, this is the missing filter.
- **[S effort / low risk]** Fix the rep-coaching field-name bug: read a.rep_talk_ratio (not a.talk_ratio) and the row-level title (not a.call_title) at rep-coaching.js:111,114,191,194.
  - _Payoff:_ Instantly un-nulls talk ratio and call names in the Sonnet coaching prompt and evidence rows — data already exists under the correct key, just mis-read.
- **[S effort / low risk]** Point deal-risk-alerts.js and intel-risk.js at the stored accounts.risk_score (written nightly by score-deal-risk) instead of recomputing a divergent formula on the sparse transcripts table.
  - _Payoff:_ One risk number everywhere; stops the nightly Slack alert and at-risk widget from falsely reporting 'No calls recorded.' Note: move score-deal-risk cron to run BEFORE the 3am alert so it reads a fresh score.
- **[S effort / low risk]** Switch the hourly full-mode nightly-intel Vercel cron to a single daily full run, and add a quick (?quick=1) intraday trigger via the existing 15-min GHA poller. Keep nightly-intel as the importer — it is the ONLY job that imports new Gong calls.
  - _Payoff:_ Eliminates ~23 redundant full 150-day double-sweeps/day (token + compute waste) and their Slack-alert noise, without breaking ingestion.
- **[S effort / low risk]** Add CLAUDE_MODELS constants in lib/constants.js (sonnet/haiku) and replace the deprecated claude-sonnet-4-20250514 default in apiUtils.js:90 plus the 9 hardcoded literals before it 404s in prod.
  - _Payoff:_ A model retirement becomes a one-line edit instead of a hunt across 30+ files; prevents a prod outage on the wrapper default.
- **[S effort / low risk]** Delete confirmed-dead files: parent-dir Vite prototype (../src, ../index.html, ../package.json, ../vite.config.js — back up first, outside git), AssistantModal.jsx, CompanyDetailModal.jsx (V1), lib/seedOutboundData.js, and the bulkImportCompanies function in outboundStorage.js.
  - _Payoff:_ Removes ~1,500+ lines and 31KB of unreferenced code with zero behavior change — verified no importers anywhere.
- **[S effort / low risk]** Delete orphaned NLTaskBar (tasks.js lines 562-820) + its two dead endpoints tasks-nl.js and tasks/voice-create.js. Salvage voice-create's call-context enrichment into debrief.js first.
  - _Payoff:_ Removes a never-rendered component and two unreachable endpoints; DebriefBar already supersedes them with voice support intact.
- **[M effort / med risk]** Delete the dead useAccountsLocalStorage branch in useAccounts.js (~513 lines, the duplicate applyAssistantActions), remove the orphaned executeActions export from commandParser.js, and delete commandParser.js + ManualNoteModal.jsx (both reachable only via the unwired handleManualNote). KEEP parseCommand's source only if still imported — verification found it dead too, so remove handleManualNote in both branches.
  - _Payoff:_ Collapses a split-brain on assistant write-actions to a single source of truth; med risk only because handleManualNote spans the live Supabase hook, so it needs James's nod that offline mode is truly abandoned.
- **[S effort / low risk]** Add an auth guard (createServerSupabaseClient + getUser) to tasks/complete-assist.js — it is the only task endpoint with no auth and it burns Anthropic tokens.
  - _Payoff:_ Closes an unauthenticated token-spending endpoint, matching every other task route.
- **[S effort / low risk]** Fix getSupabase(req,res) misuse in generate-next-actions.js:125 — swap to createServerSupabaseClient(req,res) so the user lookup actually resolves and the generated next-actions persist as tasks (currently silently dropped).
  - _Payoff:_ Revives a silently-dead task-persistence side-effect on the account Overview tab; wrapped in try/catch so it cannot break the primary response.
- **[S effort / low risk]** Make CRON_SECRET mandatory across the 11 crons using the 'if (secret && ...)' bypass, and sync .env.local.example with the ~10 real env vars (remove unused NEXTAUTH_*).
  - _Payoff:_ Closes open token-spending endpoints when CRON_SECRET is unset, and gives the incoming team a correct env reference for the handoff.
- **[M effort / low risk]** Consolidate the verbatim duplicates verification CONFIRMED: getCallType (5 copies) into one helper; the account-matching block (STAGE_PRIORITY/extractCompanyFromTitle/normalizeName/scoreMatch in intel-analyze + match-calls + rep-pulse) into lib/callMatching.js; scoreAccount into lib/dealRisk.js (used by score-deal-risk + rescore); the Gong auto-task helper into lib/tasks/gongTasks.js; STAGE_PROBABILITY local copy in ceo-dashboard.js to import from lib/constants.
  - _Payoff:_ Removes the highest-confidence drift risk before the team starts editing. All verified byte-equivalent or behavior-identical, both/all call sites live — pure extraction.
- **[S effort / low risk]** Add the missing lead_pipeline columns (account_id, match_confidence, match_method) via migration so match-leads.js stops silently failing on update.
  - _Payoff:_ Unblocks the SDR<->account link that is the data foundation for T3 attribution — the matcher already writes these columns, the table just lacks them.
- **[S effort / low risk]** Drop the three never-wired tables (account_pursuit_lists, account_touches, meeting_quality_scores) from the still-PENDING migration 20260509, keeping daily_insights and the rep_type column which ARE used. Re-add fresh when the feature is built.
  - _Payoff:_ Avoids provisioning dead tables + RLS surface area; the migration hasn't been applied yet so this is a clean edit.
- **[S effort / low risk]** Update CLAUDE.md / schema.sql / memory: remove the stale 'no deal monetary values' and '8hr nightly lag' claims (both false — deal_value is live, cron is hourly), regenerate schema.sql from the 12 migrations, and fix the demo-seed description.
  - _Payoff:_ Stops future work from rebuilding what exists or reasoning from a wrong data model — critical for the small-team handoff.

## Path Forward

### Week 1: De-James the engine + stop the metric pollution (handoff-blocking)
_Nothing else matters if the engine only works for one rep and every coaching/CEO number is wrong. These are mostly small, high-impact wiring/governance changes that make the team handoff real and trustworthy. They also unblock honest measurement before any net-new feature is judged._

- Add the CS-call filter (.neq call_category cs) to all five analytics endpoints
- Fix the rep-coaching talk_ratio/call_title field-name bug
- Replace AUTO_TASK_REP_USER_IDS hardcoded map with a profiles/rep-config lookup so Mark + any auto-rep get auto-tasks
- Fire the per-call coaching DM and auto-tasks from process-backlog/nightly-intel (not just the James-only poller) so every analyzed rep gets the loop
- Thread the matched account name into the coaching DM (currently always null) and add a call_coaching_cards migration with sent_at DEFAULT now()
- Route the fresh-call Slack to the rep's own DM, not SLACK_MANAGER_CHANNEL
- Codify rep-filtering (auto/manual/excluded) in one lib/repConfig.js and enforce the excluded list in nightly-intel/process-backlog (currently analyzes everyone)

### Week 1-2: Safe consolidation + dead-code purge (unblocks everything after)
_Do the verified-safe cleanup BEFORE the bigger features so the team isn't editing four copies of the same logic. Every item here was confirmed by the verification pass as dead or behavior-equivalent; the false claims (backfill-* endpoints, VERTICALS, reengagement aggregation) are excluded. Near-zero test coverage means each consolidation should ship with a tiny unit test on representative inputs._

- Delete the confirmed-dead files (Vite prototype, AssistantModal, CompanyDetailModal V1, seedOutboundData, NLTaskBar + its 2 endpoints, useAccountsLocalStorage branch + commandParser + ManualNoteModal)
- Extract the verified verbatim duplicates: getCallType, account-matching (lib/callMatching.js), scoreAccount (lib/dealRisk.js), Gong auto-task helper, ceo-dashboard STAGE_PROBABILITY import
- Add CLAUDE_MODELS constant and kill the deprecated Sonnet-4 default before it 404s
- Fix the latent bugs: complete-assist auth guard, generate-next-actions getSupabase misuse, make CRON_SECRET mandatory, sync .env.local.example
- Point deal-risk-alerts + intel-risk at stored risk_score and stagger the cron so the score is fresh
- Switch hourly full-mode nightly-intel to daily-full + quick-intraday; update docs/schema.sql/memory to current reality

### Week 2-3: Build the real-time spine + close output (a)
_With the engine de-Jamesed and the analytics clean, the two highest-impact architectural gaps become worth building. The webhook is the single biggest daily-use lever (T1); writing MEDDICC/stakeholders back to the account makes call-intel genuinely the engine. These reuse the now-consolidated intel-analyze + matching helpers._

- Build pages/api/gong/webhook — receive Gong call-end, trigger intel-analyze within minutes (T1), with the rep-config governing who gets pushed
- Wire output (a): have intel-analyze (or a follow-on step) write extracted MEDDICC/stakeholders/information_gaps to the account, converging the disconnected analyze-transcript extraction into one server-side path
- Raise/remove the .limit(600) account cap in intel-analyze so inline matching stops silently skipping accounts
- Add coaching triggers as actions: weak discovery -> coach pain, vague/no next-step -> set no_next_step momentum + coach commitment, soft-close -> DQ flag (data is already scored, just not acted on)
- Persist 30-day coaching focus + measured improvement to a DB table (replace the localStorage focus tracker) and add a manager-role gate to the coaching module

### Week 3-4: Assistant everywhere + action-capable
_The component (AISidebar) and a 16-action write path already exist, so 'everywhere' is mostly mounting and 'action-capable' is broadening the vocabulary. This is the vision's hard requirement and the endgame (conversational replaces buttons). Sequenced after the engine work so the assistant has clean data and a real-time substrate to act on._

- Mount a single shared assistant globally (in _app.js or ModulesNav) so it is reachable from every module, not 3
- Give the write-capable assistant the rich per-account context the read-only ChatTab already assembles (call/MEDDIC history); retire the redundant read-only ChatTab on the same page
- Broaden the action vocabulary beyond the single selected account: cross-account bulk stage updates, conversational task creation ('add a task for the team' — createTask already exists), next-step edits on a named deal
- Add the missing action-label preview cases in AISidebar so set_area_priority/add_gap/delete_* show before Apply
- Consolidate the three read-only chat endpoints' shared scaffolding (only intel-chat's raw fetch needs routing through callAnthropic — preserve its temperature)

### Week 4-6: SDR/T3 onto Supabase + lead-to-close attribution
_The weakest-to-vision area, but Lead Intelligence already proves the team-shared pattern. Migrating the SDR daily tools off localStorage and adding sourced_by attribution turns the SDR seat into a real team tool and lights up T3. Lower urgency than the AE-facing engine work, hence later._

- Add the missing lead_pipeline match columns (migration) and the sourced_by field on accounts; auto-set from outbound_company_id / lead_pipeline.sdr at account creation
- Migrate Outbound Engine + Account Pursuit + Today SDR view off localStorage onto the (now scoped) Supabase tables so the manager sees SDR activity and AI can roll it up
- Wire the 'Add Company' button (currently a TODO no-op) so Outbound Engine is usable for a fresh team member
- Build the auto handoff brief on qualifying->intro_scheduled (T3) using the SDR's pursuit hypothesis + outbound notes
- Surface Lead Intelligence loss reasons / show-rate-by-source into the manager weekly brief instead of siloed in one tab
- Decompose the four god-components (tasks.js, call-intelligence.js, today.js, OverviewTab.jsx) opportunistically as these features touch them — not as a standalone refactor sprint

## Verification Notes — DO NOT re-flag these (false positives)

- Five backfill-*.js endpoints (all-calls, historical, metadata, tasks, transcripts) are likely one-time migration code now dead, only referenced by manual workfl
  - Do NOT delete any of the five. backfill-all-calls.js, backfill-transcripts.js, and backfill-tasks.js are bound to live UI buttons in pages/modules/sales-reports/team-dashboard.js (and tasks.js for backfill-tasks) — removing them breaks thos
- Audit and archive obsolete backfill-* endpoints — specifically gong/backfill-transcripts.js (2888b) and backfill-all-calls.js (5226b), described as "likely one-
  - Do not remove or archive either file. Both back live manager-facing buttons in pages/modules/sales-reports/team-dashboard.js ("Link Calls to Accounts" and "Backfill Calls (4 weeks)") and backfill-all-calls.js is registered in vercel.json. R
- Extract shared call-aggregation helper for reengagement endpoints — reengagement.js:51-89 and reengage-bulk.js:42-69 both walk gong_call_analyses aggregating th
  - Do not extract a shared aggregation helper based on this claim — the premise (two near-identical aggregation loops in reengagement.js and reengage-bulk.js) is factually wrong; reengage-bulk.js does no aggregation. The only shareable fragmen

## Needs Human Decision

- Two AI deliverable-draft surfaces with overlapping purpose: WorkInClaude (/api/work-in-claude) and TaskCompleteModal (/api/tasks/complete-assist). Consolidate t
  - Do NOT delete either file as a mechanical cleanup — both are reachable and each owns behavior the other lacks. The correct move (a refactor requiring human sign-off, not an automated cleanup) is to consolidate onto the WorkInClaude engine: 
- Double stage-change task creation: hardcoded STAGE_CHECKLISTS and execute-for-stage playbooks both fire on every stage change. Pick one (playbooks) and delete g
  - Do NOT delete anything as the claim describes. There is no active duplication today (the playbook stage-trigger path is unwired and produces zero tasks because nothing writes task_playbooks.stage_trigger). This is a product/architecture dec
- run-nightly-intel.yml is a manual duplicate trigger of the Vercel cron
  - Do NOT auto-delete. This is a functioning manual (workflow_dispatch) rerun button for the nightly-intel endpoint, with no schedule, so it cannot collide with the hourly Vercel cron and causes no harm sitting there. Deleting it only removes 