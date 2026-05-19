// POST /api/hubspot/log-note
// { accountId, subject, noteBody? }
// Logs an email draft activity as a HubSpot note on the deal associated with the account.

import { createServerSupabaseClient, getSupabase } from '../../../lib/supabase'
import { apiError, apiSuccess, logRequest } from '../../../lib/apiUtils'

const HS_BASE = 'https://api.hubapi.com'

async function hsFetch(path, options = {}) {
  const apiKey = process.env.HUBSPOT_API_KEY
  if (!apiKey) throw new Error('HUBSPOT_API_KEY not configured')
  const res = await fetch(`${HS_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
      ...(options.headers || {}),
    },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`HubSpot API ${res.status}: ${body}`)
  }
  return res.json()
}

export default async function handler(req, res) {
  logRequest(req, 'hubspot/log-note')
  if (req.method !== 'POST') return apiError(res, 405, 'Method not allowed')

  const authClient = createServerSupabaseClient(req, res)
  const { data: { user } } = await authClient.auth.getUser()
  if (!user) return apiError(res, 401, 'Unauthorized')

  const { accountId, subject, noteBody } = req.body || {}
  if (!accountId) return apiError(res, 400, 'accountId required')

  const db = getSupabase()
  const { data: account, error } = await db
    .from('accounts')
    .select('id, name, hubspot_deal_id')
    .eq('id', accountId)
    .single()

  if (error || !account) return apiError(res, 404, 'Account not found')
  if (!account.hubspot_deal_id) return apiError(res, 422, 'Account has no HubSpot deal linked')

  const body = noteBody || `Email drafted: "${subject || 'untitled'}"\n\nPrepared via Sales Dashboard — sent by ${user.email}`

  let noteId = null
  let success = false
  let errMsg = null

  try {
    const note = await hsFetch('/crm/v3/objects/notes', {
      method: 'POST',
      body: JSON.stringify({
        properties: {
          hs_note_body: body,
          hs_timestamp: new Date().toISOString(),
        },
        associations: [{
          to: { id: account.hubspot_deal_id },
          types: [{ associationCategory: 'HUBSPOT_DEFINED', associationTypeId: 214 }],
        }],
      }),
    })
    noteId = note.id
    success = true
  } catch (err) {
    console.error('[hubspot/log-note]', err.message)
    errMsg = err.message
  }

  // Write to audit log (non-blocking)
  db.from('hubspot_sync_log').insert({
    action: 'note_created',
    account_id: account.id,
    account_name: account.name,
    hubspot_deal_id: account.hubspot_deal_id,
    payload: { subject, noteBody: body.slice(0, 500) },
    result: success ? { noteId } : { error: errMsg },
    triggered_by: user.email,
    success,
  }).then().catch(e => console.error('[hubspot/log-note] audit log write failed:', e.message))

  if (!success) return apiError(res, 500, errMsg)
  return apiSuccess(res, { noteId, accountName: account.name })
}
