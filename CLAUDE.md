# CLAUDE.md — Sales Dashboard

This file is read automatically at the start of every Claude Code session. Keep it up to date as features ship, bugs are fixed, and decisions are made. Do not let it go stale.

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
Core deal tracking. Accounts have 6 tabs.

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

**Note:** No deal monetary values are tracked. Confidence is entirely signal-based.

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

### Vercel Cron
Defined in `vercel.json`:
- `0 8 * * 1-5` → `/api/send-daily-digest` (Mon–Fri 8am)
- `0 2 1 * *` → `/api/cron/cleanup-inactive-users` (1st of month, 2am)
- `0 1 * * *` → `/api/cron/sync-hubspot` (nightly 1am, upserts HubSpot deals → accounts then re-matches calls)
- `30 1 * * *` → `/api/cron/enrich-calls-bulk` (nightly 1:30am, enriches unchecked calls via contact-email HubSpot lookup)
- `0 2 * * *` → `/api/cron/nightly-intel` (nightly, analyzes unanalyzed James calls)
- `0 3 * * *` → `/api/cron/deal-risk-alerts` (nightly, sends high-risk deal Slack alert)
- All secured with `CRON_SECRET` Bearer auth
- `intel-analyze-batch.js` and `enrich-calls-bulk.js` have `maxDuration: 300` (5 min Vercel function override)

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

- **No deal monetary values** — pipeline confidence is purely signal-based (stage + calls + stakeholders + champion). No deal size field exists.
- **Outbound Engine uses localStorage** — not Supabase. Data is per-browser. Known limitation, Phase 2 will address.
- **Manager role is informal** — role field controls UI visibility (team task view, Pipeline Overview access) but there's no strict server-side permission enforcement beyond auth checks.
- **MEDDICC** is the qualification framework used throughout. Stands for: Metrics, Economic Buyer, Decision Criteria, Decision Process, Identify Pain, Champion, Competition.
- **Claude models:** Sonnet 4.6 for complex generation (demo briefs, task completion drafts, next actions, follow-ups). Haiku 4.5 for fast extraction (transcript analysis, Gmail parsing, calendar processing).
- **camelCase in frontend, snake_case in DB** — `lib/db/accounts.js` handles all transforms. When adding DB columns, always update both `transformAccountFromDb` and `transformAccountToDb`.
- **All API routes are serverless** — no long-running processes. Async tasks (Slack notifications, Gong sync) are fire-and-forget. Heavy operations go through Vercel cron.
- **Supabase project name** — the project is called "Sales AI Brain" in the Supabase dashboard. There is also a "Lindcott-armory" project — do not run migrations there.

---

## Backlog (as of 2026-05-09)

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

## Recently Shipped (reverse chronological)

