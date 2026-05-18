import { apiError, apiSuccess, logRequest } from '../../../lib/apiUtils';
import { createServerSupabaseClient, getSupabase } from '../../../lib/supabase';
import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic();

export default async function handler(req, res) {
  logRequest(req, 'tasks/daily-focus');
  if (req.method !== 'GET') return apiError(res, 405, 'GET only');

  const auth = createServerSupabaseClient(req, res);
  const { data: { user } } = await auth.auth.getUser();
  if (!user) return apiError(res, 401, 'Unauthorized');

  const db = getSupabase();

  // Fetch open tasks for this user
  const { data: tasks, error } = await db
    .from('tasks')
    .select('id, title, description, priority, due_date, source, source_type, rationale, momentum, account_id, accounts(name, stage)')
    .eq('owner_id', user.id)
    .neq('status', 'complete')
    .is('dismissed_at', null)
    .limit(50)
    .order('priority', { ascending: true });

  if (error || !tasks?.length) return apiSuccess(res, { focus: [] });

  const today = new Date().toISOString().split('T')[0];

  const taskList = tasks.map((t, i) => {
    const overdue = t.due_date && t.due_date < today;
    const dueToday = t.due_date === today;
    const account = t.accounts?.name || 'No account';
    const stage = t.accounts?.stage || '';
    return `${i + 1}. ID:${t.id} | "${t.title}" | Account: ${account} (${stage}) | Priority: ${t.priority} | ${overdue ? 'OVERDUE' : dueToday ? 'DUE TODAY' : t.due_date ? `Due: ${t.due_date}` : 'No due date'} | Momentum: ${t.momentum || 'on_me'} | Source: ${t.source_type || t.source || 'manual'}`;
  }).join('\n');

  const prompt = `You are helping a sales rep prioritize their day. Here are their open tasks:

${taskList}

Pick the top 3 most important tasks to focus on TODAY. Consider:
- Overdue tasks are urgent
- Tasks with upcoming due dates
- Account stage (legal/proposal = highest urgency)
- Gong commitments (source_type = gong_commitment) need follow-through
- "Waiting on them" momentum tasks should be deprioritized unless critical

Return JSON array of exactly 3 objects (or fewer if fewer tasks exist):
[{"taskId":"uuid","title":"task title","account":"account name","reason":"one sentence explaining why this is today's priority"}]

Return ONLY valid JSON.`;

  try {
    const message = await client.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 500,
      messages: [{ role: 'user', content: prompt }],
    });

    const content = message.content[0]?.text || '[]';
    const jsonMatch = content.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return apiSuccess(res, { focus: [] });

    const focus = JSON.parse(jsonMatch[0]);
    return apiSuccess(res, { focus });
  } catch (e) {
    console.error('[daily-focus] error:', e.message);
    return apiSuccess(res, { focus: [] });
  }
}
