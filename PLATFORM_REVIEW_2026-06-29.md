# Platform Deep Review — 2026-06-29

A grounded review of the Banner sales dashboard: what to build to tie the data together, cut manual work, look sharper, and give you + the CEO a clear read on the business.

## How to use this doc

Every idea below is a checkbox. **Tick the box** on anything you want built, scribble notes right under it, save, then tell me **"execute the checked items in PLATFORM_REVIEW"** — I'll build them in priority order (build → review → test → deploy, same as always). You can also just say "do section 2 and the moonshot #3 POC."

Each item carries `effort` (S/M/L/XL), `impact` (1-5), and `confidence` (`grounded` = tied to specific code I verified; `speculative` = sound but less certain). Scoped sections (cross-team, ROI tracker) are full build plans, not one-liners.

## How this was produced (so you can trust it)

Not generic advice. I captured **24 live screenshots** of every module (desktop + mobile) and ran **30 analysis agents** across the real code, then adversarially verified every idea references real files/tables/gaps — over-generating and cutting the weak ones so the counts hold up. The full reality map is in [PLATFORM_REVIEW_2026-06-29_brief.md](PLATFORM_REVIEW_2026-06-29_brief.md) — worth a skim; it's the evidence behind everything here.

## Verified reality snapshot (the honest state, today)

