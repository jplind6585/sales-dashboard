import { createClient } from '../../lib/supabase'

/**
 * GET  /api/me — return current user's profile
 * PATCH /api/me — update current user's profile fields
 */
export default async function handler(req, res) {
  const supabase = createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return res.status(401).json({ error: 'Unauthorized' })

  if (req.method === 'GET') {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, full_name, email, role, slack_user_id')
      .eq('id', user.id)
      .single()
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ profile: data })
  }

  if (req.method === 'PATCH') {
    const allowed = ['slack_user_id', 'full_name']
    const updates = {}
    for (const key of allowed) {
      if (key in req.body) updates[key] = req.body[key]
    }
    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' })
    }
    const { data, error } = await supabase
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
