// POST /api/gmail/send { to, subject, body, providerToken } — send an email AS the signed-in user
// via the Gmail API. Requires the gmail.send OAuth scope (added in Supabase → Google provider, then
// each user re-signs in). Returns a friendly 403 if the token lacks the scope so the UI can prompt.
import { createServerSupabaseClient, getSupabase } from '../../../lib/supabase'
import { apiError, apiSuccess, validateMethod, logRequest } from '../../../lib/apiUtils'

const toBase64Url = (str) =>
  Buffer.from(str, 'utf-8').toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')

// Supabase only exposes session.provider_token right after sign-in; it's null after a refresh. Mint a
// fresh access token from the offline refresh token captured at sign-in (same path as the calendar cron).
async function freshAccessToken(refreshToken) {
  const clientId = process.env.GOOGLE_CLIENT_ID
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET
  if (!clientId || !clientSecret || !refreshToken) return null
  try {
    const r = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, refresh_token: refreshToken, grant_type: 'refresh_token' }),
    })
    if (!r.ok) return null
    return (await r.json()).access_token || null
  } catch { return null }
}

export default async function handler(req, res) {
  logRequest(req, 'gmail/send')
  if (!validateMethod(req, res, 'POST')) return

  const auth = createServerSupabaseClient(req, res)
  const { data: { user } } = await auth.auth.getUser()
  if (!user) return apiError(res, 401, 'Unauthorized')

  const { to, subject, body, providerToken } = req.body || {}
  if (!to || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(to)) return apiError(res, 400, 'A valid recipient email is required')
  if (!subject || !body) return apiError(res, 400, 'Subject and body are required')

  // Prefer the live session token; fall back to the stored offline refresh token so Send works after a
  // page refresh, not only right after sign-in.
  let accessToken = providerToken
  if (!accessToken) {
    const { data: prof } = await getSupabase().from('profiles').select('google_refresh_token').eq('id', user.id).maybeSingle()
    if (prof?.google_refresh_token) accessToken = await freshAccessToken(prof.google_refresh_token)
  }
  if (!accessToken) return apiError(res, 400, 'Not connected to Google — reconnect in Settings')

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
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
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
