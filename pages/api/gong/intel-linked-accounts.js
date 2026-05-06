// Given a list of account_ids, return the ones that are active pipeline accounts.
// POST { accountIds: ['uuid', ...] }

import { apiError, apiSuccess, logRequest } from '../../../lib/apiUtils';
import { getSupabase } from '../../../lib/supabase';

const ACTIVE_STAGES = ['intro_scheduled', 'active_pursuit', 'demo', 'solution_validation', 'proposal', 'legal']

export default async function handler(req, res) {
  logRequest(req, 'gong/intel-linked-accounts')
  if (req.method !== 'POST') return apiError(res, 405, 'Method not allowed')

  const { accountIds } = req.body || {}
  if (!accountIds?.length) return apiSuccess(res, { accounts: [] })

  const db = getSupabase()
  const { data, error } = await db
    .from('accounts')
    .select('id, name, stage, deal_value, user_id')
    .in('id', accountIds.slice(0, 50))
    .in('stage', ACTIVE_STAGES)

  if (error) return apiError(res, 500, error.message)

  // Fetch rep names for user_ids
  const userIds = [...new Set((data || []).map(a => a.user_id).filter(Boolean))]
  let profileMap = {}
  if (userIds.length) {
    const { data: profiles } = await db.from('profiles').select('id, full_name').in('id', userIds)
    ;(profiles || []).forEach(p => { profileMap[p.id] = p.full_name })
  }

  const accounts = (data || []).map(a => ({
    id: a.id,
    name: a.name,
    stage: a.stage,
    dealValue: a.deal_value,
    repName: profileMap[a.user_id] || null,
  }))

  return apiSuccess(res, { accounts })
}
