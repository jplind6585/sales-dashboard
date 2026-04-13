import { STAGES, VERTICALS } from '../../lib/constants'

/**
 * POST /api/generate-demo-brief
 *
 * Generates a tailored demo prep brief for a specific account using Claude.
 * Takes the full account context and returns a structured brief covering:
 * - Pain points and business drivers
 * - Stakeholder map and concerns
 * - What to demonstrate and emphasize
 * - Questions to answer / validate in the demo
 * - Open gaps to address
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { account } = req.body
  if (!account) return res.status(400).json({ error: 'Account data required' })

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return res.status(500).json({ error: 'API key not configured' })

  // Build context strings
  const stage = STAGES.find(s => s.id === account.stage)?.label || account.stage
  const vertical = VERTICALS.find(v => v.id === account.vertical)?.label || account.vertical || 'Unknown'

  const stakeholders = (account.stakeholders || []).map(s =>
    `- ${s.name}${s.title ? ` (${s.title})` : ''}${s.department ? ` — ${s.department}` : ''}: ${s.role || 'Unknown role'}`
  ).join('\n') || 'None identified'

  const openGaps = (account.informationGaps || [])
    .filter(g => g.status !== 'resolved')
    .slice(0, 8)
    .map(g => `- ${g.question}`)
    .join('\n') || 'None'

  const recentTranscripts = (account.transcripts || [])
    .slice(-3)
    .map(t => {
      const summary = t.summary ? `Summary: ${t.summary}` : 'No summary'
      const date = t.date ? new Date(t.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : ''
      return `[${date}] ${summary}`
    })
    .join('\n\n') || 'No calls recorded'

  const businessAreas = Object.entries(account.businessAreas || {})
    .filter(([_, d]) => d?.currentState?.length > 0 || d?.opportunities?.length > 0)
    .map(([area, d]) => {
      const parts = []
      if (d.currentState) parts.push(`Current: ${d.currentState}`)
      if (d.opportunities) parts.push(`Opportunity: ${d.opportunities}`)
      return `${area}: ${parts.join(' | ')}`
    })
    .slice(0, 6)
    .join('\n') || 'No business areas documented'

  const metrics = Object.entries(account.metrics || {})
    .filter(([_, m]) => m?.value != null)
    .map(([_, m]) => `${m.label || 'metric'}: ${m.value} ${m.unit || ''}`)
    .join(', ') || 'Not yet captured'

  const systemPrompt = `You are a senior sales coach at Banner, a CapEx management software company for commercial real estate.
Your job is to help sales reps run compelling, personalized product demos.
Generate a structured demo prep brief that is specific to this prospect's situation, not generic.
Be direct and concise — the rep will read this 10 minutes before the call.`

  const userPrompt = `Generate a demo prep brief for ${account.name || 'this account'}.

COMPANY PROFILE:
- Vertical: ${vertical}
- Stage: ${stage}
- Key metrics: ${metrics}

STAKEHOLDERS IN THE ROOM:
${stakeholders}

BUSINESS AREAS EXPLORED:
${businessAreas}

OPEN INFORMATION GAPS:
${openGaps}

RECENT CALL CONTEXT:
${recentTranscripts}

Return a JSON object with these exact keys:
{
  "talkingPoints": ["2-4 specific pain points to lead with, based on what we know about them"],
  "demoFlow": ["ordered list of 4-6 Banner features/modules to show, with 1-line context for each"],
  "stakeholderTips": [{"name": "...", "concern": "...", "tip": "..."}],
  "questionsToAsk": ["3-5 discovery questions to validate or fill gaps during the demo"],
  "openGapsToAddress": ["gaps from the list above that the demo should help answer"],
  "redFlags": ["any risks or concerns to be aware of going into this demo"]
}

Return ONLY valid JSON.`

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1500,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
      }),
    })

    if (!response.ok) {
      const err = await response.json().catch(() => ({}))
      return res.status(response.status).json({ error: err.error?.message || `API error: ${response.status}` })
    }

    const data = await response.json()
    const rawText = data.content?.[0]?.text || '{}'

    let brief
    try {
      let jsonText = rawText
      if (rawText.includes('```json')) jsonText = rawText.split('```json')[1].split('```')[0].trim()
      else if (rawText.includes('```')) jsonText = rawText.split('```')[1].split('```')[0].trim()
      brief = JSON.parse(jsonText)
    } catch {
      brief = { error: 'Could not parse response', raw: rawText }
    }

    return res.status(200).json({ success: true, brief })
  } catch (err) {
    console.error('Demo brief error:', err)
    return res.status(500).json({ error: 'Failed to generate demo brief' })
  }
}
