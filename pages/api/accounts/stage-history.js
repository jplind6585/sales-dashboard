import { getSupabase } from '../../../lib/supabase'
import { apiError, apiSuccess } from '../../../lib/apiUtils'

export default async function handler(req, res) {
  if (req.method !== 'GET') return apiError(res, 405, 'Method not allowed')

  const { accountId } = req.query
  if (!accountId) return apiError(res, 400, 'accountId required')

  const db = getSupabase()

  const { data: history, error } = await db
    .from('account_stage_history')
    .select('id, from_stage, to_stage, changed_at, changed_by_name, days_in_prior_stage, deal_value_at_change')
    .eq('account_id', accountId)
    .order('changed_at', { ascending: true })

  if (error) return apiError(res, 500, error.message)

  return apiSuccess(res, { history: history || [] })
}
