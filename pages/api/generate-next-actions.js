import { STAGES, MEDDICC } from '../../lib/constants';

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

  const systemPrompt = `You are a sales coach for Banner, a CapEx management software company. Generate 3-5 specific, actionable next steps for advancing this deal.

Each action should be:
- Specific and actionable (not vague)
- Prioritized by impact on deal progression
- Include the "why" - what will this accomplish

Format as a JSON array of objects with:
- action: The specific action to take (imperative verb)
- reason: Why this matters for the deal
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

Generate 3-5 prioritized next actions. Return ONLY valid JSON array.`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
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
