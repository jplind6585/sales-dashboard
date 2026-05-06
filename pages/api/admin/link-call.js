// Manually link a Gong call to an account (or auto-link all unmatched calls).
// POST { gongCallId, accountId } — link one call
// POST { autoLink: true } — batch auto-link all unmatched calls by domain + name

import { apiError, apiSuccess, logRequest } from '../../../lib/apiUtils';
import { createServerSupabaseClient, getSupabase } from '../../../lib/supabase';

function normalizeName(s) {
  return (s || '').toLowerCase()
    .replace(/banner[\s\-–—]*/gi, '')
    .replace(/[\-–—:|]/g, ' ')
    .replace(/\b(intro|demo|discovery|presentation|follow\s*up|meeting|call)\b/gi, '')
    .replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim()
}

function matchScore(callTitle, account) {
  const title = normalizeName(callTitle)
  const names = [account.name, ...(account.aliases || [])].map(normalizeName)
  const domains = account.email_domains || []

  // Domain match in title is strongest signal
  for (const domain of domains) {
    const co = domain.split('.')[0]
    if (title.includes(co)) return { score: 95, method: 'domain' }
  }

  // Name / alias overlap
  let best = 0
  for (const name of names) {
    if (!name) continue
    if (title === name) return { score: 90, method: 'exact' }
    if (title.includes(name) || name.includes(title)) { best = Math.max(best, 80) }
    const tWords = new Set(title.split(' ').filter(w => w.length > 2))
    const nWords = name.split(' ').filter(w => w.length > 2)
    if (!tWords.size || !nWords.length) continue
    const overlap = nWords.filter(w => tWords.has(w)).length / Math.max(tWords.size, nWords.length)
    best = Math.max(best, Math.round(overlap * 75))
  }
  return best >= 40 ? { score: best, method: 'name' } : { score: 0, method: null }
}

export default async function handler(req, res) {
  logRequest(req, 'admin/link-call')
  if (req.method !== 'POST') return apiError(res, 405, 'Method not allowed')

  const authClient = createServerSupabaseClient(req, res)
  const { data: { user } } = await authClient.auth.getUser()
  if (!user) return apiError(res, 401, 'Unauthorized')

  const db = getSupabase()
  const { gongCallId, accountId, autoLink } = req.body || {}

  // ── Manual single link ──────────────────────────────────────────────────────
  if (gongCallId && accountId) {
    const { error } = await db.from('gong_call_analyses')
      .update({ account_id: accountId, match_method: 'manual', match_confidence: 100 })
      .eq('gong_call_id', gongCallId)
    if (error) return apiError(res, 500, error.message)
    return apiSuccess(res, { linked: 1 })
  }

  // ── Batch auto-link ─────────────────────────────────────────────────────────
  if (autoLink) {
    const [{ data: calls }, { data: accounts }] = await Promise.all([
      db.from('gong_call_analyses').select('gong_call_id, analysis').is('account_id', null).not('analysis', 'is', null),
      db.from('accounts').select('id, name, aliases, email_domains'),
    ])

    const updates = []
    for (const call of (calls || [])) {
      const title = call.analysis?.call_title || ''
      if (!title) continue
      let best = null; let bestScore = 0
      for (const acct of (accounts || [])) {
        const { score, method } = matchScore(title, acct)
        if (score > bestScore) { bestScore = score; best = { acct, method } }
      }
      if (best && bestScore >= 50) {
        updates.push({ gong_call_id: call.gong_call_id, account_id: best.acct.id, match_confidence: bestScore, match_method: best.method })
      }
    }

    for (let i = 0; i < updates.length; i += 100) {
      await db.from('gong_call_analyses').upsert(updates.slice(i, i + 100), { onConflict: 'gong_call_id' })
    }

    return apiSuccess(res, { linked: updates.length, total: (calls || []).length })
  }

  return apiError(res, 400, 'Provide gongCallId + accountId, or autoLink: true')
}
