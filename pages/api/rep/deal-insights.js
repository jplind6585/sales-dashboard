import { createServerSupabaseClient, getSupabase } from '../../../lib/supabase'
import { logRequest } from '../../../lib/apiUtils'

const STAGE_WEIGHT = {
  legal: 9,
  proposal: 8,
  solution_validation: 7,
  demo: 6,
  active_pursuit: 5,
  intro_scheduled: 4,
  qualifying: 3,
}

const INSIGHT_STAGES = ['demo', 'solution_validation', 'proposal', 'legal']

export default async function handler(req, res) {
  logRequest(req, 'rep/deal-insights')
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const authClient = createServerSupabaseClient(req, res)
  const { data: { user } } = await authClient.auth.getUser()
  if (!user) return res.status(401).json({ error: 'Unauthorized' })

  const db = getSupabase()
  const today = new Date().toISOString().split('T')[0]
  const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString()

    // Try fetching today's pre-generated daily_insights row
  const { data: insightRow } = await db
    .from('daily_insights')
    .select('insight, account_name, account_id, action_recommendation, insights_array, created_at')
    .eq('user_id', user.id)
    .eq('insight_date', today)
    .maybeSingle()

  // If nightly cron already ran and insights_array is populated, return it
  if (insightRow?.insights_array?.length) {
    const idleQueue = await computeIdleQueue(db, user)
    return res.status(200).json({
      insights: insightRow.insights_array,
      idle_queue: idleQueue,
      generated_at: insightRow.created_at,
      is_live: true,
    })
  }

  // If row exists but no insights_array, surface single insight from legacy columns
  if (insightRow) {
    const insight = {
      account_name: insightRow.account_name || 'Unknown',
      account_id: insightRow.account_id,
      headline: insightRow.insight?.slice(0, 80) || 'Deal needs attention',
      insight: insightRow.insight,
      recommended_action: insightRow.action_recommendation || 'Review account status',
      type: 'deal_watch',
      urgency: 'medium',
    }

    const idleQueue = await computeIdleQueue(db, user)

    return res.status(200).json({
      insights: [insight],
      idle_queue: idleQueue,
      generated_at: insightRow.created_at,
      is_live: false,
    })
  }

  // Fallback: compute lightweight insights on the fly
  const { data: activeAccounts } = await db
    .from('accounts')
    .select('id, name, stage')
    .in('stage', INSIGHT_STAGES)
    .is('parent_account_id', null)   // one row per company (masters) — no duplicate account cards
    .order('name')
    .limit(50)

  if (!activeAccounts || activeAccounts.length === 0) {
    const idleQueue = await computeIdleQueue(db, user)
    return res.status(200).json({ insights: [], idle_queue: idleQueue, generated_at: new Date().toISOString(), is_live: true })
  }

  // Last call per COMPANY — rolled up across each master's child deal-rows. After a dedupe/merge the
  // calls often sit on the children, so the master's own row shows none ("No calls linked yet" bug).
  const lastCallByAccount = await lastCallByCompany(db, activeAccounts)

  const now = Date.now()
  const insights = []

  for (const account of activeAccounts) {
    const lastCall = lastCallByAccount[account.id]
    if (lastCall && new Date(lastCall) >= new Date(fourteenDaysAgo)) continue

    const daysCold = lastCall
      ? Math.floor((now - new Date(lastCall).getTime()) / (1000 * 60 * 60 * 24))
      : null

    insights.push({
      account_name: account.name,
      account_id: account.id,
      stage: account.stage,
      headline: lastCall ? `No call in ${daysCold} days` : 'No calls linked yet',
      insight_text: lastCall
        ? `Last Gong call was ${daysCold} days ago. Deal may be going cold.`
        : 'No Gong calls are linked to this company yet — either none have happened, or calls exist but aren’t matched. Verify before assuming no activity.',
      recommended_action: 'Schedule a check-in',
      type: 'gone_cold',
      urgency: (daysCold == null || daysCold > 30) ? 'high' : 'medium',
      days_cold: daysCold,
    })

    if (insights.length >= 3) break
  }

  const idleQueue = await computeIdleQueue(db, user)

  return res.status(200).json({
    insights,
    idle_queue: idleQueue,
    generated_at: new Date().toISOString(),
    is_live: true,
  })
}

async function computeIdleQueue(db, user) {
  const { data: accounts } = await db
    .from('accounts')
    .select('id, name, stage')
    .not('stage', 'in', '(closed_won,closed_lost)')
    .is('parent_account_id', null)   // masters only — one row per company
    .order('name')
    .limit(80)

  if (!accounts || accounts.length === 0) return []

  const lastCallByAccount = await lastCallByCompany(db, accounts)

  const now = Date.now()

  const scored = accounts.map(a => {
    const last = lastCallByAccount[a.id]
    const daysSince = last
      ? Math.floor((now - new Date(last).getTime()) / (1000 * 60 * 60 * 24))
      : 999
    const weight = STAGE_WEIGHT[a.stage] || 2
    return { ...a, days_since_last_call: daysSince, score: weight * daysSince }
  })

  scored.sort((a, b) => b.score - a.score)

  return scored.slice(0, 3).map(a => ({
    account_id: a.id,
    name: a.name,
    stage: a.stage,
    days_since_last_call: a.days_since_last_call === 999 ? null : a.days_since_last_call,
    suggested_angle: `Check in on ${(a.stage || 'deal').replace(/_/g, ' ')} progress`,
  }))
}

// Newest analyzed Gong call per company, rolled up across a master account and its child deal-rows.
// Merged companies keep their calls on the child rows, so a master queried alone shows zero.
// Returns { masterId: newest call_date }.
async function lastCallByCompany(db, masters) {
  const masterIds = (masters || []).map(m => m.id)
  if (!masterIds.length) return {}
  const { data: kids } = await db
    .from('accounts')
    .select('id, parent_account_id')
    .in('parent_account_id', masterIds)

  const toMaster = {}
  masterIds.forEach(id => { toMaster[id] = id })
  for (const k of (kids || [])) toMaster[k.id] = k.parent_account_id

  const { data: calls } = await db
    .from('gong_call_analyses')
    .select('account_id, call_date')
    .in('account_id', Object.keys(toMaster))
    .not('analyzed_at', 'is', null)
    .order('call_date', { ascending: false })
    .limit(3000)

  const last = {}
  for (const c of (calls || [])) {
    const m = toMaster[c.account_id]
    if (m && (!last[m] || new Date(c.call_date) > new Date(last[m]))) last[m] = c.call_date
  }
  return last
}
