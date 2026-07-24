import { createServerSupabaseClient, getSupabase } from '../../../lib/supabase'
import { REP_TYPES } from '../../../lib/roles'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const supabase = createServerSupabaseClient(req, res)
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return res.status(401).json({ error: 'Unauthorized' })

  const db = getSupabase()
  const { data: profile } = await db.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return res.status(403).json({ error: 'Admin only' })

  const { email, role: designation } = req.body
  if (!email) return res.status(400).json({ error: 'email required' })

  // The invite picker is a single "designation": AE / SDR are seller types (-> rep_type, access
  // role stays 'rep'); Manager is an access role (-> role, no rep_type). Map it to profile columns.
  let meta
  if (designation === 'manager') meta = { role: 'manager', rep_type: null }
  else if (REP_TYPES.includes(designation)) meta = { role: 'rep', rep_type: designation }
  else return res.status(400).json({ error: 'Invalid designation. Expected ae, sdr, support, or manager.' })

  const { data, error } = await db.auth.admin.inviteUserByEmail(email, { data: meta })
  if (error) return res.status(500).json({ error: error.message })

  return res.status(200).json({ user: data.user })
}
