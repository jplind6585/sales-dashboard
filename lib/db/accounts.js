import { getSupabase } from '../supabase'

/**
 * Get all accounts for a user with related data
 * @param {string} userId
 * @returns {Promise<{accounts: Array|null, error: Error|null}>}
 */
export async function getAccounts(userId) {
  const supabase = getSupabase()

  // Fetch lightweight account metadata only (no joins) — RLS handles authorization
  const { data: accounts, error } = await supabase
    .from('accounts')
    .select('id, name, stage, tier, owner_name, hubspot_deal_id, deal_value, close_date, created_at, updated_at, user_id, hubspot_synced_at')
    .order('name', { ascending: true })

  if (error) {
    return { accounts: null, error }
  }

  return {
    accounts: (accounts || []).map(a => ({
      id: a.id,
      name: a.name,
      stage: a.stage,
      tier: a.tier || 'active',
      ownerName: a.owner_name,
      dealValue: a.deal_value,
      closeDate: a.close_date,
      hubspotDealId: a.hubspot_deal_id,
      createdAt: a.created_at,
      updatedAt: a.updated_at,
      // empty arrays so existing code doesn't break
      transcripts: [],
      stakeholders: [],
      informationGaps: [],
      notes: [],
    })),
    error: null
  }
}

/**
 * Get a single account by ID with related data (full detail)
 * @param {string} accountId
 * @returns {Promise<{account: Object|null, error: Error|null}>}
 */
export async function getAccountDetail(accountId) {
  const supabase = getSupabase()

  const { data: account, error } = await supabase
    .from('accounts')
    .select(`
      *,
      transcripts (*),
      stakeholders (*),
      information_gaps (*),
      notes (*)
    `)
    .eq('id', accountId)
    .single()

  if (error) {
    return { account: null, error }
  }

  return { account: transformAccountFromDb(account), error: null }
}

/**
 * Get a single account by ID with related data
 * @param {string} accountId
 * @returns {Promise<{account: Object|null, error: Error|null}>}
 */
export async function getAccount(accountId) {
  const supabase = getSupabase()

  const { data: account, error } = await supabase
    .from('accounts')
    .select(`
      *,
      transcripts (*),
      stakeholders (*),
      information_gaps (*),
      notes (*)
    `)
    .eq('id', accountId)
    .single()

  if (error) {
    return { account: null, error }
  }

  return { account: transformAccountFromDb(account), error: null }
}

/**
 * Create a new account
 * @param {string} userId
 * @param {Object} data - { name, url, stage, vertical, ownershipType }
 * @returns {Promise<{account: Object|null, error: Error|null}>}
 */
export async function createAccount(userId, data) {
  const supabase = getSupabase()

  const { data: account, error } = await supabase
    .from('accounts')
    .insert({
      user_id: userId,
      name: data.name,
      url: data.url || null,
      stage: data.stage || 'qualifying',
      vertical: data.vertical || null,
      ownership_type: data.ownershipType || null,
      business_areas: data.businessAreas || {},
      meddicc: data.meddicc || {},
      metrics: data.metrics || {},
      ...(data.outbound_company_id ? { outbound_company_id: data.outbound_company_id } : {}),
      ...(data.slackChannel ? { slack_channel: data.slackChannel } : {}),
    })
    .select()
    .single()

  if (error) {
    return { account: null, error }
  }

  // Return with empty arrays for related data
  return {
    account: {
      ...transformAccountFromDb(account),
      transcripts: [],
      stakeholders: [],
      informationGaps: [],
      notes: []
    },
    error: null
  }
}

/**
 * Update an account
 * @param {string} accountId
 * @param {Object} updates
 * @returns {Promise<{account: Object|null, error: Error|null}>}
 */
export async function updateAccount(accountId, updates) {
  const supabase = getSupabase()

  // Transform camelCase to snake_case for database
  const dbUpdates = transformAccountToDb(updates)

  const { data: account, error } = await supabase
    .from('accounts')
    .update(dbUpdates)
    .eq('id', accountId)
    .select()
    .single()

  if (error) {
    return { account: null, error }
  }

  return { account: transformAccountFromDb(account), error: null }
}

/**
 * Delete an account (cascades to related tables)
 * @param {string} accountId
 * @returns {Promise<{error: Error|null}>}
 */
export async function deleteAccount(accountId) {
  const supabase = getSupabase()

  const { error } = await supabase
    .from('accounts')
    .delete()
    .eq('id', accountId)

  return { error }
}

// Transform database row to frontend format
function transformAccountFromDb(account) {
  if (!account) return null

  return {
    id: account.id,
    userId: account.user_id,
    name: account.name,
    url: account.url,
    stage: account.stage,
    tier: account.tier || 'active',
    vertical: account.vertical,
    ownershipType: account.ownership_type,
    businessAreas: account.business_areas || {},
    meddicc: account.meddicc || {},
    metrics: account.metrics || {},
    slackChannel: account.slack_channel || null,
    dealValue: account.deal_value ?? null,
    closeDate: account.close_date ?? null,
    hubspotDealId: account.hubspot_deal_id ?? null,
    hubspotStage: account.hubspot_stage ?? null,
    hubspotSyncedAt: account.hubspot_synced_at ?? null,
    createdAt: account.created_at,
    updatedAt: account.updated_at,
    lastUpdated: account.updated_at,
    // Transform related data
    transcripts: (account.transcripts || []).map(transformTranscriptFromDb),
    stakeholders: (account.stakeholders || []).map(transformStakeholderFromDb),
    informationGaps: (account.information_gaps || []).map(transformGapFromDb),
    notes: (account.notes || []).map(transformNoteFromDb),
  }
}

// Transform frontend format to database format
function transformAccountToDb(account) {
  const dbAccount = {}

  if (account.name !== undefined) dbAccount.name = account.name
  if (account.url !== undefined) dbAccount.url = account.url
  if (account.stage !== undefined) dbAccount.stage = account.stage
  if (account.tier !== undefined) dbAccount.tier = account.tier
  if (account.vertical !== undefined) dbAccount.vertical = account.vertical
  if (account.ownershipType !== undefined) dbAccount.ownership_type = account.ownershipType
  if (account.ownership_type !== undefined) dbAccount.ownership_type = account.ownership_type
  if (account.businessAreas !== undefined) dbAccount.business_areas = account.businessAreas
  if (account.business_areas !== undefined) dbAccount.business_areas = account.business_areas
  if (account.meddicc !== undefined) dbAccount.meddicc = account.meddicc
  if (account.metrics !== undefined) dbAccount.metrics = account.metrics
  if (account.slackChannel !== undefined) dbAccount.slack_channel = account.slackChannel
  if (account.slack_channel !== undefined) dbAccount.slack_channel = account.slack_channel

  return dbAccount
}

// Helper transforms for related tables
function transformTranscriptFromDb(t) {
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

function transformStakeholderFromDb(s) {
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

function transformGapFromDb(g) {
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

function transformNoteFromDb(n) {
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
