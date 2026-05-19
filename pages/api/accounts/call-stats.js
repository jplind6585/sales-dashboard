// GET /api/accounts/call-stats
// Returns last call date, call count, and max ICP score per account.
// Used to power pipeline sort/filter by engagement signals.

import { createServerSupabaseClient, getSupabase } from '../../../lib/supabase'
import { apiError, apiSuccess, logRequest } from '../../../lib/apiUtils'

export default async function handler(req, res) {
  logRequest(req, 'accounts/call-stats')
  if (req.method !== 'GET') return apiError(res, 405, 'GET only')

  const auth = createServerSupabaseClient(req, res)
  const { data: { user } } = await auth.auth.getUser()
  if (!user) return apiError(res, 401, 'Unauthorized')

  const db = getSupabase()

  const { data, error } = await db
    .from('gong_call_analyses')
    .select('account_id, call_date, analysis')
    .not('account_id', 'is', null)
    .not('analyzed_at', 'is', null)
    .order('call_date', { ascending: false })

  if (error) return apiError(res, 500, error.message)

  // Aggregate per account
  const stats = {}
  for (const row of (data || [])) {
    const id = row.account_id
    if (!stats[id]) {
      stats[id] = { lastCallDate: null, callCount: 0, maxIcpScore: null }
    }
    stats[id].callCount++
    if (!stats[id].lastCallDate || row.call_date > stats[id].lastCallDate) {
      stats[id].lastCallDate = row.call_date
    }
    const icp = row.analysis?.icp_score
    if (icp && (!stats[id].maxIcpScore || icp > stats[id].maxIcpScore)) {
      stats[id].maxIcpScore = icp
    }
  }

  return apiSuccess(res, { stats })
}
