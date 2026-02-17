import { getSupabase } from '../supabase'

/**
 * Get all stakeholders for an account
 * @param {string} accountId
 * @returns {Promise<{stakeholders: Array|null, error: Error|null}>}
 */
export async function getStakeholders(accountId) {
  const supabase = getSupabase()

  const { data: stakeholders, error } = await supabase
    .from('stakeholders')
    .select('*')
    .eq('account_id', accountId)
    .order('created_at', { ascending: true })

  if (error) {
    return { stakeholders: null, error }
  }

  return {
    stakeholders: stakeholders.map(transformFromDb),
    error: null
  }
}

/**
 * Get a single stakeholder by ID
 * @param {string} stakeholderId
 * @returns {Promise<{stakeholder: Object|null, error: Error|null}>}
 */
export async function getStakeholder(stakeholderId) {
  const supabase = getSupabase()

  const { data: stakeholder, error } = await supabase
    .from('stakeholders')
    .select('*')
    .eq('id', stakeholderId)
    .single()

  if (error) {
    return { stakeholder: null, error }
  }

  return { stakeholder: transformFromDb(stakeholder), error: null }
}

/**
 * Add a new stakeholder
 * @param {string} accountId
 * @param {Object} data
 * @returns {Promise<{stakeholder: Object|null, error: Error|null}>}
 */
export async function addStakeholder(accountId, data) {
  const supabase = getSupabase()

  const { data: stakeholder, error } = await supabase
    .from('stakeholders')
    .insert({
      account_id: accountId,
      name: data.name,
      title: data.title || null,
      department: data.department || null,
      role: data.role || 'Unknown',
      notes: data.notes || null,
    })
    .select()
    .single()

  if (error) {
    return { stakeholder: null, error }
  }

  return { stakeholder: transformFromDb(stakeholder), error: null }
}

/**
 * Update a stakeholder
 * @param {string} stakeholderId
 * @param {Object} updates
 * @returns {Promise<{stakeholder: Object|null, error: Error|null}>}
 */
export async function updateStakeholder(stakeholderId, updates) {
  const supabase = getSupabase()

  const dbUpdates = {}
  if (updates.name !== undefined) dbUpdates.name = updates.name
  if (updates.title !== undefined) dbUpdates.title = updates.title
  if (updates.department !== undefined) dbUpdates.department = updates.department
  if (updates.role !== undefined) dbUpdates.role = updates.role
  if (updates.notes !== undefined) dbUpdates.notes = updates.notes

  const { data: stakeholder, error } = await supabase
    .from('stakeholders')
    .update(dbUpdates)
    .eq('id', stakeholderId)
    .select()
    .single()

  if (error) {
    return { stakeholder: null, error }
  }

  return { stakeholder: transformFromDb(stakeholder), error: null }
}

/**
 * Delete a stakeholder
 * @param {string} stakeholderId
 * @returns {Promise<{error: Error|null}>}
 */
export async function deleteStakeholder(stakeholderId) {
  const supabase = getSupabase()

  const { error } = await supabase
    .from('stakeholders')
    .delete()
    .eq('id', stakeholderId)

  return { error }
}

/**
 * Find stakeholder by name (case-insensitive)
 * @param {string} accountId
 * @param {string} name
 * @returns {Promise<{stakeholder: Object|null, error: Error|null}>}
 */
export async function findStakeholderByName(accountId, name) {
  const supabase = getSupabase()

  const { data: stakeholder, error } = await supabase
    .from('stakeholders')
    .select('*')
    .eq('account_id', accountId)
    .ilike('name', name)
    .maybeSingle()

  if (error) {
    return { stakeholder: null, error }
  }

  return { stakeholder: stakeholder ? transformFromDb(stakeholder) : null, error: null }
}

// Transform database row to frontend format
function transformFromDb(s) {
  if (!s) return null
  return {
    id: s.id,
    accountId: s.account_id,
    name: s.name,
    title: s.title,
    department: s.department,
    role: s.role,
    notes: s.notes,
    addedAt: s.created_at,
    createdAt: s.created_at,
    updatedAt: s.updated_at,
    lastUpdated: s.updated_at,
  }
}
