import { createServerSupabaseClient } from '../../../lib/supabase'
import { getChannelMessages } from '../../../lib/slack'
import { callAnthropic, validateAnthropicKey, parseClaudeJson } from '../../../lib/apiUtils'

const SEVEN_DAYS_AGO_S = () => (Date.now() / 1000) - 7 * 24 * 60 * 60

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const supabase = createServerSupabaseClient(req, res)
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return res.status(401).json({ error: 'Unauthorized' })

  const apiKey = validateAnthropicKey(res)
  if (!apiKey) return

  const messages = await getChannelMessages('sales_operations', 50)

  const cutoff = SEVEN_DAYS_AGO_S()
  const recent = messages.filter(m => parseFloat(m.ts) >= cutoff && !m.isBot && m.text?.trim())

  if (recent.length === 0) {
    return res.status(200).json({ bookings: [] })
  }

  const numbered = recent
    .map((m, i) => `[${i + 1}] ts:${m.ts} user:${m.userName}\n${m.text}`)
    .join('\n\n')

  const prompt = `Parse these Slack messages from a sales ops channel. Each booking message has an SDR name, action (Intro booked, Demo booked, Rebooked, Canceled), account name, contact info, context bullets, and AE owner + date/time. Return a JSON array of parsed bookings. If a message is not a booking, skip it.

Return ONLY a JSON array. Each element:
{
  "sdrName": string,
  "action": string,
  "accountName": string,
  "contactName": string,
  "contactTitle": string,
  "ae": string,
  "dateTime": string,
  "contextBullets": string[],
  "rawText": string,
  "ts": string
}

Messages:
${numbered}`

  try {
    const raw = await callAnthropic(apiKey, {
      model: 'claude-haiku-4-5-20251001',
      maxTokens: 4000,
      messages: [{ role: 'user', content: prompt }],
    })

    const parsed = parseClaudeJson(raw, [])
    const bookings = Array.isArray(parsed) ? parsed : []

    // Attach ts from source messages where possible
    const tsMap = Object.fromEntries(recent.map((m, i) => [String(i + 1), m.ts]))
    bookings.forEach(b => {
      if (!b.ts) b.ts = null
    })

    return res.status(200).json({ bookings })
  } catch (err) {
    console.error('sales-ops-feed error:', err)
    return res.status(200).json({ bookings: [], error: err.message })
  }
}
