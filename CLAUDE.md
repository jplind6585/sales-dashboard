# CLAUDE.md — Sales Dashboard

This file is read automatically at the start of every Claude Code session. Keep it up to date as features ship, bugs are fixed, and decisions are made. Do not let it go stale.

> **Full platform audit (2026-06-27): see [`PLATFORM_AUDIT_2026-06-27.md`](PLATFORM_AUDIT_2026-06-27.md).** Scorecard, ranked gaps, verified cleanup, and the sequenced path forward. Read it before planning new work.

---

## North Star (the bar to build against)

This is **not a CRM with buttons**. Three hard requirements drive every decision:

1. **AI-first / push-don't-pull** — surface work TO reps automatically; don't make them go find it. AI does the work conversationally instead of a button per action. Reps should be on calls, not managing the tool.
2. **The AI Assistant should be everywhere + action-capable** — persistent on every module, and able to WRITE through conversation ("move these 6 accounts to proposal", "change the next step on UDR", "add a task for the team"), not just answer/navigate.
3. **Call Intelligence is the engine underneath everything** — every Gong call auto-ingests → analyzes → produces FOUR outputs at once: (a) updates account MEDDICC/stakeholders/gaps, (b) creates Tasks from next steps, (c) rolls into dashboard analytics, (d) generates rep + account coaching.

**Phase 1 shipped (2026-06-27) — handoff blockers fixed:**
- ✅ **Engine de-Jamesed**: rep governance now lives in `lib/repConfig.js` (auto-process / historical / excluded). Auto-tasks resolve the rep's `user_id` from `profiles` by email (no hardcoded UUID map), and the per-call coaching DM + auto-tasks are centralized in `intel-analyze.js` so EVERY analysis path (poller, backlog, nightly) feeds them — gated to auto-process reps, sales-category calls, and a 72h freshness window (no backlog spam, idempotent via `call_coaching_cards`). To onboard a rep to the full loop, add them to `AUTO_PROCESS_REPS`. **Mark is intentionally still manual** — promote him in repConfig when desired.
- ✅ **CS-call pollution fixed**: `call_category != 'cs'` (null-safe `.or`) now filters rep-coaching, rep-coaching-trend, competitive-analytics, intel-aggregate, ceo-dashboard.
- ✅ **Rep-filtering enforced**: the excluded list (Leah/David/Julian/Kyle/Amber/Josh/Kelly/Wendy/Chris) is now enforced in `nightly-intel` (import + analyze) and `process-backlog`.
- ✅ **Coaching field bug + fresh-call routing**: rep-coaching reads `rep_talk_ratio`/row-level `title` (was the never-emitted `talk_ratio`/`call_title`); coaching DM carries the matched account name; the fresh-call auto-task Slack now goes to the **rep's own DM**, not the manager channel.
- ✅ **Deprecated model fixed**: retired `claude-sonnet-4-20250514` replaced with `claude-sonnet-4-6` across all 10 remaining files; model ids now centralized in `CLAUDE_MODELS` (lib/constants.js), referenced by the `apiUtils` default.

**Still open (where we still fall short — see ROADMAP phases 3–5):**
- **Output (a) is unbuilt**: the Gong pipeline never writes MEDDICC/stakeholders/gaps back to the account. That extraction lives in a disconnected client-side `analyze-transcript.js` flow that persists nothing server-side. So it's "3½ outputs," not 4. (Phase 3)
- **No real-time / no Gong webhook**: processing is polling (hourly `nightly-intel` cron in full mode + a 15-min GitHub Actions poll). The vision's <30min webhook (T1) does not exist. (Phase 3)
- **The assistant can only write in one place** (account-pipeline `AISidebar`, one selected account); it is not mounted globally and the other chat surfaces are read-only. (Phase 4)
- **Deal-risk has 3 divergent formulas**: `score-deal-risk`/`rescore` write `accounts.risk_score` (the intended source), but `deal-risk-alerts` + `intel-risk` recompute a different formula on the sparse `transcripts` table. Point them at the stored score. (Phase 2)

---

## Who This Is For

**Banner** — a CapEx management software company with a small sales team (~5 reps + 1 manager/CEO, James). This is an internal sales tool that replaces manual HubSpot entry, scattered Slack updates, and copy-pasting between tools. Reps live in this app day-to-day. James (the manager/CEO) uses it for pipeline visibility.

The goal is to reduce rep busywork, surface what needs attention, and keep deals moving without reps having to manually update five different systems.

---

## The User (James)

- James is the manager/CEO and the primary person building this with Claude Code
- He is not a developer — explanations should be clear and non-technical unless he asks otherwise
- He wants concise responses: build it, ship it, move on. No trailing summaries of what was just done
- He is building this iteratively — features get added in chunks, often scoped in conversation first
- When something is ambiguous, propose the simplest approach and explain the tradeoff briefly