- **2026-05-18** — Big build (phase 2):
  - **Call backlog processing**: New `pages/api/cron/process-backlog.js` — queries DB for `analyzed_at IS NULL AND ignored = false`, takes 10 most recent, calls intel-analyze per call with 400ms delay. GitHub Actions workflow (`process-recent-calls.yml`) runs it every 30 min alongside the existing `process-recent` job.
  - **Transcript storage**: Added `transcript_text TEXT` column to `gong_call_analyses`. `intel-analyze.js` now saves full formatted transcript to this column on every analysis. Permanent storage, no re-fetching needed.
  - **2-year historical import** (`pages/api/gong/backfill-historical.js`): Paginated endpoint that imports all Gong calls (2 years default). For each call: batch-fetches transcripts + party details, formats with speaker labels, upserts to `gong_call_analyses` with `transcript_text` stored, does inline account matching. Leaves `analyzed_at` null so process-backlog picks up AI analysis. GitHub Actions workflow (`backfill-historical.yml`) loops until done, then triggers match-calls for auto-linking.
  - **Nightly reengagement picks** (`pages/api/cron/reengagement-picks.js`): Scores cold accounts (30+ days no call) by ICP score, stage reached, sentiment, buying signals, champion health. Picks top 5, generates personalized re-opening hooks via Claude Haiku, sends Slack DM to James. Runs Mon-Fri noon UTC.
  - **Reengage button rebuild** (`pages/api/accounts/reengagement.js`): Now pulls all 30 analyzed calls (was 5), aggregates full history (themes, objections, buying signals, ICP trend, all next steps, transcript excerpt from most recent call), feeds to Sonnet 4.6 for highly specific non-generic brief.
  - **Today as landing page**: Auth callback (`pages/api/auth/callback.js`) and `pages/index.js` now redirect to `/modules/today` instead of `/modules/tasks`. Today page already has TodaysTasksCard with top-5 tasks + "View all" link.
  - **HubSpot audit log** (`pages/modules/sales-reports/hubspot-audit.js`): New Sales Reports page — paginated table of all HubSpot writes (searchable/filterable by account/action/success). `GET /api/hubspot/sync-log` endpoint. `log-note.js` now writes to `hubspot_sync_log` on every note (success + fail). `sync-hubspot.js` logs nightly sync runs.
  - **Account pipeline engagement filters** (`pages/modules/account-pipeline.js`): New sort dropdown — A-Z, Last contacted (most recent first), Most conversations (call count), Cold 30+ days, Stage. Loads call stats from `GET /api/accounts/call-stats` on mount. Shows days-since or call-count in sidebar list when relevant sort is active.
  - **Account health strip**: Shows on selected account header — green/amber/red dot + days since last call + total call count.
  - **HubSpot audit log table** — `hubspot_sync_log` created with: id, created_at, action, account_id, account_name, hubspot_deal_id, payload JSONB, result JSONB, triggered_by, success.

- **2026-05-18** — Quick wins (4 features):
  - **Open in Gmail from Work in Claude**: `detectDraftedEmail()` in `tasks.js` scans every assistant message for a `Subject:` line. When found, "Open in Gmail" button appears below the message. Clicking opens `mail.google.com/mail/u/0/?view=cm&su=...&body=...` with the body pre-filled including the rep's email signature (from `localStorage.email_signature`). If the task has an `accountId`, a HubSpot note is auto-logged via `POST /api/hubspot/log-note` (no checkbox — fires automatically). Shows "Logged to HubSpot" / "Will log to HubSpot" text next to button.
  - **HubSpot note logging** (`pages/api/hubspot/log-note.js`): POST `{ accountId, subject }` — looks up account's `hubspot_deal_id`, creates HubSpot note via `/crm/v3/objects/notes` associated to the deal. Association type ID 214 = note-to-deal.
  - **Gmail suggestions — due date extraction**: Updated `pages/api/gmail/suggestions.js` prompt to include `dueDate: "YYYY-MM-DD or null"` in the JSON schema. `handleAddEmailTask` in `SmartSuggestionsPanel.jsx` now passes `dueDate` when creating the task.
  - **Auto-create prep tasks on calendar sync**: `SmartSuggestionsPanel.jsx` — after sync() loads calendar events, auto-creates "Prep for: [event title]" tasks for owned meetings with `needsPrep: true` (within 48 hours). Tracks created events in `autoPrepCreatedRef` (daily localStorage set `auto_prep_created`) to prevent duplicates across re-syncs. Also fires on cache-load via `useEffect`. Shows amber "Auto-created N prep task(s)" notice. User can still click "AI Brief" for the full AI-generated brief.

