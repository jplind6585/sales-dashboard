// GET  /api/campaigns        — list campaigns (with member counts)
// POST /api/campaigns        — create { name, type, description }
import { createServerSupabaseClient } from '../../../lib/supabase'
import { apiError, apiSuccess, logRequest } from '../../../lib/apiUtils'
import { listCampaigns, createCampaign, getCampaignsForAccount } from '../../../lib/db/campaigns'

export default async function handler(req, res) {
  logRequest(req, 'campaigns')
  const auth = createServerSupabaseClient(req, res)
  const { data: { user } } = await auth.auth.getUser()
  if (!user) return apiError(res, 401, 'Unauthorized')

  if (req.method === 'GET') {
    // ?accountId=X — campaigns this account belongs to (Overview membership); else all campaigns.
    if (req.query.accountId) {
      const { campaigns, error } = await getCampaignsForAccount(req.query.accountId)
      if (error) return apiError(res, 500, error.message)
      return apiSuccess(res, { campaigns })
    }
    const { campaigns, error } = await listCampaigns()
    if (error) return apiError(res, 500, error.message)
    return apiSuccess(res, { campaigns })
  }
  if (req.method === 'POST') {
    const { name, type, description } = req.body || {}
    if (!name?.trim()) return apiError(res, 400, 'name required')
    const { campaign, error } = await createCampaign({ name: name.trim(), type, description, createdBy: user.id })
    if (error) return apiError(res, 500, error.message)
    return apiSuccess(res, { campaign })
  }
  return apiError(res, 405, 'Method not allowed')
}
