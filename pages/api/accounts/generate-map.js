// POST /api/accounts/generate-map
// Generates a Mutual Action Plan for demo/solution_validation stage accounts.
// Uses account context + call data + stakeholders to build a realistic MAP.

import Anthropic from '@anthropic-ai/sdk';
import { apiError, apiSuccess, logRequest } from '../../../lib/apiUtils';
import { createServerSupabaseClient, getSupabase } from '../../../lib/supabase';

const client = new Anthropic();

export default async function handler(req, res) {
  logRequest(req, 'accounts/generate-map');
  if (req.method !== 'POST') return apiError(res, 405, 'POST only');

  const auth = createServerSupabaseClient(req, res);
  const { data: { user } } = await auth.auth.getUser();
  if (!user) return apiError(res, 401, 'Unauthorized');

  const { accountId } = req.body;
  if (!accountId) return apiError(res, 400, 'accountId required');

  const db = getSupabase();

  const [accountRes, callsRes, stakeholdersRes] = await Promise.all([
    db.from('accounts').select('*').eq('id', accountId).single(),
    db.from('gong_call_analyses')
      .select('call_date, analysis')
      .eq('account_id', accountId)
      .not('analyzed_at', 'is', null)
      .order('call_date', { ascending: false })
      .limit(10),
    db.from('stakeholders').select('name, title, department, is_champion').eq('account_id', accountId),
  ]);

  const account = accountRes.data;
  if (!account) return apiError(res, 404, 'Account not found');

  const calls = callsRes.data || [];
  const stakeholders = stakeholdersRes.data || [];

  // Aggregate MEDDICC and pain points from calls
  const allMeddicc = {};
  const painPoints = [];
  const nextSteps = [];
  const commitments = [];

  for (const call of calls) {
    const a = call.analysis || {};
    if (a.meddicc) {
      for (const [k, v] of Object.entries(a.meddicc)) {
        if (v && !allMeddicc[k]) allMeddicc[k] = v;
      }
    }
    if (a.pain_points_identified?.length) painPoints.push(...a.pain_points_identified.slice(0, 3));
    if (a.next_steps_mentioned?.length) nextSteps.push(...a.next_steps_mentioned.slice(0, 3));
    if (a.commitments?.length) commitments.push(...a.commitments.slice(0, 3));
  }

  const stageLabel = (account.stage || '').replace(/_/g, ' ');

  const prompt = `You are a VP of Sales at a B2B SaaS company. Generate a Mutual Action Plan (MAP) for this deal.

ACCOUNT: ${account.name}
STAGE: ${stageLabel}
VERTICAL: ${account.vertical || 'Unknown'}

KEY STAKEHOLDERS:
${stakeholders.length > 0
  ? stakeholders.map(s => `- ${s.name}, ${s.title || 'Unknown title'}${s.is_champion ? ' (CHAMPION)' : ''}`).join('\n')
  : 'None recorded yet'}

MEDDIC (from calls):
${Object.entries(allMeddicc).map(([k, v]) => `- ${k}: ${v}`).join('\n') || 'Not captured yet'}

PAIN POINTS IDENTIFIED:
${[...new Set(painPoints)].slice(0, 6).map(p => `- ${p}`).join('\n') || 'None captured yet'}

OPEN NEXT STEPS:
${[...new Set(nextSteps)].slice(0, 5).map(s => `- ${s}`).join('\n') || 'None'}

Build a realistic, specific Mutual Action Plan. Each milestone should have a clear owner (either "Banner" or "Prospect" or both) and a realistic due date offset in business days from today.

Return JSON:
{
  "title": "Mutual Action Plan — [Account Name]",
  "goal": "1 sentence: what success looks like for both sides",
  "target_close": "realistic close date as a relative expression like '4 weeks' or '6 weeks'",
  "milestones": [
    {
      "week": "Week 1",
      "actions": [
        {
          "action": "specific action description",
          "owner": "Banner" | "Prospect" | "Both",
          "due_offset_days": 3,
          "critical": true | false
        }
      ]
    }
  ],
  "success_criteria": ["specific criteria that define a successful outcome"],
  "risks": ["potential risks that could delay this timeline"]
}

Use 3-5 weeks of milestones. Be specific and actionable based on the actual deal context.`

  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 2000,
      messages: [{ role: 'user', content: prompt }],
    });

    const text = response.content[0].text;
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return apiError(res, 500, 'Failed to parse MAP');

    const map = JSON.parse(match[0]);

    // Save to accounts.map_data
    await db.from('accounts').update({ map_data: { ...map, generated_at: new Date().toISOString() } }).eq('id', accountId);

    return apiSuccess(res, { map: { ...map, generated_at: new Date().toISOString() } });
  } catch (err) {
    console.error('[generate-map] Error:', err.message);
    return apiError(res, 500, err.message);
  }
}