---

## Tech Stack

| Layer | Tech |
|---|---|
| Frontend | Next.js 14, React 18, Tailwind CSS |
| Backend | Next.js API routes (serverless on Vercel) |
| Database | Supabase (PostgreSQL + Row Level Security) |
| Auth | Supabase Auth + Google OAuth (restricted to @withbanner.com) |
| AI | Anthropic Claude — Sonnet 4.6 (complex generation), Haiku 4.5 (fast extraction) |
| Integrations | Gong API, Gmail API, Google Calendar API, Slack Bot API |
| Deployment | Vercel (with cron jobs via vercel.json) |
| State | Zustand (`stores/useAccountStore.js`, `stores/useAuthStore.js`) |
| Storage | Supabase (primary) + localStorage (Outbound Engine + Account Pursuit + SDR touch log) |

---

## Project Structure

```
pages/
  modules/           # Full-page module views
    tasks.js         # Task management (quick-nav includes Today, Pursuit, Bottleneck)
    today.js         # Role-aware landing page (SDR call queue / AE focus / Manager team view)
    account-pipeline.js
    pursuit.js       # Account Pursuit Dashboard — top-50 SDR named accounts, touch logging, localStorage
    outbound-engine.js
    pipeline-overview.js
    bottleneck.js    # Bottleneck Tracker — funnel conversion rates, stall alerts, per-rep table
    settings.js      # Email sig, Slack ID, rep_type (SDR/AE) selector
    content.js
  api/               # Serverless API routes
    tasks.js         # GET (list), POST (create)
    tasks/[id].js    # GET, PATCH, DELETE
    tasks/call-commitments.js  # GET — unresolved Gong commitments/next steps for tasks panel
    users.js         # GET all profiles (for assign-to dropdowns)
    me.js            # GET/PATCH current user profile (allows: slack_user_id, full_name, rep_type)
    pipeline-overview.js
    bottleneck.js    # GET — stage conversion rates, bottleneck detection, stall alerts
    send-daily-digest.js
    slack/notify.js  # Real-time Slack notifications (stage change, task complete)
    gmail/suggestions.js
    calendar/upcoming.js
    calendar/prep-brief.js  # POST — AI pre-call brief (fuzzy account match + call history)
    gong/import-call.js, list-calls.js, onboarding-sync.js
    gong/account-competitors.js  # GET ?accountId — aggregated competitor mentions across calls
    playbooks/execute.js  # POST {playbookId, accountId} — creates task batch from playbook steps
    cron/cleanup-inactive-users.js
    cron/sdr-activity.js  # 9pm UTC weekdays — SDR Activity Leaderboard → Slack manager channel
    cron/rep-pulse.js     # 10pm UTC weekdays — private Slack DM per rep (coaching + tomorrow focus)
    generate-*.js    # Claude-powered generation endpoints (follow-up, demo-brief, next-actions, etc.)
    analyze-transcript.js
    account-assistant.js
    platform-assistant.js

components/
  smart-suggestions/SmartSuggestionsPanel.jsx
  tabs/              # Account Pipeline tabs
    OverviewTab.jsx
    TranscriptsTab.jsx
    StakeholdersTab.jsx
    InformationGapsTab.jsx
    ContentTab.jsx
    CurrentStateTab.jsx
  tasks/TaskCompleteModal.jsx
  auth/UserMenu.jsx
  common/, layout/, modals/, outbound/

lib/
  supabase.js        # Client helpers — READ THIS before touching auth
  auth.js
  slack.js           # Multi-channel Slack routing
  db/
    accounts.js      # All account DB operations + snake_case ↔ camelCase transforms
    tasks.js
    transcripts.js
    stakeholders.js
    gaps.js
    notes.js
    content.js
  constants.js
  userSettings.js

stores/
  useAccountStore.js # Zustand — accounts, stage changes, Slack notify on stage change
  useAuthStore.js

supabase/migrations/ # SQL migration files (for reference)
vercel.json          # Cron job schedules
```

---

## Critical: Supabase Auth Pattern

This has caused a major bug before. Understand this before touching any API route.

### The wrong way (caused 401s on all task routes):
```js
// getSupabase() server-side used createBrowserClient which has no cookie access
// auth.getUser() returned null → 401
import { getSupabase } from '../../lib/supabase'
const supabase = getSupabase() // ❌ wrong on server — no session cookies
```

### The right way:
```js
// API routes: use createServerSupabaseClient to read session from HTTP cookies
import { createServerSupabaseClient } from '../../lib/supabase'
const supabase = createServerSupabaseClient(req, res)
const { data: { user } } = await supabase.auth.getUser()
if (!user) return res.status(401).json({ error: 'Unauthorized' })

// DB operations: use getSupabase() with service role key (bypasses RLS)
import { getSupabase } from '../../lib/supabase'
const db = getSupabase() // ✅ server-side uses SUPABASE_SERVICE_ROLE_KEY
```

