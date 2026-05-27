// POST /api/gong/backfill-metadata
// Re-fetches title, call_date, gong_url, duration, rep info from Gong for rows missing metadata.
// Runs until all 1,055 corrupted rows are patched.
// Protected by CRON_SECRET.

import { createClient } from '@supabase/supabase-js'
import { createGongHeaders } from '../../../lib/apiUtils'

const GONG_API_BASE = 'https://api.gong.io'
const BATCH = 100

function normalizeName(s) {
  return (s || '')
    .toLowerCase()
    .replace(/banner[\s\-–—]*/gi, '')
    .replace(/[\-–—:|]/g, ' ')
    .replace(/\b(intro|demo|discovery|presentation|follow\s*up|meeting|call|new deal|year \d+)\b/gi, '')
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function matchScore(accountName, callTitle) {
  const a = normalizeName(accountName)
  const d = normalizeName(callTitle)
  if (!a || !d) return 0
  if (a === d) return 10
  if (d.startsWith(a) || a.startsWith(d)) return 8
  if (d.includes(a) || a.includes(d)) return 6
  const aWords = new Set(a.split(' ').filter(w => w.length > 2))
  const dWords = d.split(' ').filter(w => w.length > 2)
  const overlap = dWords.filter(w => aWords.has(w)).length
  if (overlap >= 3) return 5
  if (overlap >= 2) return 3
  if (overlap === 1 && aWords.size === 1) return 2
  return 0
}

export default async function handler(req, res) {
  if (!['GET', 'POST'].includes(req.method)) return res.status(405).end()

  const secret = (process.env.CRON_SECRET || '').trim()
  if (secret && req.headers['authorization'] !== `Bearer ${secret}`) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const gongAccessKey = (process.env.GONG_ACCESS_KEY || '').trim()
  const gongSecretKey = (process.env.GONG_SECRET_KEY || '').trim()
  if (!gongAccessKey || !gongSecretKey) return res.status(500).json({ error: 'Gong credentials missing' })

  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
  const gongHeaders = createGongHeaders(gongAccessKey, gongSecretKey)
  const gongGetHeaders = { Authorization: gongHeaders.Authorization }

  // 1. Fetch a batch of rows missing title
  const { data: rows, error: fetchErr } = await db
    .from('gong_call_analyses')
    .select('gong_call_id')
    .is('title', null)
    .limit(BATCH)

  if (fetchErr) return res.status(500).json({ error: fetchErr.message })

  const remaining = await db
    .from('gong_call_analyses')
    .select('id', { count: 'exact', head: true })
    .is('title', null)

  if (!rows?.length) {
    return res.status(200).json({ updated: 0, remaining: remaining.count || 0, done: true })
  }

  const callIds = rows.map(r => r.gong_call_id)

  // 2. Fetch user map for rep name/email
  let userMap = {}
  try {
    const usersRes = await fetch(`${GONG_API_BASE}/v2/users`, { method: 'GET', headers: gongGetHeaders })
    if (usersRes.ok) {
      const usersData = await usersRes.json()
      ;(usersData.users || []).forEach(u => {
        userMap[u.id] = {
          name: `${u.firstName || ''} ${u.lastName || ''}`.trim(),
          email: u.emailAddress,
        }
      })
    }
  } catch { /* continue */ }

  // 3. Fetch metadata for these call IDs from Gong
  const extRes = await fetch(`${GONG_API_BASE}/v2/calls/extensive`, {
    method: 'POST',
    headers: gongHeaders,
    body: JSON.stringify({
      filter: { callIds },
      contentSelector: { exposedFields: { parties: true } },
    }),
  })

  if (!extRes.ok) {
    const errText = await extRes.text().catch(() => '')
    return res.status(500).json({ error: `Gong extensive API failed: ${extRes.status}`, detail: errText })
  }

  const extData = await extRes.json().catch(() => ({}))
  const gongCallMap = {}
  ;(extData.calls || []).forEach(c => {
    const id = c.metaData?.id || c.id
    gongCallMap[id] = {
      title: c.metaData?.title || null,
      started: c.metaData?.started || null,
      url: c.metaData?.url || null,
      duration: c.metaData?.duration || null,
      primaryUserId: c.metaData?.primaryUserId || null,
    }
  })

  // 4. Load accounts for title-based matching
  const { data: accounts } = await db.from('accounts').select('id, name').limit(2000)

  // 5. Update each row
  let updated = 0
  for (const callId of callIds) {
    const meta = gongCallMap[callId]
    if (!meta?.title) continue // Gong doesn't have this call anymore, skip

    const user = userMap[meta.primaryUserId] || null

    // Account matching from title
    let accountId = null
    let matchConf = null
    let matchMethod = null
    if (accounts?.length && meta.title) {
      let best = null, bestScore = 0
      for (const account of accounts) {
        const score = matchScore(account.name, meta.title)
        if (score > bestScore) { bestScore = score; best = account }
      }
      if (best && bestScore >= 6) {
        accountId = best.id
        matchConf = bestScore / 10
        matchMethod = 'title_fuzzy_inline'
      }
    }

    const patch = {
      title: meta.title,
      call_date: meta.started || null,
      gong_url: meta.url || null,
      duration_seconds: meta.duration || null,
    }

    // Only overwrite rep fields if Gong has them and we don't
    if (user?.name) patch.rep_name = user.name
    if (user?.email) patch.rep_email = user.email
    if (accountId) {
      patch.account_id = accountId
      patch.match_confidence = matchConf
      patch.match_method = matchMethod
    }

    const { error: updateErr } = await db
      .from('gong_call_analyses')
      .update(patch)
      .eq('gong_call_id', callId)

    if (!updateErr) updated++
    else console.error(`[backfill-metadata] update failed for ${callId}:`, updateErr.message)
  }

  const { count: newRemaining } = await db
    .from('gong_call_analyses')
    .select('id', { count: 'exact', head: true })
    .is('title', null)

  console.log(`[backfill-metadata] updated=${updated} remaining=${newRemaining}`)
  return res.status(200).json({ updated, remaining: newRemaining || 0, done: (newRemaining || 0) === 0 })
}
