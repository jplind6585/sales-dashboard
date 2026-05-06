// GET /api/gong/intel-risk
// Returns active accounts sorted by deal risk score.
// Risk formula (0-100):
//   0-7d since last call: +0, 8-14d: +20, 15-21d: +40, 22-30d: +60, 30+d: +80
//   No transcripts at all: +90
//   Disqualification signal on last call: +10
//   No confirmed next step on last call: +15
// Risk levels: high ≥70, medium 40-69, low <40

import { apiError, apiSuccess, logRequest } from '../../../lib/apiUtils';
import { getSupabase } from '../../../lib/supabase';

const ACTIVE_STAGES = [
  'qualifying', 'intro_scheduled', 'active_pursuit',
  'demo', 'solution_validation', 'proposal', 'legal',
];

function daysSince(dateStr) {
  if (!dateStr) return null;
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24));
}

function computeRisk(transcripts) {
  let score = 0;
  const reasons = [];

  if (!transcripts?.length) {
    return { score: 90, level: 'high', reasons: ['No calls recorded'] };
  }

  const last = transcripts[0]; // already sorted desc by date
  const days = daysSince(last.date);

  if (days === null || days > 30) {
    score += 80;
    reasons.push(`${days != null ? `${days}d` : 'Unknown'} since last call`);
  } else if (days > 21) {
    score += 60;
    reasons.push(`${days}d since last call`);
  } else if (days > 14) {
    score += 40;
    reasons.push(`${days}d since last call`);
  } else if (days > 7) {
    score += 20;
    reasons.push(`${days}d since last call`);
  }

  const analysis = last.raw_analysis || {};
  if (analysis.disqualification_signal) {
    score += 10;
    reasons.push('Soft close on last call');
  }
  const hasNextStep =
    analysis.next_steps_mentioned?.length > 0 ||
    analysis.nextSteps?.length > 0;
  if (!hasNextStep) {
    score += 15;
    reasons.push('No confirmed next step');
  }

  return {
    score,
    level: score >= 70 ? 'high' : score >= 40 ? 'medium' : 'low',
    reasons,
  };
}

export default async function handler(req, res) {
  logRequest(req, 'gong/intel-risk');
  if (req.method !== 'GET') return apiError(res, 405, 'Method not allowed');

  const db = getSupabase();

  const { data: accounts, error: accErr } = await db
    .from('accounts')
    .select('id, name, stage, user_id, slack_channel')
    .in('stage', ACTIVE_STAGES);

  if (accErr) return apiError(res, 500, accErr.message);
  if (!accounts?.length) return apiSuccess(res, { risks: [] });

  const accountIds = accounts.map(a => a.id);

  const { data: transcripts, error: tErr } = await db
    .from('transcripts')
    .select('account_id, date, raw_analysis, summary, call_type')
    .in('account_id', accountIds)
    .order('date', { ascending: false });

  if (tErr) return apiError(res, 500, tErr.message);

  const byAccount = {};
  for (const t of (transcripts || [])) {
    if (!byAccount[t.account_id]) byAccount[t.account_id] = [];
    byAccount[t.account_id].push(t);
  }

  const risks = accounts.map(account => {
    const acctTranscripts = byAccount[account.id] || [];
    const { score, level, reasons } = computeRisk(acctTranscripts);
    const last = acctTranscripts[0] || null;
    return {
      accountId: account.id,
      accountName: account.name,
      stage: account.stage,
      userId: account.user_id,
      slackChannel: account.slack_channel,
      riskScore: score,
      riskLevel: level,
      riskReasons: reasons,
      callCount: acctTranscripts.length,
      lastCallDate: last?.date || null,
      lastCallSummary: last?.summary || null,
      daysSinceLastCall: last?.date ? daysSince(last.date) : null,
    };
  }).sort((a, b) => b.riskScore - a.riskScore);

  return apiSuccess(res, { risks });
}
