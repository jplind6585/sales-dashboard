// GET  /api/reports/goals            — list configured goals
// POST /api/reports/goals  { metric, period, target, label, scope, ownerId, periodStart }
//   — upsert the current goal. Manager-facing (informal role model, like the rest of the app).

import { createServerSupabaseClient, getSupabase } from '../../../lib/supabase';
import { apiError, apiSuccess, logRequest } from '../../../lib/apiUtils';

function currentPeriodStart(period) {
  const now = new Date();
  if (period === 'month') return new Date(now.getFullYear(), now.getMonth(), 1);
  if (period === 'year') return new Date(now.getFullYear(), 0, 1);
  return new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
}

export default async function handler(req, res) {
  logRequest(req, 'reports/goals');
  const auth = createServerSupabaseClient(req, res);
  const { data: { user } } = await auth.auth.getUser();
  if (!user) return apiError(res, 401, 'Unauthorized');

  const db = getSupabase();

  if (req.method === 'GET') {
    try {
      const { data, error } = await db.from('sales_goals').select('*').order('period_start', { ascending: false });
      if (error) throw error;
      return apiSuccess(res, { goals: data || [] });
    } catch {
      // table not migrated yet
      return apiSuccess(res, { goals: [], migrationPending: true });
    }
  }

  if (req.method === 'POST') {
    const { metric = 'revenue', period = 'quarter', target, label, scope = 'team', ownerId = null } = req.body || {};
    const t = Number(target);
    if (!isFinite(t) || t <= 0) return apiError(res, 400, 'A positive target is required');
    if (!['revenue', 'pipeline'].includes(metric)) return apiError(res, 400, 'metric must be revenue or pipeline');
    if (!['month', 'quarter', 'year'].includes(period)) return apiError(res, 400, 'invalid period');

    const periodStart = (req.body?.periodStart) || currentPeriodStart(period).toISOString().slice(0, 10);

    try {
      // One goal per (scope, owner, metric, period_start): delete-then-insert keeps it simple + idempotent.
      let del = db.from('sales_goals').delete().eq('scope', scope).eq('metric', metric).eq('period_start', periodStart);
      del = ownerId ? del.eq('owner_id', ownerId) : del.is('owner_id', null);
      await del;

      const { data, error } = await db.from('sales_goals').insert({
        scope, owner_id: ownerId, metric, period, period_start: periodStart, target: t, label: label || null,
      }).select().single();
      if (error) throw error;
      return apiSuccess(res, { goal: data });
    } catch (e) {
      console.error('[reports/goals] save failed (sales_goals migrated?):', e.message);
      return apiError(res, 503, 'Goal tracking activates after the next deploy — nothing was lost. Try again once the update is live.');
    }
  }

  return apiError(res, 405, 'GET or POST');
}
