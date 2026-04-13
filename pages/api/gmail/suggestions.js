/**
 * POST /api/gmail/suggestions
 *
 * Reads the user's recent Gmail, sends context to Claude, and returns:
 * - Suggested tasks extracted from emails (action items, follow-ups, promises made)
 * - Response time metrics (avg hours to reply, unanswered threads)
 *
 * Requires the user's Google provider_token from Supabase session.
 * Reads last 7 days of inbox + sent mail.
 */

const GMAIL_BASE = 'https://gmail.googleapis.com/gmail/v1/users/me'

async function gmailFetch(path, token) {
  const res = await fetch(`${GMAIL_BASE}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (res.status === 401) throw new Error('Google token expired — please refresh the page and try again.')
  if (!res.ok) throw new Error(`Gmail API error: ${res.status}`)
  return res.json()
}

// Decode base64url to string
function decodeBase64(str) {
  if (!str) return ''
  const base64 = str.replace(/-/g, '+').replace(/_/g, '/')
  try {
    return Buffer.from(base64, 'base64').toString('utf-8')
  } catch {
    return ''
  }
}

// Extract header value from Gmail message headers
function getHeader(headers, name) {
  return headers?.find(h => h.name.toLowerCase() === name.toLowerCase())?.value || ''
}

// Get plain-text body from message payload
function getBody(payload) {
  if (!payload) return ''

  // Direct body
  if (payload.mimeType === 'text/plain' && payload.body?.data) {
    return decodeBase64(payload.body.data).slice(0, 500)
  }

  // Multipart: find text/plain part
  if (payload.parts) {
    for (const part of payload.parts) {
      if (part.mimeType === 'text/plain' && part.body?.data) {
        return decodeBase64(part.body.data).slice(0, 500)
      }
    }
    // Fall back to first part
    for (const part of payload.parts) {
      const body = getBody(part)
      if (body) return body
    }
  }

  return payload.snippet || ''
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { token } = req.body
  if (!token) return res.status(400).json({ error: 'Google token required' })

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return res.status(500).json({ error: 'ANTHROPIC_API_KEY not configured' })

  try {
    // ── 1. Fetch message IDs from last 7 days ─────────────────────────────────
    const sevenDaysAgo = Math.floor((Date.now() - 7 * 24 * 60 * 60 * 1000) / 1000)

    const [inboxData, sentData] = await Promise.all([
      gmailFetch(`/messages?maxResults=25&q=after:${sevenDaysAgo} -category:promotions -category:social`, token),
      gmailFetch(`/messages?maxResults=15&q=in:sent after:${sevenDaysAgo}`, token),
    ])

    const inboxIds = (inboxData.messages || []).slice(0, 20)
    const sentIds = (sentData.messages || []).slice(0, 10)
    const allIds = [...inboxIds, ...sentIds]

    if (allIds.length === 0) {
      return res.status(200).json({ suggestions: [], responseMetrics: { avgHours: null, unanswered: 0 } })
    }

    // ── 2. Fetch message details (headers + snippet) ──────────────────────────
    const messages = await Promise.all(
      allIds.map(({ id }) =>
        gmailFetch(`/messages/${id}?format=metadata&metadataHeaders=Subject,From,To,Date`, token)
          .catch(() => null)
      )
    )

    // ── 3. Build email summaries for Claude ───────────────────────────────────
    const emailSummaries = messages
      .filter(Boolean)
      .map(m => {
        const headers = m.payload?.headers || []
        const isInbox = !m.labelIds?.includes('SENT')
        return {
          id: m.id,
          subject: getHeader(headers, 'Subject') || '(no subject)',
          from: getHeader(headers, 'From'),
          to: getHeader(headers, 'To'),
          date: getHeader(headers, 'Date'),
          snippet: m.snippet || '',
          direction: isInbox ? 'received' : 'sent',
        }
      })

    // ── 4. Response time calculation ──────────────────────────────────────────
    // Find received emails with no corresponding sent reply in thread
    const threadsSeen = new Set()
    let unansweredCount = 0
    const responseTimes = []

    for (const email of emailSummaries.filter(e => e.direction === 'received')) {
      if (threadsSeen.has(email.id)) continue
      threadsSeen.add(email.id)

      // Check if there's a sent email with the same subject prefix
      const subjectBase = email.subject.replace(/^(re:|fwd?:|fw:)\s*/i, '').toLowerCase().trim()
      const hasSentReply = emailSummaries.some(
        e => e.direction === 'sent' &&
          e.subject.replace(/^(re:|fwd?:|fw:)\s*/i, '').toLowerCase().trim() === subjectBase
      )

      if (!hasSentReply && !email.from.includes('@withbanner.com')) {
        unansweredCount++
      }
    }

    // ── 5. Send to Claude for action item extraction ──────────────────────────
    const emailContext = emailSummaries.slice(0, 25).map((e, i) =>
      `[${i + 1}] ${e.direction.toUpperCase()} | ${e.date}
Subject: ${e.subject}
${e.direction === 'received' ? `From: ${e.from}` : `To: ${e.to}`}
Preview: ${e.snippet}`
    ).join('\n\n')

    const prompt = `You are reviewing emails for a B2B SaaS sales rep at Banner (CapEx management software).

Identify action items, follow-ups, and commitments from these emails.

EMAILS (last 7 days):
${emailContext}

Extract only genuine action items — things the rep needs to DO, not just informational emails.
Look for:
- Promises the rep made ("I'll send...", "I'll follow up...", "Let me get you...")
- Requests from prospects/customers that need a response
- Follow-ups that haven't been addressed
- Meeting requests or scheduling needed

Return JSON array of up to 8 items:
[{
  "title": "concise action in imperative form",
  "reason": "why this matters / what email triggered it",
  "emailSubject": "the subject line",
  "priority": "high|medium|low",
  "category": "follow_up|send_content|schedule_meeting|internal"
}]

Return ONLY valid JSON array. If no action items, return [].`

    const aiRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001', // fast + cheap for email triage
        max_tokens: 800,
        messages: [{ role: 'user', content: prompt }],
      }),
    })

    const aiData = await aiRes.json()
    const rawText = aiData.content?.[0]?.text || '[]'

    let suggestions = []
    try {
      let jsonText = rawText
      if (rawText.includes('```json')) jsonText = rawText.split('```json')[1].split('```')[0].trim()
      else if (rawText.includes('```')) jsonText = rawText.split('```')[1].split('```')[0].trim()
      suggestions = JSON.parse(jsonText)
    } catch {
      suggestions = []
    }

    return res.status(200).json({
      suggestions,
      responseMetrics: {
        unanswered: unansweredCount,
        emailsAnalyzed: emailSummaries.length,
      },
    })
  } catch (err) {
    console.error('Gmail suggestions error:', err)
    return res.status(500).json({ error: err.message })
  }
}
