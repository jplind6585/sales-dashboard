// GET /api/cron/deal-pulse
// Scores James's active accounts for attention needed, picks top 2-3,
// calls Claude per account for a specific action + drafted opener,
// sends as a Slack DM to James (SLACK_MANAGER_CHANNEL) at 7am EST weekdays.
// Protected by CRON_SECRET. Accepts GET or POST (manual trigger).

import { getSupabase } from '../../../lib/supabase';
import { sendSlackMessage } from '../../../lib/slack';

const JAMES_USER_ID = '8c969178-4d4e-494f-a8d7-752276fb683c';
const DASHBOARD_URL = 'https://sales-dashboard-james-projects-87ec0089.vercel.app';

const ACTIVE_STAGES = [
  'qualifying', 'intro_scheduled', 'active_pursuit',
  'demo', 'solution_validation', 'proposal', 'legal',
];

const STAGE_WEIGHT = {
  legal: 35,
  proposal: 30,
  solution_validation: 25,
  demo: 20,
  active_pursuit: 10,
  intro_scheduled: 5,
  qualifying: 5,
};

function daysSince(dateStr) {
  if (!dateStr) return null;
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24));
}

function computeAttentionScore(account, lastAnalysis, openTasks) {
  let score = 0;
  const factors = [];

  // Days since last call
  const days = daysSince(lastAnalysis?.analyzed_at || null);
  if (days === null || days > 30) {
    score += 80; factors.push('No recent calls');
  } else if (days > 21) {
    score += 60; factors.push(`${days}d since last call`);
  } else if (days > 14) {
    score += 40; factors.push(`${days}d since last call`);
  } else if (days > 7) {
    score += 20;
  }

  // Stage weight — later-stage deals need more active attention
  score += STAGE_WEIGHT[account.stage] || 5;

  // Overdue tasks
  const today = new Date().toISOString().split('T')[0];
  const overdue = (openTasks || []).filter(t => t.due_date && t.due_date < today);
  score += overdue.length * 40;
  if (overdue.length) factors.push(`${overdue.length} overdue task${overdue.length > 1 ? 's' : ''}`);

  // Unresolved next steps from last call
  const analysis = lastAnalysis?.analysis || {};
  const nextSteps = analysis.nextSteps || analysis.next_steps || [];
  const commitments = analysis.commitments || [];
  const unresolvedCount = Math.min(nextSteps.length + commitments.length, 3);
  score += unresolvedCount * 15;
  if (unresolvedCount > 0) factors.push(`${unresolvedCount} open next step${unresolvedCount > 1 ? 's' : ''}`);

  // Red flags
  const redFlags = analysis.redFlags || analysis.red_flags || [];
  if (redFlags.length > 0) {
    score += 20; factors.push('Red flags on last call');
  }

  return { score, factors };
}

async function generateAccountPulse(account, lastAnalysis, openTasks) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;

  const analysis = lastAnalysis?.analysis || {};
  const daysSinceCall = daysSince(lastAnalysis?.analyzed_at);

  const contextLines = [
    `Account: ${account.name}`,
    `Stage: ${(account.stage || '').replace(/_/g, ' ')}`,
    daysSinceCall != null ? `Days since last call: ${daysSinceCall}` : 'No calls recorded',
  ];

  if (analysis.summary) contextLines.push(`Last call summary: ${String(analysis.summary).slice(0, 300)}`);

  const nextSteps = analysis.nextSteps || analysis.next_steps || [];
  if (nextSteps.length) contextLines.push(`Open next steps: ${nextSteps.slice(0, 3).join(' | ')}`);

  const commitments = analysis.commitments || [];
  if (commitments.length) contextLines.push(`Rep commitments: ${commitments.slice(0, 2).join(' | ')}`);

  const redFlags = analysis.redFlags || analysis.red_flags || [];
  if (redFlags.length) contextLines.push(`Red flags: ${redFlags.slice(0, 2).join(' | ')}`);

  const today = new Date().toISOString().split('T')[0];
  const overdueTasks = (openTasks || []).filter(t => t.due_date && t.due_date < today);
  if (overdueTasks.length) contextLines.push(`Overdue tasks: ${overdueTasks.map(t => t.title).slice(0, 3).join(' | ')}`);

  const openTaskTitles = (openTasks || []).filter(t => !t.due_date || t.due_date >= today).slice(0, 3).map(t => t.title);
  if (openTaskTitles.length) contextLines.push(`Open tasks: ${openTaskTitles.join(' | ')}`);

  const prompt = `You are helping a sales rep (James) decide what to do RIGHT NOW with a stalled or at-risk deal.

${contextLines.join('\n')}

Respond in JSON only. No explanation. Schema:
{
  "urgency_reason": "1 sentence — why this account needs attention today specifically",
  "action": "1 specific action James should take today (not vague — e.g. 'Send Sarah the ROI model you promised on the April 28 call')",
  "draft_subject": "Email subject line if relevant (or null)",
  "draft_opener": "First 1-2 sentences of the message or call opener. Make it specific, not generic."
}`;

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 400,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    const data = await res.json();
    const raw = data.content?.[0]?.text || '';
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) return null;
    return JSON.parse(match[0]);
  } catch (e) {
    console.error(`[deal-pulse] Claude error for ${account.name}:`, e.message);
    return null;
  }
}

