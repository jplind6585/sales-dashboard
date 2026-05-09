// GET /api/gong/account-competitors?accountId=X
// Aggregates competitor mentions across all Gong calls for an account.
// Returns a battle card view: each competitor with mention count, contexts, sentiment trend.

import { apiError, apiSuccess, logRequest } from '../../../lib/apiUtils';
import { createServerSupabaseClient, getSupabase } from '../../../lib/supabase';

export default async function handler(req, res) {
  logRequest(req, 'gong/account-competitors');
  if (req.method !== 'GET') return apiError(res, 405, 'GET only');

  const auth = createServerSupabaseClient(req, res);
  const { data: { user } } = await auth.auth.getUser();
  if (!user) return apiError(res, 401, 'Unauthorized');

  const { accountId } = req.query;
  if (!accountId) return apiError(res, 400, 'accountId required');

  const db = getSupabase();
  const { data: rows, error } = await db
    .from('gong_call_analyses')
    .select('gong_call_id, analysis, call_date')
    .eq('account_id', accountId)
    .not('analysis', 'is', null)
    .order('call_date', { ascending: false })
    .limit(50);

  if (error) return apiError(res, 500, error.message);

  // Aggregate competitor mentions across all calls
  const byCompetitor = {};

  for (const row of rows || []) {
    const mentions = row.analysis?.competitor_mentions || [];
    for (const mention of mentions) {
      const name = (mention.name || '').trim();
      if (!name) continue;

      const key = name.toLowerCase();
      if (!byCompetitor[key]) {
        byCompetitor[key] = {
          name,
          mentions: 0,
          positive: 0,
          neutral: 0,
          negative: 0,
          contexts: [],
          firstSeen: row.call_date,
          lastSeen: row.call_date,
        };
      }

      const entry = byCompetitor[key];
      entry.mentions++;
      if (mention.sentiment === 'positive') entry.positive++;
      else if (mention.sentiment === 'negative') entry.negative++;
      else entry.neutral++;

      if (mention.context) {
        entry.contexts.push({
          text: mention.context,
          date: row.call_date,
          sentiment: mention.sentiment || 'neutral',
        });
      }

      if (!entry.firstSeen || row.call_date < entry.firstSeen) entry.firstSeen = row.call_date;
      if (!entry.lastSeen || row.call_date > entry.lastSeen) entry.lastSeen = row.call_date;
    }
  }

  const competitors = Object.values(byCompetitor)
    .sort((a, b) => b.mentions - a.mentions)
    .map(c => ({
      ...c,
      contexts: c.contexts.slice(0, 3), // most recent 3 contexts
      overallSentiment: c.positive > c.negative ? 'positive' : c.negative > c.positive ? 'negative' : 'neutral',
    }));

  return apiSuccess(res, { competitors, totalCalls: (rows || []).length });
}
