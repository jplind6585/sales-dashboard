export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { transcript } = req.body;

  if (!transcript || typeof transcript !== 'string') {
    return res.status(400).json({ error: 'Transcript is required' });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    return res.status(500).json({
      error: 'API key not configured. Set ANTHROPIC_API_KEY in your environment variables.'
    });
  }

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
        max_tokens: 4000,
        messages: [{
          role: 'user',
          content: `Analyze this sales call transcript and extract:

1. Current State (3-5 bullet points about their current situation/challenges)
2. Pain Points (specific problems mentioned, with direct quotes)
3. Requirements (what they need, categorized)
4. Information Gaps (what we still need to learn)

Transcript:
${transcript}`
        }]
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return res.status(response.status).json({
        error: errorData.error?.message || `Anthropic API error: ${response.status}`
      });
    }

    const data = await response.json();

    return res.status(200).json({
      content: data.content
    });
  } catch (error) {
    console.error('Error calling Anthropic API:', error);
    return res.status(500).json({
      error: 'Failed to process transcript'
    });
  }
}
