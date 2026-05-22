import { createServerSupabaseClient } from '../../lib/supabase'
import { getSupabase } from '../../lib/supabase'

// GET /api/users — returns all user profiles merged with reps from Gong call data.
// Reps who haven't logged into the dashboard yet still appear via their Gong rep_name/email.
export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const supabase = createServerSupabaseClient(req, res)
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return res.status(401).json({ error: 'Unauthorized' })

  const db = getSupabase()
  const [{ data: profiles, error }, { data: gongReps }] = await Promise.all([
    db.from('profiles').select('id, full_name, email, role').order('full_name', { ascending: true }),
    db.from('gong_call_analyses')
      .select('rep_name, rep_email')
      .not('rep_email', 'is', null)
      .not('rep_name', 'is', null)
      .not('ignored', 'is', true),
  ])

  if (error) return res.status(500).json({ error: error.message })

  // Build set of profile emails for dedup
  const profileEmails = new Set((profiles || []).map(p => p.email?.toLowerCase()))

  // Collect unique Gong reps not already in profiles
  const gongRepMap = {}
  for (const r of (gongReps || [])) {
    const email = r.rep_email?.toLowerCase()
    if (!email || profileEmails.has(email) || gongRepMap[email]) continue
    gongRepMap[email] = { id: null, full_name: r.rep_name, email: r.rep_email, role: 'rep', fromGong: true }
  }

  const merged = [
    ...(profiles || []),
    ...Object.values(gongRepMap),
  ].sort((a, b) => (a.full_name || '').localeCompare(b.full_name || ''))

  return res.status(200).json({ users: merged })
}
