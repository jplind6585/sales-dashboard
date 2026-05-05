# Sales Dashboard — Roadmap

_Last updated: 2026-05-05_

---

## ✅ Shipped

### Auth & Access
- Google OAuth restricted to @withbanner.com accounts only
- Auto-provision profile on first login (role defaults to `rep`)
- Unauthorized domain → signed out + error banner shown on login page
- Inactive account auto-deletion — cron runs 1st of month at 2am, deletes users inactive 6+ months

### Tasks (Homescreen)
- Tasks is the default landing page after login — not a module, the front of the app
- Other modules accessible via dropdown nav in the header
- Create, prioritize, and track tasks by status/priority/account
- Filter by Active / All / Complete
- AI task completion — marking a task complete opens a Claude window that drafts the deliverable (email, call prep, doc, action plan) and asks refinement questions before finalizing
- Smart Suggestions panel — pulls action items from Gmail + surfaces upcoming sales meetings from Google Calendar
- Demo seed tasks — auto-populates "Email UDR for an update" and "Create swim lanes for IRT" on first load so list is never empty
- Recurring task templates — define daily/weekly/monthly tasks that auto-spawn instances
- Manager view — managers can see all reps' tasks in a team grid
- Task completion fires Slack notification to the account's channel
- Fixed: server-side auth bug that caused create task and filters to silently fail (2026-04-15)

### Account Pipeline
- Create, edit, and stage accounts with vertical + ownership type classification
- Deal Health scoring — calculated from MEDDICC completeness, transcripts, stakeholders, and activity recency
- Suggested Next Actions — AI-generated per account
- Sales Journey Tracker — visual stage tracker (Intro → Demo → Evaluation → Proposal → Contract)
- Demo Brief — AI-generated brief for accounts in demo / solution validation / proposal stages
- MEDDICC tracking — structured qualification framework per account
- Stakeholders tab — track contacts, roles, champions
- Transcripts tab — Gong call import + manual transcript entry + AI analysis
- Information Gaps tab — track open discovery questions and gaps
- Stage-change task checklists — auto-creates relevant tasks when an account moves stages
- Slack channel field per account — explicit override or auto-derived from account name (`pursuit_udr`)
- Stage changes fire instantly to the account's Slack channel
- Demo Brief button appears for demo / solution_validation / proposal stage accounts
- Auto-select account from URL query param (`?account=id`)

### Outbound Engine
- Dense spreadsheet-style company table with filters (vertical, status, search)
- Company detail modal — contacts (12-col table with search/filter), notes, activity
- One-click "Create Account in Pipeline" — pushes company + contacts + notes into Account Pipeline

### Pipeline Overview (Manager / CEO)
- Pipeline confidence score — hero card showing weighted win probability across all active accounts (stage-based + bonuses for calls, stakeholders, champion)
- Visual pipeline funnel — stage distribution across all accounts
- Per-rep breakdown — expandable rows with confidence %, accounts, open tasks, overdue, done this week
- Stale accounts panel — flags accounts with no transcript activity in 14+ days

### Settings
- Email signature — saved and auto-appended to generated follow-up emails
- Slack Member ID — reps enter their Slack ID to receive daily digest as a DM

### Integrations

**Gong**
- Import calls directly into Account Pipeline → Transcripts tab
- AI transcript analysis — extracts stakeholders, pain points, MEDDICC data, business areas, next steps
- Onboarding sync — on first login, pulls last 3 weeks of that rep's calls and creates tasks from action items

**Gmail**
- Reads last 7 days of inbox + sent via Gmail API
- Claude extracts action items and surfaces them in the Smart Suggestions panel on Tasks

**Google Calendar**
- Reads next 7 days via Calendar API
- Surfaces upcoming external sales meetings, flags meetings within 48 hours as needing prep

