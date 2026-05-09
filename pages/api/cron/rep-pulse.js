// GET /api/cron/rep-pulse
// Sends each rep a private Slack DM at 5pm EST weekdays with:
// - Today's call summary
// - Top account to focus on tomorrow
// - One AI coaching insight
// Only fires for reps with a slack_user_id set in their profile.
// Protected by CRON_SECRET.

import { getSupabase } from '../../../lib/supabase';
import { sendSlackMessage } from '../../../lib/slack';

const DASHBOARD_URL = 'https://sales-dashboard-james-projects-87ec0089.vercel.app';

function isToday(dateStr) {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  const now = new Date();
  return d.getUTCFullYear() === now.getUTCFullYear() &&
    d.getUTCMonth() === now.getUTCMonth() &&
    d.getUTCDate() === now.getUTCDate();
}

function daysSince(dateStr) {
  if (!dateStr) return null;
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24));
}

const ACTIVE_STAGES = ['qualifying', 'intro_scheduled', 'active_pursuit', 'demo', 'solution_validation', 'proposal', 'legal'];

async function generateRepInsight(rep, todayCalls, topAccount, lastAnalysis) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;

  const callSummaries = todayCalls.slice(0, 3).map(c => {
    const a = c.analysis || {};
    return `- ${c.title || 'Call'}: ${a.summary ? String(a.summary).slice(0, 150) : 'No summary'}`;
  }).join('\n');

  const accountContext = topAccount ? [
    `Account: ${topAccount.name} (${(topAccount.stage || '').replace(/_/g, ' ')})`,
    lastAnalysis?.analysis?.summary ? `Last call: ${String(lastAnalysis.analysis.summary).slice(0, 200)}` : 'No recent calls',
  ].join('\n') : 'No active accounts';

  const prompt = `You are coaching a sales rep named ${rep.full_name || rep.email}.
Today they made ${todayCalls.length} call${todayCalls.length !== 1 ? 's' : ''}.

${todayCalls.length > 0 ? `Today's calls:\n${callSummaries}` : 'No calls today.'}

Top account to prioritize tomorrow:
${accountContext}

