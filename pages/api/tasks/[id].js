import { getTask, updateTask, deleteTask, dismissTask } from '../../../lib/db/tasks'
import { createServerSupabaseClient } from '../../../lib/supabase'

export default async function handler(req, res) {
  const { id } = req.query

  if (!id) {
    return res.status(400).json({ error: 'Task ID is required' })
  }

  // Resolve the current user from the session cookie
  const supabase = createServerSupabaseClient(req, res)
  const { data: { user } } = await supabase.auth.getUser()
  const currentUser = user || (process.env.NEXT_PUBLIC_USE_SUPABASE === 'false' ? { id: 'local-user' } : null)

  if (!currentUser) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  // ── GET /api/tasks/[id] ─────────────────────────────────────────────────────
  if (req.method === 'GET') {
    const { task, error } = await getTask(id)

    if (error) {
      console.error('getTask error:', error)
      return res.status(500).json({ error: 'Failed to fetch task' })
    }

    if (!task) {
      return res.status(404).json({ error: 'Task not found' })
    }

    return res.status(200).json({ success: true, task })
  }

  // ── PATCH /api/tasks/[id] ───────────────────────────────────────────────────
  if (req.method === 'PATCH') {
    const allowed = ['title', 'description', 'status', 'priority', 'dueDate', 'ownerId', 'visibleToManager']
    const updates = {}

    for (const key of allowed) {
      if (req.body[key] !== undefined) {
        updates[key] = req.body[key]
      }
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' })
    }

    const { task, error } = await updateTask(id, updates)

    if (error) {
      console.error('updateTask error:', error)
      return res.status(500).json({ error: 'Failed to update task' })
    }

    return res.status(200).json({ success: true, task })
  }

  // ── DELETE /api/tasks/[id] ──────────────────────────────────────────────────
  if (req.method === 'DELETE') {
    const { error } = await deleteTask(id)

    if (error) {
      console.error('deleteTask error:', error)
      return res.status(500).json({ error: 'Failed to delete task' })
    }

    return res.status(200).json({ success: true })
  }

  // ── POST /api/tasks/[id] — dismiss a task ──────────────────────────────────
  if (req.method === 'POST') {
    const { action, reason } = req.body || {}
    if (action !== 'dismiss') {
      return res.status(400).json({ error: 'Unknown action. Use action: "dismiss".' })
    }

    const { error } = await dismissTask(id, currentUser.id, reason || null)

    if (error) {
      console.error('dismissTask error:', error)
      return res.status(500).json({ error: 'Failed to dismiss task' })
    }

    return res.status(200).json({ success: true })
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
