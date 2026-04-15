# Sales Dashboard — Roadmap

_Last updated: 2026-04-15 (afternoon)_

---

## ✅ Shipped

### Auth & Access
- Google OAuth restricted to @withbanner.com accounts only
- Auto-provision profile on first login (role defaults to `rep`)
- Unauthorized domain → signed out + error shown on login page
- Inactive account auto-deletion — cron runs 1st of month, deletes users inactive 6+ months

### Tasks (Homescreen)
- Tasks is the default landing page after login
- Other modules accessible via dropdown nav (no back button)
- Create, assign, prioritize, filter tasks by status/priority/account
- AI task completion — marking complete opens a Claude window that drafts the deliverable (email, call prep, document, action plan) and asks refinement questions before finalizing
- Smart Suggestions panel — pulls action items from Gmail + surfaces upcoming sales meetings from Google Calendar
- Demo seed tasks — auto-populates example tasks on first load so the list is never empty
- Recurring task templates — define daily/weekly/monthly tasks that auto-spawn instances
- Manager view — managers see all reps' tasks

### Account Pipeline
- Create, edit, stage accounts with vertical + ownership classification
- Deal Health scoring — calculated from MEDDICC completeness, transcripts, stakeholders, activity
- Suggested Next Actions — AI-generated recommendations per account
- Sales Journey Tracker — visual stage tracker (Intro → Demo → Evaluation → Proposal → Contract)
- Demo Brief — AI-generated brief for accounts in demo/solution validation/proposal stages
- MEDDICC tracking — structured qualification framework per account
- Stakeholders tab — track contacts, roles, champions
- Transcripts tab — Gong call import + manual transcript entry + AI analysis
- Information Gaps tab — track open questions and discovery gaps
- Stage-change task checklists — auto-creates relevant tasks when an account moves stages

### Outbound Engine
- Browse and research prospect companies with dense spreadsheet-style table
- Company detail modal — contacts (12-col table), notes, activity
- One-click "Create Account in Pipeline" — pushes outbound company into Account Pipeline with contacts + notes pre-filled

### Pipeline Overview (Manager/CEO)
- Visual pipeline funnel — stage breakdown across all accounts
- Per-rep breakdown — expandable rows showing each rep's open/overdue tasks + stage distribution
- Stale accounts panel — flags accounts with no activity in 14+ days

### Integrations

**Gong**
- Import calls, analyze transcripts (stakeholders, pain points, MEDDICC, business areas, next steps)
- Onboarding sync — on first login, pulls last 3 weeks of that rep's calls and creates tasks from action items

**Gmail**
- Reads last 7 days of inbox/sent via Gmail API
- Claude extracts action items and surfaces them in Smart Suggestions panel

**Google Calendar**
- Reads next 7 days via Calendar API
- Surfaces external sales meetings needing prep (flags meetings within 48 hours)

**Slack (multi-channel bot)**
- Uses Bot Token (not webhook) — routes to any channel dynamically
- Stage changes fire instantly to the account's Slack channel
- Daily digest (Mon–Fri 8am via Vercel cron) routes each rep's digest to their primary account channel
- Manager digest goes to configured DM/channel (`SLACK_MANAGER_CHANNEL`)
- Channel auto-derived from account name: "UDR Inc" → `#pursuit_udr`
- Manual channel override per account in Overview tab
- Fallback to `SLACK_DEFAULT_CHANNEL` if no channel resolved

**Vercel Cron**
- Daily digest: Mon–Fri 8am
- Inactive user cleanup: 1st of month at 2am

---

## 🔧 Needs Setup (Pending)

| Item | Action needed |
|---|---|
| **Slack channel migration** | Run in Supabase SQL Editor: `ALTER TABLE accounts ADD COLUMN IF NOT EXISTS slack_channel TEXT;` |
| **Slack user ID migration** | Run in Supabase SQL Editor: `ALTER TABLE profiles ADD COLUMN IF NOT EXISTS slack_user_id TEXT;` |
| **Supabase Google OAuth scopes** | Supabase dashboard → Authentication → Providers → Google → Additional OAuth Scopes → add: `https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/calendar.readonly` |
| **Existing users re-auth** | Reps need to sign out and back in to grant Gmail + Calendar permissions |
| **Gong env vars** | Add `GONG_ACCESS_KEY` and `GONG_SECRET_KEY` to Vercel for call import + onboarding sync |

