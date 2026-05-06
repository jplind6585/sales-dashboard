// GET: fetch investor narrative version history
// POST { narrative, callCount }: save a new version

import { apiError, apiSuccess, logRequest } from '../../../lib/apiUtils';
import { createServerSupabaseClient, getSupabase } from '../../../lib/supabase';

export default async function handler(req, res) {
  logRequest(req, 'gong/intel-narrative-history')

  if (req.method === 'GET') {
    const db = getSupabase()
    const { data, error } = await db
      .from('investor_narratives')
      .select('id, narrative, generated_at, call_count, generated_by')
      .order('generated_at', { ascending: false })
      .limit(10)
    if (error) return apiError(res, 500, error.message)
    return apiSuccess(res, { versions: data || [] })
  }

  if (req.method === 'POST') {
    const authClient = createServerSupabaseClient(req, res)
    const { data: { user } } = await authClient.auth.getUser()
    if (!user) return apiError(res, 401, 'Unauthorized')

    const { narrative, callCount } = req.body || {}
    if (!narrative) return apiError(res, 400, 'narrative required')

    const db = getSupabase()
    const { error } = await db.from('investor_narratives').insert({
      narrative,
      call_count: callCount || null,
      generated_by: user.email,
    })
    if (error) return apiError(res, 500, error.message)
    return apiSuccess(res, { saved: true })
  }

  return apiError(res, 405, 'Method not allowed')
}
