import { createServerSupabaseClient, getSupabase } from '../../../lib/supabase'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const supabase = createServerSupabaseClient(req, res)
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return res.status(401).json({ error: 'Unauthorized' })

  const db = getSupabase()
  const { data: profile } = await db.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return res.status(403).json({ error: 'Admin only' })

  const { email, role } = req.body
  if (!email || !role) return res.status(400).json({ error: 'email and role required' })

  const { data, error } = await db.auth.admin.inviteUserByEmail(email, {
    data: { role: 'rep', rep_type: role },
  })
  if (error) return res.status(500).json({ error: error.message })

  return res.status(200).json({ user: data.user })
}