Give a short, specific coaching note in JSON. Keep it direct and actionable — like a good manager would say at end of day.
{
  "coaching_note": "1-2 sentences of specific coaching insight based on today's calls, OR encouragement if they made strong progress",
  "tomorrow_focus": "1 sentence on the most important thing to do tomorrow for the top account"
}`;

  try {
    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 300,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    const data = await resp.json();
    const raw = data.content?.[0]?.text || '';
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) return null;
    return JSON.parse(match[0]);
  } catch (e) {
    console.error(`[rep-pulse] Claude error for ${rep.email}:`, e.message);
    return null;
  }
}

function buildRepPulseBlocks(rep, todayCalls, topAccount, insight) {
  const dateStr = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  const callCount = todayCalls.length;

  const blocks = [
    {
      type: 'header',
      text: { type: 'plain_text', text: `Your Day in Review — ${dateStr}`, emoji: true },
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: callCount > 0
          ? `You made *${callCount} call${callCount !== 1 ? 's' : ''}* today. Here's your end-of-day summary.`
          : `No Gong calls recorded today. Here's what to focus on tomorrow.`,
      },
    },
    { type: 'divider' },
  ];

  if (callCount > 0) {
    const callLines = todayCalls.slice(0, 5).map(c => {
      const a = c.analysis || {};
      const sentiment = a.sentiment === 'positive' ? '✅' : a.sentiment === 'negative' ? '⚠️' : '—';
      return `${sentiment} ${c.title || 'Untitled call'}`;
    }).join('\n');

    blocks.push({
      type: 'section',
      text: { type: 'mrkdwn', text: `*Today's calls:*\n${callLines}` },
    });
  }

  if (insight?.coaching_note) {
    blocks.push({
      type: 'section',
      text: { type: 'mrkdwn', text: `*Coaching insight:* ${insight.coaching_note}` },
    });
  }

  if (topAccount) {
    blocks.push({ type: 'divider' });
    const stageLabel = (topAccount.stage || '').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    const days = daysSince(topAccount.lastCallDate);
    const staleness = days != null ? ` · ${days}d since last call` : '';
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*Tomorrow's first call:* <${DASHBOARD_URL}/modules/account-pipeline?account=${topAccount.id}|${topAccount.name}> — ${stageLabel}${staleness}`,
      },
    });

    if (insight?.tomorrow_focus) {
      blocks.push({
        type: 'section',
        text: { type: 'mrkdwn', text: `*Focus:* ${insight.tomorrow_focus}` },
      });
    }
  }

  blocks.push({
    type: 'context',
    elements: [{ type: 'mrkdwn', text: `<${DASHBOARD_URL}/modules/tasks|Open Tasks →>` }],
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

  // Get all reps with a Slack DM channel
  const { data: profiles, error: profErr } = await db
    .from('profiles')
    .select('id, full_name, email, role, slack_user_id')
    .eq('role', 'rep')
    .not('slack_user_id', 'is', null);

  if (profErr) {
    console.error('[rep-pulse] Profiles error:', profErr.message);
    return res.status(500).json({ error: profErr.message });
  }

  if (!profiles?.length) {
    return res.status(200).json({ sent: 0, reason: 'No reps with Slack IDs' });
  }

  // Get today's calls for all reps
  const todayStart = new Date();
  todayStart.setUTCHours(0, 0, 0, 0);
  const { data: todayCalls } = await db
    .from('gong_call_analyses')
    .select('rep_email, title, call_date, analysis, account_id')
    .gte('call_date', todayStart.toISOString());

  // Group calls by rep email
  const callsByRep = {};
  for (const call of todayCalls || []) {
    const email = call.rep_email?.toLowerCase();
    if (!email) continue;
    if (!callsByRep[email]) callsByRep[email] = [];
    callsByRep[email].push(call);
  }

  // Get active accounts per rep
  const { data: accounts } = await db
    .from('accounts')
    .select('id, name, stage, user_id, updated_at')
    .in('stage', ACTIVE_STAGES);

  // Get latest call per account
  const accountIds = (accounts || []).map(a => a.id);
  const { data: recentCalls } = accountIds.length > 0
    ? await db
        .from('gong_call_analyses')
        .select('account_id, call_date, analysis')
        .in('account_id', accountIds)
        .order('call_date', { ascending: false })
    : { data: [] };

  const latestCallByAccount = {};
  for (const c of recentCalls || []) {
    if (!latestCallByAccount[c.account_id]) latestCallByAccount[c.account_id] = c;
  }

  // Build rep → accounts map
  const accountsByRepUser = {};
  for (const a of accounts || []) {
    if (!a.user_id) continue;
    if (!accountsByRepUser[a.user_id]) accountsByRepUser[a.user_id] = [];
    accountsByRepUser[a.user_id].push({
      ...a,
      lastCallDate: latestCallByAccount[a.id]?.call_date || null,
    });
  }

  const results = [];

  for (const rep of profiles) {
    const repCalls = callsByRep[rep.email?.toLowerCase()] || [];
    const repAccounts = accountsByRepUser[rep.id] || [];

    // Find the top account to focus on — highest-stage account with stalest call
    const STAGE_PRIORITY = { legal: 8, proposal: 7, solution_validation: 6, demo: 5, active_pursuit: 4, intro_scheduled: 3, qualifying: 2 };
    const sorted = [...repAccounts].sort((a, b) => {
      const stageScore = (STAGE_PRIORITY[b.stage] || 0) - (STAGE_PRIORITY[a.stage] || 0);
      if (stageScore !== 0) return stageScore;
      // Tiebreak: stalest call
      const daysA = daysSince(a.lastCallDate) ?? 999;
      const daysB = daysSince(b.lastCallDate) ?? 999;
      return daysB - daysA;
    });

    const topAccount = sorted[0] || null;
    const lastAnalysis = topAccount ? latestCallByAccount[topAccount.id] || null : null;

    const insight = await generateRepInsight(rep, repCalls, topAccount, lastAnalysis);
    const payload = buildRepPulseBlocks(rep, repCalls, topAccount, insight);

    const result = await sendSlackMessage(payload, rep.slack_user_id);
    console.log(`[rep-pulse] ${rep.email}: calls=${repCalls.length}, Slack=${result.ok ? 'ok' : result.error}`);

    results.push({ email: rep.email, callsToday: repCalls.length, slackOk: result.ok });
  }

  return res.status(200).json({ sent: results.filter(r => r.slackOk).length, results });
}
