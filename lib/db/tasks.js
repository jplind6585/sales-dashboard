import { getSupabase } from '../supabase'

/**
 * Get tasks for a user.
 * Managers/admins will get all tasks back (RLS handles this automatically).
 * Reps get only tasks they own or created.
 *
 * @param {Object} options
 * @param {string} [options.ownerId]   - filter by owner (optional)
 * @param {string} [options.status]    - filter by status (optional)
 * @param {string} [options.type]      - filter by type (optional)
 * @param {string} [options.accountId] - filter by account (optional)
 * @returns {Promise<{tasks: Array|null, error: Error|null}>}
 */
export async function getTasks({ ownerId, status, type, accountId, includeDismissed = false } = {}) {
  const supabase = getSupabase()

  let query = supabase
    .from('tasks')
    .select(`
      *,
      accounts ( id, name, stage, vertical )
    `)
    .order('due_date', { ascending: true, nullsFirst: false })
    .order('priority', { ascending: true })
    .order('created_at', { ascending: false })

  if (!includeDismissed) query = query.is('dismissed_at', null)
  if (ownerId)    query = query.eq('owner_id', ownerId)
  if (status)     query = query.eq('status', status)
  if (type)       query = query.eq('type', type)
  if (accountId)  query = query.eq('account_id', accountId)

  const { data: tasks, error } = await query

  if (error) return { tasks: null, error }

  return { tasks: tasks.map(transformTaskFromDb), error: null }
}

/**
 * Get a single task by ID.
 * @param {string} taskId
 * @returns {Promise<{task: Object|null, error: Error|null}>}
 */
export async function getTask(taskId) {
  const supabase = getSupabase()

  const { data: task, error } = await supabase
    .from('tasks')
    .select(`
      *,
      accounts ( id, name, stage, vertical )
    `)
    .eq('id', taskId)
    .single()

  if (error) return { task: null, error }

  return { task: transformTaskFromDb(task), error: null }
}

/**
 * Get a summary of tasks grouped by owner — used for the manager team view.
 * Returns one row per user with counts for open, overdue, and completed this week.
 * @returns {Promise<{summary: Array|null, error: Error|null}>}
 */
export async function getTeamTaskSummary() {
  const supabase = getSupabase()

  const now = new Date().toISOString().split('T')[0]
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

  // Fetch all tasks with profile data — RLS ensures only managers/admins get cross-user data
  const { data: tasks, error } = await supabase
    .from('tasks')
    .select(`
      id, owner_id, status, due_date, completed_at, priority, visible_to_manager,
      profiles!tasks_owner_id_fkey ( id, full_name, email, role )
    `)

  if (error) return { summary: null, error }

  // Group by owner
  const byOwner = {}
  for (const task of tasks) {
    if (!task.owner_id) continue
    if (!byOwner[task.owner_id]) {
      byOwner[task.owner_id] = {
        userId: task.owner_id,
        name: task.profiles?.full_name || task.profiles?.email || 'Unknown',
        email: task.profiles?.email,
        role: task.profiles?.role,
        open: 0,
        overdue: 0,
        completedThisWeek: 0,
        tasks: [],
      }
    }
    const rep = byOwner[task.owner_id]
    if (task.status !== 'complete') {
      rep.open++
      if (task.due_date && task.due_date < now) rep.overdue++
    }
    if (task.status === 'complete' && task.completed_at >= weekAgo) {
      rep.completedThisWeek++
    }
  }

  return { summary: Object.values(byOwner), error: null }
}

/**
 * Create a new task.
 * @param {string} createdBy - user ID of the creator
 * @param {Object} data
 * @returns {Promise<{task: Object|null, error: Error|null}>}
 */
export async function createTask(createdBy, data) {
  const supabase = getSupabase()

  const { data: task, error } = await supabase
    .from('tasks')
    .insert({
      owner_id:          data.ownerId || createdBy,
      created_by:        createdBy,
      type:              data.type || 'assigned',
      priority:          data.priority || 2,
      title:             data.title,
      description:       data.description || null,
      status:            data.status || 'open',
      source:            data.source || 'manual',
      source_type:       data.sourceType || null,
      source_id:         data.sourceId || null,
      account_id:        data.accountId || null,
      due_date:          data.dueDate || null,
      primary_action:    data.primaryAction || null,
      rationale:         data.rationale || null,
      visible_to_manager: data.visibleToManager !== false,
    })
    .select(`
      *,
      accounts ( id, name, stage, vertical )
    `)
    .single()

  if (error) return { task: null, error }

  return { task: transformTaskFromDb(task), error: null }
}

