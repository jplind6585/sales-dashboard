import { getSupabase } from '../../../lib/supabase';

const ACTIVE_STAGES = [
  'qualifying', 'intro_scheduled', 'active_pursuit',
  'demo', 'solution_validation', 'proposal', 'legal',
];

const STAGE_EXPECTED_DAYS = {
  qualifying: 21,
  intro_scheduled: 14,
  active_pursuit: 28,
  demo: 14,
  solution_validation: 21,
  proposal: 21,
  legal: 28,
};

function daysSince(dateStr) {
  if (!dateStr) return null;
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24));
}

function scoreAccount(account, lastAnalysis, openTaskCount) {
  let score = 0;
  const factors = [];

  // Days over expected stage duration (proxy: updated_at as stage-change date)
  const expected = STAGE_EXPECTED_DAYS[account.stage];
  if (expected != null) {
    const daysInStage = daysSince(account.updated_at) ?? 0;
    const over = daysInStage - expected;
    if (over > 0) {
      const points = Math.min(over * 3, 35);
      score += points;
      const stageName = account.stage.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
      factors.push(`${over} day${over === 1 ? '' : 's'} over expected time in ${stageName} stage`);
    }
  }

  // Days since last Gong call
  const daysSinceCall = lastAnalysis?.call_date ? daysSince(lastAnalysis.call_date) : null;
  if (daysSinceCall === null || daysSinceCall > 30) {
    score += 35;
    factors.push(daysSinceCall === null ? 'No Gong call on record' : `No Gong call in ${daysSinceCall} days`);
  } else if (daysSinceCall > 14) {
    score += 20;
    factors.push(`No Gong call in ${daysSinceCall} days`);
  }

  // MEDDICC gaps from last call analysis
  if (lastAnalysis?.analysis) {
    const a = lastAnalysis.analysis;

    // Missing metrics: check if discovery_score is low or gaps mention metrics
    const gaps = a.discovery_gaps || [];
    const hasMetrics = (a.meddicc?.metrics) ||
      !gaps.some(g => /metric|roi|quantif|measur/i.test(g));
    if (!hasMetrics) {
      score += 8;
      factors.push('Missing quantified metrics (MEDDICC)');
    }

    // Missing economic buyer
    const hasEconomicBuyer = (a.meddicc?.economic_buyer) ||
      !gaps.some(g => /economic.buyer|budget.author|finance.lead|cfo/i.test(g));
    if (!hasEconomicBuyer) {
      score += 8;
      factors.push('Economic buyer not identified');
    }

    // Missing champion
    const hasChampion = (a.meddicc?.champion) ||
      !gaps.some(g => /champion/i.test(g));
    if (!hasChampion) {
      score += 10;
      factors.push('No champion identified');
    }

    // Open red flags
    const redFlags = Array.isArray(a.red_flags) ? a.red_flags : [];
    if (redFlags.length > 0) {
      const points = Math.min(redFlags.length * 8, 24);
      score += points;
      factors.push(`${redFlags.length} open red flag${redFlags.length === 1 ? '' : 's'} on last call`);
    }

    // Competitor mentioned
    const competitors = Array.isArray(a.competitor_mentions) ? a.competitor_mentions : [];
    if (competitors.length > 0) {
      score += 5;
      factors.push(`Competitor mentioned: ${competitors.map(c => c.name || c).join(', ')}`);
    }

    // Low discovery score
    const discoveryScore = typeof a.discovery_score === 'number' ? a.discovery_score : null;
    if (discoveryScore !== null && discoveryScore < 5) {
      score += 10;
      factors.push(`Low discovery score (${discoveryScore}/10) on last call`);
    }
  }

  // No open tasks
  if (openTaskCount === 0) {
    score += 10;
    factors.push('No open tasks for this account');
  }

  return { score: Math.min(score, 100), factors };
}

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const secret = process.env.CRON_SECRET;
  if (secret && req.headers['authorization'] !== `Bearer ${secret}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const db = getSupabase();

  const { data: accounts, error: accErr } = await db
    .from('accounts')
    .select('id, name, stage, updated_at, tier')
    .in('stage', ACTIVE_STAGES)
    .neq('tier', 'archived');

  if (accErr) {
    return res.status(500).json({ error: accErr.message });
  }
  if (!accounts?.length) {
    return res.status(200).json({ scored: 0, message: 'No active accounts' });
  }

  const accountIds = accounts.map(a => a.id);

  // Fetch last call analysis per account
  const { data: analyses } = await db
    .from('gong_call_analyses')
    .select('account_id, call_date, analysis')
    .in('account_id', accountIds)
    .not('analysis', 'is', null)
    .order('call_date', { ascending: false });

  const lastAnalysisByAccount = {};
  for (const row of (analyses || [])) {
    if (!lastAnalysisByAccount[row.account_id]) {
      lastAnalysisByAccount[row.account_id] = row;
    }
  }

  // Fetch open task counts per account
  const { data: tasks } = await db
    .from('tasks')
    .select('account_id')
    .in('account_id', accountIds)
    .in('status', ['open', 'in_progress']);

  const openTasksByAccount = {};
  for (const t of (tasks || [])) {
    openTasksByAccount[t.account_id] = (openTasksByAccount[t.account_id] || 0) + 1;
  }

  const now = new Date().toISOString();
  const errors = [];
  let scored = 0;

  // Score in batches of 50 to avoid payload limits
  const BATCH = 50;
  for (let i = 0; i < accounts.length; i += BATCH) {
    const batch = accounts.slice(i, i + BATCH);
    const upsertRows = batch.map(account => {
      const { score, factors } = scoreAccount(
        account,
        lastAnalysisByAccount[account.id] || null,
        openTasksByAccount[account.id] || 0,
      );
      return {
        id: account.id,
        risk_score: score,
        risk_factors: factors,
        risk_scored_at: now,
      };
    });

    const { error: upsertErr } = await db
      .from('accounts')
      .upsert(upsertRows, { onConflict: 'id' });

    if (upsertErr) {
      errors.push(upsertErr.message);
    } else {
      scored += batch.length;
    }
  }

  return res.status(200).json({ scored, errors });
}
