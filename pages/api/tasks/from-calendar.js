// POST /api/tasks/from-calendar
//   { phase: 'prep' | 'followup', event: { id, title, start, end }, repEmail? }
// Creates a prep task (before an intro/meeting) or a follow-up task (after it ends),
// fuzzy-matched to a pipeline account, with a pre-generated AI draft. Draft-only.
// Idempotent: dedup by source + source_id (event id + phase). Client passes the event
// because the Google token lives in the user's session, not in a cron.

import { createServerSupabaseClient, getSupabase } from '../../../lib/supabase';
import { apiError, apiSuccess, logRequest } from '../../../lib/apiUtils';

function normalize(s) {
  return (s || '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
}
// Lightweight title→account match by word overlap (mirrors the app's prep-brief approach).
function matchAccount(title, accounts) {
  const t = normalize(title);
  if (!t) return null;
  const words = new Set(t.split(' ').filter(w => w.length > 3));
  let best = null, bestScore = 0;
  for (const a of accounts) {
    const an = normalize(a.name);
    if (!an) continue;
    if (t.includes(an) || an.includes(t)) return a;       // strong containment
    const overlap = an.split(' ').filter(w => w.length > 3 && words.has(w)).length;
    if (overlap > bestScore) { bestScore = overlap; best = a; }
  }
  return bestScore >= 1 ? best : null;
}

export default async function handler(req, res) {
  logRequest(req, 'tasks/from-calendar');
  if (req.method !== 'POST') return apiError(res, 405, 'POST only');

  const auth = createServerSupabaseClient(req, res);
  const { data: { user } } = await auth.auth.getUser();
  if (!user) return apiError(res, 401, 'Unauthorized');

  const { phase, event, accountId: passedAccountId } = req.body || {};
  if (!event?.id || !['prep', 'followup'].includes(phase)) return apiError(res, 400, 'phase (prep|followup) and event.id required');

  const db = getSupabase();

  // Resolve the requesting rep's profile (owner of the created task)
  const { data: profile } = await db.from('profiles').select('id, full_name').ilike('email', user.email).maybeSingle();
  const ownerId = profile?.id;
  if (!ownerId) return apiError(res, 400, 'No profile for user');

  const sourceId = `cal_${phase}_${event.id}`;

  // Idempotency
  const { data: existing } = await db.from('tasks').select('id').eq('source', 'calendar').eq('source_id', sourceId).maybeSingle();
  if (existing) return apiSuccess(res, { created: false, taskId: existing.id, reason: 'already_exists' });

  // Prefer the account the UI already matched (stronger attendee-based match); else fall back to title overlap.
  let account = null;
  if (passedAccountId) {
    const { data: a } = await db.from('accounts').select('id, name, stage').eq('id', passedAccountId).maybeSingle();
    account = a || null;
  }
  if (!account) {
    const { data: accounts } = await db.from('accounts').select('id, name, stage').limit(800);
    account = matchAccount(event.title, accounts || []);
  }

  const when = event.start ? new Date(event.start).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : null;
  const isPrep = phase === 'prep';
  const title = isPrep
    ? `Prep for: ${event.title || 'meeting'}`
    : `Follow up: ${event.title || 'meeting'}`;
  const trigger = isPrep ? 'calendar_prep' : 'calendar_followup';
  const sourceType = trigger;

  const row = {
    owner_id: ownerId,
    created_by: ownerId,
    type: 'triggered',
    priority: isPrep ? 2 : 1,
    title: title.length > 120 ? title.slice(0, 117) + '...' : title,
    description: `${isPrep ? 'Upcoming meeting' : 'Meeting ended'}${when ? ` (${when})` : ''}: "${event.title || 'meeting'}". Calendar event ${event.id}.`,
    status: 'open',
    source: 'calendar',
    source_id: sourceId,
    source_type: sourceType,
    account_id: account?.id || null,
    rationale: isPrep ? 'Walk in prepared — review the deal and set the ask.' : 'Capture notes and send the follow-up while it is fresh.',
    visible_to_manager: true,
  };

  const { data: created, error } = await db.from('tasks').insert(row).select('id, title, description, rationale, source_type').single();
  if (error) return apiError(res, 500, `Could not create task: ${error.message}`);

  // Tag the trigger synchronously (fast single update). The AI draft is generated lazily
  // when the rep opens the task (generate-action) so we never block the client request.
  try {
    await db.from('tasks').update({ trigger }).eq('id', created.id);
  } catch (e) { console.error('[from-calendar] trigger tag skipped (pre-migration?):', e.message); }

  return apiSuccess(res, { created: true, taskId: created.id, accountMatched: account?.name || null });
}
