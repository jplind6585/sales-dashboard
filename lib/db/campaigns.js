// Campaigns data layer (Phase 2C). Named, multi-type campaigns + account membership.
import { getSupabase } from '../supabase'

export const CAMPAIGN_TYPES = [
  { id: 'reengagement', label: 'Reengagement' },
  { id: 'vertical_push', label: 'Vertical push' },
  { id: 'event_followup', label: 'Event follow-up' },
  { id: 'expansion', label: 'Expansion' },
  { id: 'other', label: 'Other' },
]

function transform(c) {
  if (!c) return null
  return {
    id: c.id, name: c.name, type: c.type, status: c.status, description: c.description,
    createdBy: c.created_by, createdAt: c.created_at, updatedAt: c.updated_at,
  }
}

export async function listCampaigns() {
  const db = getSupabase()
  const { data, error } = await db.from('campaigns').select('*').order('created_at', { ascending: false }).limit(500)
  if (error) return { campaigns: null, error }
  const ids = (data || []).map(c => c.id)
  const counts = {}
  if (ids.length) {
    const { data: mem } = await db.from('campaign_accounts').select('campaign_id').in('campaign_id', ids).limit(5000)
    for (const m of mem || []) counts[m.campaign_id] = (counts[m.campaign_id] || 0) + 1
  }
  return { campaigns: (data || []).map(c => ({ ...transform(c), memberCount: counts[c.id] || 0 })), error: null }
}

export async function createCampaign({ name, type, description, createdBy }) {
  const db = getSupabase()
  const { data, error } = await db.from('campaigns')
    .insert({ name, type: type || 'reengagement', description: description || null, created_by: createdBy || null })
    .select().single()
  return { campaign: transform(data), error }
}

export async function getCampaign(id) {
  const db = getSupabase()
  const { data: c, error } = await db.from('campaigns').select('*').eq('id', id).maybeSingle()
  if (error || !c) return { campaign: null, error }
  const { data: members } = await db.from('campaign_accounts')
    .select('account_id, status, added_at, accounts ( id, name, stage, deal_value, owner_name )')
    .eq('campaign_id', id).limit(2000)
  return {
    campaign: {
      ...transform(c),
      members: (members || []).map(m => ({ accountId: m.account_id, status: m.status, addedAt: m.added_at, account: m.accounts || null })),
    },
    error: null,
  }
}

export async function updateCampaign(id, updates) {
  const db = getSupabase()
  const patch = { updated_at: new Date().toISOString() }
  for (const k of ['name', 'type', 'status', 'description']) if (updates[k] !== undefined) patch[k] = updates[k]
  const { data, error } = await db.from('campaigns').update(patch).eq('id', id).select().single()
  return { campaign: transform(data), error }
}

export async function deleteCampaign(id) {
  const db = getSupabase()
  const { error } = await db.from('campaigns').delete().eq('id', id) // campaign_accounts cascade
  return { error }
}

export async function addAccountsToCampaign(id, accountIds) {
  const db = getSupabase()
  const rows = [...new Set(accountIds || [])].filter(Boolean).map(aid => ({ campaign_id: id, account_id: aid }))
  if (!rows.length) return { added: 0, error: null }
  const { error } = await db.from('campaign_accounts').upsert(rows, { onConflict: 'campaign_id,account_id' })
  return { added: error ? 0 : rows.length, error }
}

export async function removeAccountFromCampaign(id, accountId) {
  const db = getSupabase()
  const { error } = await db.from('campaign_accounts').delete().eq('campaign_id', id).eq('account_id', accountId)
  return { error }
}

// Campaigns a given account belongs to (for the Overview membership badge).
export async function getCampaignsForAccount(accountId) {
  const db = getSupabase()
  const { data, error } = await db.from('campaign_accounts')
    .select('status, campaigns ( id, name, type, status )').eq('account_id', accountId)
  if (error) return { campaigns: null, error }
  return { campaigns: (data || []).filter(r => r.campaigns).map(r => ({ ...transform(r.campaigns), memberStatus: r.status })), error: null }
}
