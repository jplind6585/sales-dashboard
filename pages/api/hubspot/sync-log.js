// GET /api/hubspot/sync-log
// Returns paginated HubSpot audit log entries.
// Query params: ?limit=50&offset=0&action=&account=

import { createServerSupabaseClient, getSupabase } from '../../../lib/supabase'
import { apiError, apiSuccess, logRequest } from '../../../lib/apiUtils'

export default async function handler(req, res) {
  logRequest(req, 'hubspot/sync-log')
  if (req.method !== 'GET') return apiError(res, 405, 'GET only')

  const auth = createServerSupabaseClient(req, res)
  const { data: { user } } = await auth.auth.getUser()
  if (!user) return apiError(res, 401, 'Unauthorized')

  const limit = Math.min(parseInt(req.query.limit) || 50, 200)
  const offset = parseInt(req.query.offset) || 0
  const actionFilter = req.query.action || null
  const accountFilter = req.query.account || null

  const db = getSupabase()
  let query = db
    .from('hubspot_sync_log')
    .select('id, created_at, action, account_name, hubspot_deal_id, payload, result, triggered_by, success', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (actionFilter) query = query.eq('action', actionFilter)
  if (accountFilter) query = query.ilike('account_name', `%${accountFilter}%`)

  const { data, count, error } = await query
  if (error) return apiError(res, 500, error.message)

  return apiSuccess(res, { entries: data || [], total: count || 0, limit, offset })
}
