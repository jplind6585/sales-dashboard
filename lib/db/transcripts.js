import { getSupabase } from '../supabase'

/**
 * Get all transcripts for an account
 * @param {string} accountId
 * @returns {Promise<{transcripts: Array|null, error: Error|null}>}
 */
export async function getTranscripts(accountId) {
  const supabase = getSupabase()

  const { data: transcripts, error } = await supabase
    .from('transcripts')
    .select('*')
    .eq('account_id', accountId)
    .order('date', { ascending: false })

  if (error) {
    return { transcripts: null, error }
  }

  return {
    transcripts: transcripts.map(transformFromDb),
    error: null
  }
}

/**
 * Get a single transcript by ID
 * @param {string} transcriptId
 * @returns {Promise<{transcript: Object|null, error: Error|null}>}
 */
export async function getTranscript(transcriptId) {
  const supabase = getSupabase()

  const { data: transcript, error } = await supabase
    .from('transcripts')
    .select('*')
    .eq('id', transcriptId)
    .single()

  if (error) {
    return { transcript: null, error }
  }

  return { transcript: transformFromDb(transcript), error: null }
}

/**
 * Add a new transcript
 * @param {string} accountId
 * @param {Object} data
 * @returns {Promise<{transcript: Object|null, error: Error|null}>}
 */
export async function addTranscript(accountId, data) {
  const supabase = getSupabase()

  const { data: transcript, error } = await supabase
    .from('transcripts')
    .insert({
      account_id: accountId,
      text: data.text,
      date: data.date || new Date().toISOString().split('T')[0],
      call_type: data.callType || 'other',
      attendees: data.attendees || [],
      summary: data.summary || null,
      raw_analysis: data.rawAnalysis || null,
      source: data.source || 'manual',
      gong_call_id: data.gongCallId || null,
      gong_url: data.gongUrl || null,
    })
    .select()
    .single()

  if (error) {
    return { transcript: null, error }
  }

  return { transcript: transformFromDb(transcript), error: null }
}

/**
 * Update a transcript
 * @param {string} transcriptId
 * @param {Object} updates
 * @returns {Promise<{transcript: Object|null, error: Error|null}>}
 */
export async function updateTranscript(transcriptId, updates) {
  const supabase = getSupabase()

  const dbUpdates = {}
  if (updates.text !== undefined) dbUpdates.text = updates.text
  if (updates.date !== undefined) dbUpdates.date = updates.date
  if (updates.callType !== undefined) dbUpdates.call_type = updates.callType
  if (updates.attendees !== undefined) dbUpdates.attendees = updates.attendees
  if (updates.summary !== undefined) dbUpdates.summary = updates.summary
  if (updates.rawAnalysis !== undefined) dbUpdates.raw_analysis = updates.rawAnalysis

  const { data: transcript, error } = await supabase
    .from('transcripts')
    .update(dbUpdates)
    .eq('id', transcriptId)
    .select()
    .single()

  if (error) {
    return { transcript: null, error }
  }

  return { transcript: transformFromDb(transcript), error: null }
}

/**
 * Delete a transcript
 * @param {string} transcriptId
 * @returns {Promise<{error: Error|null}>}
 */
export async function deleteTranscript(transcriptId) {
  const supabase = getSupabase()

  const { error } = await supabase
    .from('transcripts')
    .delete()
    .eq('id', transcriptId)

  return { error }
}

// Transform database row to frontend format
function transformFromDb(t) {
  if (!t) return null
  return {
    id: t.id,
    accountId: t.account_id,
    text: t.text,
    date: t.date,
    callType: t.call_type,
    attendees: t.attendees || [],
    summary: t.summary,
    rawAnalysis: t.raw_analysis,
    source: t.source,
    gongCallId: t.gong_call_id,
    gongUrl: t.gong_url,
    addedAt: t.created_at,
    createdAt: t.created_at,
  }
}
