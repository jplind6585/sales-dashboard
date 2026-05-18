import { apiError, apiSuccess, logRequest, callAnthropic } from '../../../lib/apiUtils';
import { createServerSupabaseClient, getSupabase } from '../../../lib/supabase';

export default async function handler(req, res) {
  logRequest(req, 'tasks/debrief');
  if (req.method !== 'POST') return apiError(res, 405, 'POST only');

  const auth = createServerSupabaseClient(req, res);
  const { data: { user } } = await auth.auth.getUser();
  if (!user) return apiError(res, 401, 'Unauthorized');

  const { text } = req.body;
  if (!text || text.trim().length < 5) return apiError(res, 400, 'text required');

  const db = getSupabase();

  // Fetch user's accounts for fuzzy matching
  const { data: accounts } = await db
    .from('accounts')
    .select('id, name, stage, tier')
    .not('stage', 'in', '("closed_won","closed_lost")')
    .limit(200);

  const accountList = (accounts || []).map(a => `${a.name} (stage: ${a.stage}, tier: ${a.tier || 'active'})`).join('\n');

  const prompt = `You are a task parser for a sales rep. Extract ALL distinct tasks from the following text. The rep may mention account names, actions, deadlines, or just general priorities.

Available pipeline accounts:
${accountList || '(none loaded)'}

Text to parse:
"${text}"

Return a JSON array of tasks. For each task extract:
- title: short actionable task title (max 80 chars)
- description: optional extra context (null if none)
- accountName: the matched account name from the pipeline list above, or null if no match
- accountId: the account id if matched, or null
- priority: 1 (high), 2 (medium), or 3 (low) — infer from urgency language
- dueDate: ISO date string if mentioned (e.g. "Thursday" = next Thursday), or null

If the text mentions multiple things, return ALL of them as separate tasks.
Return ONLY valid JSON, no explanation. Example:
[{"title":"Review JSP proposal","description":null,"accountName":"JSP","accountId":"uuid-here","priority":2,"dueDate":null}]`;

  try {
    const content = await callAnthropic(process.env.ANTHROPIC_API_KEY, {
      model: 'claude-haiku-4-5-20251001',
      maxTokens: 1000,
      messages: [{ role: 'user', content: prompt }],
    }) || '[]';
    const jsonMatch = content.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return apiSuccess(res, { tasks: [] });

    let parsed = JSON.parse(jsonMatch[0]);

    // Fuzzy match account IDs if not already set
    const accountMap = {};
    (accounts || []).forEach(a => { accountMap[a.name.toLowerCase()] = a; });

    parsed = parsed.map(t => {
      if (!t.accountId && t.accountName) {
        const lower = t.accountName.toLowerCase();
        const match = (accounts || []).find(a =>
          a.name.toLowerCase().includes(lower) || lower.includes(a.name.toLowerCase())
        );
        if (match) {
          t.accountId = match.id;
          t.accountName = match.name;
        }
      }
      return t;
    });

    return apiSuccess(res, { tasks: parsed });
  } catch (e) {
    console.error('[debrief] error:', e.message);
    return apiError(res, 500, 'Failed to parse tasks');
  }
}