- **2026-05-09** — Big build (phase 1):
  - **Today page** (`/modules/today`): role-aware landing (SDR/AE/Manager). SDR view: daily call targets from `sdr_touches_today` localStorage, call queue from `pursuit_accounts` localStorage, touch logging (call/email/linkedin/meeting/voicemail + outcome). AE view: morning brief, top-5 tasks, today's calendar with AI Brief, top-3 stale pipeline accounts. Manager view: team activity table, at-risk late-stage accounts. Role toggle saves to localStorage + profiles.rep_type.
  - **Account Pursuit Dashboard** (`/modules/pursuit`): top-50 named SDR account tracking. 100% localStorage. Coverage score = touches30d / 8 × 100%. Touch log with type + outcome. Right detail panel with SVG arc gauge + full history. Add Account modal with rank/hypothesis/vertical.
  - **Bottleneck Tracker** (`/modules/bottleneck` + `/api/bottleneck`): funnel visualization, stage-to-stage conversion rates, bottleneck detection (highest absolute drop), stall alerts (21+ days in late stages), per-rep breakdown table.
  - **intel-analyze.js**: added `pain_depth_score` (1-10) + `champion_health_score` (1-10) to Claude prompt + scoring guides. Both fields now stored in every new `gong_call_analyses` row.
  - **OverviewTab.jsx**: `CompetitorIntel` component — lazy-fetches `/api/gong/account-competitors?accountId=X`, aggregates mentions across all calls, collapsible battle card with sentiment badge + context quotes. `RunPlaybook` button — fetches active playbooks, executes via `/api/playbooks/execute`, shows result inline.
  - **Settings**: rep_type SDR/AE selector — saves to localStorage + `profiles.rep_type` via `/api/me` PATCH (column requires migration).
  - **Crons**: `sdr-activity` (9pm UTC weekdays) posts team call/accounts/meetings leaderboard to Slack manager channel. `rep-pulse` (10pm UTC weekdays) sends private Slack DM per rep with today's calls, AI coaching insight, tomorrow's top account.
  - **New APIs**: `/api/gong/account-competitors`, `/api/playbooks/execute`, `/api/calendar/prep-brief`, `/api/tasks/call-commitments`, `/api/bottleneck`
  - **DB migration pending**: `supabase/migrations/20260509_big_build_schema.sql` — needs Supabase MCP re-auth to run. Adds: `profiles.rep_type`, `account_pursuit_lists`, `account_touches`, `meeting_quality_scores`, `daily_insights` tables. Run this migration as first action next session.

- **2026-05-09** — Tasks intelligence upgrade (4 features):
  - **From Recent Calls panel**: `GET /api/tasks/call-commitments` — queries `gong_call_analyses` for past 7 days by rep_email, extracts `commitments[]` and `next_steps_mentioned[]`, cross-references existing tasks to skip already-added items, returns account names. `CallCommitmentsPanel` component in tasks.js auto-fetches on load, shows orange badge panel above Smart Suggestions, dismissals persist to localStorage.
  - **Morning brief with real data**: Rewrote `GET /api/rep/morning-brief` to pull active accounts (excluding closed stages), compute last call date per account via `gong_call_analyses`, identify stale accounts (no call in 14+ days), build late-stage deal list (demo/proposal/legal), pass all real account names into Claude Haiku prompt. Fallback uses stale accounts list.
  - **AI Prep Brief modal**: `POST /api/calendar/prep-brief` — fuzzy-matches meeting title to pipeline accounts (word overlap score), fetches last 3 calls + stakeholders for matched account, generates brief via Sonnet 4.6 (opening recommendation, objectives, talking points, discovery questions, watch-outs, closing ask). `PrepBriefModal` component opens from "AI Brief" button on calendar events. "Add prep task with brief" writes full brief into task description.
  - **Warmy sender blocklist**: `SmartSuggestionsPanel.jsx` — `blockedSenders` array loaded from localStorage `email_sender_blocklist` on mount; "Block sender" button in expanded suggestion panel blocks by sender name, persists to localStorage, filters all suggestions from that sender. Auto-filters `(no subject)` emails. Metrics strip shows blocked count + "clear all" link.

