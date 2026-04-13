/**
 * POST /api/tasks/complete-assist
 *
 * AI assistant that helps a rep complete a task by:
 * 1. Generating a first draft of the deliverable (email, bullet points, etc.)
 * 2. Asking clarifying questions to refine it
 * 3. Iterating based on user responses
 *
 * Body: {
 *   task: { title, description, type },
 *   messages: [{ role: 'user'|'assistant', content: string }]
 * }
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { task, messages = [] } = req.body
  if (!task?.title) return res.status(400).json({ error: 'task.title required' })

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return res.status(500).json({ error: 'ANTHROPIC_API_KEY not configured' })

  // Detect task type to guide the output format
  const title = task.title.toLowerCase()
  let outputType = 'action_plan'
  if (/\bemail\b|send.*to|reach out|follow.?up/.test(title)) outputType = 'email'
  else if (/\bcreate\b|\bwrite\b|\bdraft\b|\bbuild\b|\bdesign\b/.test(title)) outputType = 'document'
  else if (/\bcall\b|\bphone\b|\bmeeting\b|\bprep\b/.test(title)) outputType = 'call_prep'
  else if (/\breview\b|\banalyze\b|\bcheck\b/.test(title)) outputType = 'review_notes'

  const outputInstructions = {
    email: 'Write a professional, concise email draft. Use placeholders like [their name] where needed. After the draft, ask 2-3 specific questions to personalize it (e.g., tone, key message, prior context).',
    document: 'Create a structured outline or bullet-point breakdown. After the outline, ask 2-3 questions to sharpen it (e.g., audience, depth needed, key constraints).',
    call_prep: 'Create a call prep sheet: goal of the call, 3-5 questions to ask, key points to make, objection handling. Then ask 2-3 clarifying questions about the call context.',
    action_plan: 'Create a clear action plan with specific steps. Then ask 2-3 questions to make it more specific to the situation.',
    review_notes: 'Create a structured review framework or checklist. Then ask 2-3 questions about what to focus on.',
  }

  const systemPrompt = `You are an AI work assistant helping a B2B sales rep at Banner (a CapEx management software company for commercial real estate).

Your job is to help them actually complete their tasks — not just plan them.

When given a task:
- Generate a ready-to-use first draft (email, document, bullet points, call prep — whatever fits)
- Be specific and professional, not generic
- After your draft, ask 2-3 sharp clarifying questions to improve it
- When the user answers, refine the output based on their answers
- Keep responses focused and actionable

${outputInstructions[outputType]}

Format: use markdown. Lead with the draft, then separate your questions clearly with "---" and a "**To refine this, I need to know:**" heading.

If the user says "looks good" or "done" or "mark complete", just confirm and say they're all set.`

  const isFirstMessage = messages.length === 0

  const conversationMessages = isFirstMessage
    ? [{ role: 'user', content: `Task: ${task.title}${task.description ? `\n\nContext: ${task.description}` : ''}` }]
    : messages

  try {
    const res2 = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 1200,
        system: systemPrompt,
        messages: conversationMessages,
      }),
    })

    const data = await res2.json()
    const reply = data.content?.[0]?.text || 'Sorry, something went wrong. Please try again.'

    return res.status(200).json({ reply })
  } catch (err) {
    console.error('Complete assist error:', err)
    return res.status(500).json({ error: err.message })
  }
}
