import { STAGES, MEDDICC } from '../../lib/constants';
import { createTasks } from '../../lib/db/tasks';
import { getSupabase, createServerSupabaseClient } from '../../lib/supabase';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { account } = req.body;

  if (!account) {
    return res.status(400).json({ error: 'Account data is required' });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    return res.status(500).json({ error: 'API key not configured' });
  }

  // Build context about the account
  const stage = STAGES.find(s => s.id === account.stage)?.label || 'Unknown';
  const stakeholders = account.stakeholders || [];
  const hasChampion = stakeholders.some(s => s.role === 'Champion');
  const hasEB = stakeholders.some(s => s.role === 'Economic Buyer');

  const gaps = account.informationGaps || [];
  const openGaps = gaps.filter(g => g.status !== 'resolved');
  const businessGaps = openGaps.filter(g => g.category !== 'sales').slice(0, 5);
  const salesGaps = openGaps.filter(g => g.category === 'sales').slice(0, 5);

  const transcripts = account.transcripts || [];
  const lastTranscript = transcripts[transcripts.length - 1];
  const daysSinceActivity = lastTranscript
    ? Math.floor((Date.now() - new Date(lastTranscript.addedAt)) / (1000 * 60 * 60 * 24))
    : null;

  const businessAreas = account.businessAreas || {};
  const areasWithData = Object.entries(businessAreas)
    .filter(([_, data]) => data?.currentState?.length > 0 || data?.opportunities?.length > 0)
    .length;

  const metrics = account.metrics || {};
  const hasKeyMetrics = Object.values(metrics).some(m => m?.value != null);

  const systemPrompt = `You are a sales coach for Banner, a CapEx management software company. Give the 2-3 HIGHEST-IMPACT next steps for advancing this deal — quality over quantity. If only one thing truly matters, return one.

Each action must be:
- Specific and executable by the rep (not "update MEDDICC" — the system does that; think: send X, call Y, book Z)
- The single most deal-advancing thing to do next

Format as a JSON array (max 3) of objects with:
- action: imperative, SHORT — under 80 characters, no preamble
- reason: ONE short sentence, under 140 characters — the so-what
- priority: "high", "medium", or "low"
- category: "meddicc", "discovery", "follow_up", or "content"`;

  const userPrompt = `Generate next actions for ${account.name || 'this prospect'}.

CURRENT STATE:
- Stage: ${stage}
- Days since last activity: ${daysSinceActivity !== null ? daysSinceActivity : 'No calls yet'}
- Champion identified: ${hasChampion ? 'Yes' : 'No'}
- Economic Buyer identified: ${hasEB ? 'Yes' : 'No'}
- Business areas explored: ${areasWithData}/16
- Key metrics captured: ${hasKeyMetrics ? 'Yes' : 'Limited'}

OPEN BUSINESS GAPS:
${businessGaps.length > 0 ? businessGaps.map(g => `- ${g.question}`).join('\n') : '- None identified'}

OPEN SALES/MEDDICC GAPS:
${salesGaps.length > 0 ? salesGaps.map(g => `- ${g.question}`).join('\n') : '- None identified'}

${lastTranscript ? `LAST CALL SUMMARY:\n${lastTranscript.summary || 'No summary available'}` : 'No calls recorded yet.'}

Give the 2-3 highest-impact next actions (max 3). Return ONLY valid JSON array.`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 1000,
        system: systemPrompt,
        messages: [{
          role: 'user',
          content: userPrompt
        }]
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return res.status(response.status).json({
        error: errorData.error?.message || `API error: ${response.status}`
      });
    }

    const data = await response.json();
    const rawText = data.content?.[0]?.text || '[]';

    let actions;
    try {
      let jsonText = rawText;
      if (rawText.includes('```json')) {
        jsonText = rawText.split('```json')[1].split('```')[0].trim();
      } else if (rawText.includes('```')) {
        jsonText = rawText.split('```')[1].split('```')[0].trim();
      }
      actions = JSON.parse(jsonText);
    } catch {
      actions = [];
    }

    // Write actions to the tasks table if Supabase is enabled
    if (process.env.NEXT_PUBLIC_USE_SUPABASE !== 'false' && actions.length > 0) {
      try {
        const auth = createServerSupabaseClient(req, res)
        const { data: { user } } = await auth.auth.getUser()

        if (user && account.id) {
          // Dedup on re-run: don't recreate an action that's already an open ai_suggestion for this account.
          const db = getSupabase()
          const { data: existing } = await db.from('tasks')
            .select('title').eq('account_id', account.id).eq('source', 'ai_suggestion')
            .is('dismissed_at', null).neq('status', 'complete')
          const have = new Set((existing || []).map(t => (t.title || '').toLowerCase().trim()))
          const priorityMap = { high: 1, medium: 2, low: 3 }
          const taskItems = actions.slice(0, 3)
            .filter(a => a.action && !have.has(a.action.toLowerCase().trim()))
            .map(a => ({
              title:       a.action.slice(0, 100),
              description: a.reason ? a.reason.slice(0, 160) : null,
              type:        'triggered',
              source:      'ai_suggestion',
              sourceId:    account.id,
              accountId:   account.id,
              ownerId:     user.id,
              priority:    priorityMap[a.priority] || 2,
            }))
          if (taskItems.length) await createTasks(user.id, taskItems)
        }
      } catch (taskErr) {
        // Non-fatal — log but don't block the response
        console.error('Failed to persist next actions as tasks:', taskErr)
      }
    }

    return res.status(200).json({
      success: true,
      actions
    });
  } catch (error) {
    console.error('Error generating next actions:', error);
    return res.status(500).json({
      error: 'Failed to generate next actions'
    });
  }
}