### How it works:
- `createClient()` → browser client (React components, client-side only)
- `createServerSupabaseClient(req, res)` → server client that reads session from `req.cookies` — use this in API routes to verify auth
- `getSupabase()` → server-side returns a service-role client (bypasses RLS for DB ops); client-side returns singleton browser client
- Auth is validated at the API route level. DB operations use service role and bypass RLS intentionally.

---

## Database Schema (Key Tables)

### `profiles`
- `id` (uuid, matches auth.users)
- `full_name`, `email`, `role` (`rep` | `manager`)
- `slack_user_id` — rep's Slack Member ID for DM digest routing

### `accounts`
- `id`, `user_id`, `name`, `stage`, `vertical`, `ownership_type`
- `slack_channel` — explicit override for Slack routing (e.g. `pursuit_udr`); if null, auto-derived from name
- All related data fetched via Supabase joins: `transcripts`, `stakeholders`, `information_gaps`, `notes`

### `tasks`
- `id`, `title`, `description`, `status`, `priority`, `type`, `owner_id`, `account_id`
- `due_date`, `source` (`manual` | `email` | `calendar` | `gong`), `source_id`
- `visible_to_manager`, `completed_at`
- Types: `triggered`, `assigned`, `recurring`, `project`
- Status: `open`, `in_progress`, `complete`, `blocked`
- Priority: `1` (high), `2` (medium), `3` (low)

### `transcripts`, `stakeholders`, `information_gaps`, `notes`
- All tied to `account_id`

### DB transforms
`lib/db/accounts.js` handles snake_case ↔ camelCase conversion between Supabase and the frontend. If you add a new column to `accounts`, add it to both `transformAccountFromDb` and `transformAccountToDb` in that file.

---

## Auth & Access Control

- Google OAuth restricted to `@withbanner.com` — any other domain gets signed out with an error banner
- First login auto-provisions a profile with `role: rep`
- Two roles: `rep` (default) and `manager`
  - Managers see the Team view in Tasks and the Pipeline Overview module
  - No strict permission enforcement beyond role checks in the UI
- Inactive account cleanup: Vercel cron runs 1st of month at 2am, deletes users inactive 6+ months

---

## Modules — What's Built

### Tasks (`pages/modules/tasks.js`)
The default landing page after login. Not a secondary module — the front of the app.

