// POST /api/accounts/cs-handover
// Generates a structured CS handover brief for a closed_won account.
// Synthesizes all analyzed calls, debrief data, stakeholders, and commitments.

import { apiError, apiSuccess, logRequest, validateAnthropicKey, callAnthropic, parseClaudeJson } from '../../../lib/apiUtils';
import { createServerSupabaseClient, getSupabase } from '../../../lib/supabase';

export default async function handler(req, res) {
  logRequest(req, 'accounts/cs-handover');
  if (req.method !== 'POST') return apiError(res, 405, 'POST only');

  const auth = createServerSupabaseClient(req, res);
  const { data: { user } } = await auth.auth.getUser();
  if (!user) return apiError(res, 401, 'Unauthorized');

  const apiKey = validateAnthropicKey(res);
  if (!apiKey) return;

  const { accountId } = req.body;
  if (!accountId) return apiError(res, 400, 'accountId required');

  const db = getSupabase();

  const [accountRes, callsRes, stakeholdersRes] = await Promise.all([
    db.from('accounts').select('*').eq('id', accountId).single(),
    db.from('gong_call_analyses')
      .select('call_date, duration_seconds, analysis')
      .eq('account_id', accountId)
      .not('analyzed_at', 'is', null)
      .order('call_date', { ascending: false })
      .limit(30),
    db.from('stakeholders').select('name, title, department, is_champion').eq('account_id', accountId),
  ]);

  const account = accountRes.data;
  if (!account) return apiError(res, 404, 'Account not found');

  const calls = callsRes.data || [];
  const stakeholders = stakeholdersRes.data || [];
  const debrief = account.debrief || {};

  // Aggregate commitments across all calls
  const allCommitments = [];
  const allNextSteps = [];
  const allMeddicc = {};
  const painPoints = new Set();

  for (const call of calls) {
    const a = call.analysis || {};
    if (a.commitments?.length) allCommitments.push(...a.commitments.map(c => `[${call.call_date?.split('T')[0] || ''}] ${c}`));
    if (a.next_steps_mentioned?.length) allNextSteps.push(...a.next_steps_mentioned.map(s => `[${call.call_date?.split('T')[0] || ''}] ${s}`));
    if (a.pain_points_identified?.length) a.pain_points_identified.forEach(p => painPoints.add(p));
    if (a.meddicc) {
      for (const [k, v] of Object.entries(a.meddicc)) {
        if (v && !allMeddicc[k]) allMeddicc[k] = v;
      }
    }
  }

  const prompt = `You are generating a CS (Customer Success) handover brief for a deal that was just closed.

ACCOUNT: ${account.name}
STAGE: closed_won

CHAMPION / KEY STAKEHOLDERS:
${stakeholders.map(s => `- ${s.name}, ${s.title || ''}${s.is_champion ? ' (CHAMPION)' : ''}`).join('\n') || 'None recorded'}

DEBRIEF NOTES:
- Why we won: ${debrief.primary_reason || 'Not captured'}
- Factors: ${(debrief.factors || []).join(', ') || 'None'}
- What we did well: ${debrief.what_went_well || 'Not captured'}
- CS notes from sales: ${debrief.notes || 'None'}

MEDDIC SUMMARY:
${Object.entries(allMeddicc).map(([k, v]) => `- ${k}: ${v}`).join('\n') || 'Not captured'}

KEY PAIN POINTS:
${[...painPoints].slice(0, 8).map(p => `- ${p}`).join('\n') || 'None captured'}

RECENT COMMITMENTS FROM CALLS (${allCommitments.length} total):
${allCommitments.slice(0, 15).join('\n') || 'None recorded'}

RECENT NEXT STEPS FROM CALLS:
${allNextSteps.slice(0, 10).join('\n') || 'None recorded'}

TOTAL ANALYZED CALLS: ${calls.length}

Generate a structured CS handover brief. Return JSON with exactly these fields:
{
  "what_was_sold": "2-3 sentences: what Banner product/capability they bought and the core use case",
  "key_contacts": ["Name, Title — relationship note (e.g. Sarah Lee, VP Finance — primary champion, very engaged)"],
  "integrations_promised": ["specific integration or commitment promised during the sales process"],
  "implementation_timeline": "expected timeline based on calls and commitments, or 'Not discussed' if absent",
  "known_risks": ["specific risk or watch-out for CS to be aware of (e.g. budget sensitivity, IT resistance, competing priorities)"],
  "open_questions": ["question that needs answering before or during onboarding"],
  "tone_notes": "1-2 sentences on relationship tone, communication style, and any key relationship context CS should know"
}

Be specific and actionable. Pull from actual call data. Do not invent details not supported by the data.`

  try {
    const text = await callAnthropic(apiKey, {
      model: 'claude-sonnet-4-6',
      maxTokens: 1500,
      messages: [{ role: 'user', content: prompt }],
    });

    const brief = parseClaudeJson(text);
    if (!brief) return apiError(res, 500, 'Failed to parse handover brief');

    return apiSuccess(res, {
      brief: {
        ...brief,
        callCount: calls.length,
        generatedAt: new Date().toISOString(),
      },
    });
  } catch (err) {
    console.error('[cs-handover] Error:', err.message);
    return apiError(res, 500, err.message);
  }
}
