import { createClient } from '../../lib/supabase'

// Stage-based win probability (%)
const STAGE_PROBABILITY = {
  qualifying: 5,
  intro_scheduled: 10,
  active_pursuit: 20,
  demo: 35,
  solution_validation: 55,
  proposal: 70,
  legal: 85,
  closed_won: 100,
  closed_lost: 0,
}

function accountConfidence(account) {
  const base = STAGE_PROBABILITY[account.stage] ?? 10
  if (account.stage === 'closed_won') return 100
  if (account.stage === 'closed_lost') return 0
  // Bonuses: calls logged (up to +15), stakeholders mapped (up to +10), champion identified (+5)
  const callBonus = Math.min((account.transcripts?.length || 0) * 3, 15)
  const stakeholderBonus = Math.min((account.stakeholders?.length || 0) * 2, 10)
  const championBonus = (account.stakeholders || []).some(s => s.role === 'Champion') ? 5 : 0
  return Math.min(base + callBonus + stakeholderBonus + championBonus, 95)
}

/**
 * GET /api/pipeline-overview
 *
 * Manager/admin-only endpoint that returns:
 * - All accounts with stage, stakeholders, last activity (grouped by owner)
 * - Task health per rep (open, overdue, completed this week)
 * - Stale accounts (no transcript activity in 14+ days)
 *
 * RLS ensures only managers/admins can read cross-user data.
 */
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const supabase = createClient()

  try {
    // ── Accounts (all, cross-user via RLS manager policy) ────────────────────
    const { data: accounts, error: accountsError } = await supabase
      .from('accounts')
      .select(`
        id, name, stage, vertical, user_id, updated_at,
        deal_value, close_date, hubspot_stage, hubspot_synced_at,
        stakeholders ( id, role ),
        transcripts ( id, date, added_at )
      `)
      .order('updated_at', { ascending: false })

    if (accountsError) throw accountsError

    // ── Profiles (for rep name mapping) ─────────────────────────────────────
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('id, full_name, email, role')

    if (profilesError) throw profilesError

    // ── Task health ───────────────────────────────────────────────────────────
    const today = new Date().toISOString().split('T')[0]
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

    const { data: openTasks } = await supabase
      .from('tasks')
      .select('owner_id, due_date, status')
      .in('status', ['open', 'in_progress', 'blocked'])

    const { data: completedTasks } = await supabase
      .from('tasks')
      .select('owner_id, completed_at')
      .eq('status', 'complete')
      .gte('completed_at', weekAgo)

    // ── Build rep summaries ──────────────────────────────────────────────────
    const reps = profiles.filter(p => p.role === 'rep')

    const repSummaries = reps.map(rep => {
      const repAccounts = accounts.filter(a => a.user_id === rep.id)
      const repTasks = (openTasks || []).filter(t => t.owner_id === rep.id)
      const overdue = repTasks.filter(t => t.due_date && t.due_date < today)
      const doneThisWeek = (completedTasks || []).filter(t => t.owner_id === rep.id).length

      // Stage breakdown for this rep
      const stageCounts = {}
      for (const acct of repAccounts) {
        stageCounts[acct.stage] = (stageCounts[acct.stage] || 0) + 1
      }

      // Stale accounts: last transcript > 14 days ago or no transcript
      const staleAccounts = repAccounts
        .filter(a => {
          const transcripts = a.transcripts || []
          if (transcripts.length === 0) return true
          const lastDate = transcripts
            .map(t => new Date(t.added_at || t.date))
            .sort((a, b) => b - a)[0]
          const daysSince = Math.floor((Date.now() - lastDate) / (1000 * 60 * 60 * 24))
          return daysSince >= 14
        })
        .map(a => ({
          id: a.id,
          name: a.name,
          stage: a.stage,
          daysSinceActivity: (() => {
            const transcripts = a.transcripts || []
            if (transcripts.length === 0) return null
            const lastDate = transcripts
              .map(t => new Date(t.added_at || t.date))
              .sort((a, b) => b - a)[0]
            return Math.floor((Date.now() - lastDate) / (1000 * 60 * 60 * 24))
          })()
        }))

      // Pipeline confidence: average confidence across active (non-closed) accounts
      const activeAccounts = repAccounts.filter(a => a.stage !== 'closed_won' && a.stage !== 'closed_lost')
      const repConfidence = activeAccounts.length > 0
        ? Math.round(activeAccounts.reduce((sum, a) => sum + accountConfidence(a), 0) / activeAccounts.length)
        : null

      // Pipeline value (raw) and weighted value
      const totalPipeline = activeAccounts.reduce((sum, a) => sum + (a.deal_value || 0), 0)
      const weightedPipeline = activeAccounts.reduce((sum, a) => {
        return sum + ((a.deal_value || 0) * accountConfidence(a) / 100)
      }, 0)

      return {
        id: rep.id,
        name: rep.full_name || rep.email || 'Rep',
        totalAccounts: repAccounts.length,
        activeAccounts: activeAccounts.length,
        openTasks: repTasks.length,
        overdueTasks: overdue.length,
        doneThisWeek,
        stageCounts,
        staleAccounts,
        pipelineConfidence: repConfidence,
        totalPipeline: Math.round(totalPipeline),
        weightedPipeline: Math.round(weightedPipeline),
        accountsWithValue: activeAccounts.filter(a => a.deal_value).length,
      }
    })

    // ── Pipeline-wide stage distribution ─────────────────────────────────────
    const stageCounts = {}
    for (const acct of accounts) {
      stageCounts[acct.stage] = (stageCounts[acct.stage] || 0) + 1
    }

    // Overall pipeline confidence + dollar values
    const activeAccounts = accounts.filter(a => a.stage !== 'closed_won' && a.stage !== 'closed_lost')
    const overallConfidence = activeAccounts.length > 0
      ? Math.round(activeAccounts.reduce((sum, a) => sum + accountConfidence(a), 0) / activeAccounts.length)
      : null
    const totalPipeline = activeAccounts.reduce((sum, a) => sum + (a.deal_value || 0), 0)
    const weightedPipeline = activeAccounts.reduce((sum, a) => {
      return sum + ((a.deal_value || 0) * accountConfidence(a) / 100)
    }, 0)
    const accountsWithValue = activeAccounts.filter(a => a.deal_value).length
    const hubspotSynced = accounts.some(a => a.hubspot_synced_at)

    return res.status(200).json({
      repSummaries,
      stageCounts,
      totalAccounts: accounts.length,
      totalOpenTasks: (openTasks || []).length,
      totalOverdue: (openTasks || []).filter(t => t.due_date && t.due_date < today).length,
      pipelineConfidence: overallConfidence,
      activeAccounts: activeAccounts.length,
      totalPipeline: Math.round(totalPipeline),
      weightedPipeline: Math.round(weightedPipeline),
      accountsWithValue,
      hubspotSynced,
    })
  } catch (err) {
    console.error('Pipeline overview error:', err)
    return res.status(500).json({ error: err.message })
  }
}
