// POST /api/work-in-claude
// {
//   messages: [{role: 'user'|'assistant', content: '...'}],
//   taskContext: { title, description, rationale, primaryAction, dueDate, source, sourceType, account }
// }
// Returns: { message }
//
// Powers the "Work in Claude" side panel on tasks.
// Conversation history is stored client-side (localStorage); backend is stateless.

import { createServerSupabaseClient } from '../../lib/supabase';
import { callAnthropic, logRequest } from '../../lib/apiUtils';

export default async function handler(req, res) {
  logRequest(req, 'work-in-claude');
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const authClient = createServerSupabaseClient(req, res);
  const { data: { user } } = await authClient.auth.getUser();
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'ANTHROPIC_API_KEY not configured' });

  const { messages, taskContext } = req.body || {};
  if (!messages?.length) return res.status(400).json({ error: 'messages required' });

  const { title, description, rationale, primaryAction, dueDate, source, sourceType, account } = taskContext || {};

  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  const repName = user.email?.split('@')[0] || 'the rep';

  const systemPrompt = [
    `You are a sales AI assistant helping ${repName} work through a specific task. Be practical, specific, and action-oriented.`,
    ``,
    `TASK: ${title || 'Untitled'}`,
    rationale      ? `WHY IT MATTERS: ${rationale}` : null,
    description    ? `CONTEXT: ${description}` : null,
    primaryAction  ? `SUGGESTED FIRST ACTION: ${primaryAction}` : null,
    dueDate        ? `DUE: ${dueDate}` : null,
    account?.name  ? `ACCOUNT: ${account.name}${account.stage ? ` (stage: ${account.stage})` : ''}` : null,
    sourceType === 'gong_next_step' ? `SOURCE: Extracted from a Gong call recording` : null,
    ``,
    `TODAY: ${today}`,
    ``,
    `Help the rep execute this task. Draft emails, talk tracks, objection handling, or action plans as requested. Keep responses focused and concise — this is a task execution tool, not a research engine.`,
  ].filter(Boolean).join('\n');

  // Trim conversation history to last 12 messages to keep costs low
  const trimmedMessages = messages.slice(-12).map(m => ({
    role: m.role === 'assistant' ? 'assistant' : 'user',
    content: String(m.content),
  }));

  try {
    const reply = await callAnthropic(apiKey, {
      model: 'claude-sonnet-4-6',
      maxTokens: 1000,
      system: systemPrompt,
      messages: trimmedMessages,
    });

    return res.status(200).json({ success: true, message: reply });
  } catch (e) {
    console.error('[work-in-claude] Error:', e.message);
    return res.status(500).json({ error: e.message });
  }
}