- **2026-05-09** — OAuth login flow fixed (server-side PKCE):
  - Root cause: `setAll` in `createServerSupabaseClient` was hard-coding `HttpOnly` flag, hiding session tokens from browser's `document.cookie` read by `createBrowserClient`.
  - Fix: `lib/supabase.js` — `setAll` now only adds `HttpOnly` if `options.httpOnly === true` (Supabase never sets this for auth tokens).
  - New `pages/api/auth/sign-in.js` — generates Google OAuth URL server-side via `createServerSupabaseClient` so PKCE code verifier is stored in a proper server-set cookie, not via `document.cookie`.
  - New `pages/api/auth/callback.js` — exchanges code for session server-side; `@withbanner.com` domain check; auto-provisions profile on first sign-in; fires Gong onboarding sync; uses explicit `res.setHeader + res.writeHead(302) + res.end()` to preserve Set-Cookie headers.
  - `lib/auth.js` `signInWithGoogle()` — now calls `/api/auth/sign-in` to get URL then redirects, instead of calling `supabase.auth.signInWithOAuth` client-side.
  - `pages/modules/tasks.js` — switched from `getUser()` (network call, fails cold) to `getSession()` (reads cookies locally, reliable).
  - Vercel deployment was also blocked by `0 */2 * * 1-5` cron schedule (Hobby plan rejects non-daily crons) — removed that entry from `vercel.json`.

- **2026-05-06** — Deal Pulse cron (`pages/api/cron/deal-pulse.js`): scores James's active accounts for attention needed (overdue tasks +40 each, days since last call up to +80, stage weight, open next steps, red flags), picks top 3, calls Claude Haiku per account for urgency_reason + specific action + draft opener, sends Slack blocks to SLACK_MANAGER_CHANNEL (D02PGNHTR53). Cron: Mon–Fri 11am UTC (7am EST). Manual trigger: POST /api/cron/deal-pulse with Authorization: Bearer {CRON_SECRET}.

- **2026-05-06** — Chat tab added to Account Pipeline:
  - `pages/api/accounts/chat.js` — POST endpoint; loads account, calls, tasks, stakeholders, open gaps, notes, and sales process config in parallel; builds a comprehensive system prompt with aggregated MEDDIC across all calls; trims to last 14 messages before sending; uses Sonnet 4.6, maxTokens 2000
  - `components/tabs/ChatTab.jsx` — persistent per-account chat UI; localStorage-backed (key: `account_chat_{id}`, trim to 30); auto-generates opening deal briefing on first open; 4 suggested prompt chips that auto-send; simple bold/newline markdown rendering; animated typing indicator; "New conversation" button clears and regenerates; error messages shown inline as system messages
  - `lib/constants.js` — Chat tab added as 7th tab in TABS array
  - `pages/modules/account-pipeline.js` — ChatTab imported and rendered in tab switch; no icons needed (TABS are label-only)

- **2026-05-06** — Account management 6-feature build:
  - **DB migrations**: `tier` column on accounts (default 'active'); `email` + `hubspot_contact_id` on stakeholders; " - New Deal" suffix stripped from all 551 account names
  - **sync-deals.js**: `cleanDealName()` helper strips " - New Deal" on every import going forward
  - **lib/db/accounts.js**: `getAccounts()` now lightweight (no joins, sorted by name, no user_id filter); new `getAccountDetail()` does full join select; `tier` added to both transform functions
  - **useAccountStore**: `accountDetails` cache map; `fetchAccountDetail` action; `getSelectedAccount` uses cache; all mutation actions mirror updates into `accountDetails`; `reset` clears cache
  - **useAccounts hook**: `setSelectedAccount` triggers `fetchAccountDetail`; `fetchAccountDetail` exposed in hook return
  - **account-pipeline.js**: Full sidebar rewrite — search, stage/tier/owner filters, tier icons, active count badge, show-archived toggle; tier selector in account header; owner/deal value in header; lazy detail loading with spinner; Reengage button + modal (email + call script); `handleBulkAddStakeholders` wired to StakeholdersTab
  - **pages/api/hubspot/account-contacts.js**: new endpoint — GET ?accountId=X, fetches HubSpot contacts for a deal, batch-reads contact properties
  - **pages/api/accounts/reengagement.js**: new endpoint — POST {accountId}, Claude generates reengagement brief (why_reengage, cold_email, cold_call_script, talking_points)
  - **StakeholdersTab.jsx**: "Import from HubSpot" button (when hubspotDealId set), contact checklist, `onBulkAddStakeholders` prop; shows email field on stakeholder cards

