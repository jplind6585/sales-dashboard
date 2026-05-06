// Low-confidence match triage queue.
// GET  — returns calls linked to an account with match_confidence < 0.85
// POST — confirm (keep link), reject (clear account_id), override (set new account_id)

import { apiError, apiSuccess, logRequest } from '../../../lib/apiUtils';
import { getSupabase } from '../../../lib/supabase';
import { createServerSupabaseClient } from '../../../lib/supabase';

const CONFIDENCE_THRESHOLD = 0.85;

export default async function handler(req, res) {
  logRequest(req, 'admin/match-triage');

  const auth = createServerSupabaseClient(req, res);
  const { data: { user } } = await auth.auth.getUser();
  if (!user) return apiError(res, 401, 'Unauthorized');

  const db = getSupabase();

  if (req.method === 'GET') {
    const { data: rows, error } = await db
      .from('gong_call_analyses')
      .select(`
        gong_call_id,
        match_confidence,
        match_method,
        account_id,
        analysis,
        analyzed_at,
        accounts!inner(id, name, stage)
      `)
      .not('account_id', 'is', null)
      .lt('match_confidence', CONFIDENCE_THRESHOLD)
      .order('match_confidence', { ascending: true })
      .limit(200);

    if (error) return apiError(res, 500, error.message);

    const items = (rows || []).map(r => ({
      gongCallId: r.gong_call_id,
      matchConfidence: r.match_confidence,
      matchMethod: r.match_method,
      accountId: r.account_id,
      accountName: r.accounts?.name,
      accountStage: r.accounts?.stage,
      callTitle: r.analysis?.call_title || r.gong_call_id,
      callDate: r.analyzed_at,
      repName: r.analysis?.rep_name || null,
    }));

    return apiSuccess(res, { items, count: items.length });
  }

  if (req.method === 'POST') {
    const { gongCallId, action, overrideAccountId } = req.body || {};
    if (!gongCallId || !action) return apiError(res, 400, 'gongCallId and action required');
    if (!['confirm', 'reject', 'override'].includes(action)) return apiError(res, 400, 'action must be confirm, reject, or override');

    if (action === 'confirm') {
      const { error } = await db
        .from('gong_call_analyses')
        .update({ match_confidence: 1.0, match_method: 'human_confirmed' })
        .eq('gong_call_id', gongCallId);
      if (error) return apiError(res, 500, error.message);
      return apiSuccess(res, { updated: gongCallId, action });
    }

    if (action === 'reject') {
      const { error } = await db
        .from('gong_call_analyses')
        .update({ account_id: null, match_confidence: null, match_method: 'human_rejected' })
        .eq('gong_call_id', gongCallId);
      if (error) return apiError(res, 500, error.message);
      return apiSuccess(res, { updated: gongCallId, action });
    }

    if (action === 'override') {
      if (!overrideAccountId) return apiError(res, 400, 'overrideAccountId required for override action');
      const { error } = await db
        .from('gong_call_analyses')
        .update({ account_id: overrideAccountId, match_confidence: 1.0, match_method: 'human_override' })
        .eq('gong_call_id', gongCallId);
      if (error) return apiError(res, 500, error.message);
      return apiSuccess(res, { updated: gongCallId, action });
    }
  }

  return apiError(res, 405, 'Method not allowed');
}
