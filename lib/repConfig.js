// repConfig — single source of truth for Gong call governance.
//
// Governs who gets what across the call-intelligence engine:
//   - AUTO_PROCESS_REPS: calls are analyzed AND generate auto-tasks + a per-call
//     coaching DM (sales-category calls only). To onboard a rep to the full loop,
//     add them here — user_id + slack_user_id are looked up from `profiles` by
//     email at runtime, so no UUIDs to hardcode.
//   - HISTORICAL_REPS: analyzed for aggregate intelligence only (former reps).
//     No tasks, no coaching.
//   - EXCLUDED_REPS: never analyzed or surfaced anywhere (CS / non-sales staff).
//   - Anyone not listed is treated as "manual": their calls may be analyzed if
//     pushed, but they get no automatic tasks/coaching until promoted here.
//
// This is the ONE place to change rep behavior. Edit the lists, not the engine.

// Fully auto-processed: analyzed + auto-tasks + per-call coaching DM (sales calls only).
export const AUTO_PROCESS_REPS = [
  { name: 'James Lindberg', email: 'james@withbanner.com' },
  // To onboard a rep, add { name, email }. Mark is intentionally MANUAL for now
  // (mixed sales + CS calls); promote him here once that's the desired behavior —
  // CS-category calls are auto-skipped for tasks/coaching regardless.
];

// Analyzed for aggregate intelligence only — no tasks, no coaching.
export const HISTORICAL_REPS = [
  { name: 'Logan', email: null },
];

// Never analyzed or surfaced — CS / non-sales staff. Matched against the call's rep_name.
export const EXCLUDED_REPS = [
  'Leah', 'David', 'Julian', 'Kyle Schneider', 'Amber', 'Josh', 'Kelly', 'Wendy Ford', 'Chris Whitney',
];

function norm(s) {
  return (s || '').toString().trim().toLowerCase();
}

function matchesRep(rep, nameOrEmail) {
  const q = norm(nameOrEmail);
  if (!q) return false;
  if (rep.email && norm(rep.email) === q) return true;
  if (rep.name) {
    const rn = norm(rep.name);
    if (rn === q || q.includes(rn) || rn.includes(q)) return true;
  }
  return false;
}

// True if this rep's calls should be fully auto-processed (tasks + coaching).
export function isAutoProcessRep(nameOrEmail) {
  return AUTO_PROCESS_REPS.some(r => matchesRep(r, nameOrEmail));
}

// True if this rep's calls are aggregate-only (analyzed, but no tasks/coaching).
export function isHistoricalRep(nameOrEmail) {
  return HISTORICAL_REPS.some(r => matchesRep(r, nameOrEmail));
}

// True if this rep should never enter the system at all.
// Multi-token entries ("Kyle Schneider") require a full-name match; single first
// names ("Leah") match on the rep's first name token — these are Banner staff, so
// first-name matching against rep_name is safe.
export function isExcludedRep(nameOrEmail) {
  const q = norm(nameOrEmail);
  if (!q) return false;
  const firstToken = q.split(/[\s@]/)[0];
  return EXCLUDED_REPS.some(n => {
    const rn = norm(n);
    if (rn.includes(' ')) return q.includes(rn);
    return firstToken === rn;
  });
}
