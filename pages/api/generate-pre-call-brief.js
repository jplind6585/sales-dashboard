// POST /api/generate-pre-call-brief
// {accountId}
// Generates a pre-call brief for an account using recent transcripts,
// open tasks, and stakeholders. Returns a structured brief the rep can
// review before their next call.

import { apiError, apiSuccess, logRequest, callAnthropic, parseClaudeJson, validateAnthropicKey } from '../../lib/apiUtils';
import { createServerSupabaseClient, getSupabase } from '../../lib/supabase';

export default async function handler(req, res) {
  logRequest(req, 'generate-pre-call-brief');
  if (req.method !== 'POST') return apiError(res, 405, 'Method not allowed');

  const authClient = createServerSupabaseClient(req, res);
  const { data: { user } } = await authClient.auth.getUser();
  if (!user) return apiError(res, 401, 'Unauthorized');

  const { accountId } = req.body || {};
  if (!accountId) return apiError(res, 400, 'accountId required');

  const apiKey = validateAnthropicKey(res);
  if (!apiKey) return;

  const db = getSupabase();

  // Fetch account, recent transcripts, open tasks, and stakeholders in parallel
  const [accountRes, transcriptRes, taskRes, stakeholderRes] = await Promise.all([
    db.from('accounts').select('id, name, stage, vertical').eq('id', accountId).single(),
    db.from('transcripts').select('id, date, call_type, summary, raw_analysis, attendees').eq('account_id', accountId).order('date', { ascending: false }).limit(3),
    db.from('tasks').select('id, title, description, status, priority').eq('account_id', accountId).in('status', ['open', 'in_progress']).order('priority', { ascending: true }).limit(10),
    db.from('stakeholders').select('id, name, role, title, notes').eq('account_id', accountId),
  ]);

  const account = accountRes.data;
  if (!account) return apiError(res, 404, 'Account not found');

  const transcripts = transcriptRes.data || [];
  const tasks = taskRes.data || [];
  const stakeholders = stakeholderRes.data || [];

  const transcriptSummaries = transcripts.map((t, i) => {
    const analysis = t.raw_analysis || {};
    return {
      date: t.date ? new Date(t.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Unknown',
      callType: t.call_type,
      summary: t.summary || '(no summary)',
      nextSteps: analysis.next_steps_mentioned || analysis.nextSteps || [],
      objections: (analysis.objections || []).map(o => o.text),
      sentiment: analysis.sentiment || null,
      disqualificationSignal: analysis.disqualification_signal || false,
      disqualificationNotes: analysis.disqualification_notes || null,
    };
  });

  const openTasks = tasks.map(t => ({
    title: t.title,
    description: t.description,
    priority: t.priority === 1 ? 'high' : t.priority === 2 ? 'medium' : 'low',
    status: t.status,
  }));

  const stakeholderList = stakeholders.map(s => `${s.name}${s.title ? ` (${s.title})` : ''} — ${s.role}`).join('\n');

  const prompt = `Generate a pre-call brief for a sales rep at Banner (CapEx management software for commercial real estate) about to call ${account.name}.

Account: ${account.name}
Stage: ${account.stage?.replace(/_/g, ' ') || 'Unknown'}
Vertical: ${account.vertical || 'Unknown'}

Last ${transcriptSummaries.length} call${transcriptSummaries.length !== 1 ? 's' : ''}:
${JSON.stringify(transcriptSummaries, null, 2)}

Open tasks:
${openTasks.length ? JSON.stringify(openTasks, null, 2) : 'None'}

Key stakeholders:
${stakeholderList || 'None recorded'}

Return ONLY valid JSON:
{
  "objective": "One crisp sentence — the primary goal for this call based on where the deal is and what's been discussed",
  "key_context": ["Most important context points the rep needs to remember — what happened last time, commitments made, what they care about"],
  "biggest_risk": "The single most important concern or risk to address — could be an objection, a stalled next step, or a disqualification signal",
  "questions_to_ask": ["3-4 specific questions that would advance this deal based on what's missing or unresolved"],
  "open_tasks": ["Tasks the rep should mention or complete on this call"],
  "call_focus": "One sentence: the single thing the rep should walk away having accomplished on this call",
  "tone_note": "Brief note on how to approach the call based on recent sentiment and any soft-close signals"
}`;

  const rawBrief = await callAnthropic(apiKey, {
    model: 'claude-sonnet-4-6',
    maxTokens: 1500,
    messages: [{ role: 'user', content: prompt }],
  });

  const brief = parseClaudeJson(rawBrief, {
    objective: 'Review deal status and confirm next steps',
    key_context: [],
    biggest_risk: null,
    questions_to_ask: [],
    open_tasks: [],
    call_focus: 'Advance the deal',
    tone_note: null,
  });

  return apiSuccess(res, {
    brief,
    accountName: account.name,
    stage: account.stage,
    transcriptCount: transcripts.length,
    lastCallDate: transcripts[0]?.date || null,
  });
}
