// GET /api/rep/morning-brief
// Returns a daily AI-generated "Today's Focus" brief for the logged-in rep.
// Pulls from: open tasks due today/overdue, recent Gong analyses, high-risk signals.
// Cached via localStorage on the client (once per calendar day).

import { createServerSupabaseClient, getSupabase } from '../../../lib/supabase';
import { callAnthropic, parseClaudeJson, logRequest } from '../../../lib/apiUtils';

export default async function handler(req, res) {
  logRequest(req, 'rep/morning-brief');
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const authClient = createServerSupabaseClient(req, res);
  const { data: { user } } = await authClient.auth.getUser();
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'ANTHROPIC_API_KEY not configured' });

  const db = getSupabase();
  const today = new Date().toISOString().split('T')[0];
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  // Fetch open tasks + recent Gong calls in parallel
  const [tasksRes, gongRes] = await Promise.all([
    db.from('tasks')
      .select('id, title, description, priority, due_date, source, source_type, rationale, primary_action, type')
      .eq('owner_id', user.id)
      .in('status', ['open', 'in_progress', 'blocked'])
      .is('dismissed_at', null)
      .order('due_date', { ascending: true, nullsFirst: false })
      .order('priority', { ascending: true }),
    db.from('gong_call_analyses')
      .select('title, call_date, rep_email, analysis')
      .eq('rep_email', user.email)
      .gte('call_date', weekAgo)
      .not('analyzed_at', 'is', null)
      .order('call_date', { ascending: false })
      .limit(5),
  ]);

  const allTasks = tasksRes.data || [];
  const recentCalls = gongRes.data || [];

  // Partition tasks
  const overdueTasks = allTasks.filter(t => t.due_date && t.due_date < today);
  const dueTodayTasks = allTasks.filter(t => t.due_date === today);
  const upcomingTasks = allTasks.filter(t => !t.due_date || t.due_date > today);
  const highPriority = allTasks.filter(t => t.priority === 1).slice(0, 5);

  const taskSummary = [
    ...overdueTasks.slice(0, 3).map(t => `[OVERDUE] ${t.title}${t.rationale ? ` — ${t.rationale.slice(0, 80)}` : ''}`),
    ...dueTodayTasks.slice(0, 5).map(t => `[DUE TODAY] ${t.title}`),
    ...highPriority.filter(t => !overdueTasks.includes(t) && !dueTodayTasks.includes(t)).slice(0, 3).map(t => `[HIGH] ${t.title}`),
  ].join('\n');

  const callSummary = recentCalls.slice(0, 3).map(c => {
    const a = c.analysis || {};
    return `${c.title} (${c.call_date?.split('T')[0]}): ${a.summary?.slice(0, 120) || 'No summary'}`;
  }).join('\n');

  const prompt = `You are a sales AI assistant. Generate a concise morning brief for a sales rep to start their day.

OPEN TASKS (${allTasks.length} total — ${overdueTasks.length} overdue, ${dueTodayTasks.length} due today):
${taskSummary || 'No urgent tasks.'}

RECENT GONG CALLS (last 7 days):
${callSummary || 'No recent calls.'}

Today's date: ${new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}

Return ONLY valid JSON:
{
  "headline": "One punchy sentence (e.g. '3 overdue tasks and a near-close deal need your attention today')",
  "top_priority": "The single most important thing to do first today and why (1-2 sentences)",
  "deals_to_watch": ["Account name — why it needs attention today (one phrase each)", "..."],
  "quick_wins": ["Task you can knock out in under 15 min", "..."],
  "insight": "One tactical coaching insight or momentum signal from recent calls (1 sentence)",
  "task_count": { "overdue": ${overdueTasks.length}, "today": ${dueTodayTasks.length}, "total": ${allTasks.length} }
}`;

  try {
    const raw = await callAnthropic(apiKey, {
      model: 'claude-haiku-4-5-20251001',
      maxTokens: 600,
      messages: [{ role: 'user', content: prompt }],
    });

    const brief = parseClaudeJson(raw, {
      headline: `You have ${allTasks.length} open tasks${overdueTasks.length ? `, including ${overdueTasks.length} overdue` : ''}.`,
      top_priority: overdueTasks[0]?.title || dueTodayTasks[0]?.title || highPriority[0]?.title || 'Review your task list.',
      deals_to_watch: [],
      quick_wins: [],
      insight: null,
      task_count: { overdue: overdueTasks.length, today: dueTodayTasks.length, total: allTasks.length },
    });

    return res.status(200).json({ success: true, brief, generatedAt: new Date().toISOString() });
  } catch (e) {
    console.error('[morning-brief] Error:', e.message);
    return res.status(500).json({ error: e.message });
  }
}
