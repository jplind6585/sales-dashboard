// GET    /api/campaigns/[id]                 — campaign detail + members
// PATCH  /api/campaigns/[id]                 — update { name, type, status, description }
// POST   /api/campaigns/[id]  { accountIds } — add accounts to the campaign
// DELETE /api/campaigns/[id]?accountId=x     — remove one member; without accountId — delete the campaign
import { createServerSupabaseClient } from '../../../lib/supabase'
import { apiError, apiSuccess, logRequest } from '../../../lib/apiUtils'
import { getCampaign, updateCampaign, deleteCampaign, addAccountsToCampaign, removeAccountFromCampaign } from '../../../lib/db/campaigns'

export default async function handler(req, res) {
  logRequest(req, 'campaigns/[id]')
  const auth = createServerSupabaseClient(req, res)
  const { data: { user } } = await auth.auth.getUser()
  if (!user) return apiError(res, 401, 'Unauthorized')
  const { id } = req.query
  // Guard malformed ids (Postgres would otherwise 500 on an invalid uuid).
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(id || ''))) return apiError(res, 404, 'Campaign not found')

  if (req.method === 'GET') {
    const { campaign, error } = await getCampaign(id)
    if (error) return apiError(res, 500, error.message)
    if (!campaign) return apiError(res, 404, 'Campaign not found')
    return apiSuccess(res, { campaign })
  }
  if (req.method === 'PATCH') {
    const { campaign, error } = await updateCampaign(id, req.body || {})
    if (error) return apiError(res, 500, error.message)
    return apiSuccess(res, { campaign })
  }
  if (req.method === 'POST') {
    const { accountIds } = req.body || {}
    if (!Array.isArray(accountIds) || accountIds.length === 0) return apiError(res, 400, 'accountIds required')
    const { added, error } = await addAccountsToCampaign(id, accountIds)
    if (error) return apiError(res, 500, error.message)
    return apiSuccess(res, { added })
  }
  if (req.method === 'DELETE') {
    const { accountId } = req.query
    if (accountId) {
      const { error } = await removeAccountFromCampaign(id, accountId)
      if (error) return apiError(res, 500, error.message)
      return apiSuccess(res, { removed: accountId })
    }
    const { error } = await deleteCampaign(id)
    if (error) return apiError(res, 500, error.message)
    return apiSuccess(res, { deleted: id })
  }
  return apiError(res, 405, 'Method not allowed')
}
