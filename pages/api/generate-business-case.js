import { BUSINESS_AREAS } from '../../lib/constants';
import { BANNER_SOLUTIONS } from '../../lib/bannerSolutions';

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

  // Build detailed context for each business area
  const businessAreasForPrompt = BUSINESS_AREAS.map(area => {
    const data = account.businessAreas?.[area.id] || {};
    const solutions = BANNER_SOLUTIONS[area.id] || [];

    return {
      id: area.id,
      label: area.label,
      description: area.description,
      currentState: data.currentState || [],
      opportunities: data.opportunities || [],
      quotes: data.quotes || [],
      bannerSolutions: solutions,
      hasData: (data.currentState?.length > 0 || data.opportunities?.length > 0),
      irrelevant: data.irrelevant || false
    };
  });

  const areasWithData = businessAreasForPrompt.filter(a => a.hasData && !a.irrelevant);
  const areasWithoutData = businessAreasForPrompt.filter(a => !a.hasData && !a.irrelevant);

  const stakeholders = (account.stakeholders || [])
    .map(s => `${s.name} (${s.title || 'Unknown'}) - ${s.role}`)
    .join('\n');

  const metrics = Object.entries(account.metrics || {})
    .filter(([_, data]) => data?.value)
    .map(([key, data]) => `${key.replace(/_/g, ' ')}: ${data.value}`)
    .join('\n');

  const systemPrompt = `You are creating a CapEx Process Evaluation document for Banner, a CapEx management software company for multifamily real estate.

Your output should follow this exact structure (similar to the Greystar evaluation deck):

1. EXECUTIVE SUMMARY (2-3 paragraphs)
   - Brief overview of the company and their CapEx challenges
   - Key findings from discovery calls
   - High-level opportunity areas

2. STAKEHOLDER DISCOVERY
   - List key stakeholders by department/role

3. CURRENT PROCESS EVALUATION
   For EACH business area with data, create a section with:
   - Process Name (e.g., "Budgeting", "Project Tracking")
   - Current State: Bullet points describing their current workflow
   - Observed Opportunities: Bullet points describing pain points and areas for improvement

4. POTENTIAL PROCESS WITH BANNER
   For EACH business area, show:
   - Process Name
   - Current State (brief summary)
   - Banner Process: How Banner would improve this (use the provided Banner solutions)

Format as clean markdown with clear headers and bullet points. Be specific and detailed based on the data provided. If limited data exists for an area, note that more discovery is needed.`;

  const userPrompt = `Create a CapEx Process Evaluation for ${account.name}.

STAKEHOLDERS:
${stakeholders || 'No stakeholders identified yet'}

KEY METRICS:
${metrics || 'No metrics captured yet'}

BUSINESS AREAS WITH DATA:
${areasWithData.map(area => `
### ${area.label}
Current State:
${area.currentState.length > 0 ? area.currentState.map(s => `- ${s}`).join('\n') : '- No data captured'}

Opportunities:
${area.opportunities.length > 0 ? area.opportunities.map(s => `- ${s}`).join('\n') : '- No opportunities identified'}

Quotes:
${area.quotes.length > 0 ? area.quotes.map(q => `> "${q}"`).join('\n') : '- No direct quotes'}

Banner Solutions for this area:
${area.bannerSolutions.map(s => `- ${s}`).join('\n')}
`).join('\n')}

BUSINESS AREAS NEEDING MORE DISCOVERY:
${areasWithoutData.map(a => `- ${a.label}: ${a.description}`).join('\n')}

Generate the evaluation document now. Make it professional, specific, and actionable.`;

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
        max_tokens: 8000,
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
    console.error('Error generating business case:', error);
    return res.status(500).json({
      error: 'Failed to generate business case'
    });
  }
}
