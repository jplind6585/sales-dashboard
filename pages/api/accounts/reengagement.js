// Generates a reengagement brief + outreach scripts for a stale account.
// POST { accountId }

import Anthropic from '@anthropic-ai/sdk'
import { apiError, apiSuccess, logRequest } from '../../../lib/apiUtils'
import { createServerSupabaseClient, getSupabase } from '../../../lib/supabase'
import { getSalesProcessConfig, buildSalesProcessContext } from '../../../lib/salesProcess'

const client = new Anthropic()

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
    db.from('gong_call_analyses').select('analysis, analyzed_at').eq('account_id', accountId).not('analysis', 'is', null).order('analyzed_at', { ascending: false }).limit(5),
    db.from('stakeholders').select('name, title, role').eq('account_id', accountId).limit(10),
    getSalesProcessConfig(),
  ])

  const account = accountRes.data
  if (!account) return apiError(res, 404, 'Account not found')

  const calls = callsRes.data || []
  const stakeholders = stakeholdersRes.data || []

  const callContext = calls.map(c => {
    const a = c.analysis || {}
    return `Call (${c.analyzed_at?.slice(0,10)}): ${a.summary || 'No summary'}\nNext steps: ${(a.next_steps_mentioned || []).join(', ') || 'None'}`
  }).join('\n\n')

  const stakeholderContext = stakeholders.length
    ? stakeholders.map(s => `${s.name}${s.title ? ` (${s.title})` : ''} — ${s.role || 'Unknown role'}`).join('\n')
    : 'No stakeholders on record'

  const processContext = buildSalesProcessContext(processConfig)

  const prompt = `You are helping a Banner sales rep reengage a prospect who has gone cold.

${processContext}

ACCOUNT: ${account.name}
Stage: ${account.stage || 'unknown'}
Deal value: ${account.deal_value ? '$' + account.deal_value.toLocaleString() : 'unknown'}
Owner: ${account.owner_name || 'unknown'}

STAKEHOLDERS:
${stakeholderContext}

LAST KNOWN CONVERSATIONS:
${callContext || 'No call history on record.'}

Generate reengagement outreach. Be specific to this company and what was discussed before. Do NOT use generic templates.

Respond with valid JSON only:
{
  "why_reengage": "2 sentences on why this account is worth pursuing and what the opportunity is",
  "cold_email": {
    "subject": "email subject line",
    "body": "the email body — reference something specific from prior conversations, keep it under 100 words, end with a soft ask"
  },
  "cold_call_script": {
    "opener": "how to open the call — reference the relationship and last interaction",
    "pain_hook": "the key pain point to surface based on what was discussed before",
    "ask": "what to ask for at the end of the call"
  },
  "talking_points": ["3-4 specific talking points grounded in prior conversation context"]
}`

  let brief
  try {
    const completion = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1000,
      messages: [{ role: 'user', content: prompt }]
    })
    const text = completion.content[0]?.text || ''
    const match = text.match(/\{[\s\S]*\}/)
    brief = match ? JSON.parse(match[0]) : null
  } catch (e) {
    return apiError(res, 500, `Claude error: ${e.message}`)
  }

  if (!brief) return apiError(res, 500, 'Failed to parse reengagement brief')
  return apiSuccess(res, { brief, accountName: account.name })
}
