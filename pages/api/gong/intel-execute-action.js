// POST { action: { title, description, action_type, target_rep, target_account, scope } }
// Executes a weekly action card: creates a task and logs to executed_actions.

import { apiError, apiSuccess, logRequest } from '../../../lib/apiUtils';
import { createServerSupabaseClient, getSupabase } from '../../../lib/supabase';
import { createTask } from '../../../lib/db/tasks';

const EXECUTABLE_TYPES = ['coaching_task_create', 'outreach_batch_create']

export default async function handler(req, res) {
  logRequest(req, 'gong/intel-execute-action')
  if (req.method !== 'POST') return apiError(res, 405, 'Method not allowed')

  const authClient = createServerSupabaseClient(req, res)
  const { data: { user } } = await authClient.auth.getUser()
  if (!user) return apiError(res, 401, 'Unauthorized')

  const { action } = req.body || {}
  if (!action?.action_type || !action?.title) return apiError(res, 400, 'action.action_type and action.title required')
  if (!EXECUTABLE_TYPES.includes(action.action_type)) return apiError(res, 400, `action_type ${action.action_type} is not executable`)

  const db = getSupabase()

  let taskDescription = action.description || ''
  if (action.action_type === 'coaching_task_create' && action.target_rep) {
    taskDescription = `Rep: ${action.target_rep}\n\n${taskDescription}`
  }
  if (action.action_type === 'outreach_batch_create' && action.target_account) {
    taskDescription = `Account: ${action.target_account}\n\n${taskDescription}`
  }
  if (action.scope) {
    taskDescription += `\n\nScope: ${action.scope}`
  }

  const { task, error: taskError } = await createTask(user.id, {
    title: action.title,
    description: taskDescription.trim(),
    type: 'triggered',
    priority: action.urgency === 'high' ? 1 : action.urgency === 'low' ? 3 : 2,
    source: 'call_intelligence',
    sourceId: null,
    visibleToManager: true,
  })

  if (taskError) return apiError(res, 500, taskError.message)

  const artifactUrl = '/modules/tasks'

  await db.from('executed_actions').insert({
    executed_by: user.email,
    action_type: action.action_type,
    payload: action,
    status: 'completed',
    artifact_url: artifactUrl,
    artifact_type: 'task',
  })

  return apiSuccess(res, { taskId: task.id, artifactUrl })
}
