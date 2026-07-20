// POST /api/tasks/start-clean { execute? } — archive the caller's OLD open backlog to start fresh
// from today. Dismisses (reversible — sets dismissed_at, doesn't delete) open tasks created before
// today. KEEPS: tasks created today, in-progress tasks, and anything with a future due date (e.g.
// scheduled re-engagements). Preview (no execute) returns the count + a sample so the rep confirms.
// The filter lives in the query (not JS) so the count is exact and execute isn't capped at 1000 rows.
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

  // OLD backlog = caller's open, non-dismissed tasks created before today, excluding future-scheduled.
  const scoped = (q) => q
    .eq('owner_id', user.id).eq('status', 'open').is('dismissed_at', null)
    .lt('created_at', startISO).or(`due_date.is.null,due_date.lt.${todayDate}`)

  if (!req.body?.execute) {
    const { count, error } = await scoped(db.from('tasks').select('id', { count: 'exact', head: true }))
    if (error) return apiError(res, 500, error.message)
    const { data: sample } = await scoped(db.from('tasks').select('title')).order('created_at', { ascending: false }).limit(6)
    const { count: keptScheduled } = await db.from('tasks').select('id', { count: 'exact', head: true })
      .eq('owner_id', user.id).eq('status', 'open').is('dismissed_at', null).lt('created_at', startISO).gte('due_date', todayDate)
    return apiSuccess(res, { count: count || 0, keptScheduled: keptScheduled || 0, sample: (sample || []).map(s => s.title) })
  }

  const { error, count } = await scoped(db.from('tasks').update({ dismissed_at: new Date().toISOString() }, { count: 'exact' }))
  if (error) return apiError(res, 500, error.message)
  return apiSuccess(res, { cleared: count ?? 0 })
}