**Slack (multi-channel bot)**
- Bot Token (`SLACK_BOT_TOKEN`) with `chat:write` + `chat:write.public` scopes
- Stage changes → fires to the account's Slack channel instantly
- Task completions → fires to the account's Slack channel
- Daily digest (Mon–Fri 8am cron) → routes each rep's digest to their Slack DM (if `slack_user_id` set) or their most-active account channel
- Manager digest → goes to `SLACK_MANAGER_CHANNEL` (currently James's DM `D02PGNHTR53`)
- Channel routing: explicit `slack_channel` field on account → auto-derived from name (`pursuit_udr`) → `SLACK_DEFAULT_CHANNEL`
- Reps set their Slack Member ID in Settings to get personal DM digests

**Vercel Cron**
- Daily digest: Mon–Fri 8am (`0 8 * * 1-5`)
- Inactive user cleanup: 1st of month at 2am (`0 2 1 * *`)

---

## 🔧 Needs Setup (Pending Config)

| Item | Action needed |
|---|---|
| **Slack channel SQL migration** | Supabase SQL Editor: `ALTER TABLE accounts ADD COLUMN IF NOT EXISTS slack_channel TEXT;` |
| **Slack user ID SQL migration** | Supabase SQL Editor: `ALTER TABLE profiles ADD COLUMN IF NOT EXISTS slack_user_id TEXT;` |
| **Supabase Google OAuth scopes** | Supabase dashboard → Auth → Providers → Google → Additional OAuth Scopes: `https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/calendar.readonly` |
| **Existing users re-auth** | All reps need to sign out and back in to grant Gmail + Calendar permissions |
| **Gong env vars** | Add `GONG_ACCESS_KEY` and `GONG_SECRET_KEY` to Vercel env vars |

---

## 🐛 Bugs

| Bug | Status | Notes |
|---|---|---|
| Create task does nothing | ✅ Fixed 2026-04-15 | Server-side Supabase used browser client with no session → all task API routes returned 401 |
| Active/All/Complete filter broken | ✅ Fixed 2026-04-15 | Symptom of the auth bug above — no tasks loaded = nothing to filter |

---

## 📊 Call Intelligence — Build Queue

Items in rough priority order. First 5 are actively in progress or next up.

### In Progress / Next Up
- **Complete full analysis (262 calls)** — prerequisite for everything below. Insights based on partial data can't be trusted.
- **Reframe "Top Themes" → "Top Buyer Priorities"** — prompt change in `intel-aggregate.js`. Same data, framed as market intelligence: "Buyers prioritizing: escaping spreadsheets, portfolio visibility, accounting integration" instead of theme counts.
- **Loss Reasons breakdown** — first-class section in the aggregate output. Ranked list: what % of negative-sentiment calls are attributed to authority mismatch, no acute pain, wrong ICP, reschedule decay, competition. Currently buried in Win/Loss bullets.
- **ICP fit score per call** — Haiku prompt addition: 1–10 score on how well the prospect matches Banner's ICP (CRE, CapEx-heavy, still on spreadsheets). Aggregate by score bucket to find the threshold below which deals don't close. Output becomes a data-backed ICP threshold for SDRs.
- **Discovery quality / MEDDICC coverage score** — Haiku prompt addition: did the rep surface economic buyer, decision process, specific pain metric, champion? Maps to MEDDICC fields already tracked in Account Pipeline. Low-discovery calls are fake pipeline.

### Soon
- **"Gone cold" deal flag** — using HubSpot stage data now cached per call, flag deals where the deal stage hasn't advanced since the intro/demo. Show a filtered view: "intro calls where deal is still in intro 30+ days later." This is the recoverable loss pool.
- **Gone cold → follow-up email/content proposal** — for each gone-cold deal, Claude drafts a re-engagement email and suggests relevant content (case study, ROI model, reference customer) based on the original call's objections and themes. Rep clicks to copy or send.
- **Revenue impact on insights** — pull `deal_amount` from HubSpot alongside deal stage. Tie aggregate insights to dollars: "Authority mismatches present in $Xm of pipeline, 3x lower close rate." Changes the aggregate prompt to output dollar-weighted insights.
- **Month-over-month trend analysis** — 6 months of call data exists, enough for trends. Add `trend` field to aggregate: loss reason %, ICP score, discovery score by month. Surface as sparklines or delta vs. prior month on the top-level numbers.
- **Executive headline** — after revenue + trend data exist, have Claude generate a single-sentence `executive_summary` field: "We're losing ~40% of qualified deals to two fixable issues: wrong-contact engagement and weak next-step discipline." Replaces the top KPI row as the hero element.
- **CEO summary tab** — a "Summary" tab showing: headline → loss reasons → rep performance → 3 actions. The existing Overview tab becomes the analyst/operational view.

### Future
- **Dock integration for re-engagement** — when a deal goes cold, auto-populate a Dock information room (Banner's tool for deal rooms) with relevant content, case studies, and a personalized message based on the call analysis. Triggered from the "gone cold" flag. James uses Dock today; this closes the loop from insight → action → delivery without rep copy-paste.
- **To-Do list auto-population from gone cold** — when a deal is flagged as gone cold, auto-create a task in the rep's task list: "Re-engage [Company] — last contacted [date], suggested follow-up attached." Links back to the Call Intelligence gone-cold view. (Note: To-Do list integration exists in the app already; this would be the first auto-created task from Call Intelligence.)
- **ICP threshold enforcement** — once ICP score data accumulates, surface the data-backed threshold (e.g., "deals scoring below 6 close at 4% vs. 38% above") and expose it as a rep-facing qualification checklist on the Intro call booking flow.
- **Gong Smart Suggestions** — surface action items from recent Gong call transcripts (next steps, commitments, follow-ups) in the Tasks Smart Suggestions panel, alongside Gmail and Calendar. Closes the loop: call happens → task auto-surfaces.

---

## 🗂 Backlog

### Tasks — High Priority
- **"Work in Claude" button** — each task gets a button that opens a persistent Claude chat. Chat is saved to the task so you pick it right back up. One chat per account (not per task) so context builds across the deal. Need to handle context window limits when accounts have lots of transcripts/content.
- **Cross-assign tasks** — any user (rep or manager) should be able to assign tasks to anyone. Add "Assign to" dropdown in New Task modal. Decision: try "anyone can assign to anyone" first and see how it goes.
- **Smart Suggestions auto-refresh** — currently requires manual re-sync on every page visit. Should auto-refresh on page load.
- **Smart Suggestions expand on click** — clicking a suggestion opens a small panel below it with the reason surfaced, source (email subject / calendar event / Gong call), and relevant context.
- **Smart Suggestions from Gong** — currently only Gmail + Calendar. Should also surface action items from recent Gong call transcripts (next steps, follow-ups, commitments made on calls).
- **Stage-triggered task checklists (expanded)** — flesh out the full trigger → checklist mapping with James + Mark. Example: booking an intro meeting auto-creates: "Add to #sales-ops channel", "Update pursuit channel", "Update HubSpot deal (AE, value, notes)", "Send intro link with deal details". Currently stage-change checklists exist but need to be customized to Banner's actual process.

### Tasks — Medium Priority
- **Slack DMs for daily digest** — built ✅, needs the two SQL migrations run + reps to paste their Member ID in Settings
- **Pipeline confidence score** — built ✅, live in Pipeline Overview

### Account Pipeline — High Priority
- **HubSpot sync** — push stage changes, notes, and deal updates to HubSpot. Reps currently update manually. Came up as part of the intro-booking checklist.

### Account Pipeline — Medium Priority
- **Email send from app** — currently AI drafts the email but rep has to copy/paste. Wire up Gmail send API so they can send directly from the app.
- **Account activity feed** — unified timeline per account: calls, notes, stage changes, tasks — all in one view.
- **Gong upcoming calls** — surface next scheduled calls from Gong alongside past transcripts in the Transcripts tab.

### Outbound Engine Phase 2
- Needs to be scoped with James + Mark — agreed it needs more build-out
- Add/edit company modal
- Edit contact details inline (currently can only add/delete)
- Bulk operations (delete multiple, export)
- CSV import for bulk company upload
- AI outreach content generation (email sequences, LinkedIn messages)
- Contact enrichment (Apollo, ZoomInfo)
- Playbooks per vertical (talk tracks, questions, objection handling)

### Platform
- **Global search** — search across accounts, tasks, transcripts, stakeholders in one place
- **Rep performance dashboard** — week-over-week task completion, call volume, deal velocity per rep

### UAT & Training
- **Full UAT suite per module** — structured test covering every feature in each module. Dual purpose: (1) regression testing when new features ship, (2) training doc for new reps. Modules: Tasks, Account Pipeline (all 6 tabs), Outbound Engine, Pipeline Overview, Settings, Slack, Gong sync, Gmail/Calendar suggestions.

### Lower Priority
- **Slack → app commands** — type `/update UDR` in Slack and get a deal digest back
- **Mobile-optimized task view** — current UI is desktop-first
- **Content module expansion** — more templates, saved outputs, version history
- **Analysis caching** — hash transcripts so identical uploads skip the Claude API call

---

## 🏗 Tech Stack

| Layer | Tech |
|---|---|
| Frontend | Next.js 14, React 18, Tailwind CSS |
| Backend | Next.js API routes (serverless on Vercel) |
| Database | Supabase (PostgreSQL + Row Level Security) |
| Auth | Supabase Auth + Google OAuth (restricted to @withbanner.com) |
| AI | Anthropic Claude — Sonnet 4.6 (complex tasks), Haiku 4.5 (fast extraction) |
| Integrations | Gong API, Gmail API, Google Calendar API, Slack Bot API |
| Deployment | Vercel (with cron jobs) |
| State | Zustand |
| Storage | Supabase (primary) + localStorage (Outbound Engine) |

---

## 📋 Env Vars Reference

| Var | Where | Purpose |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Vercel | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Vercel | Supabase anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Vercel | Server-side DB operations |
| `ANTHROPIC_API_KEY` | Vercel | Claude API |
| `GONG_ACCESS_KEY` | Vercel | Gong API auth |
| `GONG_SECRET_KEY` | Vercel | Gong API auth |
| `SLACK_BOT_TOKEN` | Vercel | Slack bot (xoxb-...) |
| `SLACK_DEFAULT_CHANNEL` | Vercel | Fallback Slack channel (`#sales-chatgpt-prompts`) |
| `SLACK_MANAGER_CHANNEL` | Vercel | Manager digest destination (`D02PGNHTR53`) |
| `CRON_SECRET` | Vercel | Secures Vercel cron job calls |
| `DIGEST_SECRET` | Vercel | Secures manual digest triggers |
