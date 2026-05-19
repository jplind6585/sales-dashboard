import { createServerSupabaseClient, getSupabase } from '../../../lib/supabase'
import { apiError, apiSuccess, logRequest } from '../../../lib/apiUtils'
import { listPursuitChannels, deriveChannelName } from '../../../lib/slack'

function normalizeName(s) {
  return (s || '')
    .toLowerCase()
    .replace(/banner[\s\-–—]*/gi, '')
    .replace(/[\-–—:|]/g, ' ')
    .replace(/\b(intro|demo|discovery|presentation|follow\s*up|meeting|call|inc|llc|ltd|corp)\b/gi, '')
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function wordOverlap(a, b) {
  const aWords = new Set(normalizeName(a).split(' ').filter(w => w.length > 2))
  const bWords = normalizeName(b).split(' ').filter(w => w.length > 2)
  if (!aWords.size || !bWords.length) return 0
  const matches = bWords.filter(w => aWords.has(w)).length
  return matches / Math.max(aWords.size, bWords.length)
}

export default async function handler(req, res) {
  logRequest(req, 'admin/data-quality')
  if (req.method !== 'GET') return apiError(res, 405, 'Method not allowed')

  const authClient = createServerSupabaseClient(req, res)
  const { data: { user } } = await authClient.auth.getUser()
  if (!user) return apiError(res, 401, 'Unauthorized')

  const db = getSupabase()

  try {
    const [
      { data: accounts, error: accountsErr },
      { data: unmatchedCalls },
      { data: mergeLog },
    ] = await Promise.all([
      db.from('accounts').select('id, name, stage, aliases, email_domains, hubspot_deal_id, hubspot_synced_at, deal_value'),
      db.from('gong_call_analyses')
        .select('gong_call_id, analysis, analyzed_at, ignored')
        .is('account_id', null)
        .eq('ignored', false)
        .not('analysis', 'is', null)
        .order('analyzed_at', { ascending: false })
        .limit(200),
      db.from('account_merge_log')
        .select('*')
        .order('merged_at', { ascending: false })
        .limit(50),
    ])

    if (accountsErr) {
      console.error('[data-quality] accounts query error:', accountsErr)
      return apiError(res, 500, accountsErr.message || 'Database error')
    }

    const allAccounts = accounts || []
    const activeStages = ['intro_scheduled', 'active_pursuit', 'demo', 'solution_validation', 'proposal', 'legal']

    // ── 1. Unmatched calls ────────────────────────────────────────────────────
    const unmatchedWithSuggestions = (unmatchedCalls || []).map(call => {
      const title = call.analysis?.call_title || ''
      let bestMatch = null
      let bestScore = 0
      for (const acct of allAccounts) {
        const score = wordOverlap(title, acct.name)
        const aliasScore = Math.max(...(acct.aliases || []).map(a => wordOverlap(title, a)), 0)
        const top = Math.max(score, aliasScore)
        if (top > bestScore) { bestScore = top; bestMatch = acct }
      }
      return {
        gongCallId: call.gong_call_id,
        title: call.analysis?.call_title || call.gong_call_id,
        date: call.analyzed_at,
        repName: call.analysis?.rep_name || null,
        summary: call.analysis?.summary || null,
        suggestedAccount: bestScore >= 0.4 ? { id: bestMatch.id, name: bestMatch.name, score: Math.round(bestScore * 100) } : null,
      }
    })

    // ── 2. Potential duplicates ───────────────────────────────────────────────
    const duplicatePairs = []
    const seen = new Set()
    for (let i = 0; i < allAccounts.length; i++) {
      for (let j = i + 1; j < allAccounts.length; j++) {
        const a = allAccounts[i]
        const b = allAccounts[j]
        const score = wordOverlap(a.name, b.name)
        if (score >= 0.6) {
          const key = [a.id, b.id].sort().join('|')
          if (!seen.has(key)) {
            seen.add(key)
            duplicatePairs.push({ a: { id: a.id, name: a.name, stage: a.stage }, b: { id: b.id, name: b.name, stage: b.stage }, score: Math.round(score * 100) })
          }
        }
      }
    }
    duplicatePairs.sort((a, b) => b.score - a.score)

    // ── 3. Missing HubSpot ────────────────────────────────────────────────────
    const missingHubspot = allAccounts
      .filter(a => activeStages.includes(a.stage) && !a.hubspot_deal_id)
      .map(a => ({ id: a.id, name: a.name, stage: a.stage }))

    // ── 4. Alias suggestions ──────────────────────────────────────────────────
    const aliasSuggestions = []
    for (const call of unmatchedWithSuggestions) {
      if (call.suggestedAccount && call.suggestedAccount.score >= 60) {
        const extracted = normalizeName(call.title)
        const acct = allAccounts.find(a => a.id === call.suggestedAccount.id)
        if (acct) {
          const existingAliases = (acct.aliases || []).map(a => normalizeName(a))
          if (!existingAliases.includes(extracted) && extracted !== normalizeName(acct.name)) {
            const existing = aliasSuggestions.find(s => s.accountId === acct.id && s.alias === extracted)
            if (!existing) {
              aliasSuggestions.push({ accountId: acct.id, accountName: acct.name, alias: extracted, seenIn: call.title, count: 1 })
            } else {
              existing.count++
            }
          }
        }
      }
    }
    aliasSuggestions.sort((a, b) => b.count - a.count)

    // ── 5. Pursuit channel audit ──────────────────────────────────────────────
    let channelAudit = { orphanChannels: [], unmatchedAccounts: [], duplicateChannels: [] }
    try {
      const pursuitChannels = await listPursuitChannels()
      const accountChannelMap = new Map() // channelName → account
      const channelHits = new Map()        // channelName → [accounts]

      for (const acct of allAccounts) {
        const expected = deriveChannelName(acct.name) // e.g. "pursuit_familydollar"
        if (!expected) continue
        if (!channelHits.has(expected)) channelHits.set(expected, [])
        channelHits.get(expected).push(acct)
      }

      // Channels with no matching account
      const orphanChannels = pursuitChannels
        .filter(ch => !channelHits.has(ch.name) || channelHits.get(ch.name).length === 0)
        .map(ch => ({ channelName: ch.name, channelId: ch.id }))

      // Channels with multiple account matches (ambiguous)
      const duplicateChannels = pursuitChannels
        .filter(ch => (channelHits.get(ch.name) || []).length > 1)
        .map(ch => ({
          channelName: ch.name,
          matchedAccounts: channelHits.get(ch.name).map(a => ({ id: a.id, name: a.name, stage: a.stage })),
        }))

      // Active accounts with no matching pursuit channel
      const channelNames = new Set(pursuitChannels.map(ch => ch.name))
      const unmatchedAccounts = allAccounts
        .filter(a => activeStages.includes(a.stage))
        .filter(a => {
          const expected = deriveChannelName(a.name)
          return expected && !channelNames.has(expected)
        })
        .map(a => ({ id: a.id, name: a.name, stage: a.stage, expectedChannel: deriveChannelName(a.name) }))

      channelAudit = {
        orphanChannels,
        duplicateChannels,
        unmatchedAccounts,
        totalPursuitChannels: pursuitChannels.length,
      }
    } catch (slackErr) {
      console.warn('[data-quality] Slack channel audit skipped:', slackErr.message)
    }

    return apiSuccess(res, {
      unmatchedCalls: unmatchedWithSuggestions,
      duplicatePairs,
      missingHubspot,
      aliasSuggestions: aliasSuggestions.slice(0, 20),
      mergeLog: mergeLog || [],
      channelAudit,
      counts: {
        unmatched: unmatchedWithSuggestions.length,
        duplicates: duplicatePairs.length,
        missingHubspot: missingHubspot.length,
        aliasSuggestions: aliasSuggestions.length,
        orphanChannels: channelAudit.orphanChannels?.length || 0,
        unmatchedAccounts: channelAudit.unmatchedAccounts?.length || 0,
      },
    })
  } catch (err) {
    console.error('[data-quality] unhandled error:', err)
    return apiError(res, 500, err.message || 'Internal server error')
  }
}
