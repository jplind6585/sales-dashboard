import { createTasks } from '../../../lib/db/tasks'
import { getSupabase } from '../../../lib/supabase'

/**
 * POST /api/gong/onboarding-sync
 *
 * Called once on a new user's first login.
 * Pulls the last 3 weeks of Gong calls the user was on,
 * sends transcripts to Claude, and creates tasks from action items found.
 *
 * Body: { userId, email }
 * Non-fatal — errors are caught and logged, never block login flow.
 */

const GONG_BASE = 'https://api.gong.io'

function gongAuth() {
  const key = process.env.GONG_ACCESS_KEY
  const secret = process.env.GONG_SECRET_KEY
  if (!key || !secret) throw new Error('Gong API keys not configured')
  return 'Basic ' + Buffer.from(`${key}:${secret}`).toString('base64')
}

async function gongGet(path) {
  const res = await fetch(`${GONG_BASE}${path}`, {
    headers: { Authorization: gongAuth(), 'Content-Type': 'application/json' },
  })
  if (!res.ok) throw new Error(`Gong GET ${path} failed: ${res.status}`)
  return res.json()
}

async function gongPost(path, body) {
  const res = await fetch(`${GONG_BASE}${path}`, {
    method: 'POST',
    headers: { Authorization: gongAuth(), 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`Gong POST ${path} failed: ${res.status}`)
  return res.json()
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { userId, email } = req.body
  if (!userId || !email) return res.status(400).json({ error: 'userId and email required' })

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return res.status(500).json({ error: 'ANTHROPIC_API_KEY not configured' })

  try {
    // ── 1. Find this user in Gong by email ────────────────────────────────────
    const usersData = await gongGet('/v2/users?includeAvatars=false')
    const gongUser = (usersData.users || []).find(
      u => u.emailAddress?.toLowerCase() === email.toLowerCase()
    )

    if (!gongUser) {
      console.log(`Gong onboarding: no Gong user found for ${email}`)
      return res.status(200).json({ success: true, tasksCreated: 0, reason: 'no_gong_user' })
    }

    // ── 2. Get calls from last 3 weeks where user was a participant ───────────
    const threeWeeksAgo = new Date(Date.now() - 21 * 24 * 60 * 60 * 1000).toISOString()
    const now = new Date().toISOString()

    const callsData = await gongPost('/v2/calls/extensive', {
      filter: {
        fromDateTime: threeWeeksAgo,
        toDateTime: now,
        primaryUserIds: [gongUser.id],
      },
      contentSelector: {
        exposedFields: {
          parties: true,
          content: { trackers: false, brief: true, keyPoints: true, outline: false },
        },
      },
    })

    const calls = (callsData.calls || []).slice(0, 8) // max 8 calls

    if (calls.length === 0) {
      return res.status(200).json({ success: true, tasksCreated: 0, reason: 'no_calls' })
    }

    // ── 3. Get transcripts for those calls ───────────────────────────────────
    const callIds = calls.map(c => c.metaData?.id).filter(Boolean)
    let transcriptText = ''

    try {
      const transcriptData = await gongPost('/v2/calls/transcript', { filter: { callIds } })
      const transcripts = transcriptData.callTranscripts || []

      transcriptText = transcripts.map(t => {
        const call = calls.find(c => c.metaData?.id === t.callId)
        const title = call?.metaData?.title || 'Call'
        const date = call?.metaData?.started
          ? new Date(call.metaData.started).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
          : ''

        // Get sentences for this user + their counterparts (exclude internal-only chatter)
        const sentences = (t.transcript || [])
          .flatMap(s => (s.sentences || []).map(sen => ({ speaker: s.speakerName, text: sen.text })))
          .slice(0, 60) // first 60 sentences per call

        const excerpt = sentences.map(s => `${s.speaker}: ${s.text}`).join('\n')
        return `--- ${title} (${date}) ---\n${excerpt}`
      }).join('\n\n')
    } catch (transcriptErr) {
      // Fall back to brief/key points if transcripts fail
      transcriptText = calls.map(c => {
        const title = c.metaData?.title || 'Call'
        const brief = c.content?.brief || ''
        const keyPoints = (c.content?.keyPoints || []).map(k => `• ${k.text}`).join('\n')
        return `--- ${title} ---\n${brief}\n${keyPoints}`
      }).join('\n\n')
    }

    // ── 4. Send to Claude for action item extraction ──────────────────────────
    const prompt = `You are reviewing Gong call recordings for a B2B SaaS sales rep at Banner (CapEx management software).

Analyze these call excerpts from the last 3 weeks and identify concrete action items the rep should be doing right now — things they promised, follow-ups they should make, next steps discussed.

CALLS:
${transcriptText.slice(0, 6000)}

Extract 3-8 specific, actionable tasks. Focus on:
- Commitments the rep made on calls ("I'll send...", "I'll follow up...", "Let me connect you with...")
- Logical next steps for each deal based on the conversation
- Things prospects asked for

Return JSON array only:
[{
  "title": "concise action in imperative form",
  "description": "context from the call",
  "priority": 1|2|3,
  "accountName": "company name if mentioned or null"
}]

Return ONLY valid JSON.`

    const aiRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 1000,
        messages: [{ role: 'user', content: prompt }],
      }),
    })

    const aiData = await aiRes.json()
    const rawText = aiData.content?.[0]?.text || '[]'

    let actions = []
    try {
      let jsonText = rawText
      if (rawText.includes('```json')) jsonText = rawText.split('```json')[1].split('```')[0].trim()
      else if (rawText.includes('```')) jsonText = rawText.split('```')[1].split('```')[0].trim()
      actions = JSON.parse(jsonText)
    } catch {
      actions = []
    }

    if (actions.length === 0) {
      return res.status(200).json({ success: true, tasksCreated: 0, reason: 'no_actions_extracted' })
    }

    // ── 5. Create tasks ───────────────────────────────────────────────────────
    const taskItems = actions.map(a => ({
      title: a.title,
      description: a.description || null,
      type: 'triggered',
      source: 'gong_onboarding',
      priority: a.priority || 2,
      ownerId: userId,
    }))

    await createTasks(userId, taskItems)

    // Mark profile as onboarded so we don't re-run this
    const supabase = getSupabase()
    await supabase
      .from('profiles')
      .update({ gong_onboarded: true })
      .eq('id', userId)

    return res.status(200).json({ success: true, tasksCreated: taskItems.length })
  } catch (err) {
    console.error('Gong onboarding sync error:', err)
    // Non-fatal — return 200 so login flow isn't blocked
    return res.status(200).json({ success: false, error: err.message })
  }
}
