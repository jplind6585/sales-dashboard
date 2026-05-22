// GET /api/cron/deal-expiry-alerts
// Finds active deals where HubSpot close_date has passed (or is within 7 days)
// and there's been no Gong call activity in the past 14 days.
// Sends a Slack DM to the manager. Protected by CRON_SECRET.

import { getSupabase } from '../../../lib/supabase';
import { sendSlackMessage } from '../../../lib/slack';

const ACTIVE_STAGES = [
  'qualifying', 'intro_scheduled', 'active_pursuit',
  'demo', 'solution_validation', 'proposal', 'legal',
];

const STAGE_LABELS = {
  qualifying: 'Qualifying',
  intro_scheduled: 'Intro Sched.',
  active_pursuit: 'Active Pursuit',
  demo: 'Demo',
  solution_validation: 'Sol. Validation',
  proposal: 'Proposal',
  legal: 'Legal',
};

function daysDiff(dateStr) {
  if (!dateStr) return null;
  return Math.floor((new Date(dateStr).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

function daysSince(dateStr) {
  if (!dateStr) return null;
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24));
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

  // Fetch active deals that have a close_date set
  const { data: accounts, error } = await db
    .from('accounts')
    .select('id, name, stage, close_date, owner_name')
    .in('stage', ACTIVE_STAGES)
    .not('close_date', 'is', null);

  if (error || !accounts?.length) {
    return res.status(200).json({ alerted: 0, message: 'No deals with close dates' });
  }

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

  const expiredDeals = [];
  const expiringSoonDeals = [];

  for (const account of accounts) {
    const daysUntilClose = daysDiff(account.close_date);
    const lastCallDate = lastCallByAccount[account.id];
    const daysSinceLastCall = lastCallDate ? daysSince(lastCallDate) : 999;

    if (daysUntilClose === null) continue;

    if (daysUntilClose < 0) {
      // Past close date
      expiredDeals.push({
        ...account,
        daysOverdue: Math.abs(daysUntilClose),
        daysSinceLastCall,
        lastCallDate,
      });
    } else if (daysUntilClose <= 7 && daysSinceLastCall > 7) {
      // Closing within 7 days but no recent activity
      expiringSoonDeals.push({
        ...account,
        daysUntilClose,
        daysSinceLastCall,
        lastCallDate,
      });
    }
  }

  const allFlagged = [...expiredDeals, ...expiringSoonDeals];
  if (!allFlagged.length) {
    console.log('[deal-expiry-alerts] No expiring/expired deals — no alert sent');
    return res.status(200).json({ alerted: 0, message: 'No expiring deals' });
  }

  const alertChannel = process.env.SLACK_MANAGER_CHANNEL || process.env.SLACK_DEFAULT_CHANNEL;
  const dashboardUrl = 'https://sales-dashboard-six-rosy.vercel.app/modules/account-pipeline';

  const blocks = [
    {
      type: 'header',
      text: { type: 'plain_text', text: `Deal Expiry Alert — ${allFlagged.length} deal${allFlagged.length > 1 ? 's' : ''} need attention`, emoji: false },
    },
  ];

  if (expiredDeals.length) {
    blocks.push({
      type: 'section',
      text: { type: 'mrkdwn', text: `*${expiredDeals.length} past close date:*` },
    });
    for (const d of expiredDeals.slice(0, 5)) {
      const lastCall = d.lastCallDate
        ? `Last call ${d.daysSinceLastCall}d ago`
        : 'No calls on record';
      blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*${d.name}* · ${STAGE_LABELS[d.stage] || d.stage}\n${d.daysOverdue}d past close date · ${lastCall}${d.owner_name ? ` · ${d.owner_name}` : ''}`,
        },
      });
    }
  }

  if (expiringSoonDeals.length) {
    blocks.push({
      type: 'section',
      text: { type: 'mrkdwn', text: `*${expiringSoonDeals.length} closing within 7 days with no recent activity:*` },
    });
    for (const d of expiringSoonDeals.slice(0, 5)) {
      blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*${d.name}* · ${STAGE_LABELS[d.stage] || d.stage}\nCloses in ${d.daysUntilClose}d · Last call ${d.daysSinceLastCall}d ago${d.owner_name ? ` · ${d.owner_name}` : ''}`,
        },
      });
    }
  }

  blocks.push({ type: 'divider' });
  blocks.push({
    type: 'context',
    elements: [{ type: 'mrkdwn', text: `<${dashboardUrl}|Open Pipeline →>` }],
  });

  const result = await sendSlackMessage({ blocks }, alertChannel);
  console.log(`[deal-expiry-alerts] ${allFlagged.length} flagged, Slack: ${result.ok ? 'ok' : result.error}`);

  return res.status(200).json({
    alerted: result.ok ? allFlagged.length : 0,
    expired: expiredDeals.length,
    expiringSoon: expiringSoonDeals.length,
    slackOk: result.ok,
  });
}
