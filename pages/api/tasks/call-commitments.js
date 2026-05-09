import { createServerSupabaseClient, getSupabase } from '../../../lib/supabase'
import { logRequest } from '../../../lib/apiUtils'

export default async function handler(req, res) {
  logRequest(req, 'tasks/call-commitments')
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const authClient = createServerSupabaseClient(req, res)
  const { data: { user } } = await authClient.auth.getUser()
  if (!user) return res.status(401).json({ error: 'Unauthorized' })

  const db = getSupabase()
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

  const { data: calls } = await db
    .from('gong_call_analyses')
    .select('id, title, call_date, analysis, account_id')
    .eq('rep_email', user.email)
    .gte('call_date', sevenDaysAgo)
    .not('analyzed_at', 'is', null)
    .order('call_date', { ascending: false })
    .limit(10)

  if (!calls?.length) return res.status(200).json({ commitments: [] })

  // Fetch account names for matched accounts
  const accountIds = [...new Set(calls.map(c => c.account_id).filter(Boolean))]
  let accountMap = {}
  if (accountIds.length) {
    const { data: accounts } = await db
      .from('accounts')
      .select('id, name')
      .in('id', accountIds)
    if (accounts) accounts.forEach(a => { accountMap[a.id] = a.name })
  }

  // Fetch existing Gong-sourced tasks to avoid surfacing items already added
  const { data: existingTasks } = await db
    .from('tasks')
    .select('title')
    .eq('owner_id', user.id)
    .in('source_type', ['gong_next_step', 'gong_commitment'])
    .is('dismissed_at', null)

  const existingTitles = new Set(
    (existingTasks || []).map(t => t.title.toLowerCase().trim())
  )

  const commitments = []

  for (const call of calls) {
    const a = call.analysis || {}
    const callDate = call.call_date?.split('T')[0]
    const callTitle = call.title || 'Untitled call'
    const accountName = accountMap[call.account_id] || null

    const rawCommitments = Array.isArray(a.commitments) ? a.commitments : []
    const rawNextSteps = Array.isArray(a.next_steps_mentioned) ? a.next_steps_mentioned : []

    const allItems = [
      ...rawCommitments.map(c => ({ text: c, type: 'commitment' })),
      ...rawNextSteps.map(s => ({ text: s, type: 'next_step' })),
    ]

    for (const item of allItems) {
      if (!item.text || typeof item.text !== 'string') continue
      const normalized = item.text.toLowerCase().trim()
      if (existingTitles.has(normalized)) continue

      commitments.push({
        id: `${call.id}_${commitments.length}`,
        callId: call.id,
        callTitle,
        callDate,
        accountId: call.account_id || null,
        accountName,
        text: item.text,
        type: item.type,
      })
    }
  }

  return res.status(200).json({ commitments: commitments.slice(0, 12) })
}
