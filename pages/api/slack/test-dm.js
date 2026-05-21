import { createServerSupabaseClient, getSupabase } from '../../../lib/supabase'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const supabase = createServerSupabaseClient(req, res)
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return res.status(401).json({ error: 'Unauthorized' })

  const db = getSupabase()
  const { data: profile } = await db.from('profiles').select('slack_user_id, full_name').eq('id', user.id).single()
  if (!profile?.slack_user_id) return res.status(400).json({ error: 'No Slack ID saved yet' })

  const token = process.env.SLACK_BOT_TOKEN
  if (!token) return res.status(500).json({ error: 'Slack not configured' })

  const name = profile.full_name || user.email?.split('@')[0] || 'there'
  const r = await fetch('https://slack.com/api/chat.postMessage', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      channel: profile.slack_user_id,
      text: `Hey ${name} — Slack notifications are connected. You'll receive your daily digest here each morning.`,
    }),
  })
  const d = await r.json()
  if (!d.ok) return res.status(500).json({ error: d.error || 'Slack DM failed' })
  return res.status(200).json({ ok: true })
}
