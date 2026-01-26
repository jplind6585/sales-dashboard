export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { transcript, account } = req.body;

  if (!transcript) {
    return res.status(400).json({ error: 'Transcript is required' });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    return res.status(500).json({ error: 'API key not configured' });
  }

  const attendees = transcript.attendees || [];
  const nextSteps = transcript.rawAnalysis?.nextSteps || [];
  const summary = transcript.summary || '';

  const systemPrompt = `You are a sales professional at Banner, a CapEx management software company for multifamily real estate. Write professional, personalized follow-up emails after sales calls.

Guidelines:
- Keep emails concise but warm and professional
- Reference specific topics discussed in the call
- Include clear next steps with specific asks
- Use a confident but not pushy tone
- Sign off as "James" from Banner

Format the email with:
- Subject line (start with "Subject: ")
- Professional greeting
- Brief thank you for their time
- Key points discussed (2-3 bullets max)
- Clear next steps
- Professional sign-off`;

  const userPrompt = `Write a follow-up email for a ${transcript.callType || 'sales'} call with ${account?.name || 'the prospect'}.

Call Date: ${transcript.date}
Attendees: ${attendees.length > 0 ? attendees.join(', ') : 'Not specified'}

Call Summary:
${summary}

${nextSteps.length > 0 ? `Agreed Next Steps:\n${nextSteps.map(s => `- ${s}`).join('\n')}` : ''}

Write the follow-up email now.`;

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
        max_tokens: 1500,
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
    console.error('Error generating follow-up email:', error);
    return res.status(500).json({
      error: 'Failed to generate follow-up email'
    });
  }
}
