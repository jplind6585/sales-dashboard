// Pulls all HubSpot deals and matches them to accounts by name.
// Updates accounts with deal_value, close_date, hubspot_deal_id, hubspot_stage.
// HubSpot is the source of truth — this is read-only from HS, write-only to Supabase.

import { apiError, apiSuccess, logRequest } from '../../../lib/apiUtils';
import { createServerSupabaseClient, getSupabase } from '../../../lib/supabase';

const HS_API_BASE = 'https://api.hubapi.com';

function normalizeName(s) {
  return (s || '')
    .toLowerCase()
    .replace(/banner[\s\-–—]*/gi, '')       // strip "Banner - " prefix
    .replace(/[\-–—:|]/g, ' ')               // dashes/colons → space
    .replace(/\b(intro|demo|discovery|presentation|follow\s*up|meeting|call)\b/gi, '')
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function matchScore(accountName, dealName) {
  const a = normalizeName(accountName)
  const d = normalizeName(dealName)
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

async function fetchAllDeals(key) {
  const deals = []
  let after = null
  let pages = 0

  do {
    const params = new URLSearchParams({
      properties: 'dealname,amount,dealstage,closedate',
      limit: '100',
      ...(after ? { after } : {}),
    })
    const r = await fetch(`${HS_API_BASE}/crm/v3/objects/deals?${params}`, {
      headers: { Authorization: `Bearer ${key}` },
    })
    if (!r.ok) break
    const d = await r.json().catch(() => ({}))
    deals.push(...(d.results || []))
    after = d.paging?.next?.after || null
    pages++
  } while (after && pages < 100)

  console.log(`[hubspot/sync-deals] fetched ${deals.length} deals across ${pages} pages`)
  return deals
}

export default async function handler(req, res) {
  logRequest(req, 'hubspot/sync-deals')
  if (req.method !== 'POST') return apiError(res, 405, 'Method not allowed')

  const authClient = createServerSupabaseClient(req, res)
  const { data: { user } } = await authClient.auth.getUser()
  if (!user) return apiError(res, 401, 'Unauthorized')

  const hsKey = process.env.HUBSPOT_API_KEY
  if (!hsKey) return apiError(res, 500, 'HUBSPOT_API_KEY not configured')

  const db = getSupabase()

  // Fetch HubSpot deals and Supabase accounts in parallel
  const [deals, { data: accounts }] = await Promise.all([
    fetchAllDeals(hsKey),
    db.from('accounts').select('id, name, stage'),
  ])

  if (!deals.length) return apiError(res, 502, 'No deals returned from HubSpot')
  if (!accounts?.length) return apiSuccess(res, { matched: 0, total: 0 })

  const now = new Date().toISOString()
  const MIN_SCORE = 2
  let matched = 0

  const updates = []
  for (const account of accounts) {
    let best = null
    let bestScore = 0

    for (const deal of deals) {
      const score = matchScore(account.name, deal.properties?.dealname || '')
      if (score > bestScore) {
        bestScore = score
        best = deal
      }
    }

    if (!best || bestScore < MIN_SCORE) continue

    const rawAmount = best.properties?.amount
    const dealValue = rawAmount ? parseFloat(rawAmount) : null
    const rawClose = best.properties?.closedate
    const closeDate = rawClose ? rawClose.split('T')[0] : null

    updates.push({
      id: account.id,
      hubspot_deal_id: best.id,
      hubspot_stage: best.properties?.dealstage || null,
      deal_value: dealValue,
      close_date: closeDate,
      hubspot_synced_at: now,
    })
    matched++
  }

  // Upsert in batches of 50
  for (let i = 0; i < updates.length; i += 50) {
    await db.from('accounts').upsert(updates.slice(i, i + 50), { onConflict: 'id' })
  }

  console.log(`[hubspot/sync-deals] matched ${matched} of ${accounts.length} accounts`)
  return apiSuccess(res, { matched, total: accounts.length, dealsSearched: deals.length })
}