function formatStage(stage) {
  return (stage || '').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function buildPulseBlocks(accounts, pulseDate) {
  const dateStr = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

  const blocks = [
    {
      type: 'header',
      text: { type: 'plain_text', text: `Deal Pulse — ${dateStr}`, emoji: true },
    },
    {
      type: 'section',
      text: { type: 'mrkdwn', text: `Here are the ${accounts.length} deal${accounts.length > 1 ? 's' : ''} that need your attention today.` },
    },
    { type: 'divider' },
  ];

  for (const item of accounts) {
    const { account, factors, pulse } = item;
    const stageLabel = formatStage(account.stage);
    const factorText = factors.slice(0, 2).join(' · ');

    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: [
          `*${account.name}* — ${stageLabel}`,
          factorText ? `_${factorText}_` : null,
          pulse?.urgency_reason ? `\n${pulse.urgency_reason}` : null,
        ].filter(Boolean).join('\n'),
      },
    });

    if (pulse?.action) {
      blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Action:* ${pulse.action}`,
        },
      });
    }

    if (pulse?.draft_opener) {
      const subjectLine = pulse.draft_subject ? `*${pulse.draft_subject}*\n` : '';
      blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Draft opener:*\n${subjectLine}${pulse.draft_opener}`,
        },
      });
    }

    blocks.push({ type: 'divider' });
  }

  blocks.push({
    type: 'context',
    elements: [{
      type: 'mrkdwn',
      text: `<${DASHBOARD_URL}/modules/account-pipeline|Open Pipeline →>`,
    }],
  });

  return { blocks };
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

  // Fetch James's active accounts
  const { data: accounts, error: accErr } = await db
    .from('accounts')
    .select('id, name, stage, owner_name, hubspot_deal_id')
    .in('stage', ACTIVE_STAGES)
    .or(`user_id.eq.${JAMES_USER_ID},owner_name.ilike.%james%`);

  if (accErr) {
    console.error('[deal-pulse] Account fetch error:', accErr.message);
    return res.status(500).json({ error: accErr.message });
  }

  if (!accounts?.length) {
    return res.status(200).json({ sent: 0, message: 'No active accounts for James' });
  }

  const accountIds = accounts.map(a => a.id);

  // Fetch most recent call analysis per account
  const { data: analyses } = await db
    .from('gong_call_analyses')
    .select('account_id, analysis, analyzed_at')
    .in('account_id', accountIds)
    .not('analysis', 'is', null)
    .order('analyzed_at', { ascending: false });

  // Fetch open tasks per account
  const { data: tasks } = await db
    .from('tasks')
    .select('account_id, title, status, due_date')
    .in('account_id', accountIds)
    .is('dismissed_at', null)
    .in('status', ['open', 'in_progress']);

  // Group by account_id — keep only the latest analysis per account
  const latestAnalysis = {};
  for (const a of (analyses || [])) {
    if (!latestAnalysis[a.account_id]) latestAnalysis[a.account_id] = a;
  }

  const tasksByAccount = {};
  for (const t of (tasks || [])) {
    if (!tasksByAccount[t.account_id]) tasksByAccount[t.account_id] = [];
    tasksByAccount[t.account_id].push(t);
  }

  // Score every account
  const scored = accounts.map(account => {
    const { score, factors } = computeAttentionScore(
      account,
      latestAnalysis[account.id] || null,
      tasksByAccount[account.id] || []
    );
    return { account, score, factors, lastAnalysis: latestAnalysis[account.id] || null, openTasks: tasksByAccount[account.id] || [] };
  });

  // Pick top 3 by score
  const top = scored
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .filter(item => item.score > 0);

  if (!top.length) {
    return res.status(200).json({ sent: 0, message: 'No accounts need attention today' });
  }

  // Generate Claude pulse for each (parallel)
  const pulseResults = await Promise.all(
    top.map(async item => {
      const pulse = await generateAccountPulse(item.account, item.lastAnalysis, item.openTasks);
      return { ...item, pulse };
    })
  );

  // Build and send Slack message
  const payload = buildPulseBlocks(pulseResults, new Date());
  const channel = process.env.SLACK_MANAGER_CHANNEL;
  const result = await sendSlackMessage(payload, channel);

  console.log(`[deal-pulse] Top ${top.length} accounts, Slack: ${result.ok ? 'ok' : result.error}`);

  return res.status(200).json({
    sent: result.ok ? top.length : 0,
    accounts: top.map(i => ({ name: i.account.name, score: i.score, factors: i.factors })),
    slackOk: result.ok,
  });
}
