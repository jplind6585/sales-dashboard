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

  const { title, description, rationale, primaryAction, dueDate, source, sourceType, account, calls, role } = taskContext || {};

  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  const repName = user.email?.split('@')[0] || 'the rep';

  const ROLE_INSTRUCTIONS = {
    'prepare-deck': `
You are helping the rep prepare for an upcoming demo using analyzed call history above.
Produce on request: "What We Have Heard" slide bullets (7-9 punchy bullets, plain business language, no em dashes, no AI phrases — each bullet should make the prospect think "that's exactly our problem"), a MEDDIC capture plan with specific questions to fill gaps, demo flow recommendation based on stated pain, objection handling for anything raised in prior calls.
Be specific to this account. Reference actual things they said. No generic advice.`,

    'review-notes': `
You are helping the rep get a complete picture of this deal before heading into the pursuit channel or a stakeholder conversation.
Produce on request: a deal snapshot (where things stand, what's been discussed, what's outstanding), a draft pursuit channel update, or a prep note for a specific stakeholder meeting.
Be concise — the rep needs to be ready fast, not read an essay.`,

    'next-step-planner': `
You are helping the rep plan exactly what to ask for at the close of the next meeting and how to ask for it.
Given the MEDDIC gaps and deal stage, recommend: the ideal next step (be specific — not "schedule a meeting" but "get the CFO on a 30-minute call to review the ROI model"), how to ask for it on the call, and how to respond if they resist or try to kick it to email.`,

    'email-draft': `
You are drafting a follow-up email after a sales call.
Rules: reference specific things from the call (don't be generic), keep it under 120 words, one clear ask at the end, no "per our conversation" or "as discussed" openings, no em dashes.
Format: subject line, then body. If they gave you context about what was discussed, incorporate it.`,

    'gong-deliverable': `
You are helping the rep complete a specific deliverable that came out of a Gong call — a next step they committed to or a follow-up action.
The context from the call is in the task rationale above. Be direct and practical — draft the thing, don't explain what you're about to do.`,
  };

  const roleInstructions = ROLE_INSTRUCTIONS[role] || '';

  let callsContext = '';
  if (calls?.length) {
    callsContext = '\n\nACCOUNT CALL HISTORY (AI-analyzed Gong recordings):\n' +
      calls.map((c, i) => {
        const parts = [`Call ${i + 1}: "${c.title || 'Untitled'}" (${c.date?.slice(0, 10) || 'date unknown'})`]
        if (c.summary) parts.push(`Summary: ${c.summary.slice(0, 400)}`)
        if (c.painPoints?.length) parts.push(`Pain points: ${(Array.isArray(c.painPoints) ? c.painPoints : [c.painPoints]).slice(0, 3).join(' | ')}`)
        if (c.buyingSignals?.length) parts.push(`Buying signals: ${c.buyingSignals.slice(0, 3).join(' | ')}`)
        if (c.redFlags?.length) parts.push(`Red flags: ${c.redFlags.slice(0, 2).join(' | ')}`)
        if (c.nextSteps?.length) parts.push(`Next steps from call: ${c.nextSteps.slice(0, 2).join(' | ')}`)
        if (c.commitments?.length) parts.push(`Rep commitments: ${c.commitments.slice(0, 2).join(' | ')}`)
        if (c.discoveryScore != null) parts.push(`Discovery score: ${c.discoveryScore}/10`)
        if (c.meddicc) {
          const gaps = Object.entries(c.meddicc).filter(([, v]) => !v || /unknown|not identified|not mentioned/i.test(v)).map(([k]) => k)
          if (gaps.length) parts.push(`MEDDIC gaps: ${gaps.join(', ')}`)
        }
        return parts.join('\n')
      }).join('\n\n---\n\n');
  }

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
    callsContext || null,
    roleInstructions || null,
    ``,
    `TODAY: ${today}`,
    ``,
    `Help the rep execute this task. Keep responses focused and concise.`,
  ].filter(Boolean).join('\n');

  // Trim conversation history to last 12 messages to keep costs low
  const trimmedMessages = messages.slice(-12).map(m => ({
    role: m.role === 'assistant' ? 'assistant' : 'user',
    content: String(m.content),
  }));

  const maxTokens = role === 'prepare-deck' ? 2000 : role === 'review-notes' ? 1500 : 1000;

  try {
    const reply = await callAnthropic(apiKey, {
      model: 'claude-sonnet-4-6',
      maxTokens,
      system: systemPrompt,
      messages: trimmedMessages,
    });

    return res.status(200).json({ success: true, message: reply });
  } catch (e) {
    console.error('[work-in-claude] Error:', e.message);
    return res.status(500).json({ error: e.message });
  }
}