/**
 * Create multiple tasks at once (e.g. stage-change checklists).
 * @param {string} createdBy
 * @param {Array<Object>} items - array of task data objects
 * @returns {Promise<{tasks: Array|null, error: Error|null}>}
 */
export async function createTasks(createdBy, items) {
  const supabase = getSupabase()

  const rows = items.map(data => ({
    owner_id:           data.ownerId || createdBy,
    created_by:         createdBy,
    type:               data.type || 'triggered',
    priority:           data.priority || 2,
    title:              data.title,
    description:        data.description || null,
    status:             'open',
    source:             data.source || 'stage_change',
    source_id:          data.sourceId || null,
    account_id:         data.accountId || null,
    due_date:           data.dueDate || null,
    visible_to_manager: data.visibleToManager !== false,
  }))

  const { data: tasks, error } = await supabase
    .from('tasks')
    .insert(rows)
    .select(`
      *,
      accounts ( id, name, stage, vertical )
    `)

  if (error) return { tasks: null, error }

  return { tasks: tasks.map(transformTaskFromDb), error: null }
}

/**
 * Update a task (status, title, description, due date, priority, etc.)
 * @param {string} taskId
 * @param {Object} updates
 * @returns {Promise<{task: Object|null, error: Error|null}>}
 */
export async function updateTask(taskId, updates) {
  const supabase = getSupabase()

  const dbUpdates = transformTaskToDb(updates)

  const { data: task, error } = await supabase
    .from('tasks')
    .update(dbUpdates)
    .eq('id', taskId)
    .select(`
      *,
      accounts ( id, name, stage, vertical )
    `)
    .single()

  if (error) return { task: null, error }

  return { task: transformTaskFromDb(task), error: null }
}

/**
 * Dismiss a task — soft-removes it from active views and logs the reason.
 * @param {string} taskId
 * @param {string} dismissedBy - user ID
 * @param {string|null} reason
 * @returns {Promise<{error: Error|null}>}
 */
export async function dismissTask(taskId, dismissedBy, reason = null) {
  const supabase = getSupabase()

  const dismissedAt = new Date().toISOString()

  const [taskUpdate, dismissLog] = await Promise.all([
    supabase.from('tasks').update({ dismissed_at: dismissedAt }).eq('id', taskId),
    supabase.from('task_dismissals').insert({ task_id: taskId, dismissed_by: dismissedBy, reason }),
  ])

  return { error: taskUpdate.error || dismissLog.error || null }
}

/**
 * Delete a task.
 * @param {string} taskId
 * @returns {Promise<{error: Error|null}>}
 */
export async function deleteTask(taskId) {
  const supabase = getSupabase()

  const { error } = await supabase
    .from('tasks')
    .delete()
    .eq('id', taskId)

  return { error }
}

/**
 * Get all recurring task templates.
 * @returns {Promise<{templates: Array|null, error: Error|null}>}
 */
export async function getRecurringTemplates() {
  const supabase = getSupabase()

  const { data: templates, error } = await supabase
    .from('recurring_task_templates')
    .select('*')
    .eq('is_active', true)
    .order('frequency')
    .order('day_of_week', { nullsFirst: false })

  if (error) return { templates: null, error }

  return { templates: templates.map(transformTemplateFromDb), error: null }
}

// ===========================================
// STAGE-CHANGE TASK CHECKLISTS
// ===========================================