---

## 🐛 Known Bugs

| Bug | Status | Notes |
|---|---|---|
| **Create task does nothing** | ✅ Fixed 2026-04-15 | Root cause: server-side Supabase client used browser client with no session, so all task API routes returned 401 |
| **Active/All/Complete filter** | ✅ Fixed 2026-04-15 | Was a symptom of the auth bug — no tasks loaded = nothing to filter |

---

## 🗂 Backlog

### Tasks — High Priority
- **"Work in Claude" button on tasks** — each task gets a button that opens a persistent Claude chat scoped to that task. The chat link is saved to the task so you can close it and pick it back up later exactly where you left off. Ideally one chat per account (not per task) so context builds across tasks for the same deal. Need to think through context window limits when accounts have lots of transcripts/decks/content.
- **Cross-assign tasks** — any user (rep or manager) should be able to create a task assigned to anyone else. Currently tasks only assign to self. Add an "Assign to" dropdown in the New Task modal.
- **Smart Suggestions auto-refresh** — currently requires manual re-sync every page visit. Should refresh automatically on page load (not just on mount if already cached).
- **Smart Suggestions expand on click** — clicking a suggestion should expand a small panel below it showing the reason it was surfaced, source (email subject / calendar event / Gong call), and any relevant context.
- **Smart Suggestions from Gong** — currently only pulls from Gmail + Google Calendar. Should also surface action items from recent Gong call transcripts (next steps, follow-ups, commitments made).
- **Stage-triggered task checklists** — when specific events happen, auto-create a checklist of tasks. Example: booking an intro meeting should auto-create: "Add to sales-ops channel", "Update pursuit channel", "Update HubSpot deal (AE, value, notes)", "Send [link] with deal details". Need to define the full trigger → checklist mapping with James/Mark.

### Tasks — Medium Priority
- **Slack DMs for daily digest** ✅ built, needs Supabase SQL migration + reps to set their Member ID in Settings
- **Pipeline confidence score** ✅ built, live in Pipeline Overview

### Account Pipeline — High Priority
- **HubSpot sync** — push stage changes and notes to HubSpot CRM (came up in task checklist discussion — reps currently have to update manually)

### Account Pipeline — Medium Priority
- **Email send from app** — draft follow-up emails in the AI window and send directly via Gmail API (currently drafts only)
- **Account activity feed** — unified timeline of calls, notes, stage changes, and tasks per account
- **Gong upcoming calls** — surface next scheduled calls from Gong alongside past transcripts

### Platform
- **Global search** — search across accounts, tasks, transcripts, stakeholders
- **Rep performance dashboard** — week-over-week task completion rate, call volume, deal velocity per rep

### Outbound Engine Phase 2
- Build this out further (to be scoped with James/Mark)
- Add/edit company modal
- Edit contact details inline
- Bulk operations (delete, export)
- CSV import
- AI outreach content generation (email sequences, LinkedIn messages)
- Contact enrichment (Apollo, ZoomInfo)

### UAT & Training
- **Full UAT suite per module** — build a structured user acceptance test for each module covering every feature. Serves two purposes: (1) regression testing when we ship new features, (2) becomes the training doc for new reps onboarding to the tool. Modules to cover: Tasks, Account Pipeline (all tabs), Outbound Engine, Pipeline Overview, Settings, Slack integration, Gong sync, Gmail/Calendar suggestions.

### Lower Priority
- **Slack → app commands** — type `/update UDR` in Slack and get a digest of that account back
- **Mobile-optimized task view** — current UI is desktop-first
- **Content module expansion** — more templates, saved outputs, version history
- **Analysis caching** — hash transcripts so identical uploads don't re-hit the API

---

## 🏗 Tech Stack

| Layer | Tech |
|---|---|
| Frontend | Next.js 14, React 18, Tailwind CSS |
| Backend | Next.js API routes (serverless on Vercel) |
| Database | Supabase (PostgreSQL + Row Level Security) |
| Auth | Supabase Auth + Google OAuth |
| AI | Anthropic Claude — Sonnet 4.6 (complex), Haiku 4.5 (fast extraction) |
| Integrations | Gong API, Gmail API, Google Calendar API, Slack Bot API |
| Deployment | Vercel (with cron jobs) |
| State | Zustand |
| Storage | Supabase (primary) + localStorage (outbound engine) |