**Features:**
- Create, prioritize, track tasks by status / priority / account
- Filter: Active / All / Complete
- Task types: Triggered, Assigned, Recurring, Project — displayed as grouped lists
- Status: open, in_progress, complete, blocked
- **AI task completion** — marking complete opens `TaskCompleteModal` which uses Claude to draft the deliverable (email, call prep, doc, action plan) with refinement questions
- **Smart Suggestions panel** (`SmartSuggestionsPanel.jsx`) — auto-syncs Gmail + Calendar on page load when Google token is available; suggestions are expandable (click to see why surfaced, source email, sender, context); click + to add as task, ✕ to dismiss, ⓘ to expand; "Block sender" button on each suggestion persists sender to localStorage blocklist (`email_sender_blocklist`); `(no subject)` emails auto-filtered; blocked sender count shown in metrics strip with "clear" link
- **AI Prep Brief modal** — calendar meeting "AI Brief" button (was "Prep task") opens a modal that fuzzy-matches meeting title to pipeline accounts, pulls call history + stakeholders, generates brief via Sonnet 4.6 with: opening recommendation, objectives, talking points, discovery questions, watch-outs, closing ask; "Add prep task with brief" attaches full brief to task description; "Basic task" skips brief; powered by `POST /api/calendar/prep-brief`
- **From Recent Calls panel** (`CallCommitmentsPanel`) — sits above Smart Suggestions; fetches from `GET /api/tasks/call-commitments`; surfaces commitments and next steps from last 7 days of Gong calls that don't already have a task; each item shows account name, call date, type badge (your commitment / next step); [+ Add task] and [✕ dismiss] per item; dismissals persisted to localStorage (`call_commitments_dismissed`); panel hidden when no items
- **Cross-assign** — New Task modal has "Assign to" dropdown; fetches all team members from `GET /api/users`; defaults to self
- **Demo seed tasks** — auto-populates "Email UDR for an update" and "Create swim lanes for IRT" on first load when task list is empty
- **Recurring task templates** — daily/weekly/monthly tasks that auto-spawn instances
- **Manager view** — managers see all reps' tasks in a team grid (expandable per-rep)
- **Task completion → Slack** — fires to account's Slack channel via `POST /api/slack/notify`
- **Stage-change task checklists** — auto-creates tasks when an account moves stages (exists but needs customization to Banner's actual process)

**Key state:** Tasks fetched from `GET /api/tasks`; summary from `GET /api/tasks?view=team`. Provider token for Google APIs grabbed from Supabase session on mount.

---

### Account Pipeline (`pages/modules/account-pipeline.js`)
Core deal tracking. Accounts have **9 tabs** (Overview, Transcripts, Stakeholders, Information Gaps, Content, Current State, Chat, Journey, CS Handover — the last is `closedWonOnly`). Tabs defined in `lib/constants.js`.

**Stages (internal names):** `qualifying` → `intro_scheduled` → `active_pursuit` → `demo` → `solution_validation` → `proposal` → `legal` → `closed_won` / `closed_lost`

**Tabs:**
1. **Overview** (`OverviewTab.jsx`) — stage tracker, deal health score, suggested next actions, MEDDICC summary, Slack channel field, Demo Brief button (shows for demo/solution_validation/proposal)
2. **Transcripts** (`TranscriptsTab.jsx`) — Gong call import + manual entry + AI analysis (extracts stakeholders, pain points, MEDDICC data, business areas, next steps)
3. **Stakeholders** (`StakeholdersTab.jsx`) — contacts, roles, champion flag
4. **Information Gaps** (`InformationGapsTab.jsx`) — open discovery questions
5. **Content** (`ContentTab.jsx`) — AI-generated emails, agendas, business cases
6. **Current State** (`CurrentStateTab.jsx`) — current situation summary

**Key features:**
- Deal Health score — calculated from MEDDICC completeness, transcript count, stakeholder count, activity recency
- Suggested Next Actions — AI-generated per account via `POST /api/generate-next-actions`
- Demo Brief — AI-generated via `POST /api/generate-demo-brief`
- Stage changes → Slack notify instantly via `useAccountStore` → `POST /api/slack/notify`
- Slack channel field — explicit override or auto-derived from account name
- Auto-select account from URL query param `?account=id`
- All account state managed in `stores/useAccountStore.js`
- **Tier system** — accounts have hot/active/watching/archived tiers; tier selector in account header; sidebar filter by tier; archived accounts hidden by default with "Show archived" toggle
- **Lazy detail loading** — `getAccounts()` returns lightweight list (no joins); selecting an account triggers `fetchAccountDetail()` which loads full data (transcripts, stakeholders, gaps, notes); loading spinner shown during fetch; detail cached in `accountDetails` map in store
- **Sidebar search + filters** — search by name/owner/stage; dropdowns for stage, tier, owner; active account count badge; tier icons (🔥 hot, 👁 watching, — archived)
- **HubSpot contacts import** — "Import from HubSpot" button in StakeholdersTab fetches contacts via `GET /api/hubspot/account-contacts`; checklist UI to select which contacts to import as stakeholders
- **Reengagement brief** — "Reengage" button in account header calls `POST /api/accounts/reengagement`; Claude generates cold email + call script + talking points; shown in modal

---

### Outbound Engine (`pages/modules/outbound-engine.js`)
Prospecting tool. Dense spreadsheet-style company table.

**Features:**
- Company list with filters: vertical, status, search
- Company detail modal: contacts (12-col table with search/filter), notes, activity log
- One-click "Create Account in Pipeline" — pushes company + contacts + notes into Account Pipeline

**Important:** Data is stored in **localStorage**, not Supabase. Per-browser, not synced across devices. This is a known limitation to address in Phase 2.

---

### Pipeline Overview (`pages/modules/pipeline-overview.js`)
Manager / CEO view. Read-only aggregate view.

**Features:**
- **Pipeline confidence score** (hero card) — weighted win probability across all active accounts
  - Stage-based probability: qualifying=5%, intro_scheduled=10%, active_pursuit=20%, demo=35%, solution_validation=55%, proposal=70%, legal=85%, closed_won=100%, closed_lost=0%
  - Bonuses: +3% per transcript call (max 15%), +2% per stakeholder (max 10%), +5% if champion identified
  - Capped at 95% (100% only for closed_won)
- Visual pipeline funnel — stage distribution across all accounts
- Per-rep breakdown — expandable rows with confidence %, accounts, open tasks, overdue, done this week
- Stale accounts panel — flags accounts with no transcript activity in 14+ days
- Data served from `GET /api/pipeline-overview`

**Note:** `deal_value` IS tracked (synced from HubSpot) and drives $ pipeline / weighted-pipeline figures across pipeline-overview, ceo-dashboard, stage-analytics, and team-dashboard. The confidence *score* is signal-based, but dollar amounts are real and live.

---

### Today (`pages/modules/today.js`)
Role-aware landing page. Role determined by `localStorage.user_rep_type` (SDR/AE) + `profile.role === 'manager'` check.

- **AE view** (default): Morning Brief card (`GET /api/rep/morning-brief`), Today's Tasks (top 5 open, `GET /api/tasks`), Calendar (`POST /api/calendar/upcoming` filtered to today), Pipeline Focus (top 3 stale accounts from `GET /api/pipeline-overview`). AI Brief button on calendar events opens PrepBriefModal (`POST /api/calendar/prep-brief`).
- **SDR view**: Daily targets strip (calls/connects/meetings from `sdr_touches_today` localStorage), Call Queue (from `pursuit_accounts` localStorage ranked list), Today's Log (all touches), link → `/modules/pursuit`
- **Manager view**: Team Activity table (from pipeline-overview), At-Risk Deals (late-stage stale accounts), link → `/modules/pipeline-overview`
- SDR/AE toggle in header updates localStorage + re-renders. Manager view auto-engages when `profile.role === 'manager'`.

### Account Pursuit (`pages/modules/pursuit.js`)
SDR tool for tracking top-50 named accounts. 100% localStorage-backed (like Outbound Engine).

localStorage keys: `pursuit_accounts`, `sdr_touches_today`, `pursuit_touches_all`

- Ranked account table: coverage score progress bar (touches30d / 8 × 100%), last touch date + type icon, next touch recommendation (cycles call→email→linkedin→call), 30d touch count vs target 8
- Log Touch modal: touch type button group + context-sensitive outcome select + notes. Saves to all touch stores, recomputes coverage score.
- Right detail panel: SVG arc progress gauge, full touch history, inline hypothesis editing
- Add Account modal: name, rank (auto-assigned), vertical, hypothesis
- Empty state CTA when no accounts added

### Bottleneck Tracker (`pages/modules/bottleneck.js`)
Manager view showing where deals stall. Reads `GET /api/bottleneck`.

- Horizontal funnel: each active stage as a proportional bar, conversion % arrows between stages (green >60%, yellow 40-60%, red <40%), bottleneck stage highlighted orange
- 4-stat bar: active deals, win rate, biggest bottleneck stage, stalled deals count
- Stalled deals panel: accounts in demo/proposal/legal not updated in 21+ days, click → account pipeline
- Conversion details: collapsible, shows from/to counts and rate per stage pair
- Per-rep breakdown table: sortable, bottleneck column highlighted

### Settings (`pages/modules/settings.js`)
- Email signature — saved and auto-appended to generated follow-up emails
- Slack Member ID — reps paste their Slack ID here to receive daily digest as a DM
- **Rep Type** — SDR/AE selector, saves to `localStorage.user_rep_type` AND `profiles.rep_type` (DB column needs migration 20260509_big_build_schema.sql). Drives Today page view.

---

## Integrations

### Gong
- **Import calls** — `POST /api/gong/import-call` pulls a specific call into Account Pipeline → Transcripts tab
- **List calls** — `GET /api/gong/list-calls` surfaces available calls to import
- **Onboarding sync** — `POST /api/gong/onboarding-sync` fires on first login; pulls last 3 weeks of that rep's calls, creates tasks from action items
- **AI transcript analysis** — after import, Claude extracts stakeholders, pain points, MEDDICC data, business areas, next steps
- Env vars: `GONG_ACCESS_KEY`, `GONG_SECRET_KEY` (already in Vercel as of Jan 25)

### Gmail
- `POST /api/gmail/suggestions` — reads last 7 days of inbox + sent; Claude extracts action items
- Suggestion object shape: `{ title, emailSubject, reason, category, priority, sender, context }`
- Categories: `follow_up`, `send_content`, `schedule_meeting`, `internal`
- Surfaced in Smart Suggestions panel on Tasks page

### Google Calendar
- `POST /api/calendar/upcoming` — reads next 7 days of calendar events
- Filters for external (sales) meetings, flags meetings within 48 hours as needing prep
- Returns: `{ salesMeetings: [{ id, title, start, durationMin, externalAttendees, needsPrep, hoursUntil, meetLink }] }`
- Surfaced in Smart Suggestions panel alongside Gmail suggestions

**OAuth note:** Both Gmail and Calendar require `gmail.readonly` and `calendar.readonly` scopes. These are set in Supabase → Auth → Providers → Google → Additional OAuth Scopes. Existing users must re-auth to grant these.

### Slack (multi-channel bot)
- Bot Token (`SLACK_BOT_TOKEN`) with `chat:write` + `chat:write.public` scopes
- **READ scopes needed (add in Slack app settings):** `channels:history`, `groups:history`, `channels:read`, `groups:read`, `channels:join`
- **Public channels (pursuit_*):** bot auto-joins on first read via `channels:join` — no manual invite needed
- **Bot must be invited to `#sales_operations`** (private channel, lock icon) — `/invite @YourBotName` in that channel once
- All messages sent via `https://slack.com/api/chat.postMessage` with dynamic `channel` param
- **Channel routing priority:** explicit `slack_channel` field on account → auto-derived from account name → `SLACK_DEFAULT_CHANNEL`
- **Channel naming convention:** `pursuit_` + account name lowercased, spaces and punctuation stripped. Example: "United Defense Resources" → `pursuit_uniteddefenseresources`
- `lib/slack.js` exports: `deriveChannelName(name)`, `resolveAccountChannel(account)`, `sendSlackMessage(payload, channel)`, `getSlackChannelId(name)`, `getChannelMessages(name, limit)`, `buildStageChangeNotification(...)`, `buildRepDigest(...)`, `buildManagerDigest(...)`
- **Read APIs:** `GET /api/slack/channel-messages?accountId=X` (or `?channel=name`) — fetches pursuit channel messages; `GET /api/slack/sales-ops-feed` — parses last 7d of `#sales_operations` into structured bookings
- **Real-time events** via `POST /api/slack/notify`:
  - `stage_change` — fires when account stage changes (from `useAccountStore`)
  - `task_complete` — fires when a task is marked complete (from `tasks.js`)
- **Daily digest** (`GET /api/send-daily-digest`, cron Mon–Fri 8am): each rep's digest routes to their Slack DM (if `slack_user_id` set) → most-active account channel → `SLACK_DEFAULT_CHANNEL`. Manager digest → `SLACK_MANAGER_CHANNEL` (James's DM: `D02PGNHTR53`)
- **`#sales_operations`** — SDR booking channel. Messages parsed by `sales-ops-feed` into: `{ sdrName, action, accountName, contactName, contactTitle, ae, dateTime, contextBullets }`. Bookings for James surfaced in Smart Suggestions panel as purple prep cards.
- **`pursuit_[accountname]`** — per-account channel. Messages shown in OverviewTab "Slack Channel Activity" collapsible section. Bot already posts there on stage changes and task completions.

