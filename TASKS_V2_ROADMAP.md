# Tasks v2 + Roadmap (captured 2026-07-19)

Everything below is committed to-do, not yet built. Source: James's 2026-07-19 review of Tasks/To-dos.

---

## Parked — integrations (activate when James is ready)
- Gmail draft — scope is live; confirm a real draft lands.
- Slack `SLACK_BOT_TOKEN` (health monitor flags it unconfigured — digests may be silently failing).
- Clay `CLAY_WEBHOOK_URL` + callback secret.
- Apollo key already set; confirm search→enrich credits.
- Gong webhook — confirm end-to-end on the first real call.
- Optional: recapture `e2e/auth.json` so automated click-through works again.

---

## Tasks v2 — the epic

### A. Task quality + context (the wall is noisy)
- **Kill nonsense tasks.** Gong-extracted commitments like "I'll come back to that in a second" are transcription noise, not tasks. Filter at extraction (min length, verb/object heuristic, confidence score) and let reps bulk-dismiss.
- **Show context on every task**: which call, with whom, when, and a one-line why. Link back to the transcript/account.
- **Everything is in the past.** Surface **upcoming** work — next scheduled calls (Gong/Calendar) with pre-call prep, not just overdue items.

### B. Today's Focus
- One-click **complete / delete / snooze** directly on each Focus item (James had already done all of them with no way to clear).
- Keep it to a genuinely-ranked short list; when cleared, refill from next-best-actions.

### C. The wall (hundreds of tasks)
- **Filter, sort, and mass-edit** — by account, stage, owner, due, source, priority; multi-select → complete/snooze/reassign/delete.
- Consistent filter/sort UX shared with By-Account and every other list surface.

### D. By Account view
- Same **filter/sort** affordances as everywhere (make this a consistent, reusable control).
- **Minimize/collapse** deals.
- **Color-coded stage tabs** using the shared StageBadge palette (consistency — stages look identical everywhere).
- Show **deal value** per account.

### E. Assistant / chat
- Much **wider** (near full-screen), not a narrow rail.
- **Concise** output — fastest, tightest answer; drop the verbosity.

### F. The cadence + re-engagement engine (the big one)
- **Per-call playbooks**: every AE gets default **pre-call** and **post-call** tasks (we built `task_playbooks` — wire the triggers), plus anything they specifically committed to on the call.
- **Re-engagement targets — AE: 10/week (2/day)** pulled from inactive/closed-lost deals:
  - Smart suggestions of deals most likely to reopen/close.
  - Trigger-based: a call line like "let's touch base in July" → auto-creates a July follow-up task **with a deliberate drafted message**, counting toward the weekly re-engage goal.
  - When a rep doesn't have enough live triggers, top up with suggested accounts to reach 10.
- **SDRs — 3 set meetings/week**: a daily plan to hit it, sized from that SDR's own call/email success rates (activity → meetings math).
- **Recurring cadences for everyone** (SDR/AE/**admin**): daily/weekly/monthly/quarterly recurring tasks via playbooks.

### G. Integrations for knowledge
- **Notion** — pull company knowledge (playbooks, product, competitive, process) into the assistant's context. (A Notion connector is available in this workspace.)

---

## Appendix — 30 ideas (2026-07-19 brainstorm)

### Easier for a rep
1. Complete → auto-surface that account's next best action (never return to the wall).
2. Voice capture after a call → parsed into tasks (extend the existing Voice button).
3. Keyboard-first: j/k move, e complete, s snooze, / search.
4. Auto-verify commitments: detect the sent email/booked meeting and self-close the task.
5. Natural-language snooze ("next Tuesday", "after the demo").
6. Saved per-rep task templates (apply a "post-demo" set in one click).
7. Draft-and-send inline from a "send" task (Content Studio embedded).
8. Slack DM of the day's 3 focus tasks with one-tap complete.
9. "Clear the noise" — archive low-signal auto-tasks older than N days in one click.
10. Mobile quick-actions (complete/snooze/add on the road).

### More impactful to the company
1. Pipeline-at-risk radar with $ at risk, to the manager daily.
2. Forecast with commit/best/worst bands vs. quota, driven by call signals.
3. Win/loss intelligence — patterns in what we lose and why → playbook.
4. Rep ramp scorecard vs. benchmark (spot coaching needs early).
5. Revenue-per-activity — which touches actually move deals.
6. Deal-desk: discount/legal/exec approvals tracked in-app.
7. Competitive win-rate dashboard (Procore/Smartsheet/Northspyre) + winning plays.
8. Post-close expansion signals from CS calls (land-and-expand).
9. Whitespace/territory map — uncovered target accounts for SDRs.
10. One-click board-ready report from the CEO view.

### Smarter with the info we have
1. Auto-write MEDDICC/stakeholders/gaps from calls back to the account (the audit's "output (a)" gap).
2. True next-best-action per deal from full signal (stage + recency + sentiment + gaps), ranked.
3. Per-account sentiment/engagement trend call-over-call.
4. Two-way commitment tracking with nudges ("they said they'd send the budget").
5. Relationship graph — champion / gone-quiet / newly-added, from call attendance.
6. Smart re-engage timing model (fiscal year, seasonality, trigger events).
7. Objection library auto-built from calls, with rebuttals that advanced deals.
8. Talk-ratio / discovery-quality coaching per call, trended, tied to outcomes.
9. Entity resolution — dedupe accounts/contacts across Gong/HubSpot/Apollo.
10. Predictive lead scoring against past closed-won (ICP + engagement).
