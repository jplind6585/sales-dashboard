// Add/remove aliases and email domains on an account.
// PATCH { accountId, aliases: [], emailDomains: [] }

import { apiError, apiSuccess, logRequest } from '../../../lib/apiUtils';
import { createServerSupabaseClient, getSupabase } from '../../../lib/supabase';

export default async function handler(req, res) {
  logRequest(req, 'admin/update-aliases')
  if (req.method !== 'PATCH') return apiError(res, 405, 'Method not allowed')

  const authClient = createServerSupabaseClient(req, res)
  const { data: { user } } = await authClient.auth.getUser()
  if (!user) return apiError(res, 401, 'Unauthorized')

  const { accountId, aliases, emailDomains } = req.body || {}
  if (!accountId) return apiError(res, 400, 'accountId required')

  const db = getSupabase()
  const updates = {}
  if (aliases !== undefined) updates.aliases = aliases.map(a => a.trim()).filter(Boolean)
  if (emailDomains !== undefined) updates.email_domains = emailDomains.map(d => d.trim().toLowerCase().replace(/^@/, '')).filter(Boolean)

  const { data, error } = await db.from('accounts').update(updates).eq('id', accountId).select('id, name, aliases, email_domains').single()
  if (error) return apiError(res, 500, error.message)
  return apiSuccess(res, { account: data })
}
