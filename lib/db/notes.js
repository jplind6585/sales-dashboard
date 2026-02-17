import { getSupabase } from '../supabase'

/**
 * Get all notes for an account
 * @param {string} accountId
 * @returns {Promise<{notes: Array|null, error: Error|null}>}
 */
export async function getNotes(accountId) {
  const supabase = getSupabase()

  const { data: notes, error } = await supabase
    .from('notes')
    .select('*')
    .eq('account_id', accountId)
    .order('created_at', { ascending: false })

  if (error) {
    return { notes: null, error }
  }

  return {
    notes: notes.map(transformFromDb),
    error: null
  }
}

/**
 * Get notes by category
 * @param {string} accountId
 * @param {string} category
 * @returns {Promise<{notes: Array|null, error: Error|null}>}
 */
export async function getNotesByCategory(accountId, category) {
  const supabase = getSupabase()

  const { data: notes, error } = await supabase
    .from('notes')
    .select('*')
    .eq('account_id', accountId)
    .eq('category', category)
    .order('created_at', { ascending: false })

  if (error) {
    return { notes: null, error }
  }

  return {
    notes: notes.map(transformFromDb),
    error: null
  }
}

/**
 * Get a single note by ID
 * @param {string} noteId
 * @returns {Promise<{note: Object|null, error: Error|null}>}
 */
export async function getNote(noteId) {
  const supabase = getSupabase()

  const { data: note, error } = await supabase
    .from('notes')
    .select('*')
    .eq('id', noteId)
    .single()

  if (error) {
    return { note: null, error }
  }

  return { note: transformFromDb(note), error: null }
}

/**
 * Add a new note
 * @param {string} accountId
 * @param {Object} data
 * @returns {Promise<{note: Object|null, error: Error|null}>}
 */
export async function addNote(accountId, data) {
  const supabase = getSupabase()

  const { data: note, error } = await supabase
    .from('notes')
    .insert({
      account_id: accountId,
      category: data.category || 'General',
      content: data.content,
    })
    .select()
    .single()

  if (error) {
    return { note: null, error }
  }

  return { note: transformFromDb(note), error: null }
}

/**
 * Update a note
 * @param {string} noteId
 * @param {Object} updates
 * @returns {Promise<{note: Object|null, error: Error|null}>}
 */
export async function updateNote(noteId, updates) {
  const supabase = getSupabase()

  const dbUpdates = {}
  if (updates.category !== undefined) dbUpdates.category = updates.category
  if (updates.content !== undefined) dbUpdates.content = updates.content

  const { data: note, error } = await supabase
    .from('notes')
    .update(dbUpdates)
    .eq('id', noteId)
    .select()
    .single()

  if (error) {
    return { note: null, error }
  }

  return { note: transformFromDb(note), error: null }
}

/**
 * Delete a note
 * @param {string} noteId
 * @returns {Promise<{error: Error|null}>}
 */
export async function deleteNote(noteId) {
  const supabase = getSupabase()

  const { error } = await supabase
    .from('notes')
    .delete()
    .eq('id', noteId)

  return { error }
}

// Transform database row to frontend format
function transformFromDb(n) {
  if (!n) return null
  return {
    id: n.id,
    accountId: n.account_id,
    category: n.category,
    content: n.content,
    addedAt: n.created_at,
    createdAt: n.created_at,
  }
}
