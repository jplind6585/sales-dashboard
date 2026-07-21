import { getTasks, createTask, findTaskBySource } from '../../lib/db/tasks'
import { createServerSupabaseClient, getSupabase } from '../../lib/supabase'

export default async function handler(req, res) {
  // Resolve the current user from the session cookie
  const supabase = createServerSupabaseClient(req, res)
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  // When Supabase auth is disabled (NEXT_PUBLIC_USE_SUPABASE=false), stub a user
  const currentUser = user || (process.env.NEXT_PUBLIC_USE_SUPABASE === 'false' ? { id: 'local-user' } : null)

  if (!currentUser) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  if (currentUser.id !== 'local-user') {
    getSupabase().from('profiles').update({ last_active_at: new Date().toISOString() }).eq('id', currentUser.id).then(() => {})
  }

  // ── GET /api/tasks ──────────────────────────────────────────────────────────
  if (req.method === 'GET') {
    const { ownerId, status, type, accountId, view, scope } = req.query

    // view=team returns the per-rep summary for the manager view
    if (view === 'team') {
      const { getTeamTaskSummary } = await import('../../lib/db/tasks')
      const { summary, error } = await getTeamTaskSummary()
      if (error) {
        console.error('getTeamTaskSummary error:', error)
        return res.status(500).json({ error: 'Failed to fetch team summary' })
      }
      return res.status(200).json({ success: true, summary })
    }

    // Scope to the caller by default. Only a manager/admin may widen to the whole team
    // (scope=all) or another rep (ownerId=…); a rep asking for either is ignored and still
    // gets only their own tasks. This is the ownership boundary the service-role client can't enforce.
    let effectiveOwnerId = currentUser.id
    if (currentUser.id !== 'local-user' && (scope === 'all' || ownerId)) {
      const { data: prof } = await getSupabase().from('profiles').select('role').eq('id', currentUser.id).maybeSingle()
      const isMgr = prof?.role === 'manager' || prof?.role === 'admin'
      if (isMgr) effectiveOwnerId = ownerId || undefined // undefined => all reps
    }

    const { tasks, error } = await getTasks({
      ownerId: effectiveOwnerId,
      status:  status  || undefined,
      type:    type    || undefined,
      accountId: accountId || undefined,
    })

    if (error) {
      console.error('getTasks error:', error)
      return res.status(500).json({ error: 'Failed to fetch tasks' })
    }

    return res.status(200).json({ success: true, tasks })
  }

  // ── POST /api/tasks ─────────────────────────────────────────────────────────
  if (req.method === 'POST') {
    const { title, description, type, priority, ownerId, accountId, dueDate, source, sourceId, sourceType, visibleToManager } = req.body

    if (!title) {
      return res.status(400).json({ error: 'title is required' })
    }

    // Idempotency for trigger-sourced tasks (e.g. calendar prep): same (source, sourceId) → don't duplicate.
    if (source && sourceId) {
      const existing = await findTaskBySource(source, sourceId)
      if (existing) return res.status(200).json({ success: true, task: existing, deduped: true })
    }

    const { task, error } = await createTask(currentUser.id, {
      title,
      description,
      type:             type || 'assigned',
      priority:         priority || 2,
      ownerId:          ownerId || currentUser.id,
      accountId:        accountId || null,
      dueDate:          dueDate || null,
      source:           source || 'manual',
      sourceId:         sourceId || null,
      sourceType:       sourceType || null,
      visibleToManager: visibleToManager !== false,
    })

    if (error) {
      console.error('createTask error:', error)
      return res.status(500).json({ error: 'Failed to create task' })
    }

    return res.status(201).json({ success: true, task })
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
