// GET /api/cron/deal-risk-alerts
// Computes deal risk for all active accounts and sends a Slack alert to the
// manager channel when any deal is high-risk (score ≥70).
// Protected by CRON_SECRET. Called nightly via Vercel cron.

import { getSupabase } from '../../../lib/supabase';
import { sendSlackMessage } from '../../../lib/slack';

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

  const last = transcripts[0];
  const days = daysSince(last.date);

  if (days === null || days > 30) { score += 80; reasons.push(`${days != null ? `${days}d` : '?'} since last call`); }
  else if (days > 21) { score += 60; reasons.push(`${days}d since last call`); }
  else if (days > 14) { score += 40; reasons.push(`${days}d since last call`); }
  else if (days > 7) { score += 20; reasons.push(`${days}d since last call`); }

  const analysis = last.raw_analysis || {};
  if (analysis.disqualification_signal) { score += 10; reasons.push('Soft close on last call'); }
  const hasNextStep = analysis.next_steps_mentioned?.length > 0 || analysis.nextSteps?.length > 0;
  if (!hasNextStep) { score += 15; reasons.push('No confirmed next step'); }

  return { score, level: score >= 70 ? 'high' : score >= 40 ? 'medium' : 'low', reasons };
}

function formatStage(stage) {
  return (stage || '').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
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
    .select('id, name, stage, slack_channel')
    .in('stage', ACTIVE_STAGES);

  if (accErr || !accounts?.length) {
    return res.status(200).json({ alerted: 0, message: 'No active accounts' });
  }

  const accountIds = accounts.map(a => a.id);
  const { data: transcripts } = await db
    .from('transcripts')
    .select('account_id, date, raw_analysis, summary')
    .in('account_id', accountIds)
    .order('date', { ascending: false });

  const byAccount = {};
  for (const t of (transcripts || [])) {
    if (!byAccount[t.account_id]) byAccount[t.account_id] = [];
    byAccount[t.account_id].push(t);
  }

  const highRisk = accounts
    .map(account => {
      const acctTranscripts = byAccount[account.id] || [];
      const { score, level, reasons } = computeRisk(acctTranscripts);
      return { ...account, riskScore: score, riskLevel: level, riskReasons: reasons, lastCallDate: acctTranscripts[0]?.date || null };
    })
    .filter(a => a.riskLevel === 'high')
    .sort((a, b) => b.riskScore - a.riskScore);

  if (!highRisk.length) {
    console.log('[deal-risk-alerts] No high-risk deals — no alert sent');
    return res.status(200).json({ alerted: 0, message: 'No high-risk deals today' });
  }

  const alertChannel = process.env.SLACK_MANAGER_CHANNEL || process.env.SLACK_DEFAULT_CHANNEL;
  const dashboardUrl = `https://${process.env.VERCEL_URL || 'sales-dashboard-james-projects-87ec0089.vercel.app'}/modules/sales-reports/call-intelligence`;

  const accountRows = highRisk.slice(0, 5).flatMap(account => {
    const lastCallText = account.lastCallDate
      ? `Last call: ${new Date(account.lastCallDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
      : 'No calls recorded';
    return [
      {
        type: 'section',
        fields: [
          { type: 'mrkdwn', text: `*${account.name}*\n${formatStage(account.stage)} · ${lastCallText}` },
          { type: 'mrkdwn', text: `*Risk: ${account.riskScore}* (high)\n${account.riskReasons.join(' · ')}` },
        ],
      },
    ];
  });

  const blocks = [
    {
      type: 'header',
      text: { type: 'plain_text', text: `⚠️ ${highRisk.length} deal${highRisk.length > 1 ? 's' : ''} at risk`, emoji: true },
    },
    {
      type: 'section',
      text: { type: 'mrkdwn', text: `These active deals haven't had meaningful progress recently and need attention today.` },
    },
    { type: 'divider' },
    ...accountRows,
    { type: 'divider' },
    {
      type: 'context',
      elements: [{ type: 'mrkdwn', text: `<${dashboardUrl}|Open Call Intelligence →>` }],
    },
  ];

  const result = await sendSlackMessage({ blocks }, alertChannel);
  console.log(`[deal-risk-alerts] ${highRisk.length} high-risk deals, Slack result: ${result.ok ? 'ok' : result.error}`);

  return res.status(200).json({ alerted: result.ok ? highRisk.length : 0, highRiskCount: highRisk.length, slackOk: result.ok });
}
