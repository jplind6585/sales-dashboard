// Merge two accounts into one canonical record, with full unmerge support.
// POST { canonicalId, absorbedId } — merge absorbed into canonical
// POST { unmergeId } — reverse a previous merge using its log entry

import { apiError, apiSuccess, logRequest } from '../../../lib/apiUtils';
import { createServerSupabaseClient, getSupabase } from '../../../lib/supabase';

export default async function handler(req, res) {
  logRequest(req, 'admin/merge')
  if (req.method !== 'POST') return apiError(res, 405, 'Method not allowed')

  const authClient = createServerSupabaseClient(req, res)
  const { data: { user } } = await authClient.auth.getUser()
  if (!user) return apiError(res, 401, 'Unauthorized')

  const db = getSupabase()
  const { canonicalId, absorbedId, unmergeId } = req.body || {}

  // ── UNMERGE ──────────────────────────────────────────────────────────────────
  if (unmergeId) {
    const { data: log } = await db.from('account_merge_log').select('*').eq('id', unmergeId).single()
    if (!log) return apiError(res, 404, 'Merge log entry not found')
    if (log.reversed_at) return apiError(res, 400, 'This merge has already been reversed')

    const snap = log.absorbed_snapshot
    if (!snap) return apiError(res, 400, 'No snapshot found — cannot unmerge')

    // Restore the absorbed account
    const { error: restoreErr } = await db.from('accounts').insert({
      id: log.absorbed_account_id,
      name: snap.name,
      stage: snap.stage,
      vertical: snap.vertical,
      ownership_type: snap.ownership_type,
      user_id: snap.user_id,
      meddicc: snap.meddicc || {},
      metrics: snap.metrics || {},
      business_areas: snap.business_areas || {},
      aliases: snap.aliases || [],
      email_domains: snap.email_domains || [],
      deal_value: snap.deal_value || null,
      close_date: snap.close_date || null,
      hubspot_deal_id: snap.hubspot_deal_id || null,
      hubspot_stage: snap.hubspot_stage || null,
      slack_channel: snap.slack_channel || null,
      created_at: snap.created_at,
    })
    if (restoreErr) return apiError(res, 500, `Restore failed: ${restoreErr.message}`)

    // Move data back to absorbed account
    await Promise.all([
      db.from('gong_call_analyses').update({ account_id: log.absorbed_account_id }).eq('account_id', log.canonical_account_id).not('gong_call_id', 'is', null),
      db.from('tasks').update({ account_id: log.absorbed_account_id }).eq('account_id', log.canonical_account_id),
      db.from('stakeholders').update({ account_id: log.absorbed_account_id }).eq('account_id', log.canonical_account_id),
      db.from('notes').update({ account_id: log.absorbed_account_id }).eq('account_id', log.canonical_account_id),
      db.from('transcripts').update({ account_id: log.absorbed_account_id }).eq('account_id', log.canonical_account_id),
    ])

    // Mark log reversed
    await db.from('account_merge_log').update({ reversed_at: new Date().toISOString(), reversed_by: user.email }).eq('id', unmergeId)

    return apiSuccess(res, { unmerged: true, restoredAccount: log.absorbed_account_name })
  }

  // ── MERGE ────────────────────────────────────────────────────────────────────
  if (!canonicalId || !absorbedId) return apiError(res, 400, 'canonicalId and absorbedId required')
  if (canonicalId === absorbedId) return apiError(res, 400, 'Cannot merge an account with itself')

  // Fetch both accounts + counts
  const [
    { data: canonical },
    { data: absorbed },
    { count: callCount },
    { count: taskCount },
    { count: stakeholderCount },
    { count: noteCount },
  ] = await Promise.all([
    db.from('accounts').select('*').eq('id', canonicalId).single(),
    db.from('accounts').select('*').eq('id', absorbedId).single(),
    db.from('gong_call_analyses').select('*', { count: 'exact', head: true }).eq('account_id', absorbedId),
    db.from('tasks').select('*', { count: 'exact', head: true }).eq('account_id', absorbedId),
    db.from('stakeholders').select('*', { count: 'exact', head: true }).eq('account_id', absorbedId),
    db.from('notes').select('*', { count: 'exact', head: true }).eq('account_id', absorbedId),
  ])

  if (!canonical) return apiError(res, 404, 'Canonical account not found')
  if (!absorbed) return apiError(res, 404, 'Absorbed account not found')

  // Merge aliases and domains — union both sets
  const mergedAliases = [...new Set([...(canonical.aliases || []), ...(absorbed.aliases || []), absorbed.name])]
  const mergedDomains = [...new Set([...(canonical.email_domains || []), ...(absorbed.email_domains || [])])]

  // Reassign all data from absorbed → canonical
  await Promise.all([
    db.from('gong_call_analyses').update({ account_id: canonicalId }).eq('account_id', absorbedId),
    db.from('tasks').update({ account_id: canonicalId }).eq('account_id', absorbedId),
    db.from('stakeholders').update({ account_id: canonicalId }).eq('account_id', absorbedId),
    db.from('notes').update({ account_id: canonicalId }).eq('account_id', absorbedId),
    db.from('transcripts').update({ account_id: canonicalId }).eq('account_id', absorbedId),
  ])

  // Update canonical with merged aliases/domains (keep canonical's deal value if present)
  await db.from('accounts').update({
    aliases: mergedAliases,
    email_domains: mergedDomains,
    deal_value: canonical.deal_value || absorbed.deal_value || null,
    hubspot_deal_id: canonical.hubspot_deal_id || absorbed.hubspot_deal_id || null,
  }).eq('id', canonicalId)

  // Log the merge with full snapshot of absorbed account (for unmerge)
  await db.from('account_merge_log').insert({
    merged_by: user.email,
    canonical_account_id: canonicalId,
    absorbed_account_id: absorbedId,
    absorbed_account_name: absorbed.name,
    absorbed_snapshot: absorbed,
    calls_reassigned: callCount || 0,
    tasks_reassigned: taskCount || 0,
    stakeholders_reassigned: stakeholderCount || 0,
    notes_reassigned: noteCount || 0,
  })

  // Delete absorbed account (data is now under canonical)
  await db.from('accounts').delete().eq('id', absorbedId)

  return apiSuccess(res, {
    merged: true,
    canonical: canonical.name,
    absorbed: absorbed.name,
    reassigned: { calls: callCount, tasks: taskCount, stakeholders: stakeholderCount, notes: noteCount },
  })
}
