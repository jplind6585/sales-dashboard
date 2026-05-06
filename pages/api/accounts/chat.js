// AI chat endpoint for a specific account.
// POST { accountId, messages: [{role, content}] }

import { createServerSupabaseClient, getSupabase } from '../../../lib/supabase'
import { apiError, callAnthropic, validateAnthropicKey } from '../../../lib/apiUtils'
import { getSalesProcessConfig, buildSalesProcessContext } from '../../../lib/salesProcess'

export default async function handler(req, res) {
  if (req.method !== 'POST') return apiError(res, 405, 'POST only')

  const auth = createServerSupabaseClient(req, res)
  const { data: { user } } = await auth.auth.getUser()
  if (!user) return apiError(res, 401, 'Unauthorized')

  const apiKey = validateAnthropicKey(res)
  if (!apiKey) return

  const { accountId, messages } = req.body || {}
  if (!accountId) return apiError(res, 400, 'accountId required')
  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return apiError(res, 400, 'messages array required')
  }

  const db = getSupabase()

  const [accountRes, callsRes, tasksRes, stakeholdersRes, gapsRes, notesRes, processConfig] = await Promise.all([
    db.from('accounts').select('id, name, stage, deal_value, owner_name, hubspot_deal_id, vertical, ownership_type').eq('id', accountId).single(),
    db.from('gong_call_analyses').select('gong_call_id, analysis, analyzed_at').eq('account_id', accountId).not('analysis', 'is', null).order('analyzed_at', { ascending: false }).limit(15),
    db.from('tasks').select('id, title, status, due_date, source_type, dismissed_at').eq('account_id', accountId).is('dismissed_at', null).in('status', ['open', 'in_progress']).limit(20),
    db.from('stakeholders').select('name, title, role, is_champion, email').eq('account_id', accountId).limit(15),
    db.from('information_gaps').select('question, category, status').eq('account_id', accountId).eq('status', 'open').limit(10),
    db.from('notes').select('content, created_at').eq('account_id', accountId).order('created_at', { ascending: false }).limit(5),
    getSalesProcessConfig(),
  ])

  const account = accountRes.data
  if (!account) return apiError(res, 404, 'Account not found')

  const calls = callsRes.data || []
  const tasks = tasksRes.data || []
  const stakeholders = stakeholdersRes.data || []
  const gaps = gapsRes.data || []
  const notes = notesRes.data || []

  // Build stakeholders section
  const stakeholderLines = stakeholders.length
    ? stakeholders.map(s => {
        const parts = [s.name]
        if (s.title) parts.push(s.title)
        if (s.role) parts.push(s.role)
        if (s.is_champion) parts.push('[Champion]')
        return `- ${parts.join(' | ')}`
      }).join('\n')
    : '- No stakeholders on record'

  // Build tasks section
  const taskLines = tasks.length
    ? tasks.map(t => {
        const due = t.due_date ? ` (due ${t.due_date.slice(0, 10)})` : ''
        return `- [${t.status}] ${t.title}${due}`
      }).join('\n')
    : '- No open tasks'

  // Build gaps section
  const gapLines = gaps.length
    ? gaps.map(g => `- [${g.category || 'general'}] ${g.question}`).join('\n')
    : '- None'

  // Build notes section
  const noteLines = notes.length
    ? notes.map(n => `- (${n.created_at?.slice(0, 10)}) ${(n.content || '').slice(0, 300)}`).join('\n')
    : '- No notes'

  // Aggregate MEDDIC across all calls — take best populated value per element
  const meddicAgg = {
    metrics: [],
    economic_buyer: [],
    decision_criteria: [],
    decision_process: [],
    identify_pain: [],
    champion: [],
    competition: [],
  }

  calls.forEach(c => {
    const a = c.analysis || {}
    const m = a.meddic || a.meddicc || {}
    Object.keys(meddicAgg).forEach(key => {
      const val = m[key]
      if (val && typeof val === 'string' && val.trim() && val.toLowerCase() !== 'unknown' && val.toLowerCase() !== 'none') {
        meddicAgg[key].push(val.trim())
      } else if (val && typeof val === 'object' && val.value) {
        meddicAgg[key].push(String(val.value).trim())
      }
    })
  })

  const meddicLines = Object.entries(meddicAgg).map(([key, vals]) => {
    const label = key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
    const best = vals.length ? vals[0] : 'Not captured'
    return `  ${label}: ${best}`
  }).join('\n')

  // Build call history section
  const callLines = calls.map((c, i) => {
    const a = c.analysis || {}
    const date = c.analyzed_at?.slice(0, 10) || 'unknown date'
    const summary = (a.summary || 'No summary').slice(0, 400)
    const pain = (a.pain_points || []).slice(0, 3).join('; ') || 'None noted'
    const signals = (a.buying_signals || []).slice(0, 2).join('; ') || 'None noted'
    const flags = (a.red_flags || []).slice(0, 2).join('; ') || 'None'
    const nextSteps = (a.next_steps_mentioned || a.next_steps || []).slice(0, 3).join('; ') || 'None'
    const commitments = (a.commitments || []).slice(0, 2).join('; ') || 'None'
    return `Call ${i + 1} (${date}):
  Summary: ${summary}
  Pain Points: ${pain}
  Buying Signals: ${signals}
  Red Flags: ${flags}
  Next Steps Committed: ${nextSteps}
  Commitments: ${commitments}`
  }).join('\n\n')

  // Build abbreviated sales process context (just current stage exit criteria + competitor playbook)
  let salesProcessSnippet = ''
  if (processConfig) {
    const currentStage = account.stage || 'unknown'
    const exitCriteriaFull = processConfig.stage_exit_criteria || ''
    // Try to find the exit criteria for the current stage
    const stagePattern = new RegExp(`${currentStage}[^\\n]*:[\\s\\S]{0,500}`, 'i')
    const stageMatch = exitCriteriaFull.match(stagePattern)
    const stageExitSnippet = stageMatch ? stageMatch[0].slice(0, 400) : exitCriteriaFull.slice(0, 400)

    const competitorSnippet = (processConfig.competitor_playbook || '').slice(0, 500)
    const icpSnippet = (processConfig.icp_definition || '').slice(0, 300)

    salesProcessSnippet = `
SALES PROCESS (Banner):
Stage Exit Criteria (${currentStage}): ${stageExitSnippet}
ICP Summary: ${icpSnippet}
Competitor Playbook: ${competitorSnippet}`.trim()
  }

  const today = new Date().toISOString().slice(0, 10)

  const systemPrompt = `You are the AI advisor for ${account.owner_name || 'the rep'}'s deal with ${account.name}. You have full context on this account — every call, every stakeholder, every task, and Banner's complete sales playbook. Answer questions about this deal with specificity. When asked to draft emails or messages, reference actual context from prior calls.

ACCOUNT: ${account.name} | Stage: ${account.stage || 'unknown'} | Value: ${account.deal_value ? '$' + Number(account.deal_value).toLocaleString() : 'unknown'} | Owner: ${account.owner_name || 'unknown'} | Vertical: ${account.vertical || 'unknown'}

STAKEHOLDERS (${stakeholders.length}):
${stakeholderLines}

OPEN TASKS (${tasks.length}):
${taskLines}

INFORMATION GAPS (still open, ${gaps.length}):
${gapLines}

RECENT NOTES:
${noteLines}

MEDDIC (aggregated across all calls):
${meddicLines}

CALL HISTORY (${calls.length} analyzed calls):
${callLines || 'No analyzed calls yet.'}

${salesProcessSnippet}

TODAY: ${today}

You know this deal better than anyone. Be direct. When asked for an email or message, draft it — don't explain what you are about to do. When asked where the deal stands, give a real assessment including risks. Keep responses focused and specific to this account.`

  // Trim to last 14 messages
  const trimmedMessages = messages.slice(-14).map(m => ({
    role: m.role,
    content: m.content,
  }))

  try {
    const reply = await callAnthropic(apiKey, {
      model: 'claude-sonnet-4-6',
      maxTokens: 2000,
      system: systemPrompt,
      messages: trimmedMessages,
    })

    return res.status(200).json({ success: true, message: reply })
  } catch (err) {
    console.error('[chat] Claude error:', err)
    return apiError(res, 500, err.message || 'AI call failed')
  }
}
