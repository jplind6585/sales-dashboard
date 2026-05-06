// Data quality queue — surfaces unmatched calls, duplicate accounts,
// missing HubSpot links, and alias suggestions for admin review.

import { apiError, apiSuccess, logRequest } from '../../../lib/apiUtils';
import { getSupabase } from '../../../lib/supabase';

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

  const db = getSupabase()

  const [
    { data: accounts },
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

  const allAccounts = accounts || []
  const activeStages = ['intro_scheduled', 'active_pursuit', 'demo', 'solution_validation', 'proposal', 'legal']

  // ── 1. Unmatched calls ──────────────────────────────────────────────────────
  // Extract company name from call title and try to suggest an account match
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

  // ── 2. Potential duplicates ─────────────────────────────────────────────────
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

  // ── 3. Missing HubSpot link ─────────────────────────────────────────────────
  const missingHubspot = allAccounts
    .filter(a => activeStages.includes(a.stage) && !a.hubspot_deal_id)
    .map(a => ({ id: a.id, name: a.name, stage: a.stage }))

  // ── 4. Alias suggestions from unmatched call titles ─────────────────────────
  const aliasSuggestions = []
  for (const call of unmatchedWithSuggestions) {
    if (call.suggestedAccount && call.suggestedAccount.score >= 60) {
      // Extract the likely company name from the title (strip "Banner - ", call types)
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

  return apiSuccess(res, {
    unmatchedCalls: unmatchedWithSuggestions,
    duplicatePairs,
    missingHubspot,
    aliasSuggestions: aliasSuggestions.slice(0, 20),
    mergeLog: mergeLog || [],
    counts: {
      unmatched: unmatchedWithSuggestions.length,
      duplicates: duplicatePairs.length,
      missingHubspot: missingHubspot.length,
      aliasSuggestions: aliasSuggestions.length,
    },
  })
}
