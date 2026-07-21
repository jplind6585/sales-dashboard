import { createServerSupabaseClient, getSupabase } from '../../lib/supabase'

/**
 * GET   /api/me — return the current user's profile
 * PATCH /api/me — update the current user's own fields (slack_user_id, full_name).
 *
 * Auth is read from request cookies via createServerSupabaseClient; DB ops use the service-role
 * client. (Using createClient() here 401'd server-side — it's a browser client with no cookies.)
 */
export default async function handler(req, res) {
  const auth = createServerSupabaseClient(req, res)
  const { data: { user }, error: authError } = await auth.auth.getUser()
  if (authError || !user) return res.status(401).json({ error: 'Unauthorized' })

  const db = getSupabase()
  db.from('profiles').update({ last_active_at: new Date().toISOString() }).eq('id', user.id).then(() => {})

  if (req.method === 'GET') {
    const { data, error } = await db
      .from('profiles')
      .select('id, full_name, email, role, rep_type, slack_user_id')
      .eq('id', user.id)
      .single()
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ profile: data })
  }

  if (req.method === 'PATCH') {
    // rep_type is assigned by an admin (invite / Users page), not self-set here.
    const allowed = ['slack_user_id', 'full_name']
    const updates = {}
    for (const key of allowed) {
      if (key in req.body) updates[key] = req.body[key]
    }
    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' })
    }
    const { data, error } = await db
      .from('profiles')
      .update(updates)
      .eq('id', user.id)
      .select()
      .single()
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ profile: data })
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