### Vercel Cron (17 jobs — defined in `vercel.json`)
- `0 8 * * 1-5` → `/api/send-daily-digest` (Mon–Fri 8am)
- `0 11 * * 1-5` → `/api/cron/deal-pulse` (Mon–Fri 11am UTC / 7am EST)
- `0 13 * * 1-5` → `/api/cron/deal-expiry-alerts` (Mon–Fri 1pm)
- `0 20 * * 0` → `/api/cron/rep-checkin` (Sunday 8pm)
- `0 21 * * 1-5` → `/api/cron/sdr-activity` (Mon–Fri 9pm)
- `0 22 * * 1-5` → `/api/cron/rep-pulse` (Mon–Fri 10pm)
- `0 1 * * *` → `/api/cron/sync-hubspot` (nightly 1am — upserts HubSpot deals → accounts, re-matches calls)
- `30 1 * * *` → `/api/cron/enrich-calls-bulk` (nightly 1:30am — contact-email HubSpot lookup)
- `0 * * * *` → `/api/cron/nightly-intel` (**HOURLY**, despite the name — runs full 150-day import+analyze sweep every hour. ⚠️ audit flag: this is wasteful; should be daily-full + a quick intraday trigger)
- `30 3 * * *` → `/api/cron/nightly-deal-insights` (nightly 3:30am)
- `0 3 * * *` → `/api/cron/deal-risk-alerts` (nightly 3am — ⚠️ recomputes a *different* risk formula than the stored `risk_score`)
- `0 4 * * *` → `/api/cron/score-deal-risk` (nightly 4am — writes `accounts.risk_score`, the intended single source)
- `0 4 * * *` → `/api/sheets/sync-leads` (nightly 4am — Google Sheets → lead_pipeline)
- `0 12 * * 1-5` → `/api/cron/reengagement-picks` (Mon–Fri noon)
- `30 7 * * 1` → `/api/cron/weekly-brief` (Monday 7:30am)
- `30 7 * * 1` → `/api/cron/weekly-task-audit` (Monday 7:30am)
- `0 2 1 * *` → `/api/cron/cleanup-inactive-users` (1st of month, 2am)
- **GitHub Actions** (every 15 min) → `process-recent-calls.yml`; (manual) → `drain-backlog.yml`, `backfill-historical.yml`, `run-nightly-intel.yml`
- Real-time post-call processing is **polling, not a webhook** — no Gong webhook exists (see North Star reality check).
- All secured with `CRON_SECRET` Bearer auth (⚠️ audit flag: ~11 crons use an `if (secret && ...)` bypass that skips the check when the env var is unset — make mandatory).