- **Navigation is fragmented.** No persistent top nav; four hand-maintained menus that disagree on names/icons/links; `pages/modules.js` (old) and `pages/modules/index.js` (new) **both resolve to `/modules`** (route collision); Activity Leaderboard is reachable only by typing the URL; 5 report pages don't render the Modules menu at all.
- **"Who to call" exists three times.** `call-queue` (real, Supabase-ranked) vs the Today SDR queue vs Pursuit — the last two are localStorage and don't sync. Three touch-loggers write to two backends in incompatible shapes and **overwrite each other**; `sdr_touches` is effectively write-only (no manager ever sees it).
- **Account write-back — the North Star's "output (a)" — is still unbuilt.** The Gong engine emits flat scores but no stakeholders/gaps/MEDDICC. A second, disconnected analyzer (`analyze-transcript.js`) has the rich schema but is hardcoded to "Sunrise Senior Living", has no auth, and persists nothing. `accounts.meddicc` is **read by 9 generators and written by none.**
- **Reporting can't be trusted end-to-end.** Three different "confidence" formulas, 3+ win-rate definitions, 4+ "stale" definitions, two stage orderings. Silent field-name bugs mean Team Dashboard's talk-ratio and top-objections are **permanently blank**, and the **Monday exec brief DM'd to you** reads three wrong field names (rep → "Unknown", talk ratio → 0, title → "untitled"). CEO Dashboard shows **zero dollars** and disagrees with Team Dashboard on stage counts (two sources of truth).
- **Funnel history is structurally incomplete.** The stage-history DB trigger was dropped; only some app paths record moves; the nightly HubSpot sync writes stage via a direct upsert that **bypasses every history writer** — so most real stage transitions are never recorded, and velocity/time-in-stage are unreliable.
- **Content is read-only and nothing sends.** Generated content is never saved (`lib/db/content.js` + the `generated_content` table are dead code); there's no Gmail send anywhere; drafts are copy/paste into a compose window.
- **The assistant is split three ways.** The one that can *write* sees only a single thin account line (can't answer task/call/MEDDICC questions); the one that's *deeply grounded* (account chat) is read-only; a third (AISidebar) is **unauthenticated and can delete accounts** from the browser.
- **Integrations are shallow.** Gong webhook is inert (polling is the real path); HubSpot is inbound-only with no stage write-back (and its API key isn't documented); Gmail/Calendar are read-only; Slack sends/reads but has no interactivity.
- **The UI has no system.** No mobile breakpoints; no list virtualization (Tasks renders a **~150,000px** page); no accent-color or stage-color system; internal engineering text leaks to production ("repName required", "needs the sdr_touches migration", raw event slugs); low-confidence AI filler is surfaced as tasks with heavy duplication.

---

## 1. Tie out the data, connect the modules & make it navigable  <sub>(10 suggestions)</sub>

- [X] **1.1 — Centralize stage/probability + confidence/win-rate/stale definitions in lib/constants.js + a new lib/metrics.js**  `M · impact 5 · grounded`
  - **Problem:** Report numbers don't tie out: three confidence formulas (ceo-dashboard plain-avg of counts, pipeline-overview bonuses capped 95, scorecard $-weighted), 3+ win-rate defs, 4+ stale/at-risk defs with divergent activity sources (gong call_date vs accounts.updated_at vs transcripts), and divergent stage ordering (stage-analytics vs everything else). Worst, CEO vs Team 'Pipeline by stage' literally disagree (Qualifying 66/29/12 vs 63/20/8) — two sources of truth on the same screenful.
  - **Solution:** lib/constants.js is the sole stage vocabulary; a new lib/metrics.js holds the shared metric functions every report surface imports, so the numbers reconcile.
  - **Build:** STAGE_PROBABILITY, STAGE_LABELS, ACTIVE_STAGE_ORDER, ALL_STAGE_ORDER already exist in lib/constants.js — delete the INLINE redeclarations that shadow them: ceo-dashboard.js:10 (STAGE_PROBABILITY) + :16 (STAGE_LABELS), scorecard.js:11 (STAGE_PROBABILITY), team-dashboard.js:142 (STAGE_LABELS), bottleneck.js:30 (STAGE_ORDER), and import from lib/constants.js instead. Add lib/metrics.js exporting computeConfidence(), computeWinRate({window,dateField}), and isStale(account) keyed to a single activity source (gong_call_analyses.call_date). Refactor pipeline-overview.js, ceo-dashboard.js, bottleneck.js, stage-analytics.js, team-dashboard.js, scorecard.js to call them. Standardize CEO win-rate off close_date instead of updated_at while here.
  - **Depends on:** Foundational; feeds the queue (STAGE_POINTS) and funnel reconciliation ideas with one shared stage vocabulary.

- [X] **1.2 — Record HubSpot-driven stage moves into account_stage_history via a shared recordStageChange helper**  `M · impact 4 · grounded`
  - **Problem:** The stage-history DB trigger was dropped (20260515) so history is app-layer only, but hubspot/sync-deals.js writes accounts.stage via a direct .upsert() that bypasses every app-side writer, and reps change stages in HubSpot, not in-app. So the vast majority of real transitions are never recorded — velocityByStage, movedThisWeek, and time-in-stage are unreliable. Separately, assistant/execute.js:69 inserts changed_by: userId, a uuid column no migration ever added (only changed_by_name was, 20260515), and the insert is wrapped in .then(()=>{},()=>{}) so the audit row is silently dropped.
  - **Solution:** One recordStageChange helper called wherever accounts.stage changes, including the nightly HubSpot sync, plus the missing changed_by column.
  - **Build:** Add lib/db/stageHistory.js recordStageChange({accountId,from,to,changedByName,dealValue}) computing days_in_prior_stage. Call it from hubspot/sync-deals.js when STAGE_MAP output differs from the current accounts.stage (before the .upsert()), and refactor the existing app writers (stores/useAccountStore.js:155, components/tabs/OverviewTab.jsx, assistant/execute.js:63-71) onto it. Add a dated migration adding changed_by (uuid) to account_stage_history (table created in 20260513_stage_history.sql) so execute.js stops silently dropping rows.
  - **Depends on:** Feeds the timeline and any real velocity/cohort funnel metric.

- [X] **1.3 — Unified account activity timeline (union API + TimelineTab)**  `L · impact 5 · grounded`
  - **Problem:** There is no account timeline anywhere. Events are scattered across gong_call_analyses, account_stage_history, tasks, notes, sdr_touches (effectively write-only — read only inside /api/sdr/call-queue.js), and hubspot_sync_log. sdr_touches' 'manager-visible' intent is unrealized because nothing surfaces it on an account.
  - **Solution:** One endpoint that unions per-account events into a normalized, date-sorted feed, rendered as a TimelineTab in Account Pipeline and reusable by the assistant.
  - **Build:** Add pages/api/accounts/timeline.js (getSupabase service client) taking account_id and unioning: gong_call_analyses (analyzed_at -> 'call', reuse the ignored=false + call_category CS filter already in pages/api/reports/feed.js:73-79), account_stage_history (changed_at -> 'stage_change', changed_by_name, matching feed.js:50-60), tasks (created_at/completed_at -> 'task'), notes, sdr_touches (touched_at -> 'touch'), hubspot_sync_log (action='note_created'). Normalize to {type,ts,title,actor,source,link}. Add components/tabs/TimelineTab.jsx mounted in account-pipeline.js next to the existing tabs. Reuse the exact event-shaping already in reports/feed.js rather than re-deriving it.
  - **Depends on:** Stronger once touch consolidation and HubSpot stage-history recording land, since those tables feed the feed.

- [X] **1.4 — Consolidate SDR touch logging into sdr_touches, killing the localStorage touch stores**  `M · impact 4 · grounded`
  - **Problem:** Three touch writers, two backends, incompatible shapes: call-queue.js -> Postgres sdr_touches but the UI sends only touchType so outcome is always null; pursuit.js:283 -> localStorage camelCase; today.js:1319 -> localStorage snake_case. Pursuit and Today mutually overwrite the same sdr_touches_today key (field-shape collision touchType/touchedAt vs touch_type/touched_at), and Supabase never syncs with localStorage — so touches are invisible across surfaces and to any manager.
  - **Solution:** All three surfaces write sdr_touches via /api/sdr/log-touch with a full outcome; the localStorage touch keys are removed.
  - **Build:** Extend the call-queue.js LogTouch UI to send outcome (connect/meeting_booked/no_answer) — log-touch.js already inserts account_id, rep_id (from session), touch_type, outcome, notes, touched_at. Rewire pursuit.js:283 and today.js:1319 to POST /api/sdr/log-touch instead of writing pursuit_touches_all / sdr_touches_today. Add a GET read path (extend log-touch.js or add pages/api/sdr/touches.js with ?scope&since) and point today.js loadTouchesToday + DailyTargets counts at it. Remove the stale 'needs migration' fail-soft copy at call-queue.js:169 and log-touch.js:34 (the 20260628_sdr_touches migration is applied).
  - **Depends on:** Feeds the timeline and unlocks the unrealized manager visibility of sdr_touches.

- [X] **1.5 — Reconcile the lead_pipeline funnel with the accounts funnel (add the missing columns, unify the matcher)**  `M · impact 3 · grounded`
  - **Problem:** Two funnels never reconcile — the accounts/HubSpot pipeline vs lead_pipeline (Google-Sheets booked->showed->qualified->won by SDR/AE/year). sheets/match-leads.js:82-105 already writes account_id/match_confidence/match_method to lead_pipeline, but those columns are not in the 20260514_lead_pipeline migration and none was added since, so every .update() fails silently and the two funnels stay unlinked.
  - **Solution:** Add the missing columns so match-leads actually links leads to accounts, consolidate the duplicated fuzzy matcher, and surface the joined funnel.
  - **Build:** Add a dated migration adding account_id (nullable FK->accounts), match_confidence, match_method to lead_pipeline, then confirm sheets/match-leads.js writes land. Consolidate the fuzzy matcher — currently in hubspot/match-calls.js (matchScore/normalizeName/extractCompanyFromTitle/scoreMatch) and the byte-for-byte copy in gong/intel-analyze.js:47-130, plus the calendar matchers — into lib/accountMatch.js so lead->account and call->account matching are consistent. Surface the reconciled view by joining on lead_pipeline.account_id in team-dashboard.js multiYear and lead-intelligence.js.
  - **Depends on:** Uses the shared stage/funnel labels from the centralized-constants idea.

- [X] **1.6 — Merge the three 'who to call' queues into the server-ranked Call Queue**  `M · impact 3 · grounded`
  - **Problem:** Two React components are both literally named CallQueue and disagree: standalone call-queue.js (Supabase composite rank from accounts + gong_call_analyses + sdr_touches, target 20) vs today.js:1398 CallQueue (reads localStorage pursuit_accounts top 10 by manual rank, never calls /api/sdr/call-queue) vs pursuit.js (coverageScore = touches30d/8). Different accounts, backends, ranking, and daily targets — no single answer to 'who do I call next'.
  - **Solution:** A single ranked queue served by /api/sdr/call-queue, embedded in Today and Pursuit.
  - **Build:** Extract the standalone queue into components/CallQueuePanel.jsx driven by /api/sdr/call-queue (scope=mine). Replace the today.js:1398 inner CallQueue and the pursuit.js list with that panel; delete the localStorage-ranked duplicate. While there, align the STAGE_POINTS scoring map at /api/sdr/call-queue.js:26-29 with lib/constants.js — its inactive_sdr_follow_up/inactive_ae_follow_up keys are legitimate (they exist in lib/constants.js:73 INACTIVE_STAGE_IDS), so source the stage list from ALL_STAGE_ORDER so the scoring map can't silently drift from the canonical set.
  - **Depends on:** Depends on the shared touch backend and shared stage set.

- [X] **1.7 — Move Account Pursuit and Outbound Engine off localStorage onto Supabase, linked to accounts.id**  `L · impact 4 · grounded`
  - **Problem:** pursuit.js is 100% localStorage and its hubspotAccountId is written as an empty string, never set or read — a dead link to real accounts. outbound-engine.js keeps companies in localStorage outbound_companies and cannot even add one (Add Company is a TODO stub in two places, :213 and :280). Nothing syncs and nothing is manager-visible.
  - **Solution:** Real tables keyed to accounts so pursuit/outbound entities are first-class, persistent, and cross-linkable.
  - **Build:** Add a dated migration creating pursuit_accounts(account_id FK->accounts nullable, rank, hypothesis, next_touch_type, is_active, added_by) plus outbound_companies + outbound_contacts mirroring the lib/outboundStorage.js shapes. (Note the abandoned account_pursuit_lists/account_touches tables in 20260509_big_build_schema — marked UNRUN, read/written nowhere; supersede rather than reuse them.) Replace lib/storage.js/lib/outboundStorage.js reads in pursuit.js and outbound-engine.js with /api/pursuit and /api/outbound CRUD routes (getSupabase). Populate pursuit_accounts.account_id through the existing bridge (outbound-engine.js:39 handleCreateAccount already carries outbound_company_id). Implement the stubbed Add Company. Retire lib/migrateLocalStorage.js.
  - **Depends on:** Pairs with the queue merge (which then reads one store) and links into the timeline.

- [X] **1.8 — Write MEDDICC back to accounts from the call-intel engine so shared context is populated**  `L · impact 4 · speculative`
  - **Problem:** accounts.meddicc is READ by ~9 generators (Overview summary, generate-follow-up, work-in-claude, generate-next-actions, account-assistant, calendar/prep-brief, accounts/cs-handover, accounts/chat, content/generate, accounts/generate-map) but WRITTEN by nobody: intel-analyze.js emits flat JSON with no meddicc key, the merge in hooks/useAccounts.js:158-161 is a dead no-op (analyze-transcript.js emits no top-level meddicc), and assistant/execute.js never sets it. So the field most account surfaces rely on is always empty.
  - **Solution:** Have the engine synthesize and persist a top-level meddicc object per account from the analyses it already produces.
  - **Build:** The persistence path ALREADY exists — lib/db/accounts.js:243 (transformAccountToDb) and :121 both handle meddicc, so no transform change is needed. The only gap is emission: add a meddicc synthesis step to pages/api/gong/intel-analyze.js (or a small pages/api/gong/intel-meddicc.js run after analyze) mapping the flat fields it already emits (pain_depth_score, champion_health_score, buying_signals, competitor_mentions, next_steps_mentioned, disqualification_signal) into a MEDDICC shape and upserting accounts.meddicc for the matched account_id (via updateAccount, which already persists it). Note: fully converging with analyze-transcript.js's richer schema needs re-extraction, not just wiring — the two prompts are divergent shapes.
  - **Depends on:** Improves the write-capable assistant's grounding once populated.

- [X] **1.9 — Give the write-capable GlobalAssistant the rich account grounding it lacks**  `M · impact 4 · grounded`
  - **Problem:** /api/assistant grounds ONLY on a thin accounts line (name|stage|$value|owner, assistant.js:78-80) plus profiles, so task/call/MEDDICC/risk/stakeholder questions hallucinate. Meanwhile accounts/chat.js is the richest-grounded surface (gong_call_analyses last 15, open tasks, stakeholders, open gaps, notes, account_memory, sales_process_config) but is READ-ONLY. Two brains, no shared code. focusAccount is computed (assistant.js:84) but resolveAccount (:22) ignores it.
  - **Solution:** When context.accountId is present, /api/assistant loads the same context bundle accounts/chat builds, so the one write-capable assistant can also answer from real data.
  - **Build:** Extract the context assembly in accounts/chat.js:26-34 (and the section-building through ~:177) into lib/accountContext.js buildAccountContext(accountId). Call it in pages/api/assistant.js when context.accountId is set and inject it alongside the existing accounts/profiles grounding before the Sonnet call. Make focusAccount actually bias resolveAccount toward context.accountId. Keep all writes flowing through /api/assistant/execute unchanged, and reconcile the action-cap mismatch (resolver .slice(0,25) at assistant.js:141 vs execute .slice(0,30)).
  - **Depends on:** Cleaner once the MEDDICC write-back populates accounts.meddicc.

- [X] **1.10 — Single-source module registry; delete the duplicate /modules page**  `M · impact 4 · grounded`
  - **Problem:** Navigation is assembled from independent, disagreeing hand-maintained lists: ModulesNav QUICK_MODULES (13 entries, ModulesNav.jsx:9-21), pages/modules/index.js MODULES grid (14), sales-reports/index.js REPORTS grid (8), plus the shadow pages/modules.js that collides on /modules, carries dead href:'#' cards, and is the sole caller of the orphaned /api/platform-assistant. Stage Analytics is dropdown-only, Activity Leaderboard is fully unlinked, and labels/icons drift (Send vs Target for Pursuit).
  - **Solution:** One registry describing every module (label, icon, href, group, status, dropdown-vs-grid), all nav surfaces render from it; delete the shadow page.
  - **Build:** Add lib/moduleRegistry.js exporting {key,label,icon,href,group,status,nav,grid}. Refactor components/layout/ModulesNav.jsx to drop hardcoded QUICK_MODULES, and pages/modules/index.js + pages/modules/sales-reports/index.js to map over it. Delete pages/modules.js (kills the 'Duplicate page /modules' warning, the dead href:'#' cards, and its dependency on /api/platform-assistant — grep confirms modules.js:233 is that endpoint's only caller). Add the missing entries: stage-analytics, activity-leaderboard, outbound-engine, data-quality, sales-processes, settings, and the 5 report pages that render no ModulesNav (team-dashboard, call-intelligence, lead-intelligence, data-validation, hubspot-audit).
  - **Depends on:** None; single source of truth for module inventory.

---

## 2. More high-quality conversations, less manual work (SDRs & AEs)  <sub>(10 ideas)</sub>

- [X] **2.1 — Turn on the inert Gong webhook and widen auto-processing so ALL reps get real-time tasks/coaching/prep**  `M · impact 5 · grounded`
  - **Problem:** webhook.js is fully built but INERT: it 503s unless BOTH GONG_WEBHOOK_SECRET and CRON_SECRET are set (webhook.js:53-54), and nothing calls it. The live path is */15 polling in cron/process-recent-calls.js, gated by isAutoProcessRep = James-only (process-recent-calls.js:98). Every other rep's calls sit with hour-to-nightly latency before auto-tasks/coaching/prep even attempt to fire, so reps do manual catch-up the engine could have done minutes after the call.
  - **Solution:** Activate the webhook and expand the auto-process roster so the whole team gets same-day auto-generated tasks, per-call coaching DMs, and prep material.
  - **Build:** Set GONG_WEBHOOK_SECRET (CRON_SECRET already set) in Vercel and register a Gong webhook rule pointing at pages/api/gong/webhook.js. It already imports users, runs isExcludedRep filter, marks <120s calls no_show, imports to gong_call_analyses without clobbering analyzed_at, inline-analyzes up to MAX_INLINE_ANALYZE=4 (webhook.js:23), and overflows to process-backlog. Expand AUTO_PROCESS_REPS in lib/repConfig.js beyond James while keeping EXCLUDED_REPS as the CS guard. Change the gate in cron/process-recent-calls.js:98 from isAutoProcessRep to the same expanded roster so polling covers the same reps as a webhook fallback.
  - **Depends on:** Needs GONG_WEBHOOK_SECRET + a Gong-side rule registration. Amplifies ideas A, C, D, J (more reps = more calls flowing through the engine).

- [X] **2.2 — Auto-fire the account write-back so reps stop hand-entering MEDDICC, stakeholders, and gaps after every call**  `L · impact 5 · grounded`
  - **Problem:** The engine's North Star output (a) is confirmed UNBUILT: grep shows intel-analyze.js emits flat JSON with NO stakeholders/information_gaps/meddicc keys, so every automated call analysis leaves reps to manually type stakeholders, gaps, and MEDDICC into Account Pipeline. accounts.meddicc is write-orphaned via a dead merge at hooks/useAccounts.js:159-160 (analysis.meddicc || {} where the analyzer emits no such key), and the rich analyze-transcript.js only runs on manual paste.
  - **Solution:** Make the engine populate the account record automatically from every confidently-linked call, eliminating manual CRM data entry.
  - **Build:** Extend the Haiku prompt in pages/api/gong/intel-analyze.js (flat JSON block ~lines 473-505) to also emit stakeholders[], information_gaps[], and a top-level meddicc{} object. In the persist step call lib/db/stakeholders.js and lib/db/gaps.js keyed on gong_call_analyses.account_id, and write accounts.meddicc. Fix transformAccountToDb in lib/db/accounts.js to add a meddicc branch (currently missing) or upsert via the raw service-role client the way assistant/execute.js does. Remove the dead merge at hooks/useAccounts.js:159-160. Gate all write-back on gong_call_analyses.match_confidence so only confidently-linked calls mutate the account.
  - **Depends on:** Requires account_id linkage (present via enrich-calls-bulk/match-calls). Pairs with idea H so it fires for all reps, not just James.

- [X] **2.3 — Generate account-grounded call scripts / talk tracks so reps walk into the call prepared, not improvising**  `S · impact 4 · grounded`
  - **Problem:** Call Queue's only AI value is a follow-up EMAIL draft (fetchDraft in call-queue.js reuses type:'follow_up_email'). There is no call script or talk track anywhere in the platform, so reps improvise or prep manually before dialing — directly against the goal of auto-preparing the human for the conversation.
  - **Solution:** Add a 'call_script' content type that produces a per-account talk track grounded in that account's actual Gong calls, MEDDICC, stage, and prior objections.
  - **Build:** In pages/api/content/generate.js add 'call_script' to the type map (currently the 6 types at lines 14-34) with a temperature entry in TEMP (line 41). The route already pulls accounts (stage, vertical, tier, deal_value), reads accounts.meddicc (line 54), pulls gong_call_analyses (last 8, CS-filtered), and getSalesProcessConfig() — reuse that grounding with a new Sonnet prompt that outputs an opener, discovery questions targeting the loaded analysis.discovery_gaps[] (and the information_gaps table once idea A populates it), objection rebuttals from prior analysis.objections[].text, and a next-step ask. Surface it in call-queue.js next to the existing Draft pill as a 'Talk track' button, opened before the rep dials.
  - **Depends on:** Reuses the existing content/generate grounding pipeline. Stronger once idea A fills gaps/MEDDICC.

- [X] **2.4 — Quality-filter and semantically dedup auto-tasks so reps stop triaging transcript filler**  `M · impact 4 · grounded`
  - **Problem:** The auto-task pipeline surfaces hundreds of filler fragments as tasks ('I'll show you everything', 'I'll follow up', 'I'll share the deck') and massive near-duplicate variants ('Rep will check with Elena on timing' ~8x). Tasks renders as a single flat ~93k-151k px unpaginated list with no account name or due date on cards, so reps spend real time sifting and deleting instead of acting.
  - **Solution:** Add a confidence/quality gate and cross-account semantic dedup at task-creation time so only real, distinct commitments become tasks.
  - **Build:** In autoCreateTasksFromAnalysis (pages/api/gong/intel-analyze.js, starts line 182) add a length/specificity filter and drop generic phrases before insert; extend dedup beyond the current .ilike('description','%callId%') (line 209) to a normalized-text/word-overlap check across the account's open tasks. Apply the same filter in tasks/call-commitments.js. Align tasks/bulk-from-calls.js to set source_type + ai_draft (it currently sets neither, so its tasks evade the call-commitments dedup and render as blank drafts). Surface account_name and due_date on the task cards in tasks.js so triage is faster.
  - **Depends on:** None hard; complements idea H (more reps = more volume to keep clean).

- [X] **2.5 — Pre-generate and push the meeting prep brief before the call instead of on manual click**  `M · impact 4 · grounded`
  - **Problem:** calendar/prep-brief.js already builds a Sonnet prep brief from the last 3 gong_call_analyses + stakeholders + account_memory, but it only runs when a human clicks 'AI Brief' in tasks.js or opens today.js PrepBriefModal. calendar/upcoming.js already flags events with needsPrep, but nothing acts on that flag, so reps still open the app and manually request prep before each meeting.
  - **Solution:** When upcoming events load with the user's calendar token, auto-generate the prep brief for needsPrep events and push it so it is waiting for the rep.
  - **Build:** Extract prep-brief.js scoring/generation into a shared lib function so both routes use it (avoids a token problem since upcoming.js already holds the Google token in-session). In calendar/upcoming.js, for each event where needsPrep is set, fire-and-forget that shared function. Cache the result into a tasks row (ai_draft, type='triggered', trigger='meeting_prep') — prefer this over account_memory, which is referenced in code but has no CREATE migration. Then DM the rep via lib/slack.js sendSlackMessage using profiles.slack_user_id when the meeting is inside N hours, and render it in today.js PrepBriefModal without a click.
  - **Depends on:** Refactor prep-brief.js into a shared lib. Needs profiles.slack_user_id and SLACK_BOT_TOKEN (missing locally).

- [X] **2.6 — Verify Gong commitments against Gmail sent + Calendar to auto-close follow-through tasks**  `M · impact 4 · grounded`
  - **Problem:** The brief flags 'no commitment verification (check sent folder for Gong follow-through unbuilt)' and 'meeting booked? verification unbuilt.' Commitments are already extracted into tasks (source_type='gong_commitment','gong_next_step'), but reps must manually mark them done after they send the email or book the meeting — pure logging overhead that leaves follow-through invisible.
  - **Solution:** Automatically match open commitment tasks to sent emails and created calendar events, then auto-complete or nudge, so reps stop manually closing tasks.
  - **Build:** Add pages/api/tasks/verify-commitments.js that loads open tasks where source_type in (gong_commitment, gong_next_step), then uses the in-session Gmail token (already threaded through SmartSuggestionsPanel/gmail/suggestions.js) to scan the sent folder and the calendar/upcoming.js payload for matching stakeholder emails/subjects. On a confident match, PATCH the task complete via tasks/[id].js (which already fires a HubSpot note on complete). On no match past the due date, set the task's momentum column to stale. Trigger it from the same client-side load that already passes the Gmail token.
  - **Depends on:** Gmail read token (exists); matching benefits from idea A populating stakeholder emails.

- [X] **2.7 — Create a real Gmail draft and attach it to the touch record so email is one click, not copy/paste**  `M · impact 4 · grounded`
  - **Problem:** Gmail is read-only (no send/drafts anywhere). Content Studio and Call Queue generate account-grounded drafts but 'Open in Gmail' (call-queue.js:78, content.js:83) only builds a mail.google.com compose URL — manual paste, and bodies over ~1800 chars are silently truncated (body.slice(0,1800) at call-queue.js:78). The draft is never attached to the sdr_touches record (no content column), so the rep re-does the work and loses the artifact.
  - **Solution:** Create the email as a real Gmail draft via API and store it on the touch, so the rep reviews-and-sends instead of retyping.
  - **Build:** Add pages/api/gmail/draft.js mirroring the token pattern in gmail/suggestions.js but ADD real getUser auth (suggestions.js has none) and request the gmail.compose scope (currently only gmail.readonly). Add a content/draft_content column to sdr_touches (new migration). Rewire the 'Open in Gmail' buttons at call-queue.js:78 and content.js:83 to POST the generated body to gmail/draft.js and persist it onto the sdr_touches row via /api/sdr/log-touch.
  - **Depends on:** OAuth scope upgrade (gmail.readonly -> gmail.compose). Feeds idea F (commitment verification) and idea L (touch logging).

- [X] **2.8 — Give the GlobalAssistant real task/touch actions and the grounding to fire them**  `L · impact 4 · grounded`
  - **Problem:** The write-capable GlobalAssistant (Cmd+J, mounted everywhere) is grounding-starved — assistant.js loads only accounts (line 71) + profiles (line 72), one thin line per account, and can't complete/dismiss tasks, log touches, or generate content. The deeply-grounded accounts/chat can see calls/tasks/stakeholders/gaps/MEDDICC but is read-only. So the one assistant reps reach from any screen can't actually take manual work off their plate.
  - **Solution:** Expand the global assistant's grounding to tasks + recent calls and add action verbs so reps can offload clicks by asking.
  - **Build:** In pages/api/assistant.js load open tasks and recent gong_call_analyses into context (today it loads only accounts + profiles at lines 71-72). Add verbs complete_task, dismiss_task, log_touch, and generate_content, and implement them in pages/api/assistant/execute.js by reusing tasks/[id].js (complete/dismiss), sdr/log-touch, and content/generate under the same ownership guardrails. Fix the action-cap mismatch (resolver .slice(0,25) at assistant.js:141 vs execute .slice(0,30) at execute.js:36) with a shared constant.
  - **Depends on:** Should converge grounding with accounts/chat to avoid a fourth divergent brain.

- [X] **2.9 — HubSpot two-way write-back so an in-app stage/deal edit posts back and is recorded in history**  `L · impact 5 · grounded`
  - **Problem:** HubSpot is one-directional inbound + notes-only write-back; the brief flags 'no stage/deal/amount property write-back.' Worse, nightly sync-deals.js overwrites accounts.stage via a direct .upsert() that bypasses every stage-history writer, so in-app moves can be clobbered and real transitions are never recorded — poisoning funnel/velocity analytics.
  - **Solution:** Push stage/amount/close-date changes from the app back to the HubSpot deal and record the transition in history, making the app the single place a rep updates a deal.
  - **Build:** Add pages/api/hubspot/update-deal.js that PATCHes deal properties (dealstage, amount, closedate) using HUBSPOT_API_KEY and the inverse of STAGE_MAP defined in hubspot/sync-deals.js. Call it from the update_account_stage / update_account_field handlers in pages/api/assistant/execute.js and from the useAccountStore stage-change path (useAccountStore.js:155). Also auto-post a call-summary note via the existing hubspot/log-note.js when intel-analyze.js finishes a new analysis, so call notes stop being manual. Ensure the stage-change path records account_stage_history to fix the sync-deals bypass.
  - **Depends on:** HUBSPOT_API_KEY is undocumented and missing locally (all HubSpot routes 500 locally) — must be provisioned first.

- [X] **2.10 — Unify touch logging to one server store and auto-log touches from calls and emails**  `L · impact 4 · grounded`
  - **Problem:** Three touch writers across two backends with incompatible shapes (Call Queue -> Supabase sdr_touches; Pursuit -> localStorage camelCase; Today -> localStorage snake_case) mutually overwrite the shared sdr_touches_today key. Call Queue's logTouch sends only touchType (call-queue.js:60-68) so outcome is always null (connect/meeting-booked never captured), and sdr_touches is effectively write-only with no manager view. Reps log the same touch multiple ways and it still can't be trusted or seen.
  - **Solution:** Make sdr_touches the single source, capture outcome, and auto-create a touch whenever a call is analyzed or an email is drafted so manual logging shrinks.
  - **Build:** Point today.js CallQueue and pursuit.js at /api/sdr/log-touch (Postgres) instead of localStorage, killing the sdr_touches_today collision. Fix call-queue.js logTouch (lines 60-68) to send outcome via added buttons (connect / no-answer / meeting-booked) into the existing sdr_touches.outcome column. Auto-insert an sdr_touch from pages/api/gong/intel-analyze.js when a call is analyzed and from the Gmail draft path (idea B) so calls/emails self-log. Add a manager read surface (e.g. in pipeline-overview.js) querying sdr_touches so the 'manager-visible' intent is realized. Remove the stale 'needs migration' messaging at call-queue.js:169 and log-touch.js:34.
  - **Depends on:** Depends on idea B for email auto-log; overlaps idea C's queue surface.

---

## 3. Make the interface easier to use  <sub>(10 things)</sub>

- [X] **3.1 — ⌘K command palette: fuzzy-search accounts and jump to any module**  `M · impact 5 · grounded`
  - **Problem:** There is no global search anywhere. To open an account you must land on account-pipeline.js and hunt its left rail; to reach a module you cross four disagreeing nav surfaces (ModulesNav 13 links, /modules grid 14 cards, reports grid 8, plus per-page back buttons). stage-analytics.js is reachable only via the dropdown and activity-leaderboard.js is fully unlinked. The only global shortcut is GlobalAssistant's ⌘J.
  - **Solution:** A ⌘K palette that instantly filters accounts by name and every module/report by label, then on Enter navigates (account -> /modules/account-pipeline?account=<id>; module -> its route). Turns a multi-click hunt into two keystrokes and makes orphaned modules reachable.
  - **Build:** Add components/layout/CommandPalette.jsx and mount it in pages/_app.js:28 right beside <GlobalAssistant/> inside <AuthGuard>; bind ⌘K with the same metaKey||ctrlKey guard GlobalAssistant.jsx uses (~:35), and reuse its useRouter (already imported, GlobalAssistant.jsx:2) via router.push. Source accounts from the already-loaded useAccountStore accounts array (client fields id, name, stage, ownerName from transformAccountFromDb) so no new API. Source module rows from the registry in the module-registry idea (or, meanwhile, inline the union of ModulesNav QUICK_MODULES + pages/modules/index.js MODULES + sales-reports/index.js REPORTS). Optionally add a 'calls' section backed by existing /api/gong/call-search.
  - **Depends on:** Best paired with the module-registry idea for a clean module list.

- [X] **3.2 — Tasks: sticky filter / sort / search / group-by-account toolbar**  `M · impact 5 · grounded`
  - **Problem:** tasks.js (127 KB) renders ~1000 cards as a single flat ungrouped list (151,909px on mobile / 93,167px desktop) with no filter, sort, search, or counts, and the top controls scroll away and never return. Finding one task is impossible.
  - **Solution:** A sticky toolbar with free-text search, filters (source_type, priority, account/owner), a sort control (due date, momentum, priority), and collapsible group-by-account sections with counts — all operating on the already-fetched /api/tasks payload.
  - **Build:** In pages/modules/tasks.js wrap the list in a position:sticky;top:0 toolbar, add client-side useState for query/filter/sort, and derive a filtered+grouped view from the existing tasks array. Filter fields exist on the task shape: source_type (values 'gong_commitment' / 'gong_next_step'; note 'assistant' is carried on the separate `source` column, not source_type), priority, account, due_date, momentum. No API change. Combine with windowed rendering to kill the 93k-151k px scroll.
  - **Depends on:** Hosts the toggle from the task de-noise idea.

- [X] **3.3 — Inline complete / dismiss / snooze on every task card (Tasks + Today)**  `S · impact 4 · grounded`
  - **Problem:** Task cards expose only a low-affordance 'open' chevron that hides content; completing or dismissing requires opening the card even though the endpoints already exist. Reps do this dozens of times a day.
  - **Solution:** Three always-visible row actions — Done, Dismiss, Snooze (push due_date +1d/+1wk) — that mutate in place and update the list without navigation.
  - **Build:** Add row buttons in pages/modules/tasks.js and the today.js Today's Tasks list. Complete + snooze = PATCH /api/tasks/[id] (handler at :37; complete already fires the fire-and-forget HubSpot note at :58-83, snooze is just a due_date update). Dismiss = POST /api/tasks/[id] (handler at :101) which calls dismissTask (lib/db/tasks.js:241 -> sets dismissed_at + inserts task_dismissals at :247-248). After each call dispatch the existing tasks:refresh event; note only tasks.js:2185 currently listens, so Today's list must re-fetch locally (today.js does not listen).

- [x] **3.4 — Single-source module registry + persistent top nav; delete the duplicate /modules route**  `M · impact 4 · grounded`
  - **Problem:** pages/modules.js and pages/modules/index.js BOTH resolve to /modules (Next.js duplicate-page collision); the older modules.js often wins and contains dead href:'#' cards ('Rep Coaching' :86-89, 'RFP' :116-119), a stale label ('Account Management' :26), and an orphaned help chat (/api/platform-assistant :233). Three hardcoded nav lists disagree on inventory/labels/icons; ModulesNav omits Outbound/Data Quality/Sales Processes/Settings, the grid omits Stage Analytics/Command Center/Call Registry, and activity-leaderboard is unreachable.
  - **Solution:** One typed registry as the source of truth for every module/report (route, label, icon, group, status), consumed by all nav surfaces so nothing is unreachable and labels never drift; delete pages/modules.js to end the route collision and dead links.
  - **Build:** Create lib/modules.js exporting an array of {key,label,icon,href,group,status}. Refactor components/layout/ModulesNav.jsx (QUICK_MODULES), pages/modules/index.js (MODULES) and pages/modules/sales-reports/index.js (REPORTS) to render from it. Delete pages/modules.js (removes the collision, the two href:'#' cards, and the orphaned /api/platform-assistant chat). Add stage-analytics.js and activity-leaderboard.js entries so both become reachable.
  - **Depends on:** Feeds the module list to the ⌘K palette idea.

- [x] **3.5 — Call Queue: inline outcome capture + real X/20 progress bar + default to 20**  `M · impact 4 · grounded`
  - **Problem:** Call Queue logs touches but the client logTouch (call-queue.js:60-68) sends only {accountId, touchType} in the body (:64), so every sdr_touches row gets outcome=null — connect and meeting-booked are never captured though /api/sdr/log-touch accepts an outcome. '0/20 touches' is plain text, the list shows 40 rows (slice 0,40) against a goal of 20, and a stale 'needs the sdr_touches migration' footer (call-queue.js:169) plus its 503 twin (log-touch.js:34) still show though the migration is applied.
  - **Solution:** Per-row quick-outcome buttons (No answer / Connected / Meeting booked), a real X/20 progress bar, a default slice of 20 with 'show more', and removal of the stale migration messaging.
  - **Build:** In pages/modules/call-queue.js extend logTouch (:60) to pass outcome in the POST body (:64) to pages/api/sdr/log-touch.js (which already inserts account_id, rep_id from session, touch_type, outcome, notes, touched_at). Render a progress bar from data.touchesToday + extraTouches (already computed at call-queue.js:82). slice(0,20) with an expand control. Delete the footer string at call-queue.js:169 and the 503 fail-soft copy at log-touch.js:34.

- [x] **3.6 — Task de-noise: client-side dedup of near-identical AI tasks + 'hide low-signal' toggle**  `M · impact 4 · grounded`
  - **Problem:** The task surfaces are flooded with transcript filler fragments ('I'll follow up', 'I'll share the deck') and massive near-duplicates ('Rep will check with Elena on timing…' ~8 variants; 'Rep will keep Todd posted…' 5+x). Priority is saturated ('High' everywhere, '70-73d overdue' on nearly all), so the list is dead as a signal.
  - **Solution:** Collapse near-identical tasks into a single grouped card and offer a 'Hide low-signal' toggle that suppresses very short gong_next_step fragments — cutting the visible list to what's actionable now, ahead of any engine-side dedup fix.
  - **Build:** In pages/modules/tasks.js add a client-side dedup pass reusing the word-overlap clustering already implemented in pages/api/tasks/bulk-from-calls.js:76-79 (words length>3, count shared matches) to group descriptions, plus a length/heuristic filter keyed on source_type='gong_next_step'. Purely a view layer over the existing /api/tasks data. The engine's missing dedup is the root cause, but this makes the current list usable immediately.
  - **Depends on:** Toggle lives in the Tasks toolbar idea.

- [x] **3.7 — Inline 'last call' summary on Today and Call Queue rows**  `M · impact 4 · grounded`
  - **Problem:** To see what happened on an account's most recent call a rep must leave Today/Call Queue, open Account Pipeline, and read a tab — even though the intel engine already stored analysis.summary, sentiment, and next_steps_mentioned per call in gong_call_analyses. Call Queue rows even bury the ICP score that ranked them in gray subtext.
  - **Solution:** An expandable row that shows the latest call's one-line summary, sentiment, and next steps inline, so reps triage without context-switching — directly exploiting the call-intel engine's existing output.
  - **Build:** In pages/modules/call-queue.js and pages/modules/today.js add an expand toggle that reads the latest gong_call_analyses.analysis for the account. Call Queue already loads gong_call_analyses; Today can hit the existing /api/gong/account-calls.js (confirmed present) or reuse calendar/prep-brief.js's last-3-calls pull. Render analysis.summary + sentiment + next_steps_mentioned. No engine work; all fields already emitted by intel-analyze.js.

- [x] **3.8 — Reconcile the two conflicting 'who to call' queues into one server-ranked list**  `M · impact 4 · grounded`
  - **Problem:** Two 'who to call' surfaces disagree: the real-data Call Queue (call-queue.js -> /api/sdr/call-queue, Supabase-ranked from accounts + gong_call_analyses, logs to sdr_touches, target 20) and today.js's inner CallQueue component (:1398) which reads localStorage pursuit_accounts top-10 by manual rank (:1404) and never calls /api/sdr/call-queue. Two React components are both named CallQueue with different accounts, ranking, and daily target — a rep sees two different 'next call' lists.
  - **Solution:** Make Today's CallQueue call the real /api/sdr/call-queue (server-ranked) so both surfaces show the same ordered list, and label the ranking basis so reps trust it — one queue, one source.
  - **Build:** Rewire the today.js inner CallQueue (:1398) to fetch /api/sdr/call-queue?scope=mine (the same endpoint call-queue.js uses) instead of reading localStorage pursuit_accounts (:1404), and reuse the row + inline-outcome component from the Call Queue outcome idea. Keep touch logging on Postgres sdr_touches via /api/sdr/log-touch so Today and Call Queue stop diverging.
  - **Depends on:** Shares the row/outcome component with the Call Queue outcome-capture idea.

- [x] **3.9 — Standardized Empty / Loading / Error state components adopted across screens**  `M · impact 4 · grounded`
  - **Problem:** State handling is uneven and often reads as broken: Command Center and Call Intelligence show plain 'Loading…' text with blank halves (no shimmer); Pipeline Overview's skeleton bars sit as the resting state and look broken; Account Pipeline uses a warning/error-circle icon for the neutral 'Select an account' prompt. Pursuit's empty state (icon + headline + one-line + single CTA) is the one good pattern.
  - **Solution:** A shared trio — EmptyState, LoadingSkeleton (shimmer), ErrorState (retry) — modeled on the Pursuit pattern, adopted so every screen communicates its state clearly instead of looking half-loaded.
  - **Build:** Add components/states/{EmptyState,LoadingSkeleton,ErrorState}.jsx. Replace the plain 'Loading…' branches in pages/modules/sales-reports/command-center.js and call-intelligence.js, the resting skeleton in pipeline-overview.js, and the wrong-icon prompt in account-pipeline.js's detail pane. Keep Pursuit and Team Dashboard's Multi-Year funnel empty state as the reference implementations.

- [x] **3.10 — Let GlobalAssistant complete/dismiss tasks and navigate — act from anywhere**  `M · impact 4 · grounded`
  - **Problem:** The write-capable GlobalAssistant (⌘J, mounted on every authed page via _app.js:28) has only 4 verbs (update_account_stage/update_account_field/create_task/add_account_note) and cannot complete or dismiss tasks or navigate; users must leave whatever they're doing, find the Tasks/Modules screen, and click.
  - **Solution:** Add complete_task, dismiss_task, and a client-only navigate verb so a user can say 'mark the Avanath follow-up done' or 'take me to Call Queue' from any screen — cutting cross-screen trips.
  - **Build:** In pages/api/assistant.js load the user's open tasks into grounding (currently only accounts at :71 and profiles at :72) and emit complete_task/dismiss_task actions; add a client-only navigate action. In pages/api/assistant/execute.js add handlers reusing lib/db/tasks.js (complete = updateTask status='complete' as in tasks/[id].js PATCH; dismiss = dismissTask -> task_dismissals + dismissed_at) behind the existing canTouchAccount ownership guard, and reuse the existing findTaskBySource idempotency. Handle navigate in GlobalAssistant.jsx apply() (:72) via the already-imported router (GlobalAssistant.jsx:2/:14). apply() already dispatches accounts:refresh + tasks:refresh (:89-90).

---

## 4. Cross-team collaboration — request content from design, custom demos from the SE  <sub>(full scope)</sub>

> **In one line:** Scoped "Work Requests" cross-team collaboration feature: a rep raises a request (new content / custom demo) that auto-snapshots the full account brief (calls, MEDDICC, stakeholders, ICP score, stage/value, recent activity) so the designer/SE receives everything with zero re-keying. New collab_requests table + buildAccountBrief lib (forked from calendar/prep-brief), a fulfiller work item reusing the tasks engine (source='collab_request'), fulfillment in a pre-grounded Content Studio / generate-demo-brief, delivery persisted to the orphaned generated_content table, and Slack DM routing via lib/slack.js. Raised from Account Pipeline, Content Studio, or conversationally through the assistant (new create_collab_request verb on the execute.js authority boundary). Roles via profiles.rep_type widened to designer/sales_engineer.

- [x] Build the MVP of this

## Cross-Team Collaboration — "Work Requests"

A rep asks a non-sales teammate for work (new content from the designer, a custom demo from the sales engineer). Today that happens in Slack/DMs and the fulfiller has to go dig up the account — which calls happened, who the stakeholders are, what stage the deal is, what the ICP fit is. This feature makes the **request a first-class object** that carries an **auto-assembled account brief** so the fulfiller opens their work already grounded in every relevant fact, and delivers back into the same system.

The design deliberately rides rails that already exist: the **task engine** for the fulfiller's work item, **Content Studio / generate-demo-brief** for fulfillment, the **assistant execute boundary** for conversational raising, **lib/slack.js** for notifications, and the **orphaned `generated_content` table** for delivery persistence (finally wiring dead code).

---

### 1. Problem

- Cross-team asks live in Slack threads and DMs with no state, no deadline, no ownership, and no link back to the deal.
- The fulfiller (designer/SE) re-keys context by hand: opens HubSpot/Gong, reads calls, asks "who's the champion again?", "what stage?", "how big is this deal?". This is exactly the busywork the North Star ("push, don't pull") exists to kill.
- Delivered work (a one-pager, a demo brief) is copy-pasted back and never attached to the account, so it's invisible to the pipeline and can't be reused.
- The assistant can create tasks but has no vocabulary for "ask the designer for X."

**Goal:** raising a request takes one sentence or one button; the fulfiller receives the complete account picture automatically; the artifact lands back on the account.

---

### 2. Proposed data model

Grounded in the real schema (`accounts`, `tasks`, `gong_call_analyses`, `profiles`, `generated_content`). One new table, one thin event table (full build), one column widen.

#### New table `collab_requests`
```sql
-- supabase/migrations/20260718_collab_requests.sql
CREATE TABLE IF NOT EXISTS public.collab_requests (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_type   text NOT NULL,           -- 'content' | 'custom_demo' | 'one_pager' | 'deck' | 'rfp' | 'custom'
  content_type   text,                    -- when request_type='content', a Content Studio type id (follow_up_email, one_pager, business_case, …) so fulfillment deep-links straight in
  title          text NOT NULL,
  details        text,                    -- the rep's free-text ask
  account_id     uuid REFERENCES public.accounts ON DELETE SET NULL,
  requested_by   uuid REFERENCES auth.users ON DELETE SET NULL,   -- the rep
  assigned_to    uuid REFERENCES auth.users ON DELETE SET NULL,   -- the specific fulfiller (nullable → routes to a pool)
  fulfiller_role text NOT NULL DEFAULT 'designer',                -- 'designer' | 'sales_engineer' | 'manager' — routing pool when unassigned
  status         text NOT NULL DEFAULT 'requested'
                 CHECK (status IN ('requested','acknowledged','in_progress','blocked','delivered','accepted','changes_requested','cancelled')),
  priority       integer NOT NULL DEFAULT 2 CHECK (priority IN (1,2,3)),
  needed_by      date,                    -- rep's deadline, often a meeting date
  brief_snapshot jsonb DEFAULT '{}',      -- the auto-assembled account brief frozen at creation (see §7)
  deliverable_text text,                  -- inline artifact if delivered as text
  deliverable_url  text,                  -- Drive/Slack link
  generated_content_id uuid REFERENCES public.generated_content(id) ON DELETE SET NULL,
  task_id        uuid REFERENCES public.tasks(id) ON DELETE SET NULL,  -- the fulfiller work item
  slack_ts       text,                    -- root Slack message ts for threading updates
  created_at     timestamptz DEFAULT now(),
  updated_at     timestamptz DEFAULT now(),
  acknowledged_at timestamptz,
  delivered_at    timestamptz,
  closed_at       timestamptz
);
CREATE INDEX ON public.collab_requests(assigned_to);
CREATE INDEX ON public.collab_requests(requested_by);
CREATE INDEX ON public.collab_requests(account_id);
CREATE INDEX ON public.collab_requests(status);
```
RLS mirrors the `tasks` policy pattern (requester OR assignee OR `is_manager_or_admin()` for select; assignee/requester/manager for update). Note the server path uses the **service-role client (`getSupabase`) which bypasses RLS** — as everywhere in this codebase, real enforcement is the API auth check + explicit ownership checks (reusing `ownsAccount`/`canTouchAccount`). RLS is for the client anon reads + documentation.

#### `profiles.rep_type` widen (no migration risk — it's the out-of-band column already used in `execute.js`/`settings.js`)
Extend the allowed values from `ae|sdr` to also include `designer` and `sales_engineer`. There is no CHECK constraint on `rep_type` (added out-of-band), so this is a settings-UI + documentation change, not a DDL blocker. This is how the routing pool is defined and how the Settings screen offers the role.

#### Reused, not rebuilt
- **`tasks`** — the fulfiller's actionable item is a plain task: `owner_id = assigned_to`, `created_by = requester`, `type = 'assigned'`, `source = 'collab_request'`, `source_id = request.id`, `account_id`, `due_date = needed_by`. Confirmed there is **no CHECK constraint on `tasks.source`** (the 20260410 migration declares `source text` with a comment only), so `'collab_request'` inserts cleanly — same trick `assistant` already relies on. This means the fulfiller sees the work in the existing Tasks module, gets the existing task Slack DM, and can complete/dismiss it with zero new task UI.
- **`generated_content`** (from `20260216_content_management.sql`, currently orphaned — `lib/db/content.js` is imported by nothing) — the delivered artifact is persisted here: `account_id`, `user_id`, `content_type`, `title`, `data_snapshot` (the generation inputs), `status = 'generated'`. This gives cross-team work a real home on the account and revives dead code.

#### Full-build only: `collab_request_events`
`(id, request_id FK, actor_id, event_type, body, created_at)` for the activity timeline / comments. MVP uses `status` + the Slack thread instead.

---

### 3. Request lifecycle & states

```
requested ─▶ acknowledged ─▶ in_progress ─▶ delivered ─▶ accepted   (rep closes)
                                  │  ▲            │
                                  ▼  │            └─▶ changes_requested ─▶ in_progress
                               blocked            
(any active state) ─▶ cancelled
```

| State | Set by | Side effects |
|---|---|---|
| `requested` | rep (button/assistant) | snapshot frozen; fulfiller task created; Slack DM to fulfiller (or pool channel); account channel post |
| `acknowledged` | fulfiller | `acknowledged_at`; thread reply; DM back to rep |
| `in_progress` | fulfiller | (implicit when they open the brief / start the task) |
| `blocked` | fulfiller | reason in `details`; DM to rep asking for input |
| `delivered` | fulfiller | `delivered_at`; artifact saved to `generated_content`; fulfiller task auto-completed; DM + thread to rep with link |
| `accepted` | rep | `closed_at`; task closed; thanks post to channel |
| `changes_requested` | rep | loops to `in_progress`; re-notifies fulfiller with the diff |
| `cancelled` | rep or manager | closes task |

Idempotency: assistant-raised requests carry the same `idempotencyKey` pattern as `execute.js` (`asst:<key>:<idx>`); a `findRequestBySource` guard + `findTaskBySource('collab_request', requestId)` prevent double-creation on retries/double-clicks.

---

### 4. UI surfaces (reuse-first)

1. **Raise — Account Pipeline** (`components/tabs/OverviewTab.jsx`): a "Request work" button next to the existing Demo Brief button (which already renders for demo/solution_validation/proposal). Opens a small modal: type (content/custom demo), sub-type, deadline (prefilled from the next calendar meeting for that account when available), free-text ask. Everything else is auto-attached — the rep types nothing about the account.
2. **Raise — Content Studio** (`pages/modules/content.js`): a "Request from designer" affordance so a rep who realizes they need something polished can hand it off with the account already selected.
3. **Raise — Assistant** (conversational): "ask the designer for a one-pager for UDR, need it Thursday" → the brain returns a `create_collab_request` action, applied through the **execute.js authority boundary**. This satisfies North Star #2 (assistant is action-capable) and adds a genuinely new verb.
4. **Fulfiller inbox — Tasks module** (`pages/modules/tasks.js`, no new screen for MVP): the collab task renders like any assigned task, with an "Open brief →" deep link (to Content Studio for content, to the demo-brief flow for demos) and a compact brief preview in the description.
5. **Fulfilment — Content Studio, pre-grounded** (`pages/modules/content.js` + `/api/content/generate`): deep-link `?accountId=X&requestId=Y&type=one_pager`. Content Studio already deep-links by `accountId` and already grounds generation in that account's real calls + MEDDICC + sales-process config. New: read `requestId`, render the `brief_snapshot` in a side panel, and add a **"Deliver to {rep}"** button that saves the output to `generated_content` and PATCHes the request to `delivered`.
6. **Fulfilment — Custom demo** (`/api/generate-demo-brief`, unchanged): the SE gets the demo prep brief generated from the same account context, plus the request's specifics.
7. **Full build — `/modules/requests` board**: a kanban by status for designers/SEs/managers, reusing the existing card + `ModulesNav` patterns; manager triage/reassign of unassigned pool requests.

---

### 5. Role model

Roles come from `profiles.role` (`rep|manager|admin`) + widened `profiles.rep_type` (`ae|sdr|designer|sales_engineer`). Set on the Settings screen (`pages/modules/settings.js` already edits `rep_type` via `/api/me`).

| Role | Can do |
|---|---|
| **Rep (ae/sdr)** | Raise requests on accounts they own or unassigned accounts (reuse `ownsAccount`/`canTouchAccount`); see and manage their own outbound requests; accept/request-changes on deliveries. |
| **Designer** (`rep_type='designer'`) | Receives `content` requests routed to the designer pool; fulfills in Content Studio; delivers. |
| **Sales Engineer** (`rep_type='sales_engineer'`) | Receives `custom_demo`/technical requests; fulfills via generate-demo-brief + demo asset; delivers. |
| **Manager** (`role='manager'`) | Sees all requests (`is_manager_or_admin()`); triages/reassigns unassigned pool requests; can raise on any account. |

Routing: if `assigned_to` is set, it goes to that person. If null, it goes to the `fulfiller_role` pool — DM/channel to the members whose `rep_type` matches (manager can also claim). This mirrors how `execute.js` already filters team-task recipients by `rep_type` and `isExcludedRep`.

---

### 6. Slack notifications (extend `lib/slack.js` + `slack/notify.js`)

Reuse the multi-channel bot and Block Kit builders. Add:
- **`sendSlackDM(slackUserId, payload)`** in `lib/slack.js` — `chat.postMessage` with `channel = slack_user_id` (Slack opens the IM). `slack_user_id` already lives on `profiles` and is used by the daily digest, so routing infrastructure exists.
- **`buildCollabRequestNotification({ request, account, brief, requesterName })`** — a Block Kit brief (account header, stage/$value, ICP score, champion, top pain, the ask, deadline) with a "Open in Banner →" deep link.
- Two new events on `pages/api/slack/notify.js`: `collab_requested` and `collab_delivered` (or call the builders directly from the collab API, which is cleaner — `slack/notify.js` is a no-auth open endpoint, so the collab API calling `lib/slack` server-side is safer).

Notification flow:
- **On create** → DM the assigned fulfiller (or post to the pool channel, e.g. `#design-requests` / `#se-requests`) with the full brief; also post a one-liner to the account's pursuit channel (`resolveAccountChannel`) so the deal thread reflects it. Store the root `slack_ts` for threading.
- **On acknowledged / blocked / delivered** → threaded reply on `slack_ts` + a DM to the rep.

---

### 7. What the fulfiller sees — the auto-assembled brief

A new shared lib **`lib/collabBrief.js` → `buildAccountBrief(accountId)`**, extracted from the proven pattern in `pages/api/calendar/prep-brief.js` (which already pulls `accounts` + last-N `gong_call_analyses` + `stakeholders` + `account_memory` and formats a grounded brief). `prep-brief.js` is refactored to call the same lib, killing a duplicated pull.

The brief assembles, with zero rep input:
- **Deal header** — name, stage (humanized), `deal_value`, `close_date`, `owner_name`, vertical, tier (from `accounts`).
- **ICP fit** — latest `analysis.icp_score` + `icp_rationale` from `gong_call_analyses` (the real source; account-level scores don't exist).
- **MEDDICC** — aggregated from per-call `analysis.meddicc` + `information_gaps` + `stakeholders` (champion flag). Honest note: `accounts.meddicc` is write-orphaned per the audit, so the brief leans on the per-call analysis fields (`discovery_gaps`, `pain_depth_score`, `champion_health_score`) and `information_gaps`, preferring whatever is populated.
- **Stakeholders** — name/title/role, champion flagged (from `stakeholders`).
- **Recent activity** — last 3–5 analyzed, non-CS calls: summary, pain points, next steps, objections, competitor mentions (from `gong_call_analyses.analysis`, same fields `content/generate` and `prep-brief` already read).
- **Open info gaps** — unresolved `information_gaps`.
- **The ask** — the rep's `title` + `details` + `needed_by`.

This snapshot is frozen into `brief_snapshot` at creation (so the fulfiller sees the state that motivated the ask) **and** the Content Studio generate call re-pulls live calls at fulfilment time — so the actual artifact is grounded in the freshest data while the coordination record is stable. The payoff: **the designer opens Content Studio with the account already selected and the generation already grounded in the real calls — nothing re-keyed.**

---

### 8. MVP vs full build

**MVP (ships the core loop):**
- Migration `20260718_collab_requests.sql` (table + RLS) and widen `rep_type` options.
- `lib/collabBrief.js` (`buildAccountBrief`) + refactor `prep-brief.js` onto it.
- `lib/db/collabRequests.js` (CRUD + transforms + `findRequestBySource`, mirroring `lib/db/tasks.js`).
- `pages/api/collab/requests.js` (GET list `?scope=mine|assigned|all`, POST create → snapshot + fulfiller task + Slack DM) and `pages/api/collab/requests/[id].js` (GET, PATCH status/deliver).
- Raise from Account Pipeline OverviewTab + Content Studio; **new `create_collab_request` verb on `assistant/execute.js`** (+ brain support in `assistant.js`).
- Fulfilment in Tasks (deep link) + pre-grounded Content Studio "Deliver to rep" saving to `generated_content`.
- Slack: `sendSlackDM` + request/delivered notifications; account-channel post.

**Full build:**
- `/modules/requests` kanban board + `ModulesNav`/grid entries; manager triage & reassign.
- `collab_request_events` timeline + comments (Slack threading in; note inbound Slack interactivity is a known platform gap, so comments start in-app with outbound Slack echoes).
- `needed_by` SLA nudges via a small cron (reuse the `rep-pulse` DM pattern) + overdue surfacing on Today/manager views.
- Prefill `needed_by` from `calendar/upcoming` (tie the request to the meeting that motivated it).
- Broader request types (pricing approval, legal review) wired into the existing stage-change checklists in `lib/db/tasks.js`.
- Turnaround analytics (volume, cycle time, by fulfiller) reusing the reports surface.
- Attach the delivered artifact to the follow-up email / `sdr_touches` record (closes the "draft never attached to touch" gap noted in the brief).

---

### 9. Exact files reused / extended

| Action | Path |
|---|---|
| **New** migration | `/Users/banner-james/Desktop/Claude Code/Sales Dashboard/sales-dashboard/supabase/migrations/20260718_collab_requests.sql` |
| **New** DB layer | `.../sales-dashboard/lib/db/collabRequests.js` |
| **New** brief assembler | `.../sales-dashboard/lib/collabBrief.js` (extracted from `pages/api/calendar/prep-brief.js`) |
| **New** API | `.../sales-dashboard/pages/api/collab/requests.js`, `.../pages/api/collab/requests/[id].js` |
| **Extend** authority boundary | `.../sales-dashboard/pages/api/assistant/execute.js` — add `create_collab_request` verb (reuses `createTask`, `findTaskBySource`, `canTouchAccount` already imported there) |
| **Extend** assistant brain | `.../sales-dashboard/pages/api/assistant.js` — teach the verb + reuse `resolveAccount`/`resolveRep` |
| **Extend** Slack lib | `.../sales-dashboard/lib/slack.js` — add `sendSlackDM`, `buildCollabRequestNotification` |
| **Extend** Slack notify | `.../sales-dashboard/pages/api/slack/notify.js` — `collab_requested` / `collab_delivered` events |
| **Reuse** fulfiller work item | `.../sales-dashboard/lib/db/tasks.js` (`createTask`/`findTaskBySource`, `source='collab_request'`) |
| **Reuse** fulfilment generation | `.../sales-dashboard/pages/api/content/generate.js`, `.../pages/api/generate-demo-brief.js` (unchanged) |
| **Reuse (revive)** delivery persistence | `.../sales-dashboard/lib/db/content.js` + `generated_content` table (currently orphaned) |
| **Extend** raise + fulfil UI | `.../sales-dashboard/components/tabs/OverviewTab.jsx` (Request button), `.../pages/modules/content.js` (requestId panel + Deliver) |
| **Extend** role selection | `.../sales-dashboard/pages/modules/settings.js` + `.../pages/api/me.js` (already allows `rep_type`) |
| **Extend (full build)** nav/board | `.../sales-dashboard/components/layout/ModulesNav.jsx`, `.../pages/modules/index.js`, new `.../pages/modules/requests.js` |

All API routes follow the codebase auth rule: `createServerSupabaseClient(req,res)` for the user check, `getSupabase()` (service role) for DB ops. Models via `CLAUDE_MODELS` (Sonnet for generation, already used by `content/generate` and `prep-brief`).

---

## 5. Make it prettier  <sub>(10 ways)</sub>

- [x] **5.1 — Wire the dormant Banner palette into a real Tailwind token system**  `L · impact 5 · grounded`
  - **Problem:** lib/constants.js:13-15 defines BRAND_COLORS (coral #E86A58, navy #1E2A3A) but grep confirms it is imported by nothing and neither hex appears anywhere in pages/components/styles. tailwind.config.js theme.extend is literally {}, so every screen invents its own 'primary': today.js hero is from-blue-600 to-indigo-600, GlobalAssistant FAB is from-blue-600 to-indigo-700, Sales Reports cards use rose/slate/violet/green/blue/orange/amber/cyan gradients, modules grid uses blue/violet/emerald/amber/teal/purple/orange/red/indigo. §10 names this the top system issue: red, blue, green, purple, and pure black all act as 'primary' somewhere.
  - **Solution:** Promote the brand palette to actual Tailwind design tokens plus a small semantic set (primary=coral, ink=navy, success/danger/warn/info/neutral), then sweep the ad-hoc blue/indigo/purple/black accents onto the tokens so one accent reads as the brand everywhere.
  - **Build:** In tailwind.config.js theme.extend.colors add banner.coral/#E86A58, banner.navy/#1E2A3A and semantic aliases (primary=banner.coral, danger/success/warn/info) sourced from a widened BRAND_COLORS in lib/constants.js; add fontFamily.sans there too. Then replace the hard-coded gradients/accents at today.js:671, components/layout/GlobalAssistant.jsx:107 & :118, and the button-accent pills in pipeline-overview.js with bg-primary / text-primary token classes. No DB or API changes.
  - **Depends on:** Foundation for the hero-tile, AI-glyph, icon-chip, and type-scale ideas.

- [x] **5.2 — A visual empty/loading system: shimmer skeletons and neutral empty states**  `M · impact 4 · grounded`
  - **Problem:** §10: Command Center and Call Intelligence render plain 'Loading…' text / blank halves that 'read as broken' (confirmed: team-dashboard.js also shows a bare 'Loading…' div, no shimmer); Pipeline Overview's skeleton bars sit as a resting state; Account Pipeline uses a warning/error-circle icon for a neutral 'Select an account' prompt. Pursuit's empty state (icon + headline + one line + single CTA) is explicitly called out as the pattern to copy.
  - **Solution:** Build a shared Skeleton shimmer and a neutral EmptyState component modeled on Pursuit's look, then replace the plain-text loading and mismatched error iconography so loading looks intentional and empty looks calm, not broken.
  - **Build:** Add components/common/Skeleton.jsx (animate-pulse gray blocks) and components/common/EmptyState.jsx (lucide icon + title + one line + optional CTA, matching Pursuit's markup) — components/common/ already exists (ApiError, PeriodDelta, DealHealthBadge, ErrorBoundary). Swap the 'Loading…' text in pages/modules/sales-reports/command-center.js, call-intelligence.js and team-dashboard.js and the resting skeleton in pipeline-overview.js for the shimmer; change the Account Pipeline 'Select an account' prompt from the warning glyph to a neutral lucide icon (Building2/MousePointer). Front-end only.

- [x] **5.3 — Introduce a type + spacing scale and a two-tier heading convention**  `M · impact 4 · grounded`
  - **Problem:** styles/globals.css only sets a system font on body; tailwind.config.js theme.extend has no fontSize or spacing scale. §10: headings are inconsistent (tiny grey ALL-CAPS 'YOUR DAY/CALENDAR/PIPELINE FOCUS' vs bold sentence-case 'Morning Brief'), and metadata is 'tiny low-contrast light gray' ('Last updated May 5' — no year, '37d avg in stage') — flagged as an accessibility/legibility problem.
  - **Solution:** Define a compact type scale and two reusable heading treatments (section-label = uppercase ~11px tracked gray-500; card-title = ~15px semibold gray-900) plus a minimum metadata contrast (gray-600 not gray-400), and apply them so every card header and meta line follows one rhythm.
  - **Build:** Add fontSize/letterSpacing tokens to tailwind.config.js theme.extend and two @layer components classes (.section-label, .card-title) in styles/globals.css. Sweep the ALL-CAPS label spans in pages/modules/today.js (YOUR DAY/CALENDAR/PIPELINE FOCUS) and card titles in tasks.js onto these classes; bump text-gray-400 meta text (e.g. stage-analytics.js:225 '{avgDays}d avg in stage') to text-gray-600. No data changes.

- [x] **5.4 — One stage color/label source of truth for every badge and bar**  `M · impact 4 · grounded`
  - **Problem:** The same stage renders three different colors: constants.js STAGE_COLORS (line 84) makes qualifying a light badge, bottleneck.js:43 FUNNEL_BAR_COLORS makes it bg-teal-400, stage-analytics.js:50 STAGE_BAR_COLORS makes it bg-gray-400 (reading as disabled). bottleneck.js (STAGE_BADGE_COLORS:29, FUNNEL_BAR_COLORS:42) and stage-analytics.js (STAGE_COLORS:35, STAGE_BAR_COLORS:49) each re-declare local maps that disagree with constants.js and with each other. §10: 'same stages, different arbitrary rainbow colors, no legend, color hierarchy inverted.'
  - **Solution:** Add a single canonical STAGE_HEX and a single-hue STAGE_BAR_RAMP (shaded by ACTIVE_STAGE_ORDER position so downstream stages darken, not random rainbow) to lib/constants.js beside the existing STAGE_LABELS/STAGE_COLORS/ACTIVE_STAGE_ORDER, delete the local maps, and have every badge/bar import from constants.
  - **Build:** Extend lib/constants.js with STAGE_HEX (keyed to STAGE_LABELS keys) and STAGE_BAR_RAMP derived from ACTIVE_STAGE_ORDER (line 63) index. Delete STAGE_BADGE_COLORS+FUNNEL_BAR_COLORS in pages/modules/bottleneck.js:29-49 and STAGE_COLORS+STAGE_BAR_COLORS in pages/modules/stage-analytics.js:35-56; import the shared maps instead. Point the CEO/Team stage bars (ceo-dashboard.js, team-dashboard.js 'Active Pipeline by Stage' at :479) and Account Pipeline badges at the same import. Pure front-end.
  - **Depends on:** Reads cleanest after the token idea; supplies the ramp the chart-repaint idea consumes.

- [x] **5.5 — Retire the saturated gradient hero tiles for one flat card system**  `M · impact 4 · grounded`
  - **Problem:** today.js:671 renders NEXT BEST ACTION as bg-gradient-to-r from-blue-600 to-indigo-600 text-white, and pipeline-overview has the blue->purple Confidence + green Total Pipeline hero tiles. §10: 'two card systems — saturated gradient hero tiles (dated ~2019 SaaS, taller so baselines misalign) vs flat white cards everywhere else.' The height mismatch breaks the row baseline on Today.
  - **Solution:** Replace the gradient heros with the flat white card treatment used elsewhere, distinguished by a coral left-accent border and larger number type rather than a full-bleed gradient, so heights match neighboring cards and the app reads as one card system.
  - **Build:** Edit the hero container className at pages/modules/today.js:671 (drop bg-gradient-to-r from-blue-600 to-indigo-600 text-white; use bg-white border border-gray-100 border-l-4 border-l-primary with dark text) and the equivalent Confidence/Total-Pipeline tiles in pages/modules/pipeline-overview.js. Match padding/height to the flat cards on the same rows. Front-end only.
  - **Depends on:** Uses the coral primary token.

- [x] **5.6 — Fix the pipeline bar/funnel chart defects: sequential shading, scale, no clipped labels**  `M · impact 4 · grounded`
  - **Problem:** §10: Bottleneck 'funnel' bars (bottleneck.js:345) are arbitrary rainbow (Proposal orange collides with bottleneck=orange meaning); Stage Analytics (stage-analytics.js:214) colors the largest top-funnel stage bg-gray-400 so it reads disabled while smaller downstream stages are vivid (inverted visual weight, no axis/scale); Team Dashboard 'Active Pipeline by Stage' bar labels overflow ('20 · $2.4M' clipped, 'M' outside the bar). These are chart-layout defects, not data ones.
  - **Solution:** Consume the shared STAGE_BAR_RAMP so bar darkness follows stage order (not random hue), add a light baseline/max-value tick for scale, and fix the overflowing value label by right-aligning it outside the bar when the bar is too short.
  - **Build:** After the shared STAGE_BAR_RAMP lands in lib/constants.js, repaint the bars at pages/modules/bottleneck.js:345 and pages/modules/stage-analytics.js:214 from that ramp (removing the isBottleneck override's clash by keeping bottleneck highlight as a border/outline, not a fill hue). In pages/modules/sales-reports/team-dashboard.js:479 render the '<count> · $<value>' string in a right-aligned span outside the bar when bar width is below a threshold. Add a positioned gridline/max-value tick div. Front-end only.
  - **Depends on:** Consumes the STAGE_BAR_RAMP from the stage color source-of-truth idea.

- [x] **5.7 — Kill the red 'Live' pill on every Sales Reports card**  `S · impact 3 · grounded`
  - **Problem:** pages/modules/sales-reports/index.js:104 returns { text:'Live', className:'bg-red-500 text-white', icon:'●' } for status 'live', and all 8 REPORTS entries are status:'live'. §10 calls this out directly: red=error misuse, and a badge that says the identical thing on every card carries zero information while shouting alarm-red across the whole grid ('delete it').
  - **Solution:** Change the live treatment to a quiet brand/neutral affordance (small coral or gray dot, no filled red pill) and only render a badge when status is NOT live (in-progress amber, coming-soon gray), so the grid stops reading like eight errors.
  - **Build:** Edit getStatusBadge in pages/modules/sales-reports/index.js:101-108: drop the 'live' case's bg-red-500 and return null (or a subtle text-primary '●'); keep the in-progress/coming-soon cases. Guard the always-rendered badge span so it only renders when badge is non-null. One file, no data changes.

- [x] **5.8 — Standardize on one AI glyph and one accent for the assistant everywhere**  `S · impact 3 · grounded`
  - **Problem:** §10: 'AI entry point inconsistent app-wide — green AI Chat button vs purple/blue sparkle FAB.' Confirmed: GlobalAssistant.jsx:107 (FAB) and :118 (header) are a blue->indigo gradient Sparkles surface, while call-intelligence.js:1029 exposes a bg-gradient-to-r from-green-600 to-emerald-600 chat-toggle button. Users won't recognize these as the same feature.
  - **Solution:** Adopt one Sparkles glyph and the brand coral accent for every AI surface, and align the FAB placement so it stops reading as different features.
  - **Build:** Point the FAB gradient at GlobalAssistant.jsx:107 and the header at :118 to the coral primary token. Change the green chat-toggle button at call-intelligence.js:1029 to the same lucide Sparkles + primary treatment (not green). While there, fix the icon drift §3 notes — Account Pursuit uses Send at components/layout/ModulesNav.jsx:19 but Target at pages/modules/index.js:70 — by switching ModulesNav.jsx:19 to Target. Front-end only.
  - **Depends on:** Uses the coral primary token.

- [x] **5.9 — Replace native OS <select> with a branded Select control**  `M · impact 3 · grounded`
  - **Problem:** §10 flags native <select> dropdowns as breaking the custom-UI illusion (beveled chevrons, system font). Confirmed by count: pages/modules/content.js (1, the account picker at :116), pages/modules/outbound-engine.js (2, All Verticals/All Status at :244/:256), pages/modules/account-pipeline.js (6, Active deals/All owners/Sort at :893/:920/:934/:947/:1450/:1495).
  - **Solution:** Build one styled Select component using a lucide ChevronDown so all filter/sort/picker dropdowns share the app's rounded-lg gray-200 field styling and font, eliminating the OS chrome.
  - **Build:** Create components/common/Select.jsx — minimally a wrapper that hides the native chevron via appearance-none and overlays a lucide-react ChevronDown, matching the existing 'border border-gray-200 rounded-lg px-3 py-2 text-sm' pattern already on content.js:116. Swap the 9 native <select> instances across content.js, account-pipeline.js, and outbound-engine.js. Front-end only.
  - **Depends on:** Uses the token/type styling for the field.

- [x] **5.10 — Unify the module and report grid icon tiles into one calm chip**  `M · impact 3 · grounded`
  - **Problem:** pages/modules/index.js gives each card an arbitrary pastel square (color/bg fields: text-blue-600/bg-blue-50, text-violet-600/bg-violet-50, text-emerald-600, text-amber-500, text-teal-600, text-purple-600, text-orange-500, text-red-500, text-indigo-600 at :15-16,:23-24,… onward), and pages/modules/sales-reports/index.js gives each an arbitrary gradient (color: from-rose-500, from-slate-700, from-violet-500, from-green-500, from-blue-500, from-orange-500, from-amber-500, from-cyan-500 at :13/24/35/46/57/68/79/90). §10: 'rainbow icon tiles (two oranges, two blues) creating false grouping'; 'decorative pastel icon squares.'
  - **Solution:** Replace the per-card colors with one consistent icon chip (single neutral/brand-tint background, brand-coral glyph) so no false color grouping forms, and equalize per-row card heights so the tall 3-line row-1 descriptions stop breaking the grid rhythm.
  - **Build:** In pages/modules/index.js remove the per-entry color/bg fields and render every lucide icon in one chip class; in pages/modules/sales-reports/index.js remove the per-report gradient 'color' fields (:13/24/35/46/57/68/79/90) and use the same chip. Add a min-h to the card body in both grids so row-1's 3-line descriptions no longer make that row ~2x taller (note: the trailing empty cell of a 14-card / 3-col grid is inherent to the item count — center the last row or leave it; min-h only fixes row-height rhythm, not the gap). Front-end only.
  - **Depends on:** Uses the coral primary token.

---

## 6. Better analyze the sales approach & results — clear updates for you + the CEO  <sub>(5 ways)</sub>

- [x] **6.1 — Record stage transitions in the HubSpot sync so a real funnel is possible**  `M · impact 5 · grounded`
  - **Problem:** Per §8(a), the vast majority of real stage moves are never recorded. `pages/api/hubspot/sync-deals.js` (nightly cron/sync-hubspot path) writes `accounts.stage` via a direct `.upsert()` on `hubspot_deal_id` (line 124), bypassing every app-layer stage-history writer, and reps move deals in HubSpot not in-app. `account_stage_history` has the right columns (from_stage/to_stage/changed_at/deal_value_at_change) but is empty for HubSpot moves, so cohort funnel, velocity, and movedThisWeek are all unreliable.
  - **Solution:** Make the nightly HubSpot sync the primary stage-transition writer: diff incoming vs stored stage per deal and emit a history row whenever it changes. This is the data substrate every other exec-analytics feature rests on.
  - **Build:** In `pages/api/hubspot/sync-deals.js`, before the `.upsert()` at line 124, SELECT `id, stage, deal_value, updated_at` from `accounts` for the batch's `hubspot_deal_id`s using the existing `db = getSupabase()` service-role client. For each deal where the STAGE_MAP-translated incoming stage (`STAGE_MAP[stageId] || 'qualifying'`, reuse the file's STAGE_MAP) differs from the stored `accounts.stage`, INSERT into `account_stage_history` (account_id = the existing row's `id`, account_name, owner_name, from_stage = stored stage, to_stage = translated new stage, changed_at = HubSpot `lastmodifieddate` or now(), deal_value_at_change = new deal_value, changed_by_name='HubSpot Sync', days_in_prior_stage computed from the prior history row's changed_at or `accounts.updated_at`). Do NOT set `changed_by` — only `changed_by_name`/`days_in_prior_stage` were added (20260515); `changed_by` is absent. New accounts (no existing row) get an initial row with from_stage null.
  - **Depends on:** None — unblocks the cohort funnel (rank 2) and enriches the exec brief (rank 5)

- [x] **6.2 — True cohort conversion + velocity endpoint to replace the fake funnels**  `L · impact 5 · grounded`
  - **Problem:** §8(b)/(d) and §10: there is NO true cohort funnel or sales-cycle-in-days anywhere. `pages/api/bottleneck.js` computes `rate = toCount/(fromCount+toCount)` (line 57) — a ratio of current snapshot head-counts labeled '% continue' — producing the nonsensical non-monotonic 67→0→33→0→14→8→2. `pages/api/pipeline/stage-analytics.js` velocityByStage uses censored dwell time of still-open deals, not true transition velocity.
  - **Solution:** A cohort endpoint that groups deals by the month they first entered `qualifying` and computes, per cohort, the % that ever reached each downstream stage plus the median days between consecutive stage timestamps — real step-by-step conversion and velocity in days.
  - **Build:** Add `pages/api/pipeline/cohort-funnel.js`. Read `account_stage_history` (populated by rank 1): per account_id, cohort = month of MIN(changed_at) where to_stage='qualifying'; walk `ACTIVE_STAGE_ORDER` imported from `lib/constants.js` and compute, per cohort, the reached-rate for each downstream to_stage and the median day-gap between adjacent to_stage timestamps. Track closed_lost separately so drop-off is visible. Give it a home: add a 'Cohort Funnel' tab to `pages/modules/stage-analytics.js` (grid-orphan, reachable only via the ModulesNav dropdown today) and/or repoint `bottleneck.js` conversions[] at this endpoint so the misleading snapshot ratio is retired.
  - **Depends on:** Rank 1 (needs populated account_stage_history)

- [x] **6.3 — Single canonical metrics library so exec numbers stop contradicting each other**  `L · impact 5 · grounded`
  - **Problem:** §8 cross-cutting: three confidence formulas (ceo plain-avg counts; pipeline-overview bonuses cap95; scorecard $-weighted), three-plus win-rate definitions, four-plus stale/at-risk definitions, divergent stage ordering, and STAGE_PROBABILITY re-declared inline in `ceo-dashboard.js` and `scorecard.js` instead of imported. §10: CEO Dashboard and Team Dashboard show different pipeline-by-stage counts (66/29/12 vs 63/20/8) — two sources of truth. 'Trustworthy exec numbers' is impossible while the same word means different math on every screen.
  - **Solution:** One `lib/salesMetrics.js` exporting canonical winRate(window,dateField), openPipeline, weightedPipeline, accountConfidence, and isStale, all importing stage constants from lib/constants.js; every exec surface calls it.
  - **Build:** Create `lib/salesMetrics.js` importing STAGE_PROBABILITY/STAGE_LABELS/ACTIVE_STAGE_ORDER from `lib/constants.js`. Implement weightedPipeline honoring `sales_process_config.stage_weights` overrides exactly as `pages/api/reports/scorecard.js` line 42 does (`prob = {...STAGE_PROBABILITY, ...cfg.stage_weights}`), winRate defaulting to `close_date` over a window, and one isStale keyed on `gong_call_analyses.call_date`. Refactor `pages/api/ceo-dashboard.js` and `reports/scorecard.js` to delete their inline STAGE_PROBABILITY copies, and refactor `pages/api/bottleneck.js`, `sales-reports/team-dashboard.js` (which has its own ACTIVE_STAGES + label maps), and `pipeline-overview.js` to import these. CEO-vs-Team counts then reconcile and stage-weight edits propagate everywhere.
  - **Depends on:** None — prerequisite for the CEO Dashboard rebuild (rank 4)

- [x] **6.4 — Rebuild CEO Dashboard with dollars, close-date win rate, and a forecast**  `M · impact 4 · grounded`
  - **Problem:** §8 and §10: `pages/api/ceo-dashboard.js` is billed as 'the one view if business is on track' yet renders ZERO dollars; its winRate uses `updated_at`>90d as a close-date proxy (lines 80-82, wrong), its confidenceScore is a plain count-weighted stage average (line 76), and its pipeline-by-stage counts disagree with Team Dashboard. There is also no forecast structure (§8e) despite `sales_goals` supporting scope='rep'+owner_id (migration 20260628_task_engine_vision), which goals.js/scorecard never use.
  - **Solution:** Extend the CEO view onto the canonical metrics and add the exec essentials: dollar open/weighted pipeline, close-date-based win rate, and a commit/best-case forecast against per-rep goals.
  - **Build:** Building on `lib/salesMetrics.js` (rank 3), extend `pages/api/ceo-dashboard.js` beyond the consistency refactor: render openPipeline and weightedPipeline in dollars (Σ deal_value over ACTIVE stages, weighted by STAGE_PROBABILITY/stage_weights); replace winRate — currently won/(won+lost) filtered by `updated_at`>90d — with a `close_date`-windowed rate; and add a forecast summing per-rep `sales_goals` (scope='rep', owner_id — supported by the migration but only scope='team' is used today) into commit vs best-case bands off weighted pipeline. Reconcile pipelineByStage with `sales-reports/team-dashboard.js` by both consuming salesMetrics + ACTIVE_STAGE_ORDER. Keep recentCloses/winLossInsights reads from `accounts.debrief`.
  - **Depends on:** Rank 3 (imports the canonical metrics; also resolves the CEO-vs-Team count mismatch)

- [x] **6.5 — Fix the field-name bugs in the Monday exec brief and make it a real narrative**  `M · impact 4 · grounded`
  - **Problem:** §8(6): `pages/api/manager/weekly-brief.js` — the Monday exec brief DM'd to James (triggered by `cron/weekly-brief.js`, also fetched from pipeline-overview.js) — reads `analysis.rep_name` (per-rep grouping collapses to 'Unknown', line 64), `analysis.talk_ratio` (avg always 0, line 87), and `a.call_title` (always 'untitled', line 94). These are ROW columns on `gong_call_analyses` (rep_name/title/duration_seconds/call_date/call_category), and talk ratio lives at `analysis.rep_talk_ratio` — so the auto-generated exec narrative is silently wrong today.
  - **Solution:** Fix the reads to use the right columns/keys, then feed the corrected data plus the new cohort funnel and $ scorecard into Sonnet to produce a genuine week-over-week exec narrative delivered to Slack.
  - **Build:** In `pages/api/manager/weekly-brief.js` select `rep_name`,`title`,`call_date`,`duration_seconds`,`call_category` as columns and read `analysis.rep_talk_ratio` for talk ratio. Enrich the payload with `reports/scorecard.js` ($ open/weighted/won-vs-goal) and `/api/pipeline/cohort-funnel` (rank 2) and have it write a real narrative ('what moved, what stalled, where the dollars are, what to watch'). The file currently calls Claude via a raw `fetch` to api.anthropic.com (line 155) — switch it to `callAnthropic` (lib/apiUtils.js) with `CLAUDE_MODELS.SONNET` per the shared-helper convention. It already delivers via `sendSlackMessage` to `SLACK_MANAGER_CHANNEL` (default D02PGNHTR53) — keep that.
  - **Depends on:** Rank 2 enriches the narrative; the field bug-fix + scorecard payload are standalone

---

## 7. Better train & improve reps (SDRs, AEs, you)  <sub>(5 improvements)</sub>

- [x] **7.1 — Persist the coaching focus and measure before/after deltas**  `M · impact 4 · grounded`
  - **Problem:** coaching.js stores a rep's coaching focus in localStorage key coaching_focus_${selectedRep} (confirmed at coaching.js:291/508/523) — never persisted server-side, no baseline captured, invisible on any other browser, lost on clear. As a result there is zero measurement of whether any coaching worked. The stated before/after-tracking goal is unbuildable on a localStorage string.
  - **Solution:** Move coaching focus into a real table, snapshot the baseline metric value at the moment a focus is set, then compute the same metric over calls that happened AFTER the set date and show the before/after trajectory in the coaching module.
  - **Build:** Migration supabase/migrations/2026xxxx_coaching_focus.sql: coaching_focus(id, rep_email text, rep_name text, focus_metric text, baseline_value numeric, baseline_window text, set_by text, set_at timestamptz, cleared_at timestamptz), partial unique index on active (cleared_at is null) focus per rep_email. Extract rep-coaching.js's computeMetrics math verbatim (avgDiscoveryScore/avgTalkRatio/nextStepRate/commitmentRate/redFlagRate/avgFillerWordsPerMin — these exact names exist in rep-coaching.js) into a shared lib/coachingMetrics.js. Replace the localStorage read/write in pages/modules/coaching.js with a new pages/api/gong/coaching-focus.js (GET/POST/PATCH, getUser auth via createServerSupabaseClient + getSupabase() service client like the other intel-* routes); on POST, capture baseline_value by running lib/coachingMetrics over the trailing 30d for that rep_email. New pages/api/gong/coaching-focus-delta.js computes focus_metric over gong_call_analyses rows with analyzed_at >= set_at grouped by rep_email (NOT the ilike '%firstName%' pattern rep-coaching.js uses — avoids the documented first-name collision), reusing rep-coaching-trend.js's 2-week bucket logic (bucketSizeMs = 14*86400000) for the trajectory. UI: coaching.js focus panel renders 'Focus: talk ratio, set Jun 26 — 58 -> 44 over 12 calls since' (talk ratio is a 0-100 integer, not a fraction).
  - **Depends on:** Builds lib/coachingMetrics.js reused by the benchmark and drills ideas; reuses rep-coaching-trend.js bucketing.

- [x] **7.2 — Best-Call Library from the scores the engine already computes**  `M · impact 4 · grounded`
  - **Problem:** intel-analyze.js scores every call — discovery_score, pain_depth_score, champion_health_score, rep_talk_ratio, buying_signals, red_flags, next_steps_mentioned (all confirmed emitted at intel-analyze.js:478-533) — into gong_call_analyses.analysis, but coaching.js only ever surfaces a rep's OWN weaknesses. There is no exemplar surface anywhere, so reps have zero reference for what a good call sounds like. High-scoring calls sit unused in a table 64 files read from.
  - **Solution:** A curated Best-Call Library that ranks existing analyzed calls by a composite of the exemplar-signalling scores and links straight to the Gong recording, so reps can study model calls by call type (discovery, demo, etc.) and skill.
  - **Build:** New route pages/api/gong/best-calls.js (getUser auth, getSupabase() service client like the intel-* routes). Query gong_call_analyses filtering ignored=false, analyzed_at not null, and the null-safe .or('call_category.is.null,call_category.neq.cs') pattern already used in intel-aggregate.js/rep-coaching.js. Compute an exemplar score per row from analysis: reward discovery_score/pain_depth_score/champion_health_score and presence of buying_signals[]/next_steps_mentioned[], penalize red_flags[] and rep_talk_ratio outside a healthy band — NOTE rep_talk_ratio is emitted as a 0-100 integer (e.g. 47), so penalize e.g. >55 rather than the incorrect >0.6. Join accounts on gong_call_analyses.account_id to boost stage='closed_won' calls. Return top N with gong_url, title, rep_name, call_date, derived_call_type (a real row column set by title regex), analysis.summary and the score breakdown. Add migration supabase/migrations/2026xxxx_coaching_exemplars.sql: coaching_exemplars(id, gong_call_id, tagged_by, skill_tag text, note text, created_at) so managers can pin/label calls. UI: add a 'Best Calls' tab in pages/modules/coaching.js (currently tab-less) filterable by derived_call_type and skill_tag, each row deep-linking to gong_url. Optional: one Haiku callAnthropic (CLAUDE_MODELS.HAIKU) to write a one-line 'why this is a model call'.
  - **Depends on:** nightly-intel sweeps all non-EXCLUDED reps (isExcludedRep filter at nightly-intel.js:147/193, analyzeCap 150), so Mark/Logan/James calls are present for cross-rep exemplars; account_id boost degrades gracefully when unmatched.

- [x] **7.3 — Team benchmark deltas so a rep knows if their score is good**  `M · impact 4 · grounded`
  - **Problem:** rep-coaching.js compares a rep only to their OWN prior 30d (computeMetrics on current vs prev window, same rep), so a rep seeing 'discovery_score 5' has no idea whether that is strong or weak versus peers. team-dashboard.js was meant to show per-rep metrics but its avgTalkRatio reads analysis.talk_ratio_rep (team-dashboard.js:74/115) and topObjections reads analysis.objections_raised (line 123) — both wrong field names (engine emits rep_talk_ratio and objections[{text}]), so those tiles are permanently blank. There is no working team benchmark anywhere.
  - **Solution:** A benchmark endpoint that computes team-wide averages and percentiles per coaching metric and shows each rep's delta versus the team median, turning raw scores into 'you are +1.2 above team on discovery, -3 below on talk ratio.'
  - **Build:** New pages/api/gong/coaching-benchmark.js: over trailing 30/90d of gong_call_analyses (ignored=false, .or('call_category.is.null,call_category.neq.cs')), group by rep_email (avoids the ilike first-name collision) using the shared lib/coachingMetrics.js, computing per-rep avgDiscoveryScore, avgTalkRatio (rep_talk_ratio, 0-100), nextStepRate, commitmentRate, redFlagRate, avgFillerWordsPerMin plus pain_depth_score and champion_health_score (add these two to lib/coachingMetrics.js — the engine emits them but current rep-coaching.js computeMetrics omits them), then team mean + the requested rep's percentile. Filter the rep set through lib/repConfig.js isExcludedRep (drops the CS team) and optionally profiles.rep_type in ('ae','sdr'). UI: in coaching.js render each metric as a bar with a team-median marker and the rep's +/- delta. In the same PR repoint team-dashboard.js's two broken reads (talk_ratio_rep -> rep_talk_ratio, objections_raised -> objections[].text) to lib/coachingMetrics.js so both surfaces read the correct analysis fields from one place.
  - **Depends on:** Shares lib/coachingMetrics.js with the before/after idea; needs multiple non-excluded reps with analyzed calls (present via nightly-intel sweep); rep_type is used in code but its migration is marked unrun (reads may degrade to null).

- [x] **7.4 — Targeted AI drills generated from a rep's real fumbled moments**  `L · impact 4 · grounded`
  - **Problem:** Every coaching output today is read-only advice: lib/coaching.js sendCallCoachingDM emits {strength,fix,next_focus}, intel-coaching.js emits 3 bullets. Nothing is practiceable. A rep is told 'improve discovery' then has nothing to rehearse against, so the advice evaporates. There is no drill/practice artifact of any kind in the codebase.
  - **Solution:** Generate role-play drills targeted at the rep's weakest metric, seeded from the exact transcript moments where they actually fumbled (a missed objection, a shallow discovery gap), so the practice is grounded in their own calls rather than generic.
  - **Build:** Migration supabase/migrations/2026xxxx_coaching_drills.sql: coaching_drills(id, rep_email, rep_name, skill_metric text, scenario text, prompt text, source_gong_call_id text, assigned_by text, status default 'assigned', created_at, completed_at, response text). New pages/api/gong/generate-drill.js: take rep_email (derive the weakest metric inline via lib/coachingMetrics.js, or from coaching-benchmark if built), pull that rep's recent low-signal calls — discovery_score below team median, non-empty red_flags[], or objections[] left unhandled — including the stored transcript_text (persisted at intel-analyze.js:552, 28k cap applied at :444). Feed the specific fumbled excerpt + target metric to callAnthropic with CLAUDE_MODELS.SONNET (claude-sonnet-4-6) to produce a role-play scenario, store in coaching_drills. UI: a 'Drills' tab in pages/modules/coaching.js listing assigned drills; the rep types a response; optional Haiku pass scores it against a rubric and writes it back. Reuse lib/slack.js sendSlackMessage to DM the drill to profiles.slack_user_id, gated exactly like sendCallCoachingDM (isAutoProcessRep + call_category!='cs' + slack_user_id present).
  - **Depends on:** Relies on transcript_text being populated on the row (engine stores it); can pick the weakest metric standalone or via coaching-benchmark.

- [x] **7.5 — Objection & competitor rebuttal library with drill mode**  `M · impact 3 · grounded`
  - **Problem:** The engine extracts objections[{text,category}] and competitor_mentions[{name}] on every call, and competitive-analytics.js already computes win-rate by competitor by cross-referencing accounts.stage (closed_won/closed_lost) — but reps never see HOW to actually answer those objections. The winning language stays buried in transcripts, so the same objections get fumbled repeatedly.
  - **Solution:** A library that clusters recurring objections and competitor mentions across all calls, then for each surfaces the model rebuttal pulled from a won-deal transcript, ranked by how much win-rate that objection/competitor moves. A drill mode hides the answer so reps practice first.
  - **Build:** New pages/api/gong/objection-library.js: scan analysis.objections[].text (note objections already carry a category field — competitive-analytics.js filters o.category==='competition' — reuse that) and competitor_mentions[].name across gong_call_analyses (ignored=false, non-cs .or filter). Cluster free-text objections into canonical buckets with a cheap Haiku callAnthropic pass. For each cluster, find the best rebuttal: select calls whose account_id maps to accounts.stage='closed_won', pull the transcript_text segment around that objection, and let Haiku extract the rep's response. Rank clusters by frequency and by win-rate impact using the same accounts.stage cross-reference competitive-analytics.js already does. UI: an 'Objection Playbook' tab in coaching.js (or the call-intelligence.js report) — each card shows the objection, frequency, win-rate when present, and the model rebuttal with a gong_url link; drill mode hides the rebuttal, lets the rep draft their own, then reveals.
  - **Depends on:** Rebuttal quality depends on transcript_text and account_id being populated on won-deal calls (account_id is a nullable FK set by enrich-calls-bulk/match-calls, coverage is imperfect for non-James reps) — degrade gracefully to frequency-only cards when no won-deal transcript is found.

---

## 8. Improve our sales processes  <sub>(5 improvements)</sub>

- [x] **8.1 — Record HubSpot-driven stage moves into account_stage_history via one shared writer**  `M · impact 5 · grounded`
  - **Problem:** cron/sync-hubspot -> hubspot/sync-deals.js upserts accounts.stage directly (STAGE_MAP + raw .upsert()), bypassing both app-side stage-history writers. Since reps move deals in HubSpot, not in-app, the vast majority of real transitions are never recorded, so bottleneck.js, pipeline/stage-analytics.js velocity/time-in-stage, and any cohort funnel are structurally unreliable (confirmed as the #1 data-substrate gap in the brief).
  - **Solution:** In the sync loop, read each account's existing stage before the upsert; when the mapped stage differs, write an account_stage_history row (from_stage, to_stage, changed_by_name='HubSpot Sync', days_in_prior_stage, deal_value_at_change) through one shared helper that every writer calls, so HubSpot moves finally land in the audit trail.
  - **Build:** Extract the history-insert from assistant/execute.js:67-69 into lib/stageHistory.js recordStageChange({accountId, from, to, changedByName, dealValue, db}) that inserts ONLY changed_by_name/days_in_prior_stage/deal_value_at_change and DROPS the changed_by column (both current writers pass changed_by:userId, but 20260515 only added changed_by_name and the insert error is swallowed, so those rows may be silently dropped today). Call it from hubspot/sync-deals.js on each detected stage diff, and refactor the two existing app-side writers to call the same helper: assistant/execute.js:67-69 and stores/useAccountStore.js:125-132. The other stage-history files in the tree (accounts/stage-history.js, pipeline/stage-analytics.js, reports/feed.js, OverviewTab.jsx) only READ, so the insert lives in exactly two places today.
  - **Depends on:** Foundational: unblocks reliable velocity/funnel data for the stage-exit gate and cadence ideas; the same diff-detection in sync-deals.js is the natural trigger point for downstream automation.

- [x] **8.2 — Stage-exit gate evaluated at every stage-write path**  `L · impact 5 · grounded`
  - **Problem:** accounts.stage_exit_criteria (live-only JSONB, read/written in lib/db/accounts.js transformAccountToDb) and sales_process_config.stage_exit_criteria both exist but are ONLY injected into AI prompts (lib/salesProcess.js, accounts/chat.js). No code path enforces them: assistant/execute.js update_account_stage advances a deal after checking only VALID_STAGES + ownership, and stores/useAccountStore.js does the same. Reps push deals to proposal/legal with no discovery, no champion, no committed next step.
  - **Solution:** Add a machine-checkable per-stage exit checklist evaluated at every advance against signals that are actually populated (latest gong_call_analyses discovery_score/champion_health_score/buying_signals, stakeholders count, open information_gaps count, presence of next_steps_mentioned) — deliberately NOT the dead accounts.meddicc. Soft gate: return unmet criteria and require a manager override/force flag rather than hard-blocking, and log the override.
  - **Build:** New lib/stageGate.js evaluateStageExit(accountId, fromStage, toStage, db) reading gong_call_analyses/stakeholders/information_gaps. Call it in assistant/execute.js update_account_stage branch (before the update at ~line 61) and in the stores/useAccountStore.js stage-change action (before the playbook/task fan-out around line 147); surface unmet items in AISidebar + OverviewTab. Add a stage_exit_checklist JSONB to sales_process_config and to the ALLOWED/whitelisted sections list in pages/api/sales-process.js plus the editor in pages/modules/sales-processes.js. Add an override_reason column to account_stage_history via a dated migration and write it through the shared lib/stageHistory.js helper.
  - **Depends on:** Shares the two stage-write paths (execute.js + useAccountStore) with the HubSpot-stage-history idea; evaluates gong signals directly so it is independent of history-data completeness.

- [x] **8.3 — AE->CS handoff: fix the dead reads, persist the brief, and gate closed_won**  `M · impact 4 · grounded`
  - **Problem:** pages/api/accounts/cs-handover.js reads a.pain_points_identified (line 52 — a key the engine never emits) and a.meddicc (line 53 — write-orphaned/dead per the brief), so the brief is thin; it persists NOTHING (returns the generated brief in memory, ~line 109); and it is not required — an account can be marked closed_won with no handoff, so CS inherits nothing durable.
  - **Solution:** Rebuild the brief on the engine's real gong_call_analyses keys (champion_health_score, red_flags[], objections[].text, buying_signals, plus commitments/next_steps_mentioned), persist the generated brief to a new accounts.cs_handoff JSONB, and on the closed_won transition auto-generate it if absent and create a CS review task.
  - **Build:** Edit pages/api/accounts/cs-handover.js: replace the pain_points_identified/meddicc aggregation (around lines 52-58) with engine-real fields pulled from gong_call_analyses, then upsert the result into a new accounts.cs_handoff column. Add cs_handoff to transformAccountFromDb/transformAccountToDb in lib/db/accounts.js (add via a dated migration, not a live-only ALTER, given the schema-reproducibility gap). Hook the closed_won branch in stores/useAccountStore.js and assistant/execute.js update_account_stage to call cs-handover when accounts.cs_handoff is empty and create a task via lib/db/tasks.js.
  - **Depends on:** Built to NOT depend on the dead meddicc field; shares the stage-write path with the stage-exit gate; reuses the callAnthropic HAIKU pattern already in cs-handover.js.

- [x] **8.4 — Disqualification-discipline queue: force advance-or-kill on soft-close deals**  `M · impact 4 · grounded`
  - **Problem:** intel-analyze.js emits disqualification_signal/disqualification_notes in its flat JSON (~lines 473-505), but autoCreateTasksFromAnalysis (lines 182-321) only turns commitments + next_steps into tasks. The DQ signal is consumed only passively (intel-risk, deal-risk-alerts +10, signal-brief, call-intelligence display), so soft-close deals limp along in active stages with no forced advance-or-disqualify decision.
  - **Solution:** When disqualification_signal is true on an active-stage account, auto-create a high-priority task 'Decide: advance or disqualify {account}' with a pre-generated keep/kill brief, and run a manager DQ digest. Completing the task with a 'disqualify' action drives the account to closed_lost through the normal stage-write path.
  - **Build:** In pages/api/gong/intel-analyze.js autoCreateTasksFromAnalysis, add a branch creating a task with source='gong', source_type='gong_disqualification', priority 1, primary_action='disqualify', ai_draft via lib/taskActions.generateTaskDraft (kill/keep brief), gated identically to existing auto-tasks (isAutoProcessRep, call_category!='cs', repEmail, <72h AUTO_TASK_MAX_AGE_MS, profile exists). New pages/api/cron/dq-review.js modeled on pages/api/cron/deal-risk-alerts.js listing accounts with an unresolved DQ signal by days-since, DM'd to SLACK_MANAGER_CHANNEL; add its schedule to vercel.json. Wire the task's primary_action 'disqualify' to a closed_lost stage write.
  - **Depends on:** Reuses the engine auto-task path and the deal-risk-alerts cron/Slack pattern; the closed_lost write reuses the stage-write path (and benefits from the stage-history helper).

- [x] **8.5 — Cadence governance: per-stage touch SLAs from a unified activity source**  `M · impact 4 · grounded`
  - **Problem:** Cadence is ungoverned and fragmented: pursuit.js nextTouchType blindly cycles call->email->linkedin, its coverage target is hardcoded 8/30d, sdr_touches has no manager reader (effectively write-only), and stale/at-risk is defined five incompatible ways (ceo call>14d, team call>21d, bottleneck updated_at>21d, stage-analytics per-stage, pipeline-overview transcripts>14d) off divergent activity sources.
  - **Solution:** Define per-stage cadence SLAs (max days between touches) in sales_process_config as the single source, compute each active account's last activity from the UNION of sdr_touches.touched_at and gong_call_analyses.call_date, and for breaches create an owner task and roll a manager Slack digest — converging the five stale definitions and giving sdr_touches its first real read-consumer.
  - **Build:** Add cadence_sla JSONB to sales_process_config and to the ALLOWED sections in pages/api/sales-process.js + the pages/modules/sales-processes.js editor. New lib/cadence.js lastActivityFor(accountIds) unioning sdr_touches (touched_at) + gong_call_analyses (call_date, ignored=false/non-cs). New pages/api/cron/cadence-governance.js modeled on pages/api/cron/deal-pulse.js that creates tasks with source_type='cadence_breach' for the owner and DMs a breach digest to SLACK_MANAGER_CHANNEL; add its schedule to vercel.json. Over time, point pipeline-overview/ceo/team/bottleneck stale checks at lib/cadence.js to converge the definition. Note sdr_touches is sparse today (only call-queue writes it), so gong_call_analyses.call_date is the primary anchor.
  - **Depends on:** Reads gong_call_analyses (dense) + sdr_touches (sparse); reuses the deal-pulse cron/Slack pattern and the sales_process_config editor + ALLOWED-sections whitelist.

---

## 9. ROI tracker for initiatives (hire an SDR, a conference, a paid ad, a tool)  <sub>(full scope)</sub>

> **In one line:** Scoped an Initiative ROI Tracker for the Banner dashboard. Core design: a new `initiatives` table (cost, expected outcome, attribution rule spec) plus an `initiative_attributions` join table (deliberately NOT a column on `accounts`, to dodge the known `transformAccountToDb` write-path gap and to support multi-touch). Attribution is COMPUTED in a new `lib/initiativeRoi.js` from existing data via four modes — rule_rep (SDR hire → owner_name/user_id + sdr_touches + gong_call_analyses + lead_pipeline.sdr), rule_lead_source (conference/ad → lead_pipeline.booked_via + date window), rule_window (accounts.created_at window, low-confidence), and cohort (tool before/after). Revenue is windowed by close_date >= start_date exactly like scorecard.js; manual tags override rules. Metrics: spend-to-date, pipeline influenced, weighted pipeline, revenue attributed, ROI multiple, CAC, payback, win-rate delta. Exec view is a new /modules/sales-reports/initiative-roi page (KPI strip + winners/money-pits + sortable table) registered in the REPORTS grid. MVP = tables + resolver + 4 API routes + exec page + rep/lead-source attribution; Full adds cost line-items, nightly snapshots for payback curves, cohort win-rate deltas, AI synthesis, weekly Slack digest, and an assistant create_initiative verb. Reuses lib/supabase, lib/apiUtils, lib/repConfig.ownsAccount, lib/constants (STAGE_PROBABILITY), lib/slack. Surfaces honest data caveats (unreliable stage history, approximate created_at, write-only sdr_touches, no lead_pipeline.account_id).

- [x] Build the MVP of this

## ROI Tracker for Sales Initiatives — Scoped Proposal

Root: `/Users/banner-james/Desktop/Claude Code/Sales Dashboard/sales-dashboard`

### 1. The problem, in James's words

"I hired an SDR, went to a conference, ran a paid ad, bought a tool — which of these is actually paying off?" Today the dashboard tracks deals (`accounts.deal_value`, stage, `close_date`) and lead flow (`lead_pipeline`), but **nothing connects a dollar spent to a dollar earned.** There is no place to record that we spent $50k on a conference, and no computed link from that spend to the pipeline and revenue it produced. This feature adds that layer: an *initiative* is a discrete investment, and the tracker computes attributed pipeline / revenue / ROI from data the platform already has.

Design constraints from the reality brief that shape every decision below:
- **Attribution must be computed from existing tables**, not hand-maintained. Reps will not keep a spreadsheet.
- **`accounts` write path is asymmetric** (`transformAccountToDb` in `lib/db/accounts.js` has no branch for `deal_value`, `close_date`, etc.; writes only happen via direct upserts or `assistant/execute.js`). So we do **not** add attribution columns to `accounts` — we use a dedicated join table that our own routes own end-to-end.
- **Stage-history is structurally unreliable** (trigger dropped 2026-05-15; HubSpot's nightly `sync-deals.js` `.upsert()` bypasses all history writers). So win-rate and cycle metrics are computed from **current `stage` + `close_date`**, never from transitions.
- **`lead_pipeline` has no `account_id`** (match-leads writes to non-existent columns). The two funnels (`accounts`/HubSpot vs `lead_pipeline`/Sheets) are treated separately and de-duped best-effort by normalized company name.
- Reuse `lib/constants.js` `STAGE_PROBABILITY` / `ACTIVE_STAGE_ORDER` / `CLOSED_STAGE_IDS` by import — do not re-declare inline (the brief flags that anti-pattern in ceo-dashboard/scorecard).

---

### 2. Data model

Three new tables (one migration file: `supabase/migrations/20260717_initiatives.sql`), RLS mirroring `sales_goals` (read = any authenticated, write = any authenticated; role enforced in UI, per the app's informal model). Apply with `supabase db query --linked -f supabase/migrations/20260717_initiatives.sql` — **never `db push`**.

#### `initiatives` — one row per investment
```sql
CREATE TABLE IF NOT EXISTS initiatives (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name          text NOT NULL,
  type          text NOT NULL DEFAULT 'other',
                -- sdr_hire | conference | paid_ad | tool | agency | content | event | other
  status        text NOT NULL DEFAULT 'active',
                -- planned | active | paused | completed | cancelled
  description   text,
  owner_id      uuid REFERENCES profiles(id),          -- who's accountable
  start_date    date NOT NULL,                         -- attribution window anchor
  end_date      date,                                  -- null = ongoing (campaign/tool/hire)

  -- Cost (MVP inline; full uses initiative_costs below)
  cost_amount   numeric NOT NULL DEFAULT 0,
  cost_type     text NOT NULL DEFAULT 'one_time',      -- one_time | monthly | annual
  currency      text DEFAULT 'USD',
  gross_margin_pct numeric DEFAULT 100,                -- payback on margin if set

  -- Expected outcome (the hypothesis James is testing)
  expected_metric text DEFAULT 'revenue',             -- revenue | pipeline | meetings | logos
  expected_value  numeric,
  expected_by     date,
  hypothesis      text,

  -- Attribution rule spec — resolved by lib/initiativeRoi.js
  attribution   jsonb NOT NULL DEFAULT '{}',
  -- { mode, rep_ids[], rep_names[], window_days, verticals[],
  --   lead_booked_via[], baseline_start, baseline_end }

  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now()
);
```

#### `initiative_attributions` — computed + manual account/lead links (multi-touch)
```sql
CREATE TABLE IF NOT EXISTS initiative_attributions (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  initiative_id  uuid NOT NULL REFERENCES initiatives(id) ON DELETE CASCADE,
  account_id     uuid REFERENCES accounts(id) ON DELETE CASCADE,
  lead_pipeline_id uuid REFERENCES lead_pipeline(id) ON DELETE CASCADE,
  method         text NOT NULL DEFAULT 'rule',   -- manual | rule_rep | rule_window | rule_lead_source
  confidence     numeric NOT NULL DEFAULT 0.5,
  weight         numeric NOT NULL DEFAULT 1.0,   -- multi-touch split (full)
  excluded       boolean NOT NULL DEFAULT false, -- manual suppression of a false auto-match
  attributed_by  uuid REFERENCES profiles(id),   -- null = auto
  attributed_at  timestamptz DEFAULT now(),
  UNIQUE (initiative_id, account_id),
  UNIQUE (initiative_id, lead_pipeline_id)
);
```
Why a join table and not an `accounts.initiative_id` column: (a) sidesteps the `transformAccountToDb` write-path gap entirely — our routes write this table directly with the service-role client; (b) supports multi-touch (a deal can be credited to both a conference *and* an SDR); (c) lets rule-based auto-attribution refresh (`method LIKE 'rule%'`) without ever clobbering a manual decision (`method = 'manual'`, `confidence = 1.0`).

#### `initiative_costs` — line items (FULL only; MVP uses inline `cost_amount`)
```sql
CREATE TABLE IF NOT EXISTS initiative_costs (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  initiative_id uuid NOT NULL REFERENCES initiatives(id) ON DELETE CASCADE,
  label         text,
  category      text,          -- salary | travel | tickets | booth | ad_spend | subscription | other
  amount        numeric NOT NULL,
  cost_date     date NOT NULL, -- when incurred → drives spend-to-date accrual
  recurring     boolean DEFAULT false,
  created_at    timestamptz DEFAULT now()
);
```

#### `initiative_roi_snapshots` — nightly point-in-time metrics (FULL only)
Enables the payback curve, trend arrows, and week-over-week deltas in the Slack digest. `(initiative_id, snapshot_date)` unique; `metrics jsonb`.

---

### 3. How cost + expected outcome are entered

**Primary: a "New Initiative" modal on the exec page** (manager-gated), fields map 1:1 to `initiatives`:
- Name, type (dropdown), owner (from `GET /api/users`), start/end dates.
- Cost: amount + type (`one_time`/`monthly`/`annual`). MVP is one number; FULL adds a "+ line item" repeater writing `initiative_costs`.
- Expected outcome: metric + target value + by-date + free-text hypothesis ("expect 5 SQLs/mo by Q4").
- Attribution config: mode selector that shows only the relevant fields (rep picker for `sdr_hire`; `booked_via` value multiselect + window-days for `conference`/`paid_ad`; baseline date range for `tool`).

**Secondary (FULL): assistant verb.** Add `create_initiative` to the global assistant's write vocabulary (`pages/api/assistant.js` + `pages/api/assistant/execute.js`) — "track the Blueprint conference, $45k, started May 10, attribute leads booked via 'Conference' for 90 days." This fits the North Star ("assistant everywhere + action-capable") and routes through the existing authority boundary. Manual tagging of an individual deal ("credit this account to the SDR hire") is a small selector on the Account Pipeline header that POSTs a `manual` attribution row.

---

### 4. Attribution — computed from existing data

All resolution lives in **new `lib/initiativeRoi.js`**, called by the compute API. For each initiative it produces a deduped set of `{account_id | lead_pipeline_id, method, confidence}` = union of stored `initiative_attributions` rows **plus** freshly-resolved rule matches, then computes metrics. Manual rows always win; `excluded=true` rows suppress a match.

**Sources read (all read-only, service-role client):**
| Source table | Columns used | Role |
|---|---|---|
| `accounts` | `id,name,stage,owner_name,user_id,deal_value,close_date,vertical,created_at` | pipeline + revenue + rep/window match |
| `lead_pipeline` | `id,company,date_booked,sdr,ae,booked_via,vertical,closed_status,arr_value,date_closed` | lead-source + rep match, second funnel |
| `sdr_touches` | `rep_id,account_id,touched_at` | SDR-hire: which accounts a rep worked |
| `gong_call_analyses` | `rep_name,account_id,call_date` | SDR/AE: accounts a rep actually ran calls on |
| `tasks` | `owner_id,account_id` | supporting activity signal |
| `profiles` | `id,full_name,email` | resolve `owner_id` → name for matching |

**Attribution modes (rules):**

1. **`rule_rep` (SDR hire / new AE)** — attributed accounts = accounts owned by the rep (`ownsAccount(account, profile)` from `lib/repConfig.js`: durable `user_id` else normalized `owner_name`) **∪** accounts with a `sdr_touches.rep_id` = rep **∪** accounts with `gong_call_analyses.rep_name` matching **∪** `lead_pipeline` rows where `sdr`/`ae` = rep name — all filtered to `created_at`/`date_booked >= start_date`. Confidence 0.9.

2. **`rule_lead_source` (conference / paid ad with a tagged channel)** — `lead_pipeline` rows where `booked_via` ∈ `attribution.lead_booked_via[]` (e.g. `['Conference']`, `['LinkedIn Ad']` — real values already synced by `sheets/sync-leads.js`) **and** `date_booked` within window. Confidence 0.8. This is the strongest computed signal because `date_booked` is a real event date and `booked_via` is an explicit channel field.

3. **`rule_window` (event/ad with no channel field)** — `accounts` with `created_at` in `[start_date, end_date || start_date + window_days]` (default 90), optionally filtered by `verticals[]`. Confidence 0.4 — **surfaced but flagged low-confidence and excluded from headline CAC by default** (toggle to include). Caveat: `accounts.created_at` ≈ HubSpot-sync time, not true creation, so this is approximate; the UI says so.

4. **`cohort` (tool / enablement, no direct pipeline link)** — no per-deal attribution. Compares a **post window** (`start_date` → now) against a **baseline window** (`baseline_start`→`baseline_end`) team-wide: win-rate, avg sales-cycle days, meetings/rep. ROI is expressed as the deltas (and, if `expected_metric='revenue'`, lift × avg deal size). This is how "buy a tool" gets measured when it doesn't source leads directly.

**Precedence / date rules (concrete):**
- **Revenue is windowed** exactly like `pages/api/reports/scorecard.js`: a `closed_won` account counts only if `close_date >= initiative.start_date`. Never credit a deal that closed before the initiative existed.
- **Manual > rule.** `method='manual'` (conf 1.0) overrides any rule row for the same account; `excluded=true` removes a false positive.
- **De-dupe across funnels.** An account and a lead row for the same company are collapsed by normalized name (reuse `normalizeName` from `hubspot/match-calls.js`) so a deal isn't double-counted; if both carry `deal_value`/`arr_value`, prefer the `accounts` value.
- **Low-confidence isolation.** Headline KPIs use confidence ≥ 0.8 by default; a toggle includes window-only matches, with the ROI number visibly re-labeled "(incl. low-confidence)".

---

### 5. Metrics (per initiative + rolled up)

Computed in `lib/initiativeRoi.js`, importing `STAGE_PROBABILITY`/`ACTIVE_STAGE_ORDER`/`CLOSED_STAGE_IDS` from `lib/constants.js`:

| Metric | Formula |
|---|---|
| **Spend to date** | MVP: `cost_amount` if `one_time`; else `cost_amount × months_elapsed(start_date→min(today,end_date))`. FULL: `Σ initiative_costs.amount where cost_date <= today` + recurring accrual. |
| **Pipeline influenced** | `Σ deal_value` of attributed accounts in `ACTIVE_STAGE_ORDER`. |
| **Weighted pipeline** | `Σ deal_value × STAGE_PROBABILITY[stage]/100` (overridable via `sales_process_config.stage_weights`, same as scorecard). |
| **Revenue attributed** | `Σ deal_value` of attributed `closed_won` with `close_date >= start_date` (+ `Σ arr_value` of attributed `lead_pipeline` won rows, de-duped). |
| **ROI multiple** | `revenue_attributed / spend_to_date` (∞/"n/a" if spend 0). Color: ≥3× green, 1–3× amber, <1× red. |
| **CAC** | `spend_to_date / count(attributed closed_won logos)`. |
| **Payback period** | Month index where cumulative (revenue × `gross_margin_pct`) ≥ cumulative spend. MVP estimate: `spend / (revenue_attributed / months_elapsed)`; FULL: true crossover from `initiative_roi_snapshots`. "Not yet — projected N mo" when unpaid. |
| **Win-rate delta** | cohort `won/(won+lost)` among attributed accounts (current stage) **minus** baseline (team rate over comparable prior window, or non-attributed accounts). For `cohort` tools, post-window vs baseline-window. |
| **Expected vs actual** | actual metric ÷ `expected_value`, with `expected_by` pacing. |

Every metric carries a **coverage/caveat flag** (following `scorecard.js`'s `coverage: {valuedAccounts,totalAccounts}`): win-rate is stage-snapshot-based (history unreliable); pipeline understates where `deal_value` is null; window attribution is approximate.

---

### 6. The exec view

New page **`pages/modules/sales-reports/initiative-roi.js`**, registered in the `REPORTS` array of `pages/modules/sales-reports/index.js` (and optionally `ModulesNav`). Auth via `createServerSupabaseClient`, manager-gated in UI like the other exec reports.

Layout (following the platform's flat-white-card system, avoiding the gradient-hero and rainbow-bar problems the brief flags):
- **KPI strip:** Total invested (spend to date) · Total pipeline influenced · Revenue attributed · Blended ROI multiple · Blended CAC.
- **"What's paying off / what's bleeding":** two short columns — winners (ROI ≥ 3×) vs money-pits (ROI < 1× and past `expected_by`). This is the direct answer to James's question.
- **Initiative table**, sortable by ROI: name · type badge · status · spend-to-date · pipeline influenced · revenue attributed · ROI multiple (colored) · payback · win-rate delta chip · # deals. One consistent stage-color legend imported from constants.
- **Row expand → detail:** cost breakdown, expected-vs-actual bar, attributed accounts list (name, stage, deal_value, won/open, attribution method + confidence badge), the hypothesis text, and (FULL) an AI "is this paying off?" one-liner via `callAnthropic` (Sonnet) — same pattern as the Command Center scorecard synthesis. Manual add/remove/exclude attribution controls live here.

---

### 7. Roles & notifications

- **Roles:** managers/admins see all initiatives and can create/edit (page manager-gated, matching ceo-dashboard/team-dashboard). An initiative `owner_id` rep can view their own. No new strict server enforcement beyond the existing auth check — consistent with the documented informal role model.
- **Notifications (FULL):** weekly `pages/api/cron/initiative-roi-digest.js` (add to `vercel.json`, `CRON_SECRET`-guarded — and make the check mandatory, not the bypass pattern the audit flags) → `sendSlackMessage` from `lib/slack.js` to `SLACK_MANAGER_CHANNEL`: "Blueprint conference now 2.4× ($120k won / $50k spent). SDR hire (Mark) at 0.8×, ~4 mo to payback. Clay tool: win-rate +6 pts vs baseline." Deltas come from `initiative_roi_snapshots`. MVP ships no notifications.

---

### 8. MVP vs Full

**MVP (ship first):**
- Migration: `initiatives` + `initiative_attributions` (skip `initiative_costs`/snapshots).
- `lib/db/initiatives.js` (CRUD, styled like `lib/db/tasks.js`) + `lib/initiativeRoi.js` (resolver + metrics).
- APIs: `pages/api/initiatives/index.js` (GET/POST), `pages/api/initiatives/[id].js` (GET/PATCH/DELETE), `pages/api/initiatives/[id]/attributions.js` (GET resolved, POST manual, DELETE/exclude), `pages/api/reports/initiative-roi.js` (aggregated exec payload).
- Attribution modes `rule_rep` + `rule_lead_source` + manual tagging. `rule_window` included but low-confidence-flagged.
- Metrics: spend-to-date (inline cost), pipeline influenced, weighted pipeline, revenue attributed, ROI multiple, CAC, simple payback estimate.
- Exec page + REPORTS-grid registration. Recompute on request (cheap; no stored snapshots).

**Full (phase 2):**
- `initiative_costs` line items + accrual; `initiative_roi_snapshots` + nightly cron → true payback curve, trend arrows, week-over-week deltas.
- `cohort` mode (tool before/after), win-rate delta + sales-cycle-days delta.
- AI "is it paying off" per-initiative synthesis + weekly Slack digest.
- Assistant `create_initiative` / `attribute_account` verbs.
- Multi-touch weight splitting; lead↔account name de-dupe hardening.

---

### 9. What it plugs into (files / APIs / tables)

**New files:**
- `supabase/migrations/20260717_initiatives.sql`
- `lib/db/initiatives.js`, `lib/initiativeRoi.js`
- `pages/api/initiatives/index.js`, `pages/api/initiatives/[id].js`, `pages/api/initiatives/[id]/attributions.js`
- `pages/api/reports/initiative-roi.js`
- `pages/modules/sales-reports/initiative-roi.js`
- (Full) `pages/api/cron/initiative-roi-digest.js`

**Existing files touched:**
- `/Users/banner-james/Desktop/Claude Code/Sales Dashboard/sales-dashboard/pages/modules/sales-reports/index.js` — add a `REPORTS` card.
- `/Users/banner-james/Desktop/Claude Code/Sales Dashboard/sales-dashboard/lib/constants.js` — import `STAGE_PROBABILITY`/`ACTIVE_STAGE_ORDER`/`CLOSED_STAGE_IDS` (no change; consume, don't re-declare).
- (Full) `/Users/banner-james/Desktop/Claude Code/Sales Dashboard/sales-dashboard/vercel.json` — digest cron; `pages/api/assistant.js` + `pages/api/assistant/execute.js` — `create_initiative` verb.

**Existing infra reused (no change):**
- `lib/supabase.js` — `getSupabase()` for DB, `createServerSupabaseClient(req,res)` for auth (per CLAUDE.md pattern).
- `lib/apiUtils.js` — `apiError`, `apiSuccess`, `logRequest`, `callAnthropic`, `parseClaudeJson`.
- `lib/repConfig.js` — `ownsAccount()` for rep attribution.
- `lib/slack.js` — `sendSlackMessage` + `SLACK_MANAGER_CHANNEL` (Full digest).
- `pages/api/reports/scorecard.js` — mirror its close-date windowing and `sales_process_config.stage_weights` override.

**Tables read for attribution:** `accounts`, `lead_pipeline`, `sdr_touches`, `gong_call_analyses`, `tasks`, `profiles`, `sales_process_config`.

---

### 10. Honest data caveats (surfaced in-UI, not hidden)
- Win-rate/cycle metrics use **current stage + `close_date`**, not transitions — stage history is incomplete (dropped trigger; HubSpot upserts bypass writers).
- **`accounts.created_at` ≈ HubSpot-sync time**, so `rule_window` is approximate → low-confidence by default; prefer `rule_lead_source` (`lead_pipeline.date_booked` is a real event date).
- **`sdr_touches` is effectively write-only and James-era**, so SDR-hire touch coverage undercounts — `owner_name` + `lead_pipeline.sdr` carry more weight.
- **No `account_id` on `lead_pipeline`** → funnels de-duped by normalized name, best-effort; flagged where uncertain.
- **`deal_value` coverage is partial** (scorecard tracks `valuedAccounts/totalAccounts`) → pipeline influenced may understate; coverage ratio shown.
- **No margin data** → payback uses ARR/revenue by default with an editable `gross_margin_pct`.

---

## 10. Moonshots — big swings (up to $500 POC each)  <sub>(5 ideas)</sub>

- [we should scope this one more before we build. I have fear of automating outrach - could this, at least to start queue them up for an SDR to review and send? as a POC] **M1 — Apollo Autonomous Outbound Engine — the platform builds and works its own pipeline every night**  `XL · impact 5 · grounded`
  - **Problem:** Top-of-funnel is the platform's hard ceiling. The Outbound Engine (pages/modules/outbound-engine.js + lib/outboundStorage.js) is localStorage-only and literally cannot add a company — 'Add Company' is a `{/* TODO */}` stub in TWO places (lines 213, 280). There is no seed source, no enrichment, no CSV import. Account Pursuit and the Today CallQueue are separate localStorage toys that never sync. So the one real pipeline-gen tool has zero way to get data into it, and only James is auto-processed by the Gong engine. The platform reports on pipeline it cannot create.
  - **Solution:** VISION: Wire Apollo.io end-to-end so the platform autonomously (1) BUILDS lists against Banner's exact CRE ICP (multifamily owners 50-500 units, senior-living operators, IWL portfolios — the verticals already in lib/outboundConstants.js), (2) ENRICHES every org with ATL/BTL/champion contacts, direct dials, LinkedIn and verified email, (3) PERSONALIZES a distinct opener per person grounded in that vertical's real Gong pain themes + BANNER_EMAIL_STYLE_GUIDE voice, and (4) EXECUTES the send mostly automatically through a shrinking human-approval gate that widens as reply quality proves out. Positive replies auto-become deals via the existing outbound→pipeline bridge. WHY A HOME RUN FOR BANNER: this converts the single biggest constraint (no pipeline generation, one auto-processed rep) into a nightly growth engine — it turns a dashboard into a demand factory, and it does it grounded in intel no generic Apollo sequence has (Banner's own won-call pain language).
  - **Build:** BUILD: new lib/apollo.js (mirror lib/slack.js + createGongHeaders pattern) with searchOrganizations(icpFilters)/enrichPerson/getVerifiedEmail; new env APOLLO_API_KEY. New migration promoting the localStorage shape to Postgres: outbound_companies + outbound_contacts (classification ATL|BTL|POTENTIAL_CHAMPION already defined in outboundStorage.js), plus outbound_messages(company_id, contact_id, draft, status, approved_by, sent_at, reply_at). New cron pages/api/cron/apollo-build-list.js (GitHub Actions like process-recent-calls.yml) that pulls Apollo orgs, dedups vs live accounts using the fuzzy matcher already exported by hubspot/match-calls.js (matchScore/normalizeName/extractCompanyFromTitle). Personalization: add type:'cold_open' to pages/api/content/generate.js, grounded in gong_aggregate_analysis vertical themes + the org's Apollo profile via callAnthropic (Sonnet). CLOSE THE SEND GAP: gmail is read-only today (gmail/suggestions.js takes provider_token, no send scope) — add gmail.send scope + pages/api/gmail/send.js; fix the two Add-Company TODO stubs into a review/approve queue. Wire replies back through the existing outbound-engine.js handleCreateAccount → useAccountStore.createAccount (stage intro_scheduled, carries outbound_company_id, ATL→Sponsor/BTL→Influencer/CHAMPION→Champion already mapped at lines 73-75). $500 POC: skip the UI — scripts/apollo-poc.mjs against ONE vertical (multifamily owners US 50-500 units): pull 200 orgs + 2 ATL contacts each, dedup vs accounts, generate 25 personalized cold emails grounded in gong_aggregate_analysis + BANNER_EMAIL_STYLE_GUIDE, write to outbound_messages; James sends the 25 by hand. Cost = Apollo credits (~$100) + Claude tokens, under $500. SCALE METRIC: booked meetings per 100 Apollo-sourced contacts (reply→meeting rate). If 25 sends yield ≥2 meetings (8%+), turn on nightly multi-vertical build + gated auto-send.
  - **Depends on:** Apollo.io API account + APOLLO_API_KEY; Gmail send scope (currently read-only) or a sending provider (Resend/Postmark); Supabase migration to replace outbound localStorage. Reuses: hubspot/match-calls fuzzy matcher, content/generate, gong_aggregate_analysis, outbound→pipeline bridge.

- [x] **M2 — Perfect-Gift Engine — mine each buyer's digital footprint to find the one gift that earns a meeting or thanks a champion**  `L · impact 4 · speculative`
  - **Problem:** Gong transcripts already capture offhand personal signals ('my kid plays hockey', 'just got back from Napa', alma mater, hobbies) inside gong_call_analyses.transcript_text — and none of it is ever used. Banner sells large-ACV CRE spend management to small, senior buying committees, but has no relationship-capital lever: no way to break into a cold whale or thank a champion beyond another cold email. stakeholders has name/title/role/email but no place to store what a person actually cares about.
  - **Solution:** VISION: For any target stakeholder or new customer, the platform mines their public footprint (LinkedIn activity via Apollo, X posts, company news, podcast/press appearances) PLUS personal signals extracted from their own Gong calls, then proposes 3 ranked gifts + a handwritten-style note in Banner's voice, ranked by meeting-conversion likelihood and bounded by a rep budget — and executes the send via a gifting API. Auto-triggers on the moments that matter: stage→closed_won (thank the champion), a stalled whale (break in), or a detected personal moment mid-deal. WHY A HOME RUN FOR BANNER: on six-figure CRE deals a thoughtful $75 gift that lands one meeting with a VP of Facilities at a 20,000-unit REIT has absurd ROI, and no CRE proptech competitor does automated, call-intel-grounded gifting. It converts dead transcript exhaust into the highest-conversion outreach channel that exists.
  - **Build:** BUILD: extend pages/api/gong/intel-analyze.js Haiku output with a personal_signals[] array (or a dedicated cheap pass over transcript_text); migration adds stakeholders.personal_signals jsonb + gift_history jsonb. Web mining via the available WebSearch/WebFetch tools + Apollo person enrichment (shared with idea 1). New lib/gifting.js wrapping a gifting provider (Sendoso/Postal/&Open) behind GIFTING_API_KEY; new tables gift_recommendations(stakeholder_id, account_id, signals_used jsonb, ideas jsonb, chosen, budget_cents, status, sent_at, outcome) and gift_budgets(rep_id, monthly_cap_cents, spent_cents). Synthesis via callAnthropic (Sonnet) grounded in BANNER_EMAIL_STYLE_GUIDE. Surface as a new assistant verb `recommend_gift` through the pages/api/assistant/execute.js authority boundary + a card on the stakeholder view and Call Queue row. $500 POC (ideal — gifts cost money): pick 5 high-value stalled/whale accounts; for each run WebSearch/WebFetch + Gong transcript_text mining → Sonnet 3 gift ideas + note; James picks one; ACTUALLY SEND 5 real gifts (~$70 each = ~$350) with the note, logged in gift_recommendations. Track 3-week meeting-book/reactivation rate. SCALE METRIC: meetings booked (or dead deals reactivated) per gift sent. If ≥2 of 5 cold/stalled whales convert, that cost-per-meeting justifies the gifting API + auto-trigger on win/stall.
  - **Depends on:** WebSearch/WebFetch (available as deferred tools); gifting provider API + GIFTING_API_KEY; personal_signals extraction added to intel-analyze; Apollo enrichment (shared with idea 1) improves signal quality but not required for POC.

- [x] **M3 — Deal OS — an autonomous AI AE that works every deal every night and finally closes the account write-back gap**  `XL · impact 5 · grounded`
  - **Problem:** The engine's stated 4th output — writing MEDDICC/stakeholders/gaps back to the account — is CONFIRMED UNBUILT (no file in pages/api/gong/* or cron/* writes stakeholders/information_gaps). accounts.meddicc is a dead no-op merge (hooks/useAccounts.js:158 merges a key analyze-transcript never emits). Worse, the three assistant brains are split: the write-capable global assistant is grounding-starved (one thin account line), while the deeply-grounded accounts/chat.js can't write. transformAccountToDb in lib/db/accounts.js can't even persist dealValue/closeDate/meddicc. So the platform's intelligence is stale-by-design and nothing acts on it.
  - **Solution:** VISION: A per-deal autonomous agent runs nightly over active-stage accounts. It assembles everything the platform knows (Gong calls, MEDDICC, stakeholders, gaps, tasks, notes, Slack channel, HubSpot stage), (a) refreshes and WRITES BACK the account's MEDDICC/stakeholders/gaps — finally firing the missing 4th output — and (b) decides the single highest-leverage next action to advance the deal, drafts it (email, Slack nudge, internal task, content asset), and within guardrails executes it through the existing authority boundary. It unifies the three divergent brains into one authoritative, grounded, action-capable deal agent. WHY A HOME RUN FOR BANNER: this is the literal AI-first north star ('AI does the work') made real, and for a team with one auto-processed rep and dozens of stalling deals it is the equivalent of hiring a floor of AEs who never forget to follow up.
  - **Build:** BUILD: extract the rich context assembly already living in pages/api/accounts/chat.js (accounts + gong_call_analyses last 15 + tasks + stakeholders + gaps + notes + MEDDICC + account_memory + sales_process_config) into a shared lib/dealContext.js. New cron pages/api/cron/deal-agent.js iterating active-stage accounts. Fix the write-back: have the agent emit + persist meddicc/stakeholders/information_gaps (tables already exist in schema.sql + lib/db/stakeholders.js/gaps.js), and repair transformAccountToDb asymmetry in lib/db/accounts.js so meddicc/dealValue/closeDate persist. Route ALL actions through pages/api/assistant/execute.js (the only authenticated, idempotent, ownership-checked boundary), widening its 4 verbs toward the richer 16-verb set in account-assistant.js but under that boundary. New table deal_agent_runs(account_id, run_date, context_hash, decided_action, action_payload jsonb, status, approved_by, executed_at, outcome). Human gate: agent proposes → Slack DM to owner (POC uses the existing task/ai_draft surface until Slack interactivity ships). $500 POC (no new integration cost, pure Claude tokens): scripts/deal-agent-poc.mjs runs shared context assembly over James's ~20 active deals nightly for 2 weeks — for each writing updated MEDDICC/gaps to the account (proving the write-back gap closes) + one recommended next action with a ready ai_draft dropped into tasks. ~280 deal-runs of Sonnet ≈ $500. SCALE METRIC: deal-advancement rate — % of agent-worked deals that move a stage or log a positive stakeholder touch within 2 weeks vs a holdout set (secondary: MEDDICC field completeness rising from ~0 today to >70%). Beat the holdout → enable auto-execute.
  - **Depends on:** Reuses accounts/chat grounding, assistant/execute authority boundary, existing meddicc/stakeholders/gaps tables. Needs transformAccountToDb fix + shared lib/dealContext.js. Full auto-execute needs Slack interactivity (currently a gap) for approvals; POC works without it.

- [x] **M4 — Intent Radar — the platform finds the deal in the outside world before the rep does**  `L · impact 4 · speculative`
  - **Problem:** Every 'who to call' surface ranks on stale INTERNAL signals only. /api/sdr/call-queue.js scores on days-since-last-call + hardcoded stage points + icp_score; pursuit.js nextTouchType blindly cycles call→email→linkedin and is explicitly not signal-driven. The platform has zero awareness of the outside world, so reps reach out with generic timing and all Call Queue status pills render identical gray (no real signal to show).
  - **Solution:** VISION: An always-on intent engine watches for CRE buying signals mapped to Banner's verticals — new construction/renovation programs, portfolio acquisitions, new VP-of-Facilities/Construction hires, expansion press, earnings-call capex commentary — and automatically creates/enriches a pursuit account, writes a hypothesis tied to the event, drafts a perfectly-timed opener that references it, and drops it into the Call Queue ranked by signal freshness. A rep opens the queue to: 'Avanath announced a 3,000-unit reno program 2 days ago — call Maria (VP Facilities), here's the opener.' WHY A HOME RUN FOR BANNER: Banner's ICP spends on renovation/construction, and those spends are announced publicly and are time-boxed — the window to sell spend management is exactly when a capex program is being planned. Event-triggered, event-referencing outreach is the single biggest lever on cold reply rate, and it makes the Call Queue's gray pills mean something real.
  - **Build:** BUILD: lib/intentSignals.js using the available WebSearch/WebFetch tools (Google News RSS is free) with per-vertical query templates keyed to lib/constants.js VERTICALS. New cron pages/api/cron/intent-scan.js: Sonnet classifies + extracts {company, signal_type, event_date, capex_hint, source_url}, dedups vs accounts and lead_pipeline using the existing hubspot/match-calls fuzzy matcher. New table intent_signals(company, matched_account_id, vertical, signal_type, summary, source_url, detected_at, freshness_score, status). Add a signalPts term to the /api/sdr/call-queue.js composite score and render a real signal chip on the row. Auto-draft via a new signal_open type in content/generate.js grounding the message in the event + gong_aggregate_analysis themes. Net-new companies feed idea 1's outbound_companies. $500 POC: scripts/intent-poc.mjs over the two biggest verticals (multifamily, senior living) for 2 weeks — daily WebSearch for reno/acquisition/exec-hire signals, Sonnet extract+match, produce a ranked 'hot signals' digest with one drafted opener each, post to Slack via existing lib/slack.js sendSlackMessage. ~$500 in tokens/search. SCALE METRIC: reply/meeting rate on signal-triggered outreach vs baseline cold outreach. If event-referencing openers convert 2-3x baseline reply rate, roll to all verticals + auto-enqueue into the Call Queue.
  - **Depends on:** WebSearch/WebFetch (deferred tools, available); optional paid intent/news API for coverage. Reuses hubspot/match-calls matcher, content/generate, lib/slack, gong_aggregate_analysis. Feeds and is fed by idea 1.

- [x] **M5 — Living Deal Room — auto-built, engagement-tracked buyer microsites with a real ROI model**  `L · impact 4 · grounded`
  - **Problem:** Banner sells spend management, where the deal-winning asset is 'here's exactly how much you'd save' — yet content is a dead end. Content Studio (content.js + content/generate.js) is read-only, saves nothing (edits live in an in-memory cacheRef, lost on reload), lib/db/content.js is imported by nothing, and every 'send' path is a manual mail.google.com compose URL. The Account-Pipeline ContentTab's Export button is a literal no-op. The account columns map_data and close_plan exist (referenced in accounts/generate-map.js) but there is no buyer-facing surface and zero engagement signal — the platform has never once seen a prospect open anything.
  - **Solution:** VISION: For each active deal the platform auto-generates a persistent, buyer-facing Deal Room — a single shareable link that houses (1) an INTERACTIVE ROI/savings model computed from the account's real metrics (units, sqft, annual spend from VERTICAL_METRICS/business_areas) with a live slider the buyer can adjust, (2) the mutual action plan from map_data/close_plan, (3) the tailored business case grounded in that account's Gong-captured pains, and (4) next steps. It's shared to the buying committee via the pursuit Slack channel and email, and every open/scroll/slider-move is tracked and fed back to the rep and the Deal OS agent as a buying signal. WHY A HOME RUN FOR BANNER: it turns intel into a viral, trackable, quantified sales asset — the exact 'digital sales room' motion that wins high-ACV B2B — and gives the platform its first buyer-facing surface with engagement analytics, closing the content-never-saved / export-no-op / no-send gaps in one stroke.
  - **Build:** BUILD: promote content persistence — actually use the orphaned lib/db/content.js + generated_content table (currently imported by nothing). New table deal_rooms(account_id, slug, roi_inputs jsonb, sections jsonb, published_at) + deal_room_views(deal_room_id, viewer_hint, event, at) for engagement. ROI model computed from getMetricsForAccount(vertical, ownershipType) in lib/constants.js + business_areas/metrics on the account; business-case copy from callAnthropic (Sonnet) grounded in gong_call_analyses (reuse content/generate.js grounding) + map_data/close_plan from accounts/generate-map.js. Render the room as a self-contained hosted page (the Artifact tool renders exactly this class of interactive single-file page) with a tracking beacon POSTing to a new pages/api/deal-room/[slug]/event.js. Share via existing lib/slack.js into the pursuit_<account> channel + a Gmail link. Feed view events back as a signal into the Call Queue score and the Deal OS agent (idea 3). $500 POC: build 5 real Deal Rooms for James's most active deals (ROI model + business case + live view tracking), share the links into their pursuit Slack channels, and watch opens for 2 weeks. Pure build time + minimal tokens, under $500. SCALE METRIC: buyer engagement rate — % of shared rooms opened by a buyer-side viewer, and stage-advance rate of opened-room deals vs non-opened. If opened rooms advance materially faster, auto-generate a room for every active deal.
  - **Depends on:** Reuses generated_content table + lib/db/content.js (dead today), content/generate grounding, VERTICAL_METRICS, map_data/close_plan columns, lib/slack. Needs a hosted-page host with a tracking endpoint (Artifact-class self-contained page + pages/api/deal-room event beacon). Engagement events plug into ideas 3 and 4.

---

## Ready to build?

Tick any boxes above, add notes inline, save this file, and tell me **"execute the checked items in PLATFORM_REVIEW."** I will sequence them by impact/effort, and for anything ambiguous I will confirm scope before building. Full evidence: [PLATFORM_REVIEW_2026-06-29_brief.md](PLATFORM_REVIEW_2026-06-29_brief.md). 24 module screenshots were captured during this review (desktop + mobile).
