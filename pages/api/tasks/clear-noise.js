// POST /api/tasks/clear-noise   { execute?: true }
// Finds the caller's OPEN, Gong-sourced tasks whose titles are in-call demo narration / boilerplate
// (created before the extraction gate) and, when execute=true, dismisses them (sets dismissed_at —
// reversible, hidden from the wall). Without execute it returns a preview (count + sample) so the rep
// reviews before clearing. Scoped strictly to the caller's own tasks.
import { createServerSupabaseClient, getSupabase } from '../../../lib/supabase'
import { apiError, apiSuccess, validateMethod, logRequest } from '../../../lib/apiUtils'
import { isLowSignalTitle } from '../../../lib/taskNoise'

export default async function handler(req, res) {
  logRequest(req, 'tasks/clear-noise')
  if (!validateMethod(req, res, 'POST')) return
  const auth = createServerSupabaseClient(req, res)
  const { data: { user } } = await auth.auth.getUser()
  if (!user) return apiError(res, 401, 'Unauthorized')

  const db = getSupabase()
  const { data: tasks, error } = await db.from('tasks')
    .select('id, title')
    .eq('owner_id', user.id)
    .eq('source', 'gong')
    .neq('status', 'complete')
    .is('dismissed_at', null)
    .limit(3000)
  if (error) return apiError(res, 500, error.message)

  const noise = (tasks || []).filter((t) => isLowSignalTitle(t.title))

  if (!req.body?.execute) {
    return apiSuccess(res, { count: noise.length, sample: noise.slice(0, 8).map((t) => t.title) })
  }

  const ids = noise.map((t) => t.id)
  const at = new Date().toISOString()
  for (let i = 0; i < ids.length; i += 200) {
    const { error: upErr } = await db.from('tasks').update({ dismissed_at: at }).in('id', ids.slice(i, i + 200))
    if (upErr) return apiError(res, 500, upErr.message)
  }
  return apiSuccess(res, { cleared: ids.length })
}
