import { createClient } from '../../lib/supabase'
import { sendSlackMessage, buildRepDigest, buildManagerDigest } from '../../lib/slack'
import { createTasks } from '../../lib/db/tasks'

/**
 * POST /api/send-daily-digest
 *
 * Fires the daily Slack digest for the whole team.
 * Designed to be called by a cron job or manually by a manager.
 *
 * What it does:
 * 1. Loads all profiles (reps + managers)
 * 2. For each rep: fetches their open/overdue tasks, finds a flagged account,
 *    sends a personal Slack digest to the team channel (tagged with their name)
 * 3. Creates any recurring task instances due today that don't already exist
 * 4. Sends a manager summary digest
 *
 * Security: requires DIGEST_SECRET header to match DIGEST_SECRET env var,
 * preventing random callers from triggering it.
 */
export default async function handler(req, res) {
  if (req.method !== 'POST' && req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  // Accept auth from:
  // 1. Vercel cron jobs: Authorization: Bearer {CRON_SECRET}
  // 2. Manual callers: x-digest-secret: {DIGEST_SECRET}
  const cronSecret = process.env.CRON_SECRET
  const digestSecret = process.env.DIGEST_SECRET
  const authHeader = req.headers['authorization']
  const digestHeader = req.headers['x-digest-secret']

  const validCron = cronSecret && authHeader === `Bearer ${cronSecret}`
  const validManual = digestSecret && digestHeader === digestSecret
  const noSecretsConfigured = !cronSecret && !digestSecret

  if (!validCron && !validManual && !noSecretsConfigured) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const supabase = createClient()
  const results = { reps: [], recurringCreated: 0, managerDigest: false, errors: [] }

  try {
    // ── 1. Load all profiles ─────────────────────────────────────────────────
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('id, full_name, email, role')

    if (profilesError) throw profilesError

    const reps = profiles.filter(p => p.role === 'rep')
    const managers = profiles.filter(p => p.role === 'manager' || p.role === 'admin')

    // ── 2. Load all open tasks with account data ─────────────────────────────
    const { data: allTasks, error: tasksError } = await supabase
      .from('tasks')
      .select('*, accounts(id, name, stage, updated_at)')
      .in('status', ['open', 'in_progress', 'blocked'])
      .order('priority', { ascending: true })
      .order('due_date', { ascending: true, nullsFirst: false })

    if (tasksError) throw tasksError

    const today = new Date().toISOString().split('T')[0]

    // ── 3. Per-rep digest ────────────────────────────────────────────────────
    const repSummaries = []

    for (const rep of reps) {
      const repTasks = allTasks.filter(t => t.owner_id === rep.id)
      const overdueTasks = repTasks.filter(t => t.due_date && t.due_date < today)
      const openTasks = repTasks.filter(t => !t.due_date || t.due_date >= today)

      // Find one account needing attention:
      // stale = linked to a task but account hasn't been updated in 14+ days
      const accountsInTasks = repTasks
        .filter(t => t.accounts)
        .map(t => t.accounts)
      const flaggedAccount = accountsInTasks.find(a => {
        if (!a?.updated_at) return false
        const daysSince = Math.floor((Date.now() - new Date(a.updated_at)) / (1000 * 60 * 60 * 24))
        return daysSince >= 14
      })

      const flagged = flaggedAccount ? {
        name: flaggedAccount.name,
        reason: (() => {
          const days = Math.floor((Date.now() - new Date(flaggedAccount.updated_at)) / (1000 * 60 * 60 * 24))
          return `no activity in ${days} days`
        })(),
      } : null

      const name = rep.full_name || rep.email || 'Rep'

      const payload = buildRepDigest({
        name,
        openTasks: [...overdueTasks, ...openTasks],
        overdueTasks,
        flaggedAccount: flagged,
      })

      const { ok, error } = await sendSlackMessage(payload)
      results.reps.push({ name, tasks: repTasks.length, overdue: overdueTasks.length, slackOk: ok })
      if (!ok) results.errors.push(`Rep ${name}: ${error}`)

      repSummaries.push({
        name,
        open: repTasks.length,
        overdue: overdueTasks.length,
        completedThisWeek: 0, // Populated below
      })
    }

    // ── 4. Completed this week counts ────────────────────────────────────────
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
    const { data: completedTasks } = await supabase
      .from('tasks')
      .select('owner_id, completed_at')
      .eq('status', 'complete')
      .gte('completed_at', weekAgo)

    if (completedTasks) {
      for (const rep of repSummaries) {
        const profile = profiles.find(p => (p.full_name || p.email) === rep.name)
        if (profile) {
          rep.completedThisWeek = completedTasks.filter(t => t.owner_id === profile.id).length
        }
      }
    }

    // ── 5. Manager digest ────────────────────────────────────────────────────
    if (managers.length > 0 && repSummaries.length > 0) {
      const managerPayload = buildManagerDigest(repSummaries)
      const { ok, error } = await sendSlackMessage(managerPayload)
      results.managerDigest = ok
      if (!ok) results.errors.push(`Manager digest: ${error}`)
    }

    // ── 6. Spawn recurring task instances ────────────────────────────────────
    // Load active templates and create task instances for today if they don't exist
    const { data: templates } = await supabase
      .from('recurring_task_templates')
      .select('*')
      .eq('is_active', true)

    if (templates?.length > 0) {
      const dayOfWeek = new Date().getDay() // 0=Sun
      const dayOfMonth = new Date().getDate()

      for (const template of templates) {
        // Check if this template should fire today
        const isDue =
          template.frequency === 'daily' ||
          (template.frequency === 'weekly' && template.day_of_week === dayOfWeek) ||
          (template.frequency === 'monthly' && template.day_of_month === dayOfMonth)

        if (!isDue) continue

        // Find the users this template targets
        let targetUsers = []
        if (template.assign_to_user_id) {
          targetUsers = [{ id: template.assign_to_user_id }]
        } else if (template.assign_to_role === 'all') {
          targetUsers = profiles
        } else if (template.assign_to_role) {
          targetUsers = profiles.filter(p => p.role === template.assign_to_role)
        }

        // Check if a task from this template already exists today for each user
        for (const targetUser of targetUsers) {
          const { data: existing } = await supabase
            .from('tasks')
            .select('id')
            .eq('source', 'recurring')
            .eq('source_id', template.id)
            .eq('owner_id', targetUser.id)
            .gte('created_at', new Date().toISOString().split('T')[0] + 'T00:00:00Z')
            .limit(1)

          if (!existing?.length) {
            // Use the system user (first manager/admin) as creator
            const systemUser = managers[0] || profiles[0]
            if (systemUser) {
              await createTasks(systemUser.id, [{
                title: template.title,
                description: template.description,
                type: 'recurring',
                priority: template.priority,
                ownerId: targetUser.id,
                source: 'recurring',
                sourceId: template.id,
                dueDate: today,
              }])
              results.recurringCreated++
            }
          }
        }
      }
    }

    return res.status(200).json({ success: true, ...results })
  } catch (err) {
    console.error('Daily digest error:', err)
    return res.status(500).json({ error: err.message, ...results })
  }
}
