// GET /api/cron/sdr-activity
// Posts daily SDR Activity Leaderboard to Slack at 5pm EST weekdays.
// Shows: calls made, accounts touched, meetings booked per rep (from Gong call data).
// Protected by CRON_SECRET.

import { getSupabase } from '../../../lib/supabase';
import { sendSlackMessage } from '../../../lib/slack';

const DASHBOARD_URL = 'https://sales-dashboard-james-projects-87ec0089.vercel.app';

function daysSince(dateStr) {
  if (!dateStr) return null;
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24));
}

function isToday(dateStr) {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  const now = new Date();
  return d.getUTCFullYear() === now.getUTCFullYear() &&
    d.getUTCMonth() === now.getUTCMonth() &&
    d.getUTCDate() === now.getUTCDate();
}

function isThisWeek(dateStr) {
  if (!dateStr) return false;
  const days = daysSince(dateStr);
  return days !== null && days <= 7;
}

function medalEmoji(rank) {
  if (rank === 1) return '🥇';
  if (rank === 2) return '🥈';
  if (rank === 3) return '🥉';
  return `${rank}.`;
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

  // Get all profiles (reps only)
  const { data: profiles, error: profErr } = await db
    .from('profiles')
    .select('id, full_name, email, role, rep_type')
    .eq('role', 'rep');

  if (profErr) {
    console.error('[sdr-activity] Profiles error:', profErr.message);
    return res.status(500).json({ error: profErr.message });
  }

  // Get today's and this week's Gong calls
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const { data: calls, error: callErr } = await db
    .from('gong_call_analyses')
    .select('rep_name, rep_email, call_date, analysis, account_id')
    .gte('call_date', sevenDaysAgo)
    .order('call_date', { ascending: false });

  if (callErr) {
    console.error('[sdr-activity] Calls error:', callErr.message);
    return res.status(500).json({ error: callErr.message });
  }

  // Build per-rep stats
  const repStats = {};

  for (const profile of profiles || []) {
    repStats[profile.email] = {
      name: profile.full_name || profile.email,
      email: profile.email,
      callsToday: 0,
      callsThisWeek: 0,
      accountsTouchedToday: new Set(),
      accountsTouchedWeek: new Set(),
      meetingsBookedToday: 0,
      meetingsBookedWeek: 0,
      connectsToday: 0,
    };
  }

  for (const call of calls || []) {
    const email = call.rep_email?.toLowerCase();
    if (!email || !repStats[email]) continue;

    const stats = repStats[email];
    const todayCall = isToday(call.call_date);
    const weekCall = isThisWeek(call.call_date);

    if (todayCall) {
      stats.callsToday++;
      if (call.account_id) stats.accountsTouchedToday.add(call.account_id);
    }
    if (weekCall) {
      stats.callsThisWeek++;
      if (call.account_id) stats.accountsTouchedWeek.add(call.account_id);
    }

    // Check for meetings booked in analysis next_steps
    const analysis = call.analysis || {};
    const nextSteps = analysis.next_steps_mentioned || [];
    const hasMeetingBooked = nextSteps.some(s => {
      const l = s.toLowerCase();
      return l.includes('demo') || l.includes('book') || l.includes('schedule') || l.includes('meeting');
    });

    if (hasMeetingBooked) {
      if (todayCall) stats.meetingsBookedToday++;
      if (weekCall) stats.meetingsBookedWeek++;
    }
  }

  // Convert sets to counts
  const repList = Object.values(repStats).map(s => ({
    ...s,
    accountsTouchedToday: s.accountsTouchedToday.size,
    accountsTouchedWeek: s.accountsTouchedWeek.size,
  }));

  // Sort by calls today desc, then week
  repList.sort((a, b) => {
    if (b.callsToday !== a.callsToday) return b.callsToday - a.callsToday;
    return b.callsThisWeek - a.callsThisWeek;
  });

  const active = repList.filter(r => r.callsThisWeek > 0 || r.callsToday > 0);
  if (!active.length) {
    console.log('[sdr-activity] No call data for today, skipping Slack post');
    return res.status(200).json({ sent: false, reason: 'No activity data' });
  }

  const dateStr = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

  const rows = repList.map((rep, i) => {
    const medal = medalEmoji(i + 1);
    const todayCalls = rep.callsToday;
    const weekCalls = rep.callsThisWeek;
    const accts = rep.accountsTouchedToday;
    const meetings = rep.meetingsBookedToday;
    return `${medal} *${rep.name}* — ${todayCalls} call${todayCalls !== 1 ? 's' : ''} today · ${accts} acct${accts !== 1 ? 's' : ''} touched · ${meetings} meeting${meetings !== 1 ? 's' : ''} booked`;
  });

  const totalCalls = repList.reduce((s, r) => s + r.callsToday, 0);
  const totalMeetings = repList.reduce((s, r) => s + r.meetingsBookedToday, 0);
  const totalAccts = repList.reduce((s, r) => s + r.accountsTouchedToday, 0);

  const blocks = [
    {
      type: 'header',
      text: { type: 'plain_text', text: `SDR Activity — ${dateStr}`, emoji: true },
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*Team total:* ${totalCalls} calls · ${totalAccts} accounts touched · ${totalMeetings} meetings booked`,
      },
    },
    { type: 'divider' },
    {
      type: 'section',
      text: { type: 'mrkdwn', text: rows.join('\n') },
    },
    {
      type: 'context',
      elements: [{ type: 'mrkdwn', text: `<${DASHBOARD_URL}/modules/pipeline-overview|View Pipeline →>` }],
    },
  ];

  const channel = process.env.SLACK_MANAGER_CHANNEL || process.env.SLACK_DEFAULT_CHANNEL;
  const result = await sendSlackMessage({ blocks }, channel);

  console.log(`[sdr-activity] ${repList.length} reps, Slack: ${result.ok ? 'ok' : result.error}`);

  return res.status(200).json({
    sent: result.ok,
    reps: repList.length,
    totalCallsToday: totalCalls,
  });
}
