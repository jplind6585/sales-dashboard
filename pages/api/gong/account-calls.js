// Returns AI-analyzed Gong calls linked to an account, sorted by attention score.
// Attention score surfaces calls most likely to need follow-up action.

import { apiError, apiSuccess, logRequest } from '../../../lib/apiUtils';
import { createServerSupabaseClient, getSupabase } from '../../../lib/supabase';

function attentionScore(row) {
  const a = row.analysis || {};
  let score = 0;

  const daysSince = row.analyzed_at
    ? (Date.now() - new Date(row.analyzed_at).getTime()) / (1000 * 60 * 60 * 24)
    : 999;
  if (daysSince <= 7) score += 30;
  else if (daysSince <= 14) score += 15;

  if ((a.next_steps_mentioned || []).length > 0) score += 40;
  if ((a.commitments || []).length > 0) score += 15;
  if ((a.red_flags || a.redFlags || []).length > 0) score += 20;

  const meddicc = a.meddicc || {};
  const gaps = Object.values(meddicc).filter(
    v => !v || v === 'unknown' || v === 'not identified' || v === 'not mentioned'
  ).length;
  if (gaps >= 3) score += 10;

  return score;
}

export default async function handler(req, res) {
  logRequest(req, 'gong/account-calls');
  if (req.method !== 'GET') return apiError(res, 405, 'GET only');

  const auth = createServerSupabaseClient(req, res);
  const { data: { user } } = await auth.auth.getUser();
  if (!user) return apiError(res, 401, 'Unauthorized');

  const { accountId } = req.query;
  if (!accountId) return apiError(res, 400, 'accountId required');

  const db = getSupabase();
  const { data: rows, error } = await db
    .from('gong_call_analyses')
    .select('gong_call_id, analysis, analyzed_at, call_date, match_confidence, match_method')
    .eq('account_id', accountId)
    .not('analysis', 'is', null)
    .order('analyzed_at', { ascending: false })
    .limit(100);

  if (error) return apiError(res, 500, error.message);

  const calls = (rows || []).map(row => {
    const a = row.analysis || {};
    return {
      id: row.gong_call_id,
      gongCallId: row.gong_call_id,
      title: a.call_title || null,
      date: row.call_date || row.analyzed_at,
      repName: a.rep_name || null,
      summary: a.summary || null,
      nextSteps: a.next_steps_mentioned || [],
      commitments: a.commitments || [],
      objections: a.objections || [],
      buyingSignals: a.buying_signals || a.buyingSignals || [],
      redFlags: a.red_flags || a.redFlags || [],
      meddicc: a.meddicc || null,
      discoveryScore: a.discovery_score ?? null,
      talkRatio: a.talk_ratio ?? null,
      attentionScore: attentionScore(row),
      matchConfidence: row.match_confidence,
      matchMethod: row.match_method,
      source: 'gong_analyzed',
    };
  });

  calls.sort((a, b) => {
    if (b.attentionScore !== a.attentionScore) return b.attentionScore - a.attentionScore;
    return new Date(b.date || 0) - new Date(a.date || 0);
  });

  return apiSuccess(res, { calls, total: calls.length });
}
