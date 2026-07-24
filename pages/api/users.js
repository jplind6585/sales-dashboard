import { createServerSupabaseClient, getSupabase } from '../../lib/supabase'
import { ROLES, REP_TYPES, isAdmin } from '../../lib/roles'
import { personaCategory } from '../../lib/repConfig'

// GET  /api/users — all user profiles merged with reps seen in Gong call data (reps who haven't
//                   logged in yet still appear via their Gong rep_name/email, role 'rep').
// PATCH /api/users { id, role?, rep_type? } — admin-only: assign another user's role / rep type.
export default async function handler(req, res) {
  const supabase = createServerSupabaseClient(req, res)
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return res.status(401).json({ error: 'Unauthorized' })

  const db = getSupabase()

  if (req.method === 'GET') {
    const [{ data: profiles, error }, { data: gongReps }] = await Promise.all([
      db.from('profiles').select('id, full_name, email, role, rep_type, last_active_at').order('full_name', { ascending: true }),
      db.from('gong_call_analyses')
        .select('rep_name, rep_email')
        .not('rep_email', 'is', null)
        .not('rep_name', 'is', null)
        .not('ignored', 'is', true),
    ])
    if (error) return res.status(500).json({ error: error.message })

    // Two classes of people. Users = real app accounts (profiles). Personas = reps who appear only in
    // call data and have no account; they are kept for attribution/analysis, tagged by category, and are
    // NOT app users. The Settings page renders them in separate sections.
    const profileEmails = new Set((profiles || []).map(p => p.email?.toLowerCase()))
    const gongRepMap = {}
    for (const r of (gongReps || [])) {
      const email = r.rep_email?.toLowerCase()
      if (!email || profileEmails.has(email) || gongRepMap[email]) continue
      gongRepMap[email] = { id: null, full_name: r.rep_name, email: r.rep_email, role: 'rep', rep_type: null, last_active_at: null, fromGong: true, persona: personaCategory(r.rep_name) }
    }
    const byName = (a, b) => (a.full_name || '').localeCompare(b.full_name || '')
    const users = (profiles || []).slice().sort(byName)
    const personas = Object.values(gongRepMap).sort(byName)
    // `users` stays the merged shape for backward compatibility; `personas` is the new call-reps group.
    return res.status(200).json({ users, personas })
  }

  if (req.method === 'PATCH') {
    const { data: me } = await db.from('profiles').select('role').eq('id', user.id).maybeSingle()
    if (!isAdmin(me)) return res.status(403).json({ error: 'Admin access required' })

    const { id, role, rep_type } = req.body || {}
    if (!id) return res.status(400).json({ error: 'id required' })
    const updates = {}
    if (role !== undefined) {
      if (!ROLES.includes(role)) return res.status(400).json({ error: 'invalid role' })
      updates.role = role
    }
    if (rep_type !== undefined) {
      if (rep_type !== null && !REP_TYPES.includes(rep_type)) return res.status(400).json({ error: 'invalid rep_type' })
      updates.rep_type = rep_type
    }
    if (!Object.keys(updates).length) return res.status(400).json({ error: 'nothing to update' })

    const { error } = await db.from('profiles').update(updates).eq('id', id)
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ ok: true })
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
