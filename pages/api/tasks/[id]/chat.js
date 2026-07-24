// Per-task chat persistence (Tasks v2 Layer 3). Replaces the localStorage `wic_<taskId>` store so
// Work-in-Claude threads survive across devices and can be reused by the account view's panel.
//   GET  /api/tasks/:id/chat            -> { messages: [{role, content, metadata, created_at}] }
//   POST /api/tasks/:id/chat  {role, content, metadata?}  -> appends one message (creates the chat row on first use)
import { createServerSupabaseClient, getSupabase } from '../../../../lib/supabase'

export default async function handler(req, res) {
  const auth = createServerSupabaseClient(req, res)
  const { data: { user } } = await auth.auth.getUser()
  if (!user) return res.status(401).json({ error: 'Unauthorized' })

  const taskId = req.query.id
  if (!taskId) return res.status(400).json({ error: 'task id required' })
  const db = getSupabase()

  if (req.method === 'GET') {
    const { data: chat } = await db.from('task_chats').select('id').eq('task_id', taskId).maybeSingle()
    if (!chat) return res.status(200).json({ messages: [] })
    const { data: messages } = await db.from('task_chat_messages')
      .select('role, content, metadata, created_at')
      .eq('task_chat_id', chat.id)
      .order('created_at', { ascending: true })
    return res.status(200).json({ messages: messages || [] })
  }

  if (req.method === 'POST') {
    const { role, content, metadata } = req.body || {}
    if (!role || !content) return res.status(400).json({ error: 'role and content required' })

    // Resolve (or create) the chat row, carrying the task's account for context assembly.
    let { data: chat } = await db.from('task_chats').select('id').eq('task_id', taskId).maybeSingle()
    if (!chat) {
      const { data: task } = await db.from('tasks').select('account_id').eq('id', taskId).maybeSingle()
      const { data: created, error: cErr } = await db.from('task_chats')
        .insert({ task_id: taskId, account_id: task?.account_id || null, status: 'active' })
        .select('id').maybeSingle()
      if (cErr) return res.status(500).json({ error: cErr.message })
      chat = created
    }
    const { data: msg, error } = await db.from('task_chat_messages')
      .insert({ task_chat_id: chat.id, role, content: String(content), metadata: metadata || null })
      .select('role, content, metadata, created_at').maybeSingle()
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ message: msg })
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
