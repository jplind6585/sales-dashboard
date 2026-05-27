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
    .select('gong_call_id, title, rep_name, analysis, analyzed_at, call_date, match_confidence, match_method, transcript_text, call_category')
    .eq('account_id', accountId)
    .eq('ignored', false)
    .order('call_date', { ascending: false })
    .limit(100);

  if (error) return apiError(res, 500, error.message);

  const calls = (rows || []).map(row => {
    const a = row.analysis || {};
    const pending = !row.analyzed_at;
    return {
      id: row.gong_call_id,
      gongCallId: row.gong_call_id,
      title: row.title || a.call_title || null,
      date: row.call_date || row.analyzed_at,
      repName: row.rep_name || a.rep_name || null,
      pending,
      callCategory: row.call_category || null,
      summary: pending ? null : (a.summary || null),
      nextSteps: pending ? [] : (a.next_steps_mentioned || []),
      commitments: pending ? [] : (a.commitments || []),
      objections: pending ? [] : (a.objections || []),
      buyingSignals: pending ? [] : (a.buying_signals || a.buyingSignals || []),
      redFlags: pending ? [] : (a.red_flags || a.redFlags || []),
      meddicc: pending ? null : (a.meddicc || null),
      discoveryScore: pending ? null : (a.discovery_score ?? null),
      talkRatio: pending ? null : (a.rep_talk_ratio ?? a.talk_ratio ?? null),
      transcriptText: row.transcript_text || null,
      attentionScore: pending ? 0 : attentionScore(row),
      matchConfidence: row.match_confidence,
      matchMethod: row.match_method,
      source: 'gong_analyzed',
    };
  });

  const pendingCount = calls.filter(c => c.pending).length;

  calls.sort((a, b) => {
    if (a.pending !== b.pending) return a.pending ? 1 : -1;
    if (b.attentionScore !== a.attentionScore) return b.attentionScore - a.attentionScore;
    return new Date(b.date || 0) - new Date(a.date || 0);
  });

  return apiSuccess(res, { calls, total: calls.length, pendingCount });
}
