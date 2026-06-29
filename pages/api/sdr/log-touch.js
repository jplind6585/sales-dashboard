// POST /api/sdr/log-touch  { accountId, touchType, outcome?, notes? }
// Logs an SDR/AE outreach touch to Supabase (manager-visible), replacing the localStorage-only
// touch log. rep_id is taken from the authenticated session — never trusted from the client.

import { createServerSupabaseClient, getSupabase } from '../../../lib/supabase';
import { apiError, apiSuccess, validateMethod, logRequest } from '../../../lib/apiUtils';

const TOUCH_TYPES = new Set(['call', 'email', 'linkedin', 'voicemail', 'meeting']);

export default async function handler(req, res) {
  logRequest(req, 'sdr/log-touch');
  if (!validateMethod(req, res, 'POST')) return;

  const auth = createServerSupabaseClient(req, res);
  const { data: { user } } = await auth.auth.getUser();
  if (!user) return apiError(res, 401, 'Unauthorized');

  const { accountId, touchType = 'call', outcome = null, notes = null } = req.body || {};
  if (!accountId) return apiError(res, 400, 'accountId required');
  if (!TOUCH_TYPES.has(touchType)) return apiError(res, 400, `invalid touchType (one of ${[...TOUCH_TYPES].join(', ')})`);

  const db = getSupabase();
  try {
    const { data, error } = await db.from('sdr_touches').insert({
      account_id: accountId, rep_id: user.id, touch_type: touchType,
      outcome: outcome ? String(outcome).slice(0, 200) : null,
      notes: notes ? String(notes).slice(0, 1000) : null,
      touched_at: new Date().toISOString(),
    }).select('id').single();
    if (error) throw error;
    return apiSuccess(res, { logged: true, id: data.id });
  } catch (e) {
    console.error('[sdr/log-touch] failed (sdr_touches migrated?):', e.message);
    return apiError(res, 503, 'Touch logging activates after the sdr_touches migration runs — nothing was lost.');
  }
}
