import { getSupabase } from '../supabase'

/**
 * Get all information gaps for an account
 * @param {string} accountId
 * @returns {Promise<{gaps: Array|null, error: Error|null}>}
 */
export async function getGaps(accountId) {
  const supabase = getSupabase()

  const { data: gaps, error } = await supabase
    .from('information_gaps')
    .select('*')
    .eq('account_id', accountId)
    .order('created_at', { ascending: false })

  if (error) {
    return { gaps: null, error }
  }

  return {
    gaps: gaps.map(transformFromDb),
    error: null
  }
}

/**
 * Get open gaps for an account
 * @param {string} accountId
 * @returns {Promise<{gaps: Array|null, error: Error|null}>}
 */
export async function getOpenGaps(accountId) {
  const supabase = getSupabase()

  const { data: gaps, error } = await supabase
    .from('information_gaps')
    .select('*')
    .eq('account_id', accountId)
    .eq('status', 'open')
    .order('created_at', { ascending: false })

  if (error) {
    return { gaps: null, error }
  }

  return {
    gaps: gaps.map(transformFromDb),
    error: null
  }
}

/**
 * Get a single gap by ID
 * @param {string} gapId
 * @returns {Promise<{gap: Object|null, error: Error|null}>}
 */
export async function getGap(gapId) {
  const supabase = getSupabase()

  const { data: gap, error } = await supabase
    .from('information_gaps')
    .select('*')
    .eq('id', gapId)
    .single()

  if (error) {
    return { gap: null, error }
  }

  return { gap: transformFromDb(gap), error: null }
}

/**
 * Add a new information gap
 * @param {string} accountId
 * @param {Object} data
 * @returns {Promise<{gap: Object|null, error: Error|null}>}
 */
export async function addGap(accountId, data) {
  const supabase = getSupabase()

  const { data: gap, error } = await supabase
    .from('information_gaps')
    .insert({
      account_id: accountId,
      question: data.question,
      category: data.category || 'business',
      meddicc_category: data.meddiccCategory || null,
      status: data.status || 'open',
      resolution: data.resolution || null,
    })
    .select()
    .single()

  if (error) {
    return { gap: null, error }
  }

  return { gap: transformFromDb(gap), error: null }
}

/**
 * Resolve an information gap
 * @param {string} gapId
 * @param {string} resolution
 * @returns {Promise<{gap: Object|null, error: Error|null}>}
 */
export async function resolveGap(gapId, resolution) {
  const supabase = getSupabase()

  const { data: gap, error } = await supabase
    .from('information_gaps')
    .update({
      status: 'resolved',
      resolution: resolution,
      resolved_at: new Date().toISOString(),
    })
    .eq('id', gapId)
    .select()
    .single()

  if (error) {
    return { gap: null, error }
  }

  return { gap: transformFromDb(gap), error: null }
}

/**
 * Reopen an information gap
 * @param {string} gapId
 * @returns {Promise<{gap: Object|null, error: Error|null}>}
 */
export async function reopenGap(gapId) {
  const supabase = getSupabase()

  const { data: gap, error } = await supabase
    .from('information_gaps')
    .update({
      status: 'open',
      resolution: null,
      resolved_at: null,
    })
    .eq('id', gapId)
    .select()
    .single()

  if (error) {
    return { gap: null, error }
  }

  return { gap: transformFromDb(gap), error: null }
}

/**
 * Update an information gap
 * @param {string} gapId
 * @param {Object} updates
 * @returns {Promise<{gap: Object|null, error: Error|null}>}
 */
export async function updateGap(gapId, updates) {
  const supabase = getSupabase()

  const dbUpdates = {}
  if (updates.question !== undefined) dbUpdates.question = updates.question
  if (updates.category !== undefined) dbUpdates.category = updates.category
  if (updates.meddiccCategory !== undefined) dbUpdates.meddicc_category = updates.meddiccCategory
  if (updates.status !== undefined) dbUpdates.status = updates.status
  if (updates.resolution !== undefined) dbUpdates.resolution = updates.resolution

  const { data: gap, error } = await supabase
    .from('information_gaps')
    .update(dbUpdates)
    .eq('id', gapId)
    .select()
    .single()

  if (error) {
    return { gap: null, error }
  }

  return { gap: transformFromDb(gap), error: null }
}

/**
 * Delete an information gap
 * @param {string} gapId
 * @returns {Promise<{error: Error|null}>}
 */
export async function deleteGap(gapId) {
  const supabase = getSupabase()

  const { error } = await supabase
    .from('information_gaps')
    .delete()
    .eq('id', gapId)

  return { error }
}

// Transform database row to frontend format
function transformFromDb(g) {
  if (!g) return null
  return {
    id: g.id,
    accountId: g.account_id,
    question: g.question,
    category: g.category,
    meddiccCategory: g.meddicc_category,
    status: g.status,
    resolution: g.resolution,
    addedAt: g.created_at,
    createdAt: g.created_at,
    resolvedAt: g.resolved_at,
  }
}
