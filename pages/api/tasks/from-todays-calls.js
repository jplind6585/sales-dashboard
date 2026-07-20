// GET /api/tasks/from-todays-calls — the caller's open tasks that were auto-created from calls that
// happened TODAY, grouped by call. Gong tasks don't store source_id, but their description carries
// "(call ID: <id>)", so we match today's analyzed calls to their tasks by that id.
import { createServerSupabaseClient, getSupabase } from '../../../lib/supabase'
import { apiError, apiSuccess, validateMethod, logRequest } from '../../../lib/apiUtils'

export default async function handler(req, res) {
  logRequest(req, 'tasks/from-todays-calls')
  if (!validateMethod(req, res, 'GET')) return
  const auth = createServerSupabaseClient(req, res)
  const { data: { user } } = await auth.auth.getUser()
  if (!user) return apiError(res, 401, 'Unauthorized')

  const db = getSupabase()
  const start = new Date(); start.setHours(0, 0, 0, 0)
  const startISO = start.toISOString()

  const { data: calls } = await db.from('gong_call_analyses')
    .select('gong_call_id, title, call_date')
    .gte('call_date', startISO)
    .order('call_date', { ascending: false })
    .limit(50)
  if (!calls?.length) return apiSuccess(res, { calls: [] })

  const callById = new Map(calls.map(c => [c.gong_call_id, c]))
  const callIds = [...callById.keys()]

  // The caller's open gong tasks created recently (bounds the scan); match to a today-call by id.
  const since = new Date(Date.now() - 4 * 86400000).toISOString()
  const { data: tasks } = await db.from('tasks')
    .select('id, title, description, source_type, priority, due_date, momentum, rationale, account_id, accounts ( name, stage )')
    .eq('owner_id', user.id).eq('source', 'gong').neq('status', 'complete').is('dismissed_at', null)
    .gte('created_at', since)
    .limit(500)

  const groups = {}
  for (const t of tasks || []) {
    const desc = t.description || ''
    const cid = callIds.find(id => desc.includes(id))
    if (!cid) continue
    const c = callById.get(cid)
    if (!groups[cid]) groups[cid] = { callId: cid, title: c.title, callDate: c.call_date, accountName: t.accounts?.name || null, stage: t.accounts?.stage || null, tasks: [] }
    groups[cid].tasks.push({ id: t.id, title: t.title, sourceType: t.source_type, priority: t.priority, dueDate: t.due_date, momentum: t.momentum })
  }

  const out = Object.values(groups).sort((a, b) => new Date(b.callDate) - new Date(a.callDate))
  return apiSuccess(res, { calls: out })
}