- **2026-05-06** — Three-feature build: auto-surfaced Gong calls, weekly brief, rep coaching dashboard:
  - **Auto-surfaced calls in Account Pipeline**: TranscriptsTab now fetches `/api/gong/account-calls?accountId=X` on mount; shows AI-analyzed calls auto-linked to account alongside manually imported transcripts; attention score surfaces calls needing follow-up (unresolved next steps +40, recent +30, risk flags +20, commitments +15, MEDDICC gaps +10); default shows top 5 by score with "show all" expand; GongCallCard component shows summary, next steps, commitments, MEDDICC grid, buying signals, objections with expandable detail; header shows call count, auto-linked count, needs-attention badge
  - **Pipeline Weekly Brief**: `GET /api/manager/weekly-brief` aggregates last 7 days accounts + calls + tasks → Sonnet 4.6 generates structured brief (headline, pipeline_pulse, watch_list, rep_coaching signals, wins, 3 priorities); `?send=slack` DMs James via existing Slack bot; `api/cron/weekly-brief.js` runs Monday 7:30am UTC; "Weekly Brief" button in Pipeline Overview header renders brief inline as collapsible panel; coaching signals per rep include call-evidence-backed observation + 1:1 opener script
  - **Rep Coaching Dashboard** (`/modules/coaching`): new module, manager-only; rep selector + time window (14/30/60/90d); metric cards (call count, avg discovery score, talk ratio, next-step rate, red flag rate) with trend arrows vs prior period; `GET /api/gong/rep-coaching?repName=X&days=N` computes metrics + calls Claude for coaching card (strengths, observations with expand, 30-day focus area, 1:1 opener, leading indicators); evidence calls list with discovery score + talk ratio + next-step chips; "Rep Coaching" link added to tasks quick-nav and pipeline-overview header; vercel.json: weekly-brief cron at 30 7 * * 1
