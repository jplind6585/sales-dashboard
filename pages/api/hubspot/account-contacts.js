// Fetches HubSpot contacts associated with a deal and returns them for stakeholder import.
// GET ?accountId=X

import { apiError, apiSuccess, logRequest } from '../../../lib/apiUtils'
import { createServerSupabaseClient, getSupabase } from '../../../lib/supabase'

const HS_API_BASE = 'https://api.hubapi.com'

export default async function handler(req, res) {
  logRequest(req, 'hubspot/account-contacts')
  if (req.method !== 'GET') return apiError(res, 405, 'GET only')

  const auth = createServerSupabaseClient(req, res)
  const { data: { user } } = await auth.auth.getUser()
  if (!user) return apiError(res, 401, 'Unauthorized')

  const { accountId } = req.query
  if (!accountId) return apiError(res, 400, 'accountId required')

  const hsKey = process.env.HUBSPOT_API_KEY
  if (!hsKey) return apiError(res, 500, 'HUBSPOT_API_KEY not configured')

  const db = getSupabase()

  // Get hubspot_deal_id for this account
  const { data: account } = await db.from('accounts').select('hubspot_deal_id, name').eq('id', accountId).single()
  if (!account?.hubspot_deal_id) return apiSuccess(res, { contacts: [] })

  // Fetch deal with contact associations
  const dealRes = await fetch(`${HS_API_BASE}/crm/v3/objects/deals/${account.hubspot_deal_id}?associations=contacts`, {
    headers: { Authorization: `Bearer ${hsKey}` }
  })
  if (!dealRes.ok) return apiError(res, 500, 'HubSpot deal fetch failed')
  const deal = await dealRes.json()

  const contactIds = (deal.associations?.contacts?.results || []).map(r => r.id)
  if (!contactIds.length) return apiSuccess(res, { contacts: [] })

  // Batch fetch contact details
  const contactRes = await fetch(`${HS_API_BASE}/crm/v3/objects/contacts/batch/read`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${hsKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      properties: ['firstname', 'lastname', 'jobtitle', 'email', 'phone', 'department'],
      inputs: contactIds.map(id => ({ id }))
    })
  })
  if (!contactRes.ok) return apiSuccess(res, { contacts: [] })
  const contactData = await contactRes.json()

  const contacts = (contactData.results || []).map(c => ({
    hubspotContactId: c.id,
    name: [c.properties?.firstname, c.properties?.lastname].filter(Boolean).join(' ') || 'Unknown',
    title: c.properties?.jobtitle || null,
    department: c.properties?.department || null,
    email: c.properties?.email || null,
    phone: c.properties?.phone || null,
  })).filter(c => c.name !== 'Unknown' || c.email)

  return apiSuccess(res, { contacts, accountName: account.name })
}
