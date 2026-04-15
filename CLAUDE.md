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
| Storage | Supabase (primary) + localStorage (Outbound Engine only) |

---

## Project Structure

```
pages/
  modules/           # Full-page module views
    tasks.js         # Default landing page after login
    account-pipeline.js
    outbound-engine.js
    pipeline-overview.js
    settings.js
    content.js
  api/               # Serverless API routes
    tasks.js         # GET (list), POST (create)
    tasks/[id].js    # GET, PATCH, DELETE
    users.js         # GET all profiles (for assign-to dropdowns)
    me.js            # GET/PATCH current user profile
    pipeline-overview.js
    send-daily-digest.js
    slack/notify.js  # Real-time Slack notifications (stage change, task complete)
    gmail/suggestions.js
    calendar/upcoming.js
    gong/import-call.js, list-calls.js, onboarding-sync.js
    cron/cleanup-inactive-users.js
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
- **Smart Suggestions panel** (`SmartSuggestionsPanel.jsx`) — auto-syncs Gmail + Calendar on page load when Google token is available; suggestions are expandable (click to see why surfaced, source email, sender, context); click + to add as task, ✕ to dismiss, ⓘ to expand
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

### Settings (`pages/modules/settings.js`)
- Email signature — saved and auto-appended to generated follow-up emails
- Slack Member ID — reps paste their Slack ID here to receive daily digest as a DM (Slack → profile photo → 3-dot menu → Copy member ID)

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
- All messages sent via `https://slack.com/api/chat.postMessage` with dynamic `channel` param
- **Channel routing priority:** explicit `slack_channel` field on account → auto-derived from account name → `SLACK_DEFAULT_CHANNEL`
- **Channel naming convention:** `pursuit_` + account name lowercased, spaces and punctuation stripped. Example: "United Defense Resources" → `pursuit_uniteddefenseresources`
- `lib/slack.js` exports: `deriveChannelName(name)`, `resolveAccountChannel(account)`, `sendSlackMessage(payload, channel)`, `buildStageChangeNotification(...)`, `buildRepDigest(...)`, `buildManagerDigest(...)`
- **Real-time events** via `POST /api/slack/notify`:
  - `stage_change` — fires when account stage changes (from `useAccountStore`)
  - `task_complete` — fires when a task is marked complete (from `tasks.js`)
- **Daily digest** (`GET /api/send-daily-digest`, cron Mon–Fri 8am): each rep's digest routes to their Slack DM (if `slack_user_id` set) → most-active account channel → `SLACK_DEFAULT_CHANNEL`. Manager digest → `SLACK_MANAGER_CHANNEL` (James's DM: `D02PGNHTR53`)

### Vercel Cron
Defined in `vercel.json`:
- `0 8 * * 1-5` → `/api/send-daily-digest` (Mon–Fri 8am)
- `0 2 1 * *` → `/api/cron/cleanup-inactive-users` (1st of month, 2am)
- Both secured with `CRON_SECRET` Bearer auth

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

Both of these have already been applied. Do not run again:
- `ALTER TABLE accounts ADD COLUMN IF NOT EXISTS slack_channel TEXT;`
- `ALTER TABLE profiles ADD COLUMN IF NOT EXISTS slack_user_id TEXT;`

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

## Backlog (as of 2026-04-15)

### High Priority — Tasks
- **"Work in Claude" button** — each task gets a button opening a persistent Claude chat. Chat saved to task, picks back up on return. One chat per account (not per task) so context builds across the deal. Must handle context window limits when accounts have many transcripts.
- **Smart Suggestions from Gong** — currently only Gmail + Calendar. Should also pull action items from recent Gong call transcripts (next steps, follow-ups, commitments).
- **Stage-triggered task checklists (expanded)** — flesh out the full trigger → checklist mapping with James + Mark. Example: booking intro meeting auto-creates: "Add to #sales-ops channel", "Update pursuit channel", "Update HubSpot deal", "Send intro link with deal details".

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

## Recently Shipped (reverse chronological)

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
