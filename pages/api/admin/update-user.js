import { createServerSupabaseClient, getSupabase } from '../../../lib/supabase'
import { REP_TYPES } from '../../../lib/roles'

export default async function handler(req, res) {
  if (req.method !== 'PATCH') return res.status(405).json({ error: 'Method not allowed' })

  const supabase = createServerSupabaseClient(req, res)
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return res.status(401).json({ error: 'Unauthorized' })

  const db = getSupabase()
  const { data: profile } = await db.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return res.status(403).json({ error: 'Admin only' })

  const { userId, rep_type } = req.body
  if (!userId) return res.status(400).json({ error: 'userId required' })
  if (rep_type != null && rep_type !== '' && !REP_TYPES.includes(rep_type)) {
    return res.status(400).json({ error: 'Invalid rep_type — expected ae or sdr' })
  }

  const updates = {}
  if (rep_type !== undefined) updates.rep_type = rep_type || null

  if (Object.keys(updates).length === 0) return res.status(400).json({ error: 'No valid fields' })

  const { error } = await db.from('profiles').update(updates).eq('id', userId)
  if (error) return res.status(500).json({ error: error.message })

  return res.status(200).json({ ok: true })
}
