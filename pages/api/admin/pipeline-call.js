// Analyzes a pipeline review call transcript and extracts per-account action items.
// POST { transcript, gongCallId, title }
// Manager-only.

import { createServerSupabaseClient, getSupabase } from '../../../lib/supabase'
import { apiError, callAnthropic, validateAnthropicKey, parseClaudeJson } from '../../../lib/apiUtils'

export default async function handler(req, res) {
  if (req.method !== 'POST') return apiError(res, 405, 'POST only')

  const auth = createServerSupabaseClient(req, res)
  const { data: { user } } = await auth.auth.getUser()
  if (!user) return apiError(res, 401, 'Unauthorized')

  const db = getSupabase()

  // Manager-only check
  const { data: profile } = await db
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()
  if (profile?.role !== 'manager') return apiError(res, 403, 'Manager access required')

  const apiKey = validateAnthropicKey(res)
  if (!apiKey) return

  const { transcript, gongCallId, title } = req.body || {}
  if (!transcript && !gongCallId) return apiError(res, 400, 'transcript or gongCallId required')

  let transcriptContext = transcript || ''

  // If gongCallId provided, pull existing analysis as context
  if (gongCallId) {
    const { data: callRow } = await db
      .from('gong_call_analyses')
      .select('analysis, title')
      .eq('gong_call_id', gongCallId)
      .maybeSingle()

    if (callRow?.analysis) {
      transcriptContext = JSON.stringify(callRow.analysis)
    }
  }

  const prompt = `Analyze this sales pipeline review call. Extract all actionable information.

${transcriptContext}

Return JSON:
{
  "accounts_discussed": [{
    "name": "account name as mentioned in transcript",
    "decisions": ["..."],
    "action_items": [{
      "title": "specific task",
      "assigned_to_name": "rep name or null",
      "due_days": 3,
      "priority": 2
    }],
    "stage_change": { "from": "current", "to": "new" },
    "memory_note": "key insight for this account — 1-2 sentences"
  }],
  "summary": "2-3 sentence overall summary"
}`

  let analysis
  try {
    const raw = await callAnthropic(apiKey, {
      model: 'claude-sonnet-4-20250514',
      maxTokens: 2000,
      messages: [{ role: 'user', content: prompt }],
    })
    analysis = parseClaudeJson(raw, { accounts_discussed: [], summary: '' })
  } catch (err) {
    console.error('[pipeline-call] Claude error:', err)
    return apiError(res, 500, err.message || 'AI call failed')
  }

  // Fuzzy-match discussed accounts to accounts table
  const { data: allAccounts } = await db
    .from('accounts')
    .select('id, name, stage')
    .not('stage', 'in', '(closed_won,closed_lost)')
    .limit(300)

  const matchedAccounts = []
  for (const discussed of analysis?.accounts_discussed || []) {
    const nameLower = (discussed.name || '').toLowerCase()
    let match = null
    let bestScore = 0

    for (const acct of allAccounts || []) {
      const acctLower = acct.name.toLowerCase()
      let score = 0
      if (acctLower === nameLower) score = 10
      else if (acctLower.includes(nameLower) || nameLower.includes(acctLower)) score = 7
      else {
        const words = nameLower.split(/\s+/).filter(w => w.length > 3)
        const hits = words.filter(w => acctLower.includes(w)).length
        if (hits >= 2) score = 5
        else if (hits === 1) score = 2
      }
      if (score > bestScore) { bestScore = score; match = acct }
    }

    // Retry with first significant word if no match
    if ((!match || bestScore < 4) && nameLower) {
      const firstWord = nameLower.split(/\s+/).find(w => w.length > 3)
      if (firstWord) {
        const { data: ilikematches } = await db
          .from('accounts')
          .select('id, name, stage')
          .ilike('name', `%${firstWord}%`)
          .limit(5)
        if (ilikematches?.length) {
          match = ilikematches[0]
          bestScore = 3
        }
      }
    }

    matchedAccounts.push({
      discussed_name: discussed.name,
      matched_account: match && bestScore >= 3 ? match : null,
      confidence: bestScore,
      decisions: discussed.decisions || [],
      action_items: discussed.action_items || [],
      stage_change: discussed.stage_change || null,
      memory_note: discussed.memory_note || null,
    })
  }

  // Save session
  const source = gongCallId ? 'gong_call_id' : transcript ? 'paste' : 'paste'
  const { data: session, error: sessionErr } = await db
    .from('pipeline_call_sessions')
    .insert({
      title: title || null,
      source,
      source_ref: gongCallId || null,
      raw_transcript: transcript || null,
      analysis,
      created_by: user.id,
    })
    .select()
    .single()

  if (sessionErr) {
    console.error('[pipeline-call] Session save error:', sessionErr)
    return apiError(res, 500, sessionErr.message)
  }

  return res.status(200).json({
    success: true,
    sessionId: session.id,
    analysis,
    matchedAccounts,
  })
}