---

## Environment Variables

| Var | Purpose |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-side DB ops (bypasses RLS) |
| `ANTHROPIC_API_KEY` | Claude API |
| `GONG_ACCESS_KEY` | Gong API auth |
| `GONG_SECRET_KEY` | Gong API auth |
| `SLACK_BOT_TOKEN` | Slack bot (`xoxb-...`) |
| `SLACK_DEFAULT_CHANNEL` | Fallback channel (`#sales-chatgpt-prompts`) |
| `SLACK_MANAGER_CHANNEL` | Manager digest destination (`D02PGNHTR53`) |
| `CRON_SECRET` | Secures Vercel cron job calls |
| `DIGEST_SECRET` | Secures manual digest trigger calls |

All vars are in Vercel. Do not hardcode any of these. Do not commit `.env` files.

---

## SQL Migrations Run (Supabase — Sales AI Brain project)

Do not run these again:
- `ALTER TABLE accounts ADD COLUMN IF NOT EXISTS slack_channel TEXT;`
- `ALTER TABLE profiles ADD COLUMN IF NOT EXISTS slack_user_id TEXT;`
- **name_cleanup** (2026-05-06): `ALTER TABLE accounts ADD COLUMN IF NOT EXISTS tier TEXT DEFAULT 'active'`; stripped " - New Deal" suffix from all 551 account names
- **stakeholders_hubspot** (2026-05-06): `ALTER TABLE stakeholders ADD COLUMN IF NOT EXISTS email TEXT` and `hubspot_contact_id TEXT`

