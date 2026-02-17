export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { transcript, account } = req.body;

  if (!transcript || !account) {
    return res.status(400).json({ error: 'Transcript and account are required' });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    return res.status(500).json({ error: 'API key not configured' });
  }

  // Gather context about gaps and MEDDICC status
  const gaps = account.informationGaps || [];
  const openGaps = gaps.filter(g => g.status !== 'resolved');
  const businessGaps = openGaps.filter(g => g.category !== 'sales');
  const salesGaps = openGaps.filter(g => g.category === 'sales');

  const stakeholders = account.stakeholders || [];
  const hasChampion = stakeholders.some(s => s.role === 'Champion');
  const hasEconomicBuyer = stakeholders.some(s => s.role === 'Economic Buyer');

  const metrics = account.metrics || {};
  const hasMetrics = Object.values(metrics).some(m => m?.value != null);

  // Determine next call type based on previous call
  const callTypeProgression = {
    'intro': 'discovery',
    'discovery': 'demo',
    'demo': 'pricing',
    'pricing': 'negotiation',
    'negotiation': 'follow_up',
    'follow_up': 'follow_up',
    'other': 'discovery'
  };
  const suggestedNextType = callTypeProgression[transcript.callType] || 'discovery';

  const systemPrompt = `You are a sales professional at Banner, a CapEx management software company for multifamily real estate. Create meeting agendas that advance deals while gathering critical missing information.

Guidelines:
- Structure the agenda to advance the sale to the next stage
- Include time allocations for each section
- Work in questions to fill information gaps naturally
- Focus on value and outcomes, not features
- Include clear objectives and desired outcomes
- End with concrete next steps

MEDDICC Framework (identify what's missing and work it in):
- Metrics: Quantifiable measures of success
- Economic Buyer: Person with budget authority
- Decision Criteria: How they'll evaluate solutions
- Decision Process: Steps to make a purchase decision
- Identify Pain: Business problems and consequences
- Champion: Internal advocate for your solution
- Competition: Other solutions being evaluated`;

  const userPrompt = `Create an agenda for the next meeting with ${account.name}.

Previous Call: ${transcript.callType || 'sales'} call on ${transcript.date}
Suggested Next Call Type: ${suggestedNextType}

Previous Call Summary:
${transcript.summary}

${transcript.rawAnalysis?.nextSteps?.length > 0 ? `Agreed Next Steps from Last Call:\n${transcript.rawAnalysis.nextSteps.map(s => `- ${s}`).join('\n')}\n` : ''}

CURRENT DEAL STATUS:
- Champion identified: ${hasChampion ? 'Yes' : 'NO - Need to identify'}
- Economic Buyer identified: ${hasEconomicBuyer ? 'Yes' : 'NO - Need to identify'}
- Key metrics captured: ${hasMetrics ? 'Yes' : 'NO - Need to gather'}

${businessGaps.length > 0 ? `BUSINESS PROCESS GAPS (work these into the conversation):\n${businessGaps.slice(0, 5).map(g => `- ${g.question}`).join('\n')}\n` : ''}

${salesGaps.length > 0 ? `SALES/MEDDICC GAPS (must address):\n${salesGaps.slice(0, 5).map(g => `- ${g.question}`).join('\n')}\n` : ''}

Create a meeting agenda that advances this deal while addressing the gaps above. Include specific questions to ask.`;

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
        max_tokens: 2000,
        temperature: 0, // Deterministic output for consistency
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
    const content = data.content?.[0]?.text || '';

    return res.status(200).json({
      success: true,
      content
    });
  } catch (error) {
    console.error('Error generating agenda:', error);
    return res.status(500).json({
      error: 'Failed to generate meeting agenda'
    });
  }
}
