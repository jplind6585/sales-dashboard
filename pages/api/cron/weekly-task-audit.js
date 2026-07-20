import { callAnthropic } from '../../../lib/apiUtils';
import { getSupabase } from '../../../lib/supabase';
import { sendSlackMessage } from '../../../lib/slack';

export default async function handler(req, res) {
  const isCron = req.headers['authorization'] === `Bearer ${process.env.CRON_SECRET}`;
  if (!isCron) return res.status(401).json({ error: 'Unauthorized' });
  if (req.method !== 'GET' && req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const db = getSupabase();
  const today = new Date().toISOString().split('T')[0];
  const weekEnd = new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0];

  // Fetch all open tasks with owner + account info
  const { data: tasks, error } = await db
    .from('tasks')
    .select(`
      id, title, due_date, priority, source, source_type, momentum, status,
      accounts(name, stage),
      profiles!tasks_owner_id_fkey(id, full_name, email, slack_user_id, role)
    `)
    .neq('status', 'complete')
    .is('dismissed_at', null);

  if (error || !tasks?.length) {
    return res.status(200).json({ success: true, message: 'No open tasks' });
  }

  // Group by owner
  const byOwner = {};
  for (const task of tasks) {
    const rep = task.profiles;
    if (!rep || ['manager','admin'].includes(rep.role)) continue;
    if (!byOwner[rep.id]) byOwner[rep.id] = { rep, tasks: [] };
    byOwner[rep.id].tasks.push(task);
  }

  let sent = 0;
  const errors = [];

  for (const { rep, tasks: repTasks } of Object.values(byOwner)) {
    if (!repTasks.length) continue;

    const overdue = repTasks.filter(t => t.due_date && t.due_date < today);
    const dueThisWeek = repTasks.filter(t => t.due_date && t.due_date >= today && t.due_date <= weekEnd);
    const noDate = repTasks.filter(t => !t.due_date);
    const waiting = repTasks.filter(t => t.momentum === 'waiting_on_them');

    const taskSummary = repTasks.slice(0, 20).map(t => {
      const account = t.accounts?.name || 'No account';
      const stage = t.accounts?.stage || '';
      const status = t.due_date && t.due_date < today ? 'OVERDUE' :
        t.due_date && t.due_date <= weekEnd ? `Due ${t.due_date}` : 'No due date';
      const momentum = t.momentum === 'waiting_on_them' ? '[waiting]' : t.momentum === 'no_next_step' ? '[no step]' : '';
      return `- ${t.title} | ${account} (${stage}) | ${status} ${momentum}`;
    }).join('\n');

    let aiText = '';
    try {
      aiText = await callAnthropic(process.env.ANTHROPIC_API_KEY, {
        model: 'claude-haiku-4-5-20251001',
        maxTokens: 400,
        messages: [{
          role: 'user',
          content: `Sales rep ${rep.full_name || rep.email} has ${repTasks.length} open tasks. Generate a brief Monday morning Slack message (3-4 sentences max) that:
1. Notes how many tasks they have, how many are overdue (${overdue.length}), and how many due this week (${dueThisWeek.length})
2. Calls out the 1-2 most urgent tasks by name
3. Ends with an encouraging one-liner

Their tasks:
${taskSummary}

Return just the message text, no headers or formatting.`,
        }],
      }) || '';
    } catch (e) {
      aiText = `You have ${repTasks.length} open tasks this week: ${overdue.length} overdue, ${dueThisWeek.length} due this week. Time to clear the deck.`;
    }

    const blocks = [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Monday Task Audit* — ${new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}`,
        },
      },
      {
        type: 'section',
        text: { type: 'mrkdwn', text: aiText },
      },
    ];

    if (overdue.length > 0) {
      blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Overdue (${overdue.length}):*\n${overdue.slice(0, 5).map(t => `• ${t.title}${t.accounts?.name ? ` — ${t.accounts.name}` : ''}`).join('\n')}`,
        },
      });
    }

    const slackId = rep.slack_user_id;
    if (!slackId) {
      console.log(`[weekly-audit] No slack_user_id for ${rep.email}, skipping`);
      continue;
    }

    try {
      await sendSlackMessage({ blocks, text: 'Monday Task Audit' }, slackId);
      sent++;
    } catch (e) {
      errors.push(`${rep.email}: ${e.message}`);
    }
  }

  return res.status(200).json({ success: true, sent, errors });
}
