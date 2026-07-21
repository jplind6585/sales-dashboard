import { getTask, updateTask, deleteTask, dismissTask } from '../../../lib/db/tasks'
import { createServerSupabaseClient, getSupabase } from '../../../lib/supabase'
import { sendSlackMessage, resolveAccountChannel } from '../../../lib/slack'

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
    const allowed = ['title', 'description', 'status', 'priority', 'dueDate', 'ownerId', 'visibleToManager', 'momentum', 'snoozeUntil']
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

    // On complete, fire side effects server-side so EVERY path (quick / bulk / AI-modal) notifies
    // exactly once — previously only the modal path posted to Slack, so most completions were silent.
    if (updates.status === 'complete' && task?.accountId) {
      completeSideEffects(task, currentUser).catch(e => console.error('[task-complete] side effects:', e.message))
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

// Slack notify to the account channel + HubSpot note. Fire-and-forget; failures are logged, not fatal.
async function completeSideEffects(task, currentUser) {
  const db = getSupabase()
  const { data: acct } = await db.from('accounts').select('name, slack_channel, hubspot_deal_id').eq('id', task.accountId).single()
  if (!acct) return

  // Slack — account's explicit channel override, else derived from the account name.
  try {
    const channel = acct.slack_channel || resolveAccountChannel({ name: acct.name })
    let repName = null
    if (currentUser?.id && currentUser.id !== 'local-user') {
      const { data: prof } = await db.from('profiles').select('full_name, email').eq('id', currentUser.id).maybeSingle()
      repName = prof?.full_name || prof?.email?.split('@')[0] || null
    }
    await sendSlackMessage({ text: `✅ *Task completed* — ${task.title}\n_${acct.name}${repName ? ` · ${repName}` : ''}_` }, channel)
  } catch (e) {
    console.error('[task-complete] slack:', e.message)
  }

  // HubSpot note on the associated deal.
  if (acct.hubspot_deal_id && process.env.HUBSPOT_API_KEY) {
    try {
      const noteBody = `Task completed: ${task.title}\nDate: ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
      const r = await fetch('https://api.hubapi.com/crm/v3/objects/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${process.env.HUBSPOT_API_KEY}` },
        body: JSON.stringify({
          properties: { hs_note_body: noteBody, hs_timestamp: new Date().toISOString() },
          associations: [{ to: { id: String(acct.hubspot_deal_id) }, types: [{ associationCategory: 'HUBSPOT_DEFINED', associationTypeId: 214 }] }],
        }),
      })
      if (!r.ok) console.error('[task-complete] hubspot-note failed:', await r.text())
    } catch (e) {
      console.error('[task-complete] hubspot-note error:', e.message)
    }
  }
}
