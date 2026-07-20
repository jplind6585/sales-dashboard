import { createServerSupabaseClient, getSupabase } from '../../../../lib/supabase';

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

  const daysSinceCall = lastAnalysis?.call_date ? daysSince(lastAnalysis.call_date) : null;
  if (daysSinceCall === null || daysSinceCall > 30) {
    score += 35;
    factors.push(daysSinceCall === null ? 'No Gong call on record' : `No Gong call in ${daysSinceCall} days`);
  } else if (daysSinceCall > 14) {
    score += 20;
    factors.push(`No Gong call in ${daysSinceCall} days`);
  }

  if (lastAnalysis?.analysis) {
    const a = lastAnalysis.analysis;

    const gaps = a.discovery_gaps || [];
    const hasMetrics = (a.meddicc?.metrics) ||
      !gaps.some(g => /metric|roi|quantif|measur/i.test(g));
    if (!hasMetrics) {
      score += 8;
      factors.push('Missing quantified metrics (MEDDICC)');
    }

    const hasEconomicBuyer = (a.meddicc?.economic_buyer) ||
      !gaps.some(g => /economic.buyer|budget.author|finance.lead|cfo/i.test(g));
    if (!hasEconomicBuyer) {
      score += 8;
      factors.push('Economic buyer not identified');
    }

    const hasChampion = (a.meddicc?.champion) ||
      !gaps.some(g => /champion/i.test(g));
    if (!hasChampion) {
      score += 10;
      factors.push('No champion identified');
    }

    const redFlags = Array.isArray(a.red_flags) ? a.red_flags : [];
    if (redFlags.length > 0) {
      const points = Math.min(redFlags.length * 8, 24);
      score += points;
      factors.push(`${redFlags.length} open red flag${redFlags.length === 1 ? '' : 's'} on last call`);
    }

    const competitors = Array.isArray(a.competitor_mentions) ? a.competitor_mentions : [];
    if (competitors.length > 0) {
      score += 5;
      factors.push(`Competitor mentioned: ${competitors.map(c => c.name || c).join(', ')}`);
    }

    const discoveryScore = typeof a.discovery_score === 'number' ? a.discovery_score : null;
    if (discoveryScore !== null && discoveryScore < 5) {
      score += 10;
      factors.push(`Low discovery score (${discoveryScore}/10) on last call`);
    }
  }

  if (openTaskCount === 0) {
    score += 10;
    factors.push('No open tasks for this account');
  }

  return { score: Math.min(score, 100), factors };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const supabase = createServerSupabaseClient(req, res);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  // Manager-only
  const db = getSupabase();
  const { data: profile } = await db
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();
  if (!['manager', 'admin'].includes(profile?.role)) {
    return res.status(403).json({ error: 'Manager access required' });
  }

  const { id } = req.query;

  const { data: account, error: accErr } = await db
    .from('accounts')
    .select('id, name, stage, updated_at, tier')
    .eq('id', id)
    .single();

  if (accErr || !account) {
    return res.status(404).json({ error: 'Account not found' });
  }

  const { data: lastAnalysisRows } = await db
    .from('gong_call_analyses')
    .select('call_date, analysis')
    .eq('account_id', id)
    .not('analysis', 'is', null)
    .order('call_date', { ascending: false })
    .limit(1);

  const lastAnalysis = lastAnalysisRows?.[0] || null;

  const { data: openTasks } = await db
    .from('tasks')
    .select('id')
    .eq('account_id', id)
    .in('status', ['open', 'in_progress']);

  const openTaskCount = openTasks?.length ?? 0;

  const { score, factors } = scoreAccount(account, lastAnalysis, openTaskCount);
  const now = new Date().toISOString();

  const { error: updateErr } = await db
    .from('accounts')
    .update({ risk_score: score, risk_factors: factors, risk_scored_at: now })
    .eq('id', id);

  if (updateErr) {
    return res.status(500).json({ error: updateErr.message });
  }

  return res.status(200).json({ risk_score: score, risk_factors: factors });
}