const STAGE_CHECKLISTS = {
  // Any stage → intro scheduled
  intro_scheduled: [
    { title: 'Pre-call research', description: 'Review company website, recent news, LinkedIn profiles of attendees.', priority: 1 },
    { title: 'Prep discovery hypothesis', description: 'Write 2-3 hypotheses about their pain based on vertical and company size.', priority: 1 },
    { title: 'Set up account in pipeline', description: 'Create account, add known contacts as stakeholders, set vertical and ownership type.', priority: 2 },
  ],
  // Intro → demo
  demo: [
    { title: 'Send follow-up email', description: 'Send recap + next steps within 24 hours of intro call.', priority: 1 },
    { title: 'Request completed workbooks', description: 'Ask for any pre-work or discovery workbooks before the demo.', priority: 1 },
    { title: 'Brief support team', description: 'Loop in any SE or solutions team members who will join the demo.', priority: 2 },
    { title: 'Prep demo deck', description: 'Customise the demo deck with their company name, vertical, and known pain points.', priority: 1 },
  ],
  // Demo → evaluation/solution_validation
  solution_validation: [
    { title: 'Send evaluation document', description: 'Share the formal eval doc outlining success criteria and timeline.', priority: 1 },
    { title: 'Schedule eval review call', description: 'Book the review call while still on the demo call if possible.', priority: 1 },
    { title: 'Identify executive sponsor', description: 'Confirm who the economic buyer is and plan exec outreach.', priority: 1 },
  ],
  // Evaluation → proposal
  proposal: [
    { title: 'Draft proposal', description: 'Build the proposal doc with pricing, timeline, and success plan.', priority: 1 },
    { title: 'Internal pricing approval', description: 'Get sign-off from manager if any discounting is required.', priority: 2 },
    { title: 'Schedule proposal walkthrough', description: 'Never send a proposal cold — book a call to walk through it.', priority: 1 },
  ],
  // Proposal → legal/closed_won
  closed_won: [
    { title: 'Send contract', description: 'Get the contract out within 24 hours of verbal agreement.', priority: 1 },
    { title: 'Intro to Customer Success', description: 'Warm handoff to CS team — cc them on a follow-up email.', priority: 1 },
    { title: 'Update HubSpot', description: 'Mark deal closed won in HubSpot, add ARR, and close date.', priority: 2 },
  ],
}

/**
 * Get the task checklist for a given pipeline stage.
 * @param {string} stage - the new stage (e.g. 'demo', 'closed_won')
 * @param {string} accountId
 * @param {string} createdBy
 * @returns {Array<Object>} array of task data objects ready for createTasks()
 */
export function getStageChangeTasks(stage, accountId, createdBy) {
  const checklist = STAGE_CHECKLISTS[stage]
  if (!checklist) return []

  return checklist.map(item => ({
    ...item,
    type: 'triggered',
    source: 'stage_change',
    sourceId: accountId,
    accountId,
    ownerId: createdBy,
  }))
}

// ===========================================
// TRANSFORMS
// ===========================================

function transformTaskFromDb(t) {
  if (!t) return null
  return {
    id:               t.id,
    ownerId:          t.owner_id,
    createdBy:        t.created_by,
    type:             t.type,
    priority:         t.priority,
    title:            t.title,
    description:      t.description,
    status:           t.status,
    source:           t.source,
    sourceType:       t.source_type,
    sourceId:         t.source_id,
    accountId:        t.account_id,
    account:          t.accounts || null,  // joined account summary
    dueDate:          t.due_date,
    primaryAction:    t.primary_action,
    rationale:        t.rationale,
    visibleToManager: t.visible_to_manager,
    createdAt:        t.created_at,
    updatedAt:        t.updated_at,
    completedAt:      t.completed_at,
    dismissedAt:      t.dismissed_at,
    // Computed helpers
    isOverdue:        t.status !== 'complete' && !t.dismissed_at && t.due_date && t.due_date < new Date().toISOString().split('T')[0],
  }
}

function transformTaskToDb(t) {
  const db = {}
  if (t.ownerId      !== undefined) db.owner_id          = t.ownerId
  if (t.type         !== undefined) db.type              = t.type
  if (t.priority     !== undefined) db.priority          = t.priority
  if (t.title        !== undefined) db.title             = t.title
  if (t.description  !== undefined) db.description       = t.description
  if (t.status       !== undefined) db.status            = t.status
  if (t.source       !== undefined) db.source            = t.source
  if (t.sourceId     !== undefined) db.source_id         = t.sourceId
  if (t.accountId    !== undefined) db.account_id        = t.accountId
  if (t.dueDate      !== undefined) db.due_date          = t.dueDate
  if (t.visibleToManager !== undefined) db.visible_to_manager = t.visibleToManager
  if (t.primaryAction    !== undefined) db.primary_action     = t.primaryAction
  if (t.rationale        !== undefined) db.rationale          = t.rationale
  if (t.sourceType       !== undefined) db.source_type        = t.sourceType
  if (t.dismissedAt      !== undefined) db.dismissed_at       = t.dismissedAt
  return db
}

function transformTemplateFromDb(t) {
  if (!t) return null
  return {
    id:               t.id,
    title:            t.title,
    description:      t.description,
    type:             t.type,
    priority:         t.priority,
    assignToRole:     t.assign_to_role,
    assignToUserId:   t.assign_to_user_id,
    frequency:        t.frequency,
    dayOfWeek:        t.day_of_week,
    dayOfMonth:       t.day_of_month,
    leadDays:         t.lead_days,
    isActive:         t.is_active,
    createdAt:        t.created_at,
    updatedAt:        t.updated_at,
  }
}
