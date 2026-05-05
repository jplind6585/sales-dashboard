import {
  apiError,
  apiSuccess,
  validateMethod,
  validateAnthropicKey,
  callAnthropic,
  parseClaudeJson,
  logRequest,
} from '../../../lib/apiUtils';
import { createServerSupabaseClient } from '../../../lib/supabase';

export default async function handler(req, res) {
  logRequest(req, 'gong/intel-reengagement');
  if (!validateMethod(req, res, 'POST')) return;

  const apiKey = validateAnthropicKey(res);
  if (!apiKey) return;

  const { callId } = req.body || {};
  if (!callId) return apiError(res, 400, 'callId is required');

  const db = createServerSupabaseClient(req, res);
  const { data: row, error } = await db
    .from('gong_call_analyses')
    .select('*')
    .eq('gong_call_id', callId)
    .single();

  if (error || !row) return apiError(res, 404, 'Call analysis not found');

  const analysis = row.analysis || {};
  const daysSince = row.call_date
    ? Math.round((Date.now() - new Date(row.call_date)) / (1000 * 60 * 60 * 24))
    : null;

  const topThemes = (analysis.buyer_priorities || analysis.themes || [])
    .slice(0, 3)
    .map(t => (typeof t === 'string' ? t : t.priority || t.theme))
    .filter(Boolean)
    .join(', ');

  const topObjections = (analysis.objections || [])
    .slice(0, 2)
    .map(o => o.text)
    .join('; ');

  const prompt = `You are writing a re-engagement email for a Banner sales rep. Banner sells CapEx management software to commercial real estate companies.

Context:
- Prospect: from call titled "${row.title}"
- Rep: ${row.rep_name || 'Unknown'}
- Call type: ${row.call_type || 'sales call'}
- Days since call: ${daysSince ?? 'unknown'}
- Call summary: ${analysis.summary || 'not available'}
- What they cared about: ${topThemes || 'not noted'}
- Objections raised: ${topObjections || 'none noted'}
- Buying signals: ${(analysis.buying_signals || []).slice(0, 2).join('; ') || 'none noted'}
- ICP fit: ${analysis.icp_score ? `${analysis.icp_score}/10 — ${analysis.icp_rationale || ''}` : 'not scored'}

Write a brief, human re-engagement email. Rules:
- Not salesy — sounds like a colleague checking in, not a sales pitch
- Acknowledge time has passed naturally
- Tie back to the most specific thing they said mattered to them
- Offer one concrete next step (a reference customer intro, a 20-min focused follow-up, an ROI exercise on their specific numbers)
- Under 100 words in the body
- Subject line under 8 words

Return ONLY valid JSON:
{
  "subject": "email subject line",
  "body": "email body — plain text, no markdown, conversational tone, sign off as [Rep name]",
  "suggested_content": "one sentence on what asset (case study, ROI model, reference customer) would resonate most for this specific prospect based on what they said"
}`;

  const raw = await callAnthropic(apiKey, {
    model: 'claude-haiku-4-5-20251001',
    maxTokens: 600,
    messages: [{ role: 'user', content: prompt }],
  });

  const email = parseClaudeJson(raw, {
    subject: 'Checking in',
    body: `Hi,\n\nJust wanted to follow up from our conversation a few weeks ago. Would love to reconnect and see if anything has changed.\n\nHappy to find 20 minutes whenever works for you.\n\n${row.rep_name || 'The Banner team'}`,
    suggested_content: null,
  });

  return apiSuccess(res, { email, callId, rep: row.rep_name, title: row.title });
}