- **2026-05-06** — Call enrichment + triage infrastructure: intel-enrich.js updated (CRON_SECRET bypass, affiliation case bug fixed 'external'→'External', account_id linking after HubSpot deal upsert via hubspot_deal_id→accounts JOIN); cron/enrich-calls-bulk.js (nightly 1:30am UTC, batches all unchecked calls through intel-enrich, maxDuration 300s); api/admin/match-triage.js (GET low-confidence links <85%, POST confirm/reject/override); Data Quality page: new "Low Confidence" tab shows auto-links needing review with Confirm/Remove Link buttons; vercel.json: enrich-calls-bulk cron added at 30 1 * * *, function timeout added
- **2026-05-06** — HubSpot → accounts sync: accounts table populated with 551 active HubSpot deals (Sales Opportunities pipeline); sync-deals.js rewritten to create accounts from HubSpot (was match-only); match-calls.js new endpoint for bulk Gong call→account fuzzy matching; intel-analyze.js updated with inline account matching on every new call analysis; cron/sync-hubspot.js runs nightly at 1am UTC (before nightly-intel); accounts table schema: user_id now nullable, hubspot_owner_id + owner_name columns added, unique constraint on hubspot_deal_id; James's profile inserted as 'manager' role (enables viewing all accounts via is_manager_or_admin()); manager UPDATE policy added to accounts RLS; 100 of 1243 Gong calls matched to accounts (title/sig-word fuzzy SQL); remaining calls need intel-enrich.js (contact-email matching) post-deployment
- **2026-05-06** — Tasks v2 (session 2): Work in Claude side panel (fixed right panel, localStorage conversation persistence per task, /api/work-in-claude.js using Sonnet 4.6); NL task creation bar above filter row (/api/tasks-nl.js Haiku-parses text → structured fields, editable preview card before create); AI priority score (computeTaskPriority() client-side 0-100 urgency score, sorts within each type group); commitment extraction added to intel-analyze.js (new 'commitments' field in JSON schema, separate gong_commitment source_type with priority 1 vs gong_next_step priority 2)
- **2026-05-06** — Tasks v2 (session 1): 23 tasks seeded (4 named + 19 Gong-extracted from James's last 4 weeks); schema: primary_action/rationale/source_type/dismissed_at added to tasks, task_dismissals table, account_insights table; auto-task creation from intel-analyze.js (next steps → tasks for James on each new analysis); Rep Morning Brief (/api/rep/morning-brief, Haiku-generated daily brief cached in localStorage, TodaysFocus card in tasks.js); dismissal flow (POST /api/tasks/[id] action=dismiss, DismissModal with reason picker, logs to task_dismissals); rationale shown in task expansion; lib/db/tasks.js updated for all new fields; getTasks() excludes dismissed by default
- **2026-05-05** — Call Intelligence v2 (session 2): Feature 9 stage filter + Stage Breakdown tab; Feature 1 action cards (coaching_task_create + outreach_batch_create executors, confirmation modal, executed_actions log); intel-execute-action.js (new); Feature 3 Deals at Risk widget (intel-risk.js, accounts + transcripts tables); Feature 4 Pre-call AI brief (generate-pre-call-brief.js, PreCallBrief component in OverviewTab.jsx); nightly cron infrastructure (nightly-intel.js, deal-risk-alerts.js); CRON_SECRET bypass added to intel-analyze.js; vercel.json updated with 2 new crons (2am, 3am UTC daily)
- **2026-05-05** — Call Intelligence v2 (session 1): PeriodDelta component, stage filter, stage breakdown tab, action cards, intel-execute-action.js, intel-aggregate weekly_actions, HubSpot enrichment fixes (intel-enrich.js now populates deal_stage_at_call)
- **2026-04-15** — Cross-assign tasks: "Assign to" dropdown in New Task modal; `GET /api/users` endpoint
- **2026-04-15** — Smart Suggestions expand on click: clicking a suggestion shows why it was surfaced, source email, sender, context
- **2026-04-15** — Smart Suggestions auto-sync: panel syncs automatically on page load (no more manual "Sync Now")
- **2026-04-15** — Fixed server-side auth bug: task create and filters were silently failing (401) because `getSupabase()` used `createBrowserClient` server-side with no cookie access. Fixed with `createServerSupabaseClient(req, res)` using `createServerClient` from `@supabase/ssr`.
- **2026-04-15** — Multi-channel Slack routing: bot token + `chat.postMessage`, channel derived from account name, explicit override field on account
- **2026-04-15** — Pipeline confidence score: weighted win probability hero card + per-rep confidence in Pipeline Overview
- **2026-04-15** — Rep Slack DM routing: daily digest routes to rep's personal Slack DM if `slack_user_id` set in Settings
- **2026-04-15** — Slack channel field on accounts: explicit override or auto-derived from account name
- **2026-04-15** — Stage changes fire Slack notification to account's channel in real time

---

## How to Work With This Codebase

- Read the relevant files before proposing changes. Don't suggest modifications to code you haven't seen.
- When adding a new API route that needs auth: always use `createServerSupabaseClient(req, res)` for the user check, and `getSupabase()` for DB operations.
- When adding a DB column: update both `transformAccountFromDb` and `transformAccountToDb` in `lib/db/accounts.js`.
- When touching Slack: routing logic lives in `lib/slack.js`. Don't duplicate channel resolution logic inline in API routes.
- Keep responses concise. No recap at the end of what was just done. James can read the diff.
- Update this file (`CLAUDE.md`) whenever a feature ships, a bug is fixed, a design decision is made, or a backlog item moves. Do not wait to be asked.
