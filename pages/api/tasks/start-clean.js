// POST /api/tasks/start-clean { execute? } — archive the caller's OLD open backlog to start fresh
// from today. Dismisses (reversible — sets dismissed_at, doesn't delete) open tasks created before
// today. KEEPS: tasks created today, in-progress tasks, and anything with a future due date (e.g.
// scheduled re-engagements). Preview (no execute) returns the count + a sample so the rep confirms.
import { createServerSupabaseClient, getSupabase } from '../../../lib/supabase'
import { apiError, apiSuccess, validateMethod, logRequest } from '../../../lib/apiUtils'

export default async function handler(req, res) {
  logRequest(req, 'tasks/start-clean')
  if (!validateMethod(req, res, 'POST')) return
  const auth = createServerSupabaseClient(req, res)
  const { data: { user } } = await auth.auth.getUser()
  if (!user) return apiError(res, 401, 'Unauthorized')

  const db = getSupabase()
  const start = new Date(); start.setHours(0, 0, 0, 0)
  const startISO = start.toISOString()
  const todayDate = startISO.slice(0, 10)

  const { data: tasks, error } = await db.from('tasks')
    .select('id, title, due_date')
    .eq('owner_id', user.id).eq('status', 'open').is('dismissed_at', null)
    .lt('created_at', startISO)
    .limit(5000)
  if (error) return apiError(res, 500, error.message)

  const old = (tasks || []).filter(t => !t.due_date || t.due_date < todayDate) // keep future-scheduled
  if (!req.body?.execute) {
    return apiSuccess(res, { count: old.length, keptScheduled: (tasks || []).length - old.length, sample: old.slice(0, 6).map(t => t.title) })
  }

  const ids = old.map(t => t.id)
  const at = new Date().toISOString()
  for (let i = 0; i < ids.length; i += 200) {
    const { error: e } = await db.from('tasks').update({ dismissed_at: at }).in('id', ids.slice(i, i + 200))
    if (e) return apiError(res, 500, e.message)
  }
  return apiSuccess(res, { cleared: ids.length })
}
