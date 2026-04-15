import { createServerSupabaseClient } from '../../lib/supabase'
import { getSupabase } from '../../lib/supabase'

/**
 * GET /api/users — returns all active user profiles (for assignment dropdowns)
 */
export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const supabase = createServerSupabaseClient(req, res)
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return res.status(401).json({ error: 'Unauthorized' })

  const db = getSupabase()
  const { data, error } = await db
    .from('profiles')
    .select('id, full_name, email, role')
    .order('full_name', { ascending: true })

  if (error) return res.status(500).json({ error: error.message })
  return res.status(200).json({ users: data || [] })
}
