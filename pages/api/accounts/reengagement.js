// Generates a reengagement brief using full call history for the account.
// POST { accountId }

import { apiError, apiSuccess, logRequest } from '../../../lib/apiUtils'
import { createServerSupabaseClient, getSupabase } from '../../../lib/supabase'
import { getSalesProcessConfig, buildSalesProcessContext } from '../../../lib/salesProcess'

export default async function handler(req, res) {
  logRequest(req, 'accounts/reengagement')
  if (req.method !== 'POST') return apiError(res, 405, 'POST only')

  const auth = createServerSupabaseClient(req, res)
  const { data: { user } } = await auth.auth.getUser()
  if (!user) return apiError(res, 401, 'Unauthorized')

  const { accountId } = req.body || {}
  if (!accountId) return apiError(res, 400, 'accountId required')

  const db = getSupabase()

  const [accountRes, callsRes, stakeholdersRes, processConfig] = await Promise.all([
    db.from('accounts').select('id, name, stage, deal_value, owner_name').eq('id', accountId).single(),
    db.from('gong_call_analyses')
      .select('analysis, call_date, analyzed_at, duration_seconds, title, transcript_text')
      .eq('account_id', accountId)
      .not('analysis', 'is', null)
      .order('call_date', { ascending: false })
      .limit(30), // full history, capped at 30 to stay in context
    db.from('stakeholders').select('name, title, role, email').eq('account_id', accountId).limit(15),
    getSalesProcessConfig(),
  ])

  const account = accountRes.data
  if (!account) return apiError(res, 404, 'Account not found')

  const calls = callsRes.data || []
  const stakeholders = stakeholdersRes.data || []

  // Aggregate signals across all calls
  const allThemes = []
  const allObjections = []
  const allBuyingSignals = []
  const allRedFlags = []
  const allNextSteps = []
  const allCommitments = []
  const icpScores = []
  const discoveryScores = []
  let avgTalkRatio = 0
  let positiveCallCount = 0

  for (const call of calls) {
    const a = call.analysis || {}
    if (a.themes) allThemes.push(...a.themes)
    if (a.objections) allObjections.push(...a.objections.map(o => typeof o === 'string' ? o : o.text || o.category))
    if (a.buying_signals) allBuyingSignals.push(...a.buying_signals)
    if (a.red_flags) allRedFlags.push(...a.red_flags)
    if (a.next_steps_mentioned) allNextSteps.push(...a.next_steps_mentioned)
    if (a.commitments) allCommitments.push(...a.commitments)
    if (a.icp_score) icpScores.push(a.icp_score)
    if (a.discovery_score) discoveryScores.push(a.discovery_score)
    if (typeof a.rep_talk_ratio === 'number') avgTalkRatio += a.rep_talk_ratio
    if (a.sentiment === 'positive') positiveCallCount++
  }

  const avgIcp = icpScores.length ? (icpScores.reduce((s, x) => s + x, 0) / icpScores.length).toFixed(1) : null
  const avgDiscovery = discoveryScores.length ? (discoveryScores.reduce((s, x) => s + x, 0) / discoveryScores.length).toFixed(1) : null
  const lastCall = calls[0]
  const firstCall = calls[calls.length - 1]

  // Deduplicate themes and signals
  const topThemes = [...new Set(allThemes)].slice(0, 6)
  const topBuyingSignals = [...new Set(allBuyingSignals)].slice(0, 5)
  const topObjections = [...new Set(allObjections)].slice(0, 4)
  const topRedFlags = [...new Set(allRedFlags)].slice(0, 3)
  const recentNextSteps = allNextSteps.slice(0, 4)
  const recentCommitments = allCommitments.slice(0, 3)

  // Build call history narrative (last 5 calls)
  const recentCallSummaries = calls.slice(0, 5).map((c, i) => {
    const a = c.analysis || {}
    const dateStr = c.call_date ? new Date(c.call_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'unknown date'
    const durationMin = c.duration_seconds ? Math.round(c.duration_seconds / 60) : null
    return [
      `Call ${i + 1}: ${c.title || 'Untitled'} — ${dateStr}${durationMin ? ` (${durationMin} min)` : ''}`,
      a.summary ? `  Summary: ${a.summary}` : null,
      a.icp_score ? `  ICP: ${a.icp_score}/10` : null,
      a.sentiment ? `  Sentiment: ${a.sentiment}` : null,
    ].filter(Boolean).join('\n')
  }).join('\n\n')

  // Use transcript from most recent call if available (first 3000 chars)
  const recentTranscriptExcerpt = lastCall?.transcript_text
    ? `\nMost recent call transcript excerpt:\n${lastCall.transcript_text.slice(0, 3000)}`
    : ''

  const processContext = buildSalesProcessContext(processConfig)

  const daysSinceLastCall = lastCall?.call_date
    ? Math.floor((Date.now() - new Date(lastCall.call_date).getTime()) / (1000 * 60 * 60 * 24))
    : null
  const totalCallDays = (firstCall?.call_date && lastCall?.call_date)
    ? Math.floor((new Date(lastCall.call_date) - new Date(firstCall.call_date)) / (1000 * 60 * 60 * 24))
    : null

  const prompt = `You are helping a Banner sales rep reengage a prospect that has gone cold. Use every signal from the full call history to write highly specific, non-generic outreach.

${processContext}

ACCOUNT: ${account.name}
Stage: ${(account.stage || 'unknown').replace(/_/g, ' ')}
Owner: ${account.owner_name || 'unknown'}
Total Gong calls on record: ${calls.length}
Relationship duration: ${totalCallDays != null ? `${totalCallDays} days` : 'unknown'}
Days since last call: ${daysSinceLastCall != null ? `${daysSinceLastCall} days` : 'unknown'}
Calls with positive sentiment: ${positiveCallCount} of ${calls.length}
Avg ICP score across calls: ${avgIcp || 'not scored'}
Avg discovery score: ${avgDiscovery || 'not scored'}

STAKEHOLDERS:
${stakeholders.length ? stakeholders.map(s => `${s.name}${s.title ? ` (${s.title})` : ''}${s.role ? ` — ${s.role}` : ''}${s.email ? ` <${s.email}>` : ''}`).join('\n') : 'No stakeholders on record'}

RECURRING THEMES (across all calls):
${topThemes.length ? topThemes.join(', ') : 'None identified'}

BUYING SIGNALS (across all calls):
${topBuyingSignals.length ? topBuyingSignals.join('\n') : 'None'}

OBJECTIONS RAISED:
${topObjections.length ? topObjections.join('\n') : 'None'}

RED FLAGS:
${topRedFlags.length ? topRedFlags.join('\n') : 'None'}

OPEN NEXT STEPS (from last calls):
${recentNextSteps.length ? recentNextSteps.join('\n') : 'None'}

REP COMMITMENTS (from last calls):
${recentCommitments.length ? recentCommitments.join('\n') : 'None'}

CALL HISTORY (most recent first):
${recentCallSummaries || 'No calls on record'}
${recentTranscriptExcerpt}

Generate a highly specific, non-generic reengagement brief. Reference actual context from the calls — specific pain points, what they said, where the conversation stalled, what was promised. Do NOT write a generic template.

Return valid JSON only:
{
  "why_reengage": "2 sentences on why this account is worth pursuing right now — tie to their specific situation and the relationship built",
  "cold_email": {
    "subject": "email subject line — specific, references something real from prior conversations",
    "body": "email body — reference a specific conversation moment or thing they shared, stay under 100 words, end with a soft and specific ask"
  },
  "cold_call_script": {
    "opener": "how to open — reference the specific relationship and where things left off",
    "pain_hook": "the exact pain point to surface, tied to what they actually said on calls",
    "ask": "what to ask for — specific, not 'let me know if you want to reconnect'"
  },
  "talking_points": ["3-4 talking points grounded in actual call history and their specific situation"]
}`

  let brief
  try {
    const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 1200,
        messages: [{ role: 'user', content: prompt }],
      }),
    })
    const data = await claudeRes.json()
    const text = data.content?.[0]?.text || ''
    const match = text.match(/\{[\s\S]*\}/)
    brief = match ? JSON.parse(match[0]) : null
  } catch (e) {
    return apiError(res, 500, `Claude error: ${e.message}`)
  }

  if (!brief) return apiError(res, 500, 'Failed to parse reengagement brief')

  return apiSuccess(res, {
    brief,
    accountName: account.name,
    callCount: calls.length,
    daysSinceLastCall,
    avgIcpScore: avgIcp ? parseFloat(avgIcp) : null,
  })
}
