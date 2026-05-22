// GET /api/ceo-dashboard
// Aggregates pipeline health, win/loss data, forecast, and top deals for CEO view.

import { createServerSupabaseClient, getSupabase } from '../../lib/supabase';
import { apiError, apiSuccess, logRequest } from '../../lib/apiUtils';

const ACTIVE_STAGES = ['qualifying', 'intro_scheduled', 'active_pursuit', 'demo', 'solution_validation', 'proposal', 'legal'];
const LATE_STAGES = ['demo', 'solution_validation', 'proposal', 'legal'];

const STAGE_PROBABILITY = {
  qualifying: 5, intro_scheduled: 10, active_pursuit: 20,
  demo: 35, solution_validation: 55, proposal: 70, legal: 85,
  closed_won: 100, closed_lost: 0,
};

const STAGE_LABELS = {
  qualifying: 'Qualifying', intro_scheduled: 'Intro Sched.', active_pursuit: 'Active Pursuit',
  demo: 'Demo', solution_validation: 'Sol. Validation', proposal: 'Proposal', legal: 'Legal',
  closed_won: 'Closed Won', closed_lost: 'Closed Lost',
};

function daysSince(d) {
  if (!d) return null;
  return Math.floor((Date.now() - new Date(d).getTime()) / 86400000);
}

export default async function handler(req, res) {
  logRequest(req, 'ceo-dashboard');
  if (req.method !== 'GET') return apiError(res, 405, 'GET only');

  const auth = createServerSupabaseClient(req, res);
  const { data: { user } } = await auth.auth.getUser();
  if (!user) return apiError(res, 401, 'Unauthorized');

  const db = getSupabase();

  // Pull accounts + recent calls in parallel
  const [accountsRes, callsRes, configRes] = await Promise.all([
    db.from('accounts').select('id, name, stage, owner_name, risk_score, debrief, close_date, updated_at'),
    db.from('gong_call_analyses')
      .select('account_id, call_date')
      .order('call_date', { ascending: false }),
    db.from('sales_process_config').select('stage_weights').limit(1).single(),
  ]);

  const accounts = accountsRes.data || [];
  const calls = callsRes.data || [];

  // DB-backed stage weights override defaults
  let stageProbability = { ...STAGE_PROBABILITY };
  if (configRes.data?.stage_weights) {
    stageProbability = { ...stageProbability, ...configRes.data.stage_weights };
  }

  // Last call date per account
  const lastCallByAccount = {};
  for (const call of calls) {
    if (!lastCallByAccount[call.account_id]) {
      lastCallByAccount[call.account_id] = call.call_date;
    }
  }

  // Pipeline breakdown
  const activeDeals = accounts.filter(a => ACTIVE_STAGES.includes(a.stage));
  const byStage = {};
  for (const stage of ACTIVE_STAGES) {
    byStage[stage] = { count: 0, label: STAGE_LABELS[stage] };
  }
  for (const a of activeDeals) {
    if (byStage[a.stage]) byStage[a.stage].count++;
  }

  // Weighted pipeline confidence score
  const totalWeight = activeDeals.reduce((sum, a) => sum + (stageProbability[a.stage] || 0), 0);
  const confidenceScore = activeDeals.length > 0 ? Math.round(totalWeight / activeDeals.length) : 0;

  // Win/loss from last 90 days
  const ninetyDaysAgo = new Date(Date.now() - 90 * 86400000).toISOString();
  const recentClosedWon = accounts.filter(a => a.stage === 'closed_won' && a.updated_at > ninetyDaysAgo);
  const recentClosedLost = accounts.filter(a => a.stage === 'closed_lost' && a.updated_at > ninetyDaysAgo);
  const winRate = (recentClosedWon.length + recentClosedLost.length) > 0
    ? Math.round((recentClosedWon.length / (recentClosedWon.length + recentClosedLost.length)) * 100)
    : null;

  // Top deals to watch (late stage + most stale)
  const topDeals = activeDeals
    .filter(a => LATE_STAGES.includes(a.stage))
    .map(a => ({
      id: a.id,
      name: a.name,
      stage: a.stage,
      stageLabel: STAGE_LABELS[a.stage],
      ownerName: a.owner_name,
      riskScore: a.risk_score,
      closeDate: a.close_date,
      daysSinceLastCall: daysSince(lastCallByAccount[a.id]),
    }))
    .sort((a, b) => (b.daysSinceLastCall ?? 999) - (a.daysSinceLastCall ?? 999))
    .slice(0, 8);

  // Recent closes with debrief
  const recentCloses = [...recentClosedWon, ...recentClosedLost]
    .sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at))
    .slice(0, 10)
    .map(a => ({
      id: a.id,
      name: a.name,
      stage: a.stage,
      updatedAt: a.updated_at,
      hasDebrief: !!a.debrief,
      debriefOutcome: a.debrief?.outcome || null,
      debriefReason: a.debrief?.primary_reason || null,
      debriefFactors: a.debrief?.factors || [],
    }));

  // Per-rep breakdown
  const repMap = {};
  for (const a of activeDeals) {
    const rep = a.owner_name || 'Unassigned';
    if (!repMap[rep]) repMap[rep] = { name: rep, activeDeals: 0, lateStage: 0, staleDeals: 0 };
    repMap[rep].activeDeals++;
    if (LATE_STAGES.includes(a.stage)) repMap[rep].lateStage++;
    const daysSince_ = daysSince(lastCallByAccount[a.id]);
    if (daysSince_ != null && daysSince_ > 14) repMap[rep].staleDeals++;
  }
  const repBreakdown = Object.values(repMap).sort((a, b) => b.lateStage - a.lateStage);

  // Win/loss reasons summary from debriefs
  const lostReasonCounts = {};
  const wonFactorCounts = {};
  for (const a of accounts) {
    if (!a.debrief) continue;
    if (a.stage === 'closed_lost' && a.debrief.primary_reason) {
      lostReasonCounts[a.debrief.primary_reason] = (lostReasonCounts[a.debrief.primary_reason] || 0) + 1;
    }
    if (a.stage === 'closed_won' && a.debrief.factors?.length) {
      for (const f of a.debrief.factors) {
        wonFactorCounts[f] = (wonFactorCounts[f] || 0) + 1;
      }
    }
  }
  const topLostReasons = Object.entries(lostReasonCounts)
    .sort((a, b) => b[1] - a[1]).slice(0, 5)
    .map(([reason, count]) => ({ reason, count }));
  const topWonFactors = Object.entries(wonFactorCounts)
    .sort((a, b) => b[1] - a[1]).slice(0, 5)
    .map(([factor, count]) => ({ factor, count }));

  return apiSuccess(res, {
    summary: {
      activeDeals: activeDeals.length,
      confidenceScore,
      lateStageDeals: activeDeals.filter(a => LATE_STAGES.includes(a.stage)).length,
      staleDeals: activeDeals.filter(a => daysSince(lastCallByAccount[a.id]) > 14).length,
      wonLast90: recentClosedWon.length,
      lostLast90: recentClosedLost.length,
      winRate,
    },
    byStage: Object.values(byStage),
    topDeals,
    recentCloses,
    repBreakdown,
    winLossInsights: {
      topLostReasons,
      topWonFactors,
      totalDebriefed: accounts.filter(a => a.debrief).length,
    },
  });
}
