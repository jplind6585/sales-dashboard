// Summarizes a chat conversation into 2-3 key account insights using Haiku.
// POST { messages: [{role, content}] }

import { createServerSupabaseClient } from '../../../../lib/supabase'
import { apiError, callAnthropic, validateAnthropicKey, parseClaudeJson } from '../../../../lib/apiUtils'

export default async function handler(req, res) {
  if (req.method !== 'POST') return apiError(res, 405, 'POST only')

  const auth = createServerSupabaseClient(req, res)
  const { data: { user } } = await auth.auth.getUser()
  if (!user) return apiError(res, 401, 'Unauthorized')

  const apiKey = validateAnthropicKey(res)
  if (!apiKey) return

  const { messages } = req.body || {}
  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return apiError(res, 400, 'messages array required')
  }

  const conversationText = messages
    .map(m => `${m.role === 'user' ? 'Rep' : 'AI'}: ${m.content}`)
    .join('\n')

  try {
    const raw = await callAnthropic(apiKey, {
      model: 'claude-haiku-4-5-20251001',
      maxTokens: 300,
      messages: [
        {
          role: 'user',
          content: `Summarize this sales conversation into 2-3 key insights or decisions about this deal. Each insight should be 1 sentence, concrete and specific. Return a JSON array of strings, no other text.\n\n${conversationText}`,
        },
      ],
    })

    const bullets = parseClaudeJson(raw, [])
    if (!Array.isArray(bullets)) return apiError(res, 500, 'Failed to parse insight array')

    return res.status(200).json({ success: true, bullets })
  } catch (err) {
    console.error('[memory-summarize] Claude error:', err)
    return apiError(res, 500, err.message || 'AI call failed')
  }
}
