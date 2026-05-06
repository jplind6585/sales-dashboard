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

  const { title, description, rationale, primaryAction, dueDate, source, sourceType, account, calls } = taskContext || {};

  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  const repName = user.email?.split('@')[0] || 'the rep';

  const isDemoPrep = /prepare deck|prep.*deck|demo prep/i.test(title || '');

  let callsContext = '';
  if (calls?.length) {
    callsContext = '\n\nACCOUNT CALL HISTORY (AI-analyzed Gong recordings):\n' +
      calls.map((c, i) => {
        const parts = [`Call ${i + 1}: "${c.title || 'Untitled'}" (${c.date?.slice(0, 10) || 'date unknown'})`]
        if (c.summary) parts.push(`Summary: ${c.summary.slice(0, 400)}`)
        if (c.painPoints?.length) parts.push(`Pain points: ${(Array.isArray(c.painPoints) ? c.painPoints : [c.painPoints]).slice(0, 3).join(' | ')}`)
        if (c.buyingSignals?.length) parts.push(`Buying signals: ${c.buyingSignals.slice(0, 3).join(' | ')}`)
        if (c.redFlags?.length) parts.push(`Red flags: ${c.redFlags.slice(0, 2).join(' | ')}`)
        if (c.nextSteps?.length) parts.push(`Committed next steps: ${c.nextSteps.slice(0, 2).join(' | ')}`)
        if (c.discoveryScore != null) parts.push(`Discovery score: ${c.discoveryScore}/10`)
        if (c.meddicc) {
          const gaps = Object.entries(c.meddicc).filter(([, v]) => !v || /unknown|not identified|not mentioned/i.test(v)).map(([k]) => k)
          if (gaps.length) parts.push(`MEDDIC gaps: ${gaps.join(', ')}`)
        }
        return parts.join('\n')
      }).join('\n\n---\n\n');
  }

  const demoPrepInstructions = isDemoPrep ? `
You are helping the rep prepare for an upcoming demo. You have access to all analyzed call history for this account above.

When asked, you can produce:
- "What We Have Heard" slide bullets (7-9 punchy bullets in plain business language — no em dashes, no AI-sounding phrases — written so the prospect reads each one and thinks "that's exactly our problem")
- A discovery summary capturing what they care about and why
- A MEDDIC capture plan with specific questions to fill gaps
- Demo flow recommendation: which features/workflows to prioritize based on their stated pain
- Objection handling for anything raised in prior calls

Be specific to this account. Reference actual things they said. Do not give generic sales advice.` : '';

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
    callsContext,
    demoPrepInstructions,
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
      maxTokens: isDemoPrep ? 2000 : 1000,
      system: systemPrompt,
      messages: trimmedMessages,
    });

    return res.status(200).json({ success: true, message: reply });
  } catch (e) {
    console.error('[work-in-claude] Error:', e.message);
    return res.status(500).json({ error: e.message });
  }
}
