// GET /api/reports/scorecard?period=quarter
// Revenue/pipeline scorecard vs configurable goal (sales_goals). Team + per-rep.
// The configured goal defines the measurement window — closed-won is windowed to the
// goal's own period so attainment % can't compare mismatched timeframes.
// Degrades gracefully if deal_value or sales_goals aren't present yet.

import { createServerSupabaseClient, getSupabase } from '../../../lib/supabase';
import { apiError, apiSuccess, logRequest } from '../../../lib/apiUtils';

const ACTIVE_STAGES = ['qualifying', 'intro_scheduled', 'active_pursuit', 'demo', 'solution_validation', 'proposal', 'legal'];
const STAGE_PROBABILITY = {
  qualifying: 5, intro_scheduled: 10, active_pursuit: 20,
  demo: 35, solution_validation: 55, proposal: 70, legal: 85,
  closed_won: 100, closed_lost: 0,
};

function periodStartDate(period) {
  const now = new Date();
  if (period === 'month') return new Date(now.getFullYear(), now.getMonth(), 1);
  if (period === 'year') return new Date(now.getFullYear(), 0, 1);
  return new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1); // quarter
}

export default async function handler(req, res) {
  logRequest(req, 'reports/scorecard');
  if (req.method !== 'GET') return apiError(res, 405, 'GET only');

  const auth = createServerSupabaseClient(req, res);
  const { data: { user } } = await auth.auth.getUser();
  if (!user) return apiError(res, 401, 'Unauthorized');

  const queryPeriod = ['month', 'quarter', 'year'].includes(req.query.period) ? req.query.period : 'quarter';
  const db = getSupabase();

  const [acctRes, cfgRes] = await Promise.all([
    db.from('accounts').select('id, name, stage, owner_name, deal_value, close_date, updated_at'),
    db.from('sales_process_config').select('stage_weights').limit(1).single(),
  ]);
  const accounts = acctRes.data || [];

  let prob = { ...STAGE_PROBABILITY };
  if (cfgRes.data?.stage_weights) prob = { ...prob, ...cfgRes.data.stage_weights };

  // ── Goal first — it defines the period and window we measure against ───────────
  let goalRow = null;
  try {
    const { data: goals } = await db
      .from('sales_goals')
      .select('*')
      .eq('scope', 'team')
      .eq('metric', 'revenue')
      .order('period_start', { ascending: false })
      .limit(1);
    if (goals?.length) goalRow = goals[0];
  } catch { /* sales_goals not migrated yet */ }

  const effectivePeriod = goalRow?.period || queryPeriod;
  const startDate = goalRow?.period_start || periodStartDate(effectivePeriod).toISOString().slice(0, 10);

  const num = v => (typeof v === 'number' && isFinite(v) ? v : 0);
  let valuedCount = 0;
  for (const a of accounts) if (num(a.deal_value) > 0) valuedCount++;

  const wonInWindow = a => a.stage === 'closed_won' && a.close_date && a.close_date >= startDate;

  const closedWon = accounts.filter(wonInWindow);
  const closedWonValue = closedWon.reduce((s, a) => s + num(a.deal_value), 0);

  const active = accounts.filter(a => ACTIVE_STAGES.includes(a.stage));
  const openPipeline = active.reduce((s, a) => s + num(a.deal_value), 0);
  const weightedPipeline = active.reduce((s, a) => s + num(a.deal_value) * ((prob[a.stage] || 0) / 100), 0);

  // Per-rep breakdown
  const byRep = {};
  for (const a of accounts) {
    const rep = a.owner_name || 'Unassigned';
    if (!byRep[rep]) byRep[rep] = { rep, closedWon: 0, openPipeline: 0, weightedPipeline: 0, activeDeals: 0 };
    if (wonInWindow(a)) byRep[rep].closedWon += num(a.deal_value);
    if (ACTIVE_STAGES.includes(a.stage)) {
      byRep[rep].openPipeline += num(a.deal_value);
      byRep[rep].weightedPipeline += num(a.deal_value) * ((prob[a.stage] || 0) / 100);
      byRep[rep].activeDeals++;
    }
  }

  let goal = null;
  if (goalRow) {
    const target = num(goalRow.target);
    goal = {
      target,
      label: goalRow.label || `${goalRow.period} revenue`,
      period: goalRow.period,
      attainmentPct: target > 0 ? Math.round((closedWonValue / target) * 100) : null,
      gap: target - closedWonValue,
      projected: Math.round(closedWonValue + weightedPipeline),
      projectedPct: target > 0 ? Math.round(((closedWonValue + weightedPipeline) / target) * 100) : null,
    };
  }

  return apiSuccess(res, {
    period: effectivePeriod,
    periodStart: startDate,
    closedWonValue,
    closedWonCount: closedWon.length,
    openPipeline,
    weightedPipeline: Math.round(weightedPipeline),
    activeDeals: active.length,
    goal,
    byRep: Object.values(byRep)
      .filter(r => r.weightedPipeline > 0 || r.closedWon > 0 || r.activeDeals > 0)
      .sort((a, b) => b.weightedPipeline - a.weightedPipeline),
    coverage: { valuedAccounts: valuedCount, totalAccounts: accounts.length },
    goalConfigured: !!goal,
  });
}
