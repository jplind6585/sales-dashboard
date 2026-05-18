// Account memory CRUD — per-account saved insights, pipeline call notes, manual entries.
// GET    ?id=uuid          → last 20 active memories
// POST   { type, content, author, source_ref } → create
// DELETE ?action=delete&memoryId=uuid → soft-delete (is_active = false)

import { createServerSupabaseClient, getSupabase } from '../../../../lib/supabase'
import { apiError } from '../../../../lib/apiUtils'

export default async function handler(req, res) {
  const auth = createServerSupabaseClient(req, res)
  const { data: { user } } = await auth.auth.getUser()
  if (!user) return apiError(res, 401, 'Unauthorized')

  const accountId = req.query.id
  if (!accountId) return apiError(res, 400, 'Account id required')

  const db = getSupabase()

  if (req.method === 'GET') {
    const { data, error } = await db
      .from('account_memory')
      .select('id, type, content, author, source_ref, created_at')
      .eq('account_id', accountId)
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(20)

    if (error) return apiError(res, 500, error.message)
    return res.status(200).json({ success: true, memories: data || [] })
  }

  if (req.method === 'POST') {
    const { type, content, author, source_ref } = req.body || {}
    if (!type || !content) return apiError(res, 400, 'type and content required')

    const { data, error } = await db
      .from('account_memory')
      .insert({ account_id: accountId, type, content, author, source_ref })
      .select()
      .single()

    if (error) return apiError(res, 500, error.message)
    return res.status(201).json({ success: true, memory: data })
  }

  if (req.method === 'DELETE') {
    const { action, memoryId } = req.query
    if (action !== 'delete' || !memoryId) return apiError(res, 400, 'action=delete and memoryId required')

    const { error } = await db
      .from('account_memory')
      .update({ is_active: false })
      .eq('id', memoryId)
      .eq('account_id', accountId)

    if (error) return apiError(res, 500, error.message)
    return res.status(200).json({ success: true })
  }

  return apiError(res, 405, 'GET, POST, DELETE only')
}
