import { getSupabase } from '../../../lib/supabase';
import { apiError, apiSuccess } from '../../../lib/apiUtils';

const ACTIVE_STAGE_ORDER = ['qualifying', 'active_pursuit', 'intro_scheduled', 'demo', 'solution_validation', 'proposal', 'legal'];
const INACTIVE_STAGES = new Set(['inactive_sdr_follow_up', 'inactive_ae_follow_up']);
const CLOSED_STAGES = new Set(['closed_won', 'closed_lost', 'won', 'lost']);

const STALL_DAYS = {
  qualifying: 30,
  active_pursuit: 30,
  intro_scheduled: 21,
  demo: 21,
  solution_validation: 21,
  proposal: 14,
  legal: 14,
};

function stageDirection(from, to) {
  if (CLOSED_STAGES.has(to) && (to === 'closed_won' || to === 'won')) return 'won';
  if (CLOSED_STAGES.has(to)) return 'lost';
  if (INACTIVE_STAGES.has(to)) return 'inactive';
  const fi = ACTIVE_STAGE_ORDER.indexOf(from);
  const ti = ACTIVE_STAGE_ORDER.indexOf(to);
  if (fi === -1 || ti === -1) return 'changed';
  return ti > fi ? 'forward' : ti < fi ? 'backward' : 'unchanged';
}

