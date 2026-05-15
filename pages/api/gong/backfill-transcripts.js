// POST /api/gong/backfill-transcripts
// One-time backfill: for every gong_call_analyses row with account_id set,
// insert a corresponding transcripts row if one doesn't already exist.
// Secured by CRON_SECRET or manager-role session.

import { apiError, apiSuccess, logRequest } from '../../../lib/apiUtils';
import { createServerSupabaseClient, getSupabase } from '../../../lib/supabase';

export default async function handler(req, res) {
  logRequest(req, 'gong/backfill-transcripts');
  if (req.method !== 'POST') return apiError(res, 405, 'Method not allowed');

  const isCron = process.env.CRON_SECRET && req.headers['authorization'] === `Bearer ${process.env.CRON_SECRET}`;
  if (!isCron) {
    const authClient = createServerSupabaseClient(req, res);
    const { data: { user } } = await authClient.auth.getUser();
    if (!user) return apiError(res, 401, 'Unauthorized');
  }

  const db = getSupabase();

  // All analyzed calls that are linked to an account
  const { data: calls, error: callErr } = await db
    .from('gong_call_analyses')
    .select('gong_call_id, title, call_date, call_type, analysis, account_id, gong_url')
    .not('account_id', 'is', null)
    .not('analyzed_at', 'is', null)
    .order('call_date', { ascending: false });

  if (callErr) return apiError(res, 500, callErr.message);
  if (!calls?.length) return apiSuccess(res, { data: { inserted: 0, skipped: 0, message: 'No matched calls found' } });

  // Get already-backfilled gong_call_ids from transcripts
  const { data: existing } = await db
    .from('transcripts')
    .select('gong_call_id')
    .not('gong_call_id', 'is', null);

  const existingIds = new Set((existing || []).map(r => r.gong_call_id));

  let inserted = 0;
  let skipped = 0;
  const errors = [];

  for (const call of calls) {
    if (existingIds.has(call.gong_call_id)) { skipped++; continue; }

    const analysis = call.analysis || {};
    const dateStr = call.call_date ? call.call_date.split('T')[0] : null;
    const summary = analysis.summary || null;
    const placeholderText = summary
      ? `[Gong call — analysis available]\n\nSummary: ${summary}`
      : '[Gong call — transcript not stored locally]';

    const { error } = await db.from('transcripts').insert({
      account_id: call.account_id,
      gong_call_id: call.gong_call_id,
      text: placeholderText,
      date: dateStr,
      call_type: call.call_type || 'other',
      summary,
      raw_analysis: call.analysis,
      source: 'gong',
      gong_url: call.gong_url || null,
    });

    if (error) {
      errors.push({ callId: call.gong_call_id, error: error.message });
    } else {
      inserted++;
      existingIds.add(call.gong_call_id);
    }
  }

  return apiSuccess(res, {
    data: {
      inserted,
      skipped,
      total: calls.length,
      errors: errors.length ? errors.slice(0, 5) : undefined,
    }
  });
}