## SQL Migrations PENDING (needs Supabase MCP re-auth)

File: `supabase/migrations/20260509_big_build_schema.sql` — **run this first thing next session**.

```sql
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS rep_type TEXT CHECK (rep_type IN ('sdr', 'ae'));
CREATE TABLE IF NOT EXISTS account_pursuit_lists (...);  -- SDR top-50 named accounts (Supabase-backed version of localStorage pursuit)
CREATE TABLE IF NOT EXISTS account_touches (...);         -- multi-channel touch log
CREATE TABLE IF NOT EXISTS meeting_quality_scores (...);  -- SDR→AE warm transfer quality
CREATE TABLE IF NOT EXISTS daily_insights (...);          -- AI-generated per-rep daily insight
```

To run: re-authorize Supabase MCP in Claude extension settings → then call `mcp__supabase__apply_migration`.

Migration files are in `supabase/migrations/` for reference.

---

## Key Design Decisions & Constraints

- **Deal values are tracked** — `accounts.deal_value` syncs from HubSpot and drives $ pipeline across the manager/CEO views. The pipeline *confidence score* is signal-based (stage + calls + stakeholders + champion), but dollar amounts are real.
- **Outbound Engine uses localStorage** — not Supabase. Data is per-browser. Known limitation, Phase 2 will address.
- **Manager role is informal** — role field controls UI visibility (team task view, Pipeline Overview access) but there's no strict server-side permission enforcement beyond auth checks.
- **MEDDICC** is the qualification framework used throughout. Stands for: Metrics, Economic Buyer, Decision Criteria, Decision Process, Identify Pain, Champion, Competition.
- **Claude models:** Sonnet 4.6 for complex generation (demo briefs, task completion drafts, next actions, follow-ups). Haiku 4.5 for fast extraction (transcript analysis, Gmail parsing, calendar processing).
- **camelCase in frontend, snake_case in DB** — `lib/db/accounts.js` handles all transforms. When adding DB columns, always update both `transformAccountFromDb` and `transformAccountToDb`.
- **All API routes are serverless** — no long-running processes. Async tasks (Slack notifications, Gong sync) are fire-and-forget. Heavy operations go through Vercel cron.
- **Supabase project name** — the project is called "Sales AI Brain" in the Supabase dashboard. There is also a "Lindcott-armory" project — do not run migrations there.

---

## Backlog & Priorities

**The live, audit-driven priority sequence is in [`ROADMAP.md`](ROADMAP.md) and [`PLATFORM_AUDIT_2026-06-27.md`](PLATFORM_AUDIT_2026-06-27.md).** Headline order: (1) de-James the engine + filter CS calls [handoff-blocking], (2) verified dead-code purge + consolidate duplicated logic, (3) Gong webhook + account write-back, (4) global action-capable assistant, (5) SDR tools onto Supabase.

### Legacy backlog (as of 2026-05-09 — partially superseded by the audit)

### High Priority — Tasks
- **Commitment status check (Gmail/Calendar verification)** — for tasks sourced from Gong commitments, check Gmail sent folder for emails to that contact after the call date; check Calendar for events with that company. Show "Email sent?" / "Meeting booked?" status on the task row. Most complex tasks feature — needs per-stakeholder email matching.
- **Stage-triggered task checklists (expanded)** — flesh out the full trigger → checklist mapping with James + Mark. Example: booking intro meeting auto-creates: "Add to #sales-ops channel", "Update pursuit channel", "Update HubSpot deal", "Send intro link with deal details".
- **Playbook trigger wiring** — `task_playbooks` table and run records exist but no UI trigger yet. Button in Account Pipeline header to fire a playbook (e.g. "Demo Booked") → creates task batch with due dates from `due_offset_hours`.
- **Near-real-time post-call processing** — currently nightly cron. James wants faster: analysis + task creation + Slack notification within ~30 min of call ending. Options: (1) Gong webhook trigger, (2) 30-min polling cron (Hobby plan limitations apply), (3) manual "Process calls" button.