function median(nums) {
  if (!nums.length) return null;
  const sorted = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? Math.round((sorted[mid - 1] + sorted[mid]) / 2)
    : sorted[mid];
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return apiError(res, 405, 'Method not allowed');
  }

  const db = getSupabase();
  const now = Date.now();
  let historyTableMissing = false;

  // ── 1. Accounts (all non-closed) ─────────────────────────────────────────────
  const { data: accounts, error: accountsError } = await db
    .from('accounts')
    .select('id, name, stage, deal_value, owner_name, updated_at')
    .not('stage', 'in', `(${[...CLOSED_STAGES].join(',')})`);

  if (accountsError) {
    return apiError(res, 500, 'Failed to fetch accounts', accountsError.message);
  }

  // ── 2. Stage distribution ─────────────────────────────────────────────────────
  const stageBuckets = {};
  for (const acct of accounts) {
    const s = acct.stage || 'unknown';
    if (!stageBuckets[s]) stageBuckets[s] = { stage: s, count: 0, total_value: 0 };
    stageBuckets[s].count += 1;
    stageBuckets[s].total_value += acct.deal_value || 0;
  }
  const stageDistribution = Object.values(stageBuckets).map(b => ({
    ...b,
    avg_value: b.count > 0 ? Math.round(b.total_value / b.count) : 0,
  }));

  // ── Summary counts (partial — movedThisWeek computed after history fetch) ────
  const activeAccounts = accounts.filter(
    a => !CLOSED_STAGES.has(a.stage) && !INACTIVE_STAGES.has(a.stage)
  );
  const activeDeals = activeAccounts.length;
  const totalPipelineValue = activeAccounts.reduce((sum, a) => sum + (a.deal_value || 0), 0);

  // ── 3. History queries ────────────────────────────────────────────────────────
  let recentMovements = [];
  let velocityByStage = [];
  let movedThisWeek = 0;

  const thirtyDaysAgo = new Date(now - 30 * 86400000).toISOString();
  const sevenDaysAgo = new Date(now - 7 * 86400000).toISOString();

  const { data: movements, error: movementsError } = await db
    .from('account_stage_history')
    .select('id, account_id, account_name, owner_name, from_stage, to_stage, changed_at, deal_value_at_change')
    .gte('changed_at', thirtyDaysAgo)
    .order('changed_at', { ascending: false })
    .limit(200);

  if (movementsError) {
    // Table may not exist yet if migration hasn't run
    if (
      movementsError.code === '42P01' ||
      movementsError.message?.includes('does not exist') ||
      movementsError.message?.includes('relation')
    ) {
      historyTableMissing = true;
    } else {
      return apiError(res, 500, 'Failed to fetch stage history', movementsError.message);
    }
  }

  if (!historyTableMissing && movements) {
    recentMovements = movements.map(m => ({
      ...m,
      direction: stageDirection(m.from_stage, m.to_stage),
    }));

    movedThisWeek = recentMovements.filter(m => m.changed_at >= sevenDaysAgo).length;
  }

  // ── 4. Time in current stage ──────────────────────────────────────────────────
  const activeAccountIds = activeAccounts.map(a => a.id);

  // Most recent history entry per active account
  const lastChangeDateByAccount = {};

  if (!historyTableMissing && activeAccountIds.length) {
    const { data: latestHistory, error: latestHistoryError } = await db
      .from('account_stage_history')
      .select('account_id, changed_at')
      .in('account_id', activeAccountIds)
      .order('changed_at', { ascending: false });

    if (latestHistoryError && !latestHistoryError.message?.includes('does not exist')) {
      return apiError(res, 500, 'Failed to fetch stage history for time-in-stage', latestHistoryError.message);
    }

    if (latestHistory) {
      for (const row of latestHistory) {
        if (!lastChangeDateByAccount[row.account_id]) {
          lastChangeDateByAccount[row.account_id] = row.changed_at;
        }
      }
    }
  }

  const timeInCurrentStage = activeAccounts.map(acct => {
    const lastChange = lastChangeDateByAccount[acct.id] || acct.updated_at;
    const days_in_stage = Math.floor((now - new Date(lastChange).getTime()) / 86400000);
    return {
      account_id: acct.id,
      account_name: acct.name,
      owner_name: acct.owner_name,
      stage: acct.stage,
      days_in_stage,
      deal_value: acct.deal_value || 0,
    };
  }).sort((a, b) => b.days_in_stage - a.days_in_stage);

  // ── 5. Velocity by stage ──────────────────────────────────────────────────────
  // Derived from timeInCurrentStage — group by stage, compute median + avg days_in_stage
  const stageDaysBuckets = {};
  for (const row of timeInCurrentStage) {
    const s = row.stage;
    if (!ACTIVE_STAGE_ORDER.includes(s)) continue;
    if (!stageDaysBuckets[s]) stageDaysBuckets[s] = [];
    stageDaysBuckets[s].push(row.days_in_stage);
  }
  velocityByStage = Object.entries(stageDaysBuckets).map(([stage, days]) => ({
    stage,
    median_days: median(days),
    avg_days: days.length ? Math.round(days.reduce((a, b) => a + b, 0) / days.length) : null,
    count: days.length,
  }));

  // ── 6. Stall candidates ───────────────────────────────────────────────────────
  const stallPool = timeInCurrentStage.filter(row => {
    const threshold = STALL_DAYS[row.stage];
    return threshold !== undefined && row.days_in_stage > threshold;
  });

  let lastCallByAccount = {};
  if (stallPool.length) {
    const stallIds = stallPool.map(r => r.account_id);
    const { data: callDates, error: callDatesError } = await db
      .from('gong_call_analyses')
      .select('account_id, call_date')
      .in('account_id', stallIds)
      .not('call_date', 'is', null);

    if (callDatesError && !callDatesError.message?.includes('does not exist')) {
      // Non-fatal — proceed without call data
      console.error('[stage-analytics] Failed to fetch last call dates:', callDatesError.message);
    }

    if (callDates) {
      for (const row of callDates) {
        const existing = lastCallByAccount[row.account_id];
        if (!existing || new Date(row.call_date) > new Date(existing)) {
          lastCallByAccount[row.account_id] = row.call_date;
        }
      }
    }
  }

  const stallCandidates = stallPool
    .map(row => {
      const lastCall = lastCallByAccount[row.account_id] || null;
      const days_since_call = lastCall
        ? Math.floor((now - new Date(lastCall).getTime()) / 86400000)
        : null;
      const stall_score = Math.min(
        Math.round(
          (row.days_in_stage / (STALL_DAYS[row.stage] || 30)) * 50 +
          ((days_since_call !== null ? days_since_call : 60) / 60) * 50
        ),
        100
      );
      return {
        account_id: row.account_id,
        account_name: row.account_name,
        owner_name: row.owner_name,
        stage: row.stage,
        days_in_stage: row.days_in_stage,
        days_since_call,
        deal_value: row.deal_value,
        stall_score,
      };
    })
    .sort((a, b) => b.stall_score - a.stall_score)
    .slice(0, 50);

  return apiSuccess(res, {
    summary: {
      activeDeals,
      movedThisWeek,
      stallCount: stallCandidates.length,
      totalPipelineValue,
    },
    stageDistribution,
    recentMovements,
    timeInCurrentStage,
    velocityByStage,
    stallCandidates,
    historyTableMissing,
  });
}
