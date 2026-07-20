# Master Build Plan — Tasks v2, Intelligence, Cadence Engine, Company Impact
_Captured 2026-07-19 · decisions confirmed 2026-07-20_

The full backlog from James's review + the approved brainstorm ideas, sequenced by dependency.
Guiding principle: **the call→account data writeback is the keystone.** Most "smarter" and
"impactful" ideas are thin UI once every analyzed call writes structured signal to the account.
So foundations first, then the daily rep experience, then the engine, then company/exec impact.

## Decisions
- **Committed (build):** all Tasks v2 items; easier-for-rep 1–9; impactful 1,2,3,5,6,7,9;
  smarter 1–10; Notion knowledge.
- **Parked (roadmap, later):** easier #10 mobile quick-actions; impactful #4 rep-ramp scorecard,
  #8 post-close expansion signals, #10 one-click board report.
- **Parked integrations:** Slack token, Clay, Apollo confirm, Gong live-call, Gmail draft confirm, E2E re-auth.

---

## Phase 0 — Foundations (unlocks most of the rest)
Nothing user-facing ships alone here; it's the data + shared primitives everything leans on.

- **Call → Account writeback** (smarter #1; unblocks smarter 2/3/4/5/7 + impactful 1/2/3).
  Extend `gong/intel-analyze` so each analysis persists to the account: MEDDICC, stakeholders,
  information gaps, competitors, next steps, **two-way commitments**, and a **sentiment/engagement
  score**. Consolidate the orphaned client-side `analyze-transcript` extraction. New/updated:
  `account_signals` table (sentiment, engagement, talk_ratio, last_call_at, meddicc_completeness),
  writeback in `lib/accountWriteback.js`. _Size: L._
- **Task quality gate + context** (Tasks A). At extraction, score each candidate task (min length,
  verb+object, confidence); drop noise ("I'll come back to that"). Store context on every task:
  `gong_call_id`, participants, call date, one-line why (columns on `tasks`). _Size: M._
- **Shared list controls** (Tasks C/D — "a consistent thing we look for"). One reusable
  `ListToolbar` (filter by account/stage/owner/due/source/priority + sort + multi-select →
  complete/snooze/reassign/delete). Used by the Tasks wall, By-Account, and future lists. _Size: M._
- **Next-best-action service** (smarter #2). One ranked NBA per deal from full signal
  (stage + recency + sentiment + open gaps + deal value). Powers Today's Focus refill, re-engage
  picks, and the at-risk radar. `lib/nba.js` + `/api/nba`. _Size: M._

## Phase 1 — Tasks that work (daily rep experience)
Depends on Phase 0 (quality gate, list controls, NBA).

- Task **context** shown on every row (call/who/when + why). (Tasks A)
- **Wall**: filter/sort/mass-edit via ListToolbar. (Tasks C)
- **Today's Focus**: one-click complete / delete / snooze; refill from NBA when cleared. (Tasks B)
- **By-Account**: filters, collapsible deals, **color-coded StageBadge**, **deal value**. (Tasks D)
- **Assistant**: near-full-screen width + concise output. (Tasks E)
- **Upcoming**, not just past: surface next scheduled calls (Gong/Calendar) with pre-call prep. (Tasks A)
- Easier-for-rep: complete→NBA (#1), voice→tasks (#2), keyboard-first (#3), auto-verify
  commitments via Gmail/Calendar (#4), NL snooze (#5), saved templates (#6), draft-and-send
  inline (#7), Slack DM of 3 focus + one-tap complete (#8), "clear the noise" bulk-archive (#9).
  _Size: L (the big daily-UX slice)._

## Phase 1.5 — Theming (dark mode) — IN PROGRESS
Requested 2026-07-20 (James loved the mockup's dark treatment). Done the centralized way, not a
29-page sweep: `darkMode: 'class'` + a no-flash pre-paint script + one `.dark` theme layer in
globals.css that remaps neutral + semantic utilities to the mockup palette (ground #0D1319, surface
#141D27, border #24303E, coral accent) + a sun/moon toggle in the shell (opt-in, persisted). Known
follow-up: a handful of inline-styled elements (some Tasks chips/bars) override CSS and stay light —
convert those to classes in a pass. Later: default to system preference once polished.

## Phase 2 — Cadence + quota engine
Depends on Phase 0/1 (NBA, playbooks table exists).

- **Per-call playbooks**: default pre-call + post-call task sets per AE, wired to triggers
  (`task_playbooks` + trigger runner) + the rep's own stated commitments from the call.
- **Trigger→task**: "let's touch base in July" → dated follow-up task **with a drafted message**,
  counts toward the weekly re-engage goal.
- **AE re-engagement — 10/week (2/day)**: pull from inactive/closed-lost + call triggers; rank by
  reopen likelihood (**smart re-engage timing model, smarter #6**); top-up with suggested accounts
  to reach 10. Weekly goal tracker.
- **SDR — 3 meetings/week**: a daily plan sized from that SDR's own call/email → meeting rates.
- **Recurring cadences** (daily/weekly/monthly/quarterly) for SDR/AE/**admin**. _Size: L._

## Phase 3 — Intelligence surfaced
Depends on Phase 0 writeback + signals.

- Two-way **commitment tracker** with nudges (smarter #4).
- **Relationship graph** — champion / gone-quiet / newly-added, from call attendance (smarter #5).
- **Objection library** auto-built from calls + rebuttals that advanced deals (smarter #7).
- **Talk-ratio / discovery-quality coaching**, trended per rep, tied to outcomes (smarter #8).
- **Entity resolution** — dedupe accounts/contacts across Gong/HubSpot/Apollo (smarter #9).
- **Predictive lead scoring** vs. past closed-won (ICP + engagement) (smarter #10).
- Per-account **sentiment/engagement trend** view (smarter #3). _Size: L._

## Phase 4 — Company impact (manager/exec)
Depends on Phase 0 signals + deal_value.

- **Pipeline-at-risk radar** with $ at risk, daily to the manager (impactful #1).
- **Forecast** with commit/best/worst bands vs. quota, signal-driven (impactful #2).
- **Win/loss intelligence** — loss patterns → playbook (impactful #3).
- **Revenue-per-activity** — which touches move deals (impactful #5).
- **Deal-desk** — discount/legal/exec approvals in-app (impactful #6).
- **Competitive win-rate dashboard** + winning plays (impactful #7).
- **Whitespace map** — uncovered target accounts → SDRs (impactful #9). _Size: L._

## Phase 5 — Knowledge
- **Notion** connector → company knowledge (playbooks, product, competitive) into the assistant's
  context (connector available in this workspace). _Size: M._

## Parked (later)
Easier #10 mobile quick-actions · impactful #4 rep-ramp scorecard · #8 post-close expansion signals
· #10 one-click board report.

---

## How it ships
Each phase: build in verified batches (workflow fan-out where mechanical), full `next build` gate,
deploy, confirm. Phases 0→1 first (foundation + the daily pain), then 2, then 3/4 in parallel, then 5.
