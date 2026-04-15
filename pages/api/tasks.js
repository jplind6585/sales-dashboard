import { getTasks, createTask } from '../../lib/db/tasks'
import { createServerSupabaseClient } from '../../lib/supabase'

export default async function handler(req, res) {
  // Resolve the current user from the session cookie
  const supabase = createServerSupabaseClient(req, res)
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  // When Supabase auth is disabled (NEXT_PUBLIC_USE_SUPABASE=false), stub a user
  const currentUser = user || (process.env.NEXT_PUBLIC_USE_SUPABASE === 'false' ? { id: 'local-user' } : null)

  if (!currentUser) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  // ── GET /api/tasks ──────────────────────────────────────────────────────────
  if (req.method === 'GET') {
    const { ownerId, status, type, accountId, view } = req.query

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

    const { tasks, error } = await getTasks({
      ownerId: ownerId || undefined,
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
    const { title, description, type, priority, ownerId, accountId, dueDate, source, sourceId, visibleToManager } = req.body

    if (!title) {
      return res.status(400).json({ error: 'title is required' })
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
