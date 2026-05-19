import { createServerSupabaseClient, getSupabase } from '../../../lib/supabase'
import { callAnthropic, logRequest } from '../../../lib/apiUtils'

export default async function handler(req, res) {
  logRequest(req, 'calendar/prep-brief')
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const authClient = createServerSupabaseClient(req, res)
  const { data: { user } } = await authClient.auth.getUser()
  if (!user) return res.status(401).json({ error: 'Unauthorized' })

  const { meetingTitle, attendees = [], meetingTime, accountId } = req.body
  if (!meetingTitle) return res.status(400).json({ error: 'meetingTitle required' })

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return res.status(500).json({ error: 'ANTHROPIC_API_KEY not configured' })

  const db = getSupabase()

  let matchedAccount = null

  // If caller already matched the account (from calendar/upcoming), use it directly
  if (accountId) {
    const { data: acc } = await db
      .from('accounts')
      .select('id, name, stage')
      .eq('id', accountId)
      .single()
    matchedAccount = acc || null
  }

  // Otherwise fuzzy-match meeting title to an active account
  if (!matchedAccount) {
    const { data: accounts } = await db
      .from('accounts')
      .select('id, name, stage')
      .not('stage', 'in', '(closed_won,closed_lost)')
      .order('name')
      .limit(200)

    if (accounts?.length) {
      const titleLower = meetingTitle.toLowerCase()
      let bestScore = 0
      for (const acc of accounts) {
        const nameLower = acc.name.toLowerCase()
        const nameWords = nameLower.split(/\s+/).filter(w => w.length > 2)
        let score = 0
        if (titleLower.includes(nameLower)) score = 100
        else if (nameLower.includes(titleLower)) score = 90
        else {
          for (const word of nameWords) {
            if (titleLower.includes(word)) score += 20
          }
        }
        if (score > bestScore) { bestScore = score; matchedAccount = acc }
      }
      if (bestScore < 15) matchedAccount = null
    }
  }

  let recentCalls = []
  let stakeholders = []
  let memories = []

  if (matchedAccount) {
    const [callsRes, stakeholdersRes, memoriesRes] = await Promise.all([
      db.from('gong_call_analyses')
        .select('title, call_date, analysis')
        .eq('account_id', matchedAccount.id)
        .not('analyzed_at', 'is', null)
        .order('call_date', { ascending: false })
        .limit(3),
      db.from('stakeholders')
        .select('name, role, is_champion')
        .eq('account_id', matchedAccount.id),
      db.from('account_memory')
        .select('type, content, created_at')
        .eq('account_id', matchedAccount.id)
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(5),
    ])
    recentCalls = callsRes.data || []
    stakeholders = stakeholdersRes.data || []
    memories = memoriesRes.data || []
  }

  const memoryContext = memories.length
    ? `\n\n## Saved Account Insights\n${memories.map(m => `[${m.type}] ${m.content}`).join('\n')}`
    : ''

  const attendeeList = attendees.map(a => a.name || a.email).filter(Boolean).join(', ')

  const callContext = recentCalls.map(c => {
    const a = c.analysis || {}
    const meddiccGaps = Object.entries(a.meddicc || {})
      .filter(([, v]) => !v || /unknown|not identified|not mentioned/i.test(v))
      .map(([k]) => k)
    return [
      `Call: ${c.title} (${c.call_date?.split('T')[0]})`,
      a.summary ? `Summary: ${a.summary.slice(0, 200)}` : null,
      (a.pain_points_identified || []).length ? `Pain points: ${(a.pain_points_identified || []).slice(0, 3).join('; ')}` : null,
      (a.next_steps_mentioned || []).length ? `Open next steps: ${(a.next_steps_mentioned || []).slice(0, 3).join('; ')}` : null,
      (a.commitments || []).length ? `Rep commitments: ${(a.commitments || []).slice(0, 2).join('; ')}` : null,
      meddiccGaps.length ? `MEDDICC gaps: ${meddiccGaps.join(', ')}` : null,
      (a.red_flags || []).length ? `Red flags: ${(a.red_flags || []).slice(0, 2).join('; ')}` : null,
    ].filter(Boolean).join('\n')
  }).join('\n\n')

  const stakeholderContext = stakeholders.length
    ? stakeholders.map(s => `${s.name} (${s.role})${s.is_champion ? ' — Champion' : ''}`).join(', ')
    : null

  const prompt = `You are a sales AI assistant helping a rep prepare for an upcoming meeting.${memoryContext}

MEETING: "${meetingTitle}"
TIME: ${meetingTime || 'Upcoming'}
ATTENDEES: ${attendeeList || 'Unknown'}
${matchedAccount ? `ACCOUNT IN PIPELINE: ${matchedAccount.name} (Stage: ${matchedAccount.stage?.replace(/_/g, ' ')})` : 'ACCOUNT: No match found in pipeline'}
${stakeholderContext ? `KNOWN STAKEHOLDERS: ${stakeholderContext}` : ''}

${recentCalls.length ? `CALL HISTORY:\n${callContext}` : 'No prior call history found for this account.'}

Generate a concise, actionable pre-call brief grounded in the data above. If no account data is available, give a generic but tactical response.

Return ONLY valid JSON:
{
  "account_match": ${matchedAccount ? `"${matchedAccount.name}"` : 'null'},
  "opening_recommendation": "How to open the first 60 seconds of this call (2-3 sentences, specific to the account context)",
  "key_objectives": ["Specific thing to accomplish in this meeting — 3 items max"],
  "talking_points": ["Key point with account-specific context"],
  "discovery_questions": ["Question to ask — which MEDDICC gap or intel it fills"],
  "watch_outs": ["Risk or sensitivity to be aware of based on call history"],
  "suggested_ask": "The specific commitment to land at the end of this call (1 sentence)"
}`

  try {
    const raw = await callAnthropic(apiKey, {
      model: 'claude-sonnet-4-6',
      maxTokens: 900,
      messages: [{ role: 'user', content: prompt }],
    })

    let brief
    try {
      const jsonMatch = raw.match(/\{[\s\S]*\}/)
      brief = jsonMatch ? JSON.parse(jsonMatch[0]) : null
    } catch {
      brief = null
    }

    if (!brief) return res.status(500).json({ error: 'Failed to parse AI response' })

    return res.status(200).json({ success: true, brief, accountMatched: matchedAccount?.name || null })
  } catch (e) {
    console.error('[prep-brief] Error:', e.message)
    return res.status(500).json({ error: e.message })
  }
}
