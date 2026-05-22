// GET /api/cron/rep-checkin
// Runs Sunday 8pm UTC (4pm EST). Two modes:
//   - Reps: DM asking them to reflect on their top deals before Monday
//   - Managers (James + Mark): DM asking about deals they want to watch this week
// Only fires for profiles with slack_user_id set.
// Protected by CRON_SECRET.

import { getSupabase } from '../../../lib/supabase';
import { sendSlackMessage } from '../../../lib/slack';

const DASHBOARD_URL = 'https://sales-dashboard-six-rosy.vercel.app';

const ACTIVE_STAGES = [
  'intro_scheduled', 'active_pursuit', 'demo',
  'solution_validation', 'proposal', 'legal',
];

const STAGE_LABELS = {
  intro_scheduled: 'Intro Sched.',
  active_pursuit: 'Active Pursuit',
  demo: 'Demo',
  solution_validation: 'Sol. Validation',
  proposal: 'Proposal',
  legal: 'Legal',
};

function daysSince(dateStr) {
  if (!dateStr) return null;
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24));
}

async function buildRepMessage(rep, accounts, lastCallByAccount) {
  const repAccounts = accounts
    .filter(a => a.owner_name === rep.full_name || a.user_id === rep.id)
    .filter(a => ACTIVE_STAGES.includes(a.stage))
    .sort((a, b) => {
      // Sort by last call (most stale first)
      const dA = daysSince(lastCallByAccount[a.id]) ?? 999;
      const dB = daysSince(lastCallByAccount[b.id]) ?? 999;
      return dB - dA;
    })
    .slice(0, 5);

  if (!repAccounts.length) return null;

  const accountLines = repAccounts.map(a => {
    const days = daysSince(lastCallByAccount[a.id]);
    const daysStr = days != null ? `${days}d since last call` : 'no calls on record';
    return `• *${a.name}* — ${STAGE_LABELS[a.stage] || a.stage} · ${daysStr}`;
  }).join('\n');

  const blocks = [
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `Hey ${rep.full_name?.split(' ')[0] || 'there'} — quick Sunday check-in before the week kicks off.`,
      },
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*Your active deals:*\n${accountLines}`,
      },
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `Before Monday:\n• Which of these is your #1 priority?\n• Any blockers you're stuck on?\n• What's the one thing that would move the needle most this week?`,
      },
    },
    {
      type: 'actions',
      elements: [
        {
          type: 'button',
          text: { type: 'plain_text', text: 'Open Pipeline', emoji: false },
          url: `${DASHBOARD_URL}/modules/account-pipeline`,
        },
      ],
    },
  ];

  return blocks;
}

async function buildManagerMessage(manager, accounts, lastCallByAccount) {
  // Find late-stage deals with no recent activity — these are the ones to watch
  const watchDeals = accounts
    .filter(a => ['demo', 'solution_validation', 'proposal', 'legal'].includes(a.stage))
    .map(a => ({
      ...a,
      daysSinceLast: daysSince(lastCallByAccount[a.id]) ?? 999,
    }))
    .sort((a, b) => b.daysSinceLast - a.daysSinceLast)
    .slice(0, 8);

  const dealLines = watchDeals.map(a => {
    const daysStr = a.daysSinceLast < 999 ? `${a.daysSinceLast}d since last call` : 'no calls on record';
    return `• *${a.name}* — ${STAGE_LABELS[a.stage] || a.stage} · ${daysStr}${a.owner_name ? ` · ${a.owner_name}` : ''}`;
  }).join('\n');

  const blocks = [
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `Hey ${manager.full_name?.split(' ')[0] || 'there'} — here are the late-stage deals worth watching this week:`,
      },
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: dealLines || 'No late-stage active deals.',
      },
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `Any deals you want to pull into your review this week? Or things the reps need from you to unblock?`,
      },
    },
    {
      type: 'actions',
      elements: [
        {
          type: 'button',
          text: { type: 'plain_text', text: 'Pipeline Overview', emoji: false },
          url: `${DASHBOARD_URL}/modules/pipeline-overview`,
        },
      ],
    },
  ];

  return blocks;
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

  const [profilesRes, accountsRes] = await Promise.all([
    db.from('profiles').select('id, full_name, email, role, slack_user_id').not('slack_user_id', 'is', null),
    db.from('accounts').select('id, name, stage, owner_name, user_id').in('stage', ACTIVE_STAGES),
  ]);

  const profiles = profilesRes.data || [];
  const accounts = accountsRes.data || [];

  if (!profiles.length) return res.status(200).json({ sent: 0, message: 'No profiles with Slack IDs' });

  // Get last call date per account
  const accountIds = accounts.map(a => a.id);
  const { data: calls } = await db
    .from('gong_call_analyses')
    .select('account_id, call_date')
    .in('account_id', accountIds)
    .order('call_date', { ascending: false });

  const lastCallByAccount = {};
  for (const call of (calls || [])) {
    if (!lastCallByAccount[call.account_id]) {
      lastCallByAccount[call.account_id] = call.call_date;
    }
  }

  let sent = 0;

  for (const profile of profiles) {
    const isManager = profile.role === 'manager';
    let blocks;

    if (isManager) {
      blocks = await buildManagerMessage(profile, accounts, lastCallByAccount);
    } else {
      blocks = await buildRepMessage(profile, accounts, lastCallByAccount);
    }

    if (!blocks) continue;

    const result = await sendSlackMessage({ blocks }, profile.slack_user_id);
    if (result.ok) {
      sent++;
      console.log(`[rep-checkin] DM sent to ${profile.full_name} (${isManager ? 'manager' : 'rep'})`);
    } else {
      console.error(`[rep-checkin] Failed to DM ${profile.full_name}: ${result.error}`);
    }
  }

  return res.status(200).json({ sent, total: profiles.length });
}
