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
// NOTE: auto-tasks are assigned to the rep's profile user_id (looked up by email). Logan & Kristin
// are promoted here so their calls generate action items FOR THEM — but tasks only actually land
// once they have an app account (invite them in Settings); until then this is a no-op for them.
export const AUTO_PROCESS_REPS = [
  { name: 'James Lindberg', email: 'james@withbanner.com' },
  { name: 'Logan King', email: null },  // promoted from historical; coached by James
  { name: 'Kristin', email: null },     // coached by James
];

// Coaches ride along on calls they don't lead. Action items from a coached call are attributed to
// the deal owner (the lead rep) and tagged coached_by the coach, so the coach can filter
// "Calls I coached". A coach IS also an auto-process rep for their own led calls.
export const COACH_REPS = [
  { name: 'James Lindberg', email: 'james@withbanner.com' },
];

// Analyzed for aggregate intelligence only — no tasks, no coaching. (Logan promoted above.)
export const HISTORICAL_REPS = [];

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
    if (q === rn) return true;
    // Allow a bare first-name (Gong sometimes omits the last name) to match the config's
    // first name — but NOT arbitrary substrings ('j', 'jam'), which over-trigger the loop.
    if (!q.includes('@')) {
      const qFirst = q.split(/\s+/)[0];
      const rFirst = rn.split(' ')[0];
      if (qFirst && qFirst === rFirst) return true;
    }
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

// True if this rep is a coach (rides along on calls they don't lead).
export function isCoachRep(nameOrEmail) {
  return COACH_REPS.some(r => matchesRep(r, nameOrEmail));
}

// True if `account` belongs to `profile`. Prefers the durable user_id link; falls back to a
// normalized owner_name compare because HubSpot-synced accounts only carry owner_name for
// non-James reps until OWNER_USER_MAP is backfilled (sync-deals.js). The fallback is
// whitespace/case-insensitive so a Google-OAuth full_name and the hand-typed HubSpot owner
// string still match instead of silently emptying that rep's queue.
export function ownsAccount(account, profile) {
  if (!account || !profile) return false;
  if (account.user_id && profile.id && account.user_id === profile.id) return true;
  const owner = norm(account.owner_name);
  const me = norm(profile.full_name);
  return !!owner && !!me && owner === me;
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
