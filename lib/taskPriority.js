// Holistic task priority score (0-100), computed on read so due-date urgency stays fresh (a persisted
// column would go stale as dates approach). Fixes "everything reads High": before this, the badge came
// from the coarse 1/2/3 that collapsed to commitment=High vs everything=Med, so most tasks showed High.
// The display band now derives from this score, and only genuinely urgent/important work reads High.

const SOURCE_BASE = {
  gong_commitment: 55, commitment: 55,   // an explicit promise on a call
  calendar: 50,                          // a scheduled meeting's prep/follow-up
  campaign: 42,
  gong_next_step: 38, gong_reengage: 34,
  ai_suggestion: 34, stage_change: 32,
  playbook_post_call: 30, playbook_pre_call: 30,
};

// Task-local scoring only (no account join needed): source, coarse priority, due-date, age.
export function scoreTask(t) {
  if (!t) return 0;
  let score = SOURCE_BASE[t.sourceType] ?? SOURCE_BASE[t.source]
    ?? (t.priority === 1 ? 55 : t.priority === 3 ? 22 : 38); // manual falls back to coarse priority

  if (t.dueDate) {
    const days = Math.floor((new Date(t.dueDate).getTime() - Date.now()) / 86400000);
    if (days < 0) score += 30;        // overdue — most urgent
    else if (days === 0) score += 25; // due today
    else if (days <= 2) score += 15;
    else if (days <= 7) score += 8;
  } else if (t.createdAt) {
    // No due date: decay stale auto-generated tasks so they stop reading as urgent.
    const ageDays = Math.floor((Date.now() - new Date(t.createdAt).getTime()) / 86400000);
    if (ageDays > 21) score -= 12;
    else if (ageDays > 10) score -= 6;
  }

  return Math.max(0, Math.min(100, Math.round(score)));
}

export function priorityBand(score) {
  if (score >= 55) return 'high';
  if (score >= 32) return 'med';
  return 'low';
}

// Display maps keyed by band (replaces PRIORITY_LABELS/PRIORITY_COLORS keyed by 1/2/3 for the badge).
export const BAND_LABEL = { high: 'High', med: 'Med', low: 'Low' };
export const BAND_COLOR = {
  high: 'text-red-600 bg-red-50 border-red-200',
  med: 'text-amber-600 bg-amber-50 border-amber-200',
  low: 'text-gray-500 bg-gray-50 border-gray-200',
};
