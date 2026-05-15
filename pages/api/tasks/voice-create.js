// POST /api/tasks/voice-create
// Takes a voice transcript, uses Claude Haiku to extract multiple tasks,
// matches each to an account (fuzzy), pulls recent call context for each,
// then creates all tasks in the DB and returns them.

import { apiError, apiSuccess, logRequest, callAnthropic, parseClaudeJson } from '../../../lib/apiUtils';
import { createServerSupabaseClient, getSupabase } from '../../../lib/supabase';

function fuzzyMatch(mention, accounts) {
  if (!mention?.trim()) return null;
  const m = mention.toLowerCase().trim();

  for (const a of accounts) {
    if (a.name.toLowerCase() === m) return a;
  }

  let best = null, bestScore = 0;
  for (const a of accounts) {
    const n = a.name.toLowerCase();
    if (n.includes(m) || m.includes(n)) {
      const score = Math.min(m.length, n.length) / Math.max(m.length, n.length);
      if (score > bestScore) { bestScore = score; best = a; }
      continue;
    }
    const mWords = m.split(' ').filter(w => w.length > 2);
    const nWords = n.split(' ').filter(w => w.length > 2);
    const overlap = mWords.filter(w => nWords.some(nw => nw.includes(w) || w.includes(nw))).length;
    if (overlap > 0) {
      const score = overlap / Math.max(mWords.length, 1);
      if (score > bestScore) { bestScore = score; best = a; }
    }
  }
  return bestScore >= 0.4 ? best : null;
}

export default async function handler(req, res) {
  logRequest(req, 'tasks/voice-create');
  if (req.method !== 'POST') return apiError(res, 405, 'Method not allowed');

  const authClient = createServerSupabaseClient(req, res);
  const { data: { user } } = await authClient.auth.getUser();
  if (!user) return apiError(res, 401, 'Unauthorized');

  const { transcript } = req.body || {};
  if (!transcript?.trim()) return apiError(res, 400, 'No transcript provided');

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return apiError(res, 500, 'ANTHROPIC_API_KEY not configured');

  const db = getSupabase();

  // 1. Parse transcript into individual tasks
  const parsePrompt = `You are helping a sales rep turn a voice note into tasks.

Voice note: "${transcript.slice(0, 2000)}"

Extract each distinct task or follow-up action. Be specific — use exact details from the note.

Return ONLY valid JSON (no other text):
[
  {
    "title": "action title starting with a verb — e.g. 'Follow up with CSM on intro call outcomes', 'Call JSP and ask about the email they sent', 'Talk to Westover about vendor experience at Burger'",
    "account_mention": "company name as said — e.g. 'CSM', 'JSP', 'Westover', 'UDR'. null if no company mentioned",
    "action_type": "email" | "call" | "meeting" | "internal" | "other",
    "notes": "specific talking points or context from the voice note — be detailed",
    "priority": 1 | 2 | 3
  }
]`;

  const raw = await callAnthropic(apiKey, {
    model: 'claude-haiku-4-5-20251001',
    maxTokens: 1200,
    messages: [{ role: 'user', content: parsePrompt }],
  });

  let parsed = parseClaudeJson(raw, []);
  if (!Array.isArray(parsed)) parsed = [];
  if (!parsed.length) return apiError(res, 422, 'Could not extract tasks from voice note. Try speaking more clearly about what you need to do.');

  // 2. Fetch accounts for fuzzy matching
  const { data: accounts } = await db.from('accounts').select('id, name, stage, owner_name').limit(600);

  // 3. Build each task with account context
  const now = new Date().toISOString();
  const dueDate = new Date(Date.now() + 2 * 86400000).toISOString().split('T')[0];
  const tasksToCreate = [];

  for (const t of parsed) {
    const matched = fuzzyMatch(t.account_mention, accounts || []);
    let description = t.notes || null;

    if (matched) {
      const { data: calls } = await db
        .from('gong_call_analyses')
        .select('title, call_date, analysis')
        .eq('account_id', matched.id)
        .not('analyzed_at', 'is', null)
        .order('call_date', { ascending: false })
        .limit(3);

      const callLines = (calls || []).map(c => {
        const date = new Date(c.call_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        const summary = c.analysis?.summary || '';
        const nextSteps = (c.analysis?.next_steps_mentioned || []).slice(0, 2).join('; ');
        return `• ${date} — ${c.title}${summary ? `: ${summary.slice(0, 150)}` : ''}${nextSteps ? `\n  Next steps: ${nextSteps}` : ''}`;
      });

      const contextParts = [
        `Account: ${matched.name} (${matched.stage || 'unknown stage'})`,
        t.notes || null,
        callLines.length ? `Recent calls:\n${callLines.join('\n')}` : null,
      ].filter(Boolean);

      description = contextParts.join('\n\n');
    }

    tasksToCreate.push({
      row: {
        title: t.title,
        description: description || null,
        status: 'open',
        priority: t.priority || 2,
        type: 'triggered',
        owner_id: user.id,
        account_id: matched?.id || null,
        source: 'voice',
        due_date: dueDate,
        created_at: now,
      },
      accountName: matched?.name || t.account_mention || null,
      accountStage: matched?.stage || null,
      actionType: t.action_type,
    });
  }

  // 4. Insert all tasks
  const created = [];
  for (const { row, accountName, accountStage, actionType } of tasksToCreate) {
    const { data: task, error } = await db.from('tasks').insert(row).select('id, title, account_id').single();
    if (!error && task) {
      created.push({ id: task.id, title: task.title, accountId: task.account_id, accountName, accountStage, actionType });
    }
  }

  return apiSuccess(res, { data: { created, parsed: parsed.length } });
}
