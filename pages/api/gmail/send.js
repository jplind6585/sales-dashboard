// POST /api/gmail/send { to, subject, body, providerToken } — send an email AS the signed-in user
// via the Gmail API. Requires the gmail.send OAuth scope (added in Supabase → Google provider, then
// each user re-signs in). Returns a friendly 403 if the token lacks the scope so the UI can prompt.
import { createServerSupabaseClient } from '../../../lib/supabase'
import { apiError, apiSuccess, validateMethod, logRequest } from '../../../lib/apiUtils'

const toBase64Url = (str) =>
  Buffer.from(str, 'utf-8').toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')

export default async function handler(req, res) {
  logRequest(req, 'gmail/send')
  if (!validateMethod(req, res, 'POST')) return

  const auth = createServerSupabaseClient(req, res)
  const { data: { user } } = await auth.auth.getUser()
  if (!user) return apiError(res, 401, 'Unauthorized')

  const { to, subject, body, providerToken } = req.body || {}
  if (!to || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(to)) return apiError(res, 400, 'A valid recipient email is required')
  if (!subject || !body) return apiError(res, 400, 'Subject and body are required')
  if (!providerToken) return apiError(res, 400, 'Not connected to Google — reconnect in Settings')

  // RFC 2822 message. Subject is header-encoded to survive non-ASCII.
  const encSubject = `=?UTF-8?B?${Buffer.from(subject, 'utf-8').toString('base64')}?=`
  const mime = [
    `From: ${user.email}`,
    `To: ${to}`,
    `Subject: ${encSubject}`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset="UTF-8"',
    '',
    body,
  ].join('\r\n')

  try {
    const r = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
      method: 'POST',
      headers: { Authorization: `Bearer ${providerToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ raw: toBase64Url(mime) }),
    })
    if (r.status === 401 || r.status === 403) {
      return apiError(res, 403, 'Gmail send permission missing — an admin must add the gmail.send scope, then re-sign in.')
    }
    if (!r.ok) return apiError(res, 502, `Gmail send failed: ${(await r.text()).slice(0, 200)}`)
    const data = await r.json()
    return apiSuccess(res, { id: data.id })
  } catch (e) {
    return apiError(res, 500, e.message || 'Send failed')
  }
}
