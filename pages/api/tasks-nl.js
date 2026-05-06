// POST /api/tasks-nl
// { text: "Send the deck to Hope at LTC tomorrow" }
// → { title, description, priority, dueDate, type, source_type }
//
// Parses natural language into structured task fields via Haiku.
// Client shows a preview card that the user confirms before creating.

import { createServerSupabaseClient } from '../../lib/supabase';
import { callAnthropic, parseClaudeJson, logRequest } from '../../lib/apiUtils';

export default async function handler(req, res) {
  logRequest(req, 'tasks-nl');
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const authClient = createServerSupabaseClient(req, res);
  const { data: { user } } = await authClient.auth.getUser();
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'ANTHROPIC_API_KEY not configured' });

  const { text } = req.body || {};
  if (!text?.trim()) return res.status(400).json({ error: 'text required' });

  const today = new Date().toISOString().split('T')[0];
  const todayDisplay = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

  const prompt = `You are a task parser for a sales platform. Parse the following natural language task description into structured fields.

Today is ${todayDisplay} (${today}).

INPUT: "${text.trim()}"

Rules:
- title: clean, action-oriented title (max 100 chars). Start with a verb. Remove filler words.
- description: any useful context not captured in title (null if nothing to add)
- priority: 1=high (urgent/blocking), 2=medium (default), 3=low (someday)
- dueDate: ISO date string (YYYY-MM-DD) or null. "tomorrow" = ${new Date(Date.now() + 86400000).toISOString().split('T')[0]}, "this week" = ${new Date(Date.now() + 4 * 86400000).toISOString().split('T')[0]}, "next week" = ${new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0]}. "EOD" counts as the date mentioned.
- type: "triggered" (sales action/follow-up), "assigned" (someone gave you work), "project" (multi-step initiative), "recurring" (repeating task)
- rationale: one sentence on why this matters (null if not obvious from context)

Return ONLY valid JSON:
{
  "title": "...",
  "description": null,
  "priority": 2,
  "dueDate": null,
  "type": "triggered",
  "rationale": null
}`;

  try {
    const raw = await callAnthropic(apiKey, {
      model: 'claude-haiku-4-5-20251001',
      maxTokens: 400,
      messages: [{ role: 'user', content: prompt }],
    });

    const parsed = parseClaudeJson(raw, {
      title: text.trim().slice(0, 100),
      description: null,
      priority: 2,
      dueDate: null,
      type: 'triggered',
      rationale: null,
    });

    return res.status(200).json({ success: true, task: parsed });
  } catch (e) {
    console.error('[tasks-nl] Error:', e.message);
    return res.status(500).json({ error: e.message });
  }
}