### High Priority — Account Pipeline
- **HubSpot sync** — push stage changes, notes, deal updates to HubSpot. Reps currently update HubSpot manually.

### Medium Priority — Account Pipeline
- **Email send from app** — Claude drafts the email but rep has to copy/paste. Wire up Gmail send API to send directly.
- **Account activity feed** — unified timeline per account: calls, notes, stage changes, tasks — all in one view.
- **Gong upcoming calls** — surface next scheduled calls from Gong alongside past transcripts in Transcripts tab.

### Outbound Engine Phase 2 (needs scoping with James + Mark)
- Add/edit company modal
- Edit contact details inline (currently add/delete only)
- Bulk operations (delete multiple, export)
- CSV import for bulk company upload
- AI outreach content generation (email sequences, LinkedIn messages)
- Contact enrichment (Apollo, ZoomInfo)
- Playbooks per vertical (talk tracks, objection handling)

### Platform
- **Global search** — accounts, tasks, transcripts, stakeholders in one place
- **Rep performance dashboard** — week-over-week task completion, call volume, deal velocity per rep

### UAT & Training
- Full UAT suite per module — structured test for every feature. Dual purpose: regression testing + training doc for new reps. Modules: Tasks, Account Pipeline (all 6 tabs), Outbound Engine, Pipeline Overview, Settings, Slack, Gong sync, Gmail/Calendar suggestions.

### Lower Priority
- Slack → app commands — `/update UDR` in Slack returns a deal digest
- Mobile-optimized task view — current UI is desktop-first
- Content module expansion — more templates, saved outputs, version history
- Analysis caching — hash transcripts so identical uploads skip the Claude API call

---

## Sales Process Config (the AI's source of truth)

The `sales_process_config` table is a single row that drives all AI analysis. Every call analysis, ICP score, discovery score, coaching card, and disqualification flag reads from it.

**Sections:**
- `icp_definition` — who we sell to, who we don't, how to score fit (1-10)
- `discovery_framework` — what must be uncovered (MEDDICC-based), drives discovery scoring
- `stage_exit_criteria` — what must be true before advancing each stage
- `disqualification_signals` — hard stops, soft stops, language patterns to recognize
- `coaching_priorities` — ranked coaching areas, drives all coaching output
- `qualification_framework` — ICP and discovery score rubrics
- `winning_tactics` — proven plays from the field
- `competitor_playbook` — how to handle Smartsheet, Procore, Northspyre, etc.

**How it flows:**
- `lib/salesProcess.js` — `getSalesProcessConfig()` fetches with 5-min cache; `buildSalesProcessContext()` formats it for prompt injection
- `pages/api/gong/intel-analyze.js` — injects full config into every call analysis prompt
- `pages/api/gong/intel-coaching.js` — injects coaching priorities + discovery framework into every coaching card
- `pages/api/sales-process.js` — GET to fetch, PATCH to update (saves version history to `sales_process_config_history`)
- `pages/modules/sales-processes.js` — editor UI, one section at a time

**Version history:** Every save creates a snapshot in `sales_process_config_history`. Version number increments on each save.

---

## Recently Shipped

The detailed build changelog lived here and grew to ~130 lines duplicating git history. For what shipped and when, use `git log --oneline`. Major arcs:

- **Phase 1–2 big builds (May 2026)** — Today landing page, Account Pursuit, Bottleneck Tracker, call-intelligence v2 (transcript storage, 2-yr backfill, matching, process-backlog drain), CEO Dashboard, deal-risk scoring, reengagement, HubSpot audit log, 13-feature VP-of-sales build (playbooks, stage-exit checklists, win/loss debrief, CS handover, MAP generator).
- **May 27** — showed unanalyzed calls in Transcripts tab; dropped 5 dead HubSpot columns from `gong_call_analyses`; fixed the 1,056-call no-show bug.
- See [`PLATFORM_AUDIT_2026-06-27.md`](PLATFORM_AUDIT_2026-06-27.md) for the current verified state and gaps.

## How to Work With This Codebase

- Read the relevant files before proposing changes. Don't suggest modifications to code you haven't seen.
- When adding a new API route that needs auth: always use `createServerSupabaseClient(req, res)` for the user check, and `getSupabase()` for DB operations.
- When adding a DB column: update both `transformAccountFromDb` and `transformAccountToDb` in `lib/db/accounts.js`.
- When touching Slack: routing logic lives in `lib/slack.js`. Don't duplicate channel resolution logic inline in API routes.
- Keep responses concise. No recap at the end of what was just done. James can read the diff.
- Update this file (`CLAUDE.md`) whenever a feature ships, a bug is fixed, a design decision is made, or a backlog item moves. Do not wait to be asked.
