// Confirms action items from a pipeline review call session.
// Creates tasks and/or saves memory notes based on the confirmation payload.
// POST { sessionId, items: [{ accountId, taskTitle, assignedToName, dueDate, priority, createTask, memoryNote, saveMemory }] }
// Manager-only.

import { createServerSupabaseClient, getSupabase } from '../../../lib/supabase'
import { apiError } from '../../../lib/apiUtils'

export default async function handler(req, res) {
  if (req.method !== 'POST') return apiError(res, 405, 'POST only')

  const auth = createServerSupabaseClient(req, res)
  const { data: { user } } = await auth.auth.getUser()
  if (!user) return apiError(res, 401, 'Unauthorized')

  const db = getSupabase()

  // Manager-only check
  const { data: profile } = await db
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()
  if (profile?.role !== 'manager') return apiError(res, 403, 'Manager access required')

  const { sessionId, items } = req.body || {}
  if (!sessionId || !Array.isArray(items)) return apiError(res, 400, 'sessionId and items array required')

  // Fetch all profiles once for name→user_id lookup
  const { data: profiles } = await db.from('profiles').select('id, full_name')

  let tasksCreated = 0
  let memoriesSaved = 0
  const errors = []

  for (const item of items) {
    const {
      accountId,
      taskTitle,
      assignedToName,
      dueDate,
      priority,
      createTask,
      memoryNote,
      saveMemory,
    } = item

    if (createTask && taskTitle && accountId) {
      // Resolve owner user_id from assignedToName
      let ownerId = null
      if (assignedToName) {
        const nameLower = assignedToName.toLowerCase()
        const match = profiles?.find(p => {
          const n = (p.full_name || '').toLowerCase()
          return n === nameLower || n.includes(nameLower) || nameLower.includes(n)
        })
        ownerId = match?.id || null
      }

      const { error: taskErr } = await db.from('tasks').insert({
        title: taskTitle,
        owner_id: ownerId,
        account_id: accountId,
        due_date: dueDate || null,
        priority: priority || 2,
        type: 'triggered',
        status: 'open',
        source: 'pipeline_review',
        description: `From pipeline review session: ${sessionId}`,
      })

      if (taskErr) {
        errors.push(`task for ${accountId}: ${taskErr.message}`)
      } else {
        tasksCreated++
      }
    }

    if (saveMemory && memoryNote && accountId) {
      const { error: memErr } = await db.from('account_memory').insert({
        account_id: accountId,
        type: 'pipeline_call',
        content: memoryNote,
        author: 'pipeline_review',
        source_ref: sessionId,
      })

      if (memErr) {
        errors.push(`memory for ${accountId}: ${memErr.message}`)
      } else {
        memoriesSaved++
      }
    }
  }

  return res.status(200).json({ success: true, tasksCreated, memoriesSaved, errors })
}
