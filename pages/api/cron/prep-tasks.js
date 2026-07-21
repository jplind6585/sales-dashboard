// Pre-call prep cron. For each user with a stored Google refresh token, mint a fresh access token,
// pull the next ~2 days of calendar events, and for each EXTERNAL meeting create the active pre-call
// playbook checklist (due relative to the meeting). Idempotent via (source='calendar', sourceId).
// Dormant until GOOGLE_CLIENT_ID/SECRET are set in the environment + a user has re-consented.
import { getSupabase } from '../../../lib/supabase'
import { createTask, findTaskBySource } from '../../../lib/db/tasks'

const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token'
const CAL_API = 'https://www.googleapis.com/calendar/v3/calendars/primary/events'

async function freshAccessToken(refreshToken) {
  const clientId = process.env.GOOGLE_CLIENT_ID
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET
  if (!clientId || !clientSecret || !refreshToken) return null
  try {
    const r = await fetch(GOOGLE_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, refresh_token: refreshToken, grant_type: 'refresh_token' }),
    })
    if (!r.ok) return null
    return (await r.json()).access_token || null
  } catch { return null }
}

export default async function handler(req, res) {
  const secret = process.env.CRON_SECRET
  const authHeader = req.headers.authorization || ''
  if (secret && authHeader !== `Bearer ${secret}`) return res.status(401).json({ error: 'Unauthorized' })

  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    return res.status(200).json({ ok: false, reason: 'GOOGLE_CLIENT_ID/SECRET not set — pre-call prep dormant' })
  }

  const db = getSupabase()
  const { data: pb } = await db.from('task_playbooks').select('steps').eq('trigger', 'pre_call').eq('active', true).limit(1).maybeSingle()
  const steps = Array.isArray(pb?.steps) ? pb.steps : []
  if (!steps.length) return res.status(200).json({ ok: true, created: 0, reason: 'no active pre-call playbook' })

  const { data: users } = await db.from('profiles').select('id, email, google_refresh_token').not('google_refresh_token', 'is', null)
  const now = new Date()
  const timeMax = new Date(now.getTime() + 2 * 86400000)
  let created = 0, processedUsers = 0

  for (const u of users || []) {
    const token = await freshAccessToken(u.google_refresh_token)
    if (!token) continue
    processedUsers++
    const params = new URLSearchParams({ timeMin: now.toISOString(), timeMax: timeMax.toISOString(), singleEvents: 'true', orderBy: 'startTime', maxResults: '25' })
    const evRes = await fetch(`${CAL_API}?${params}`, { headers: { Authorization: `Bearer ${token}` } })
    if (!evRes.ok) continue
    const items = (await evRes.json()).items || []
    const myDomain = (u.email.split('@')[1] || '').toLowerCase()

    for (const ev of items) {
      const start = ev.start?.dateTime // timed events only (skip all-day)
      if (!start || ev.status === 'cancelled') continue
      const external = (ev.attendees || []).some(a => a.email && !a.resource && !a.email.toLowerCase().endsWith('@' + myDomain))
      if (!external) continue // internal meeting → no pre-call prep
      const meetingMs = new Date(start).getTime()
      const when = new Date(start).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })

      for (let i = 0; i < steps.length; i++) {
        const s = steps[i]
        const sourceId = `precall:${ev.id}:${i}`
        if (await findTaskBySource('calendar', sourceId)) continue
        const due = new Date(meetingMs + (Number(s.due_offset_hours) || 0) * 3600000).toISOString().slice(0, 10)
        const { error } = await createTask(u.id, {
          title: `${s.title} — ${ev.summary || 'meeting'}`,
          description: `Pre-call checklist for "${ev.summary || 'meeting'}" (${when})`,
          type: 'triggered',
          priority: [1, 2, 3].includes(Number(s.priority)) ? Number(s.priority) : 2,
          ownerId: u.id, source: 'calendar', sourceId, sourceType: 'playbook_pre_call', dueDate: due,
        })
        if (!error) created++
      }
    }
  }
  return res.status(200).json({ ok: true, processedUsers, created })
}
