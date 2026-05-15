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
  const callBonus = Math.min((account.transcripts?.length || 0) * 3, 15)
  const stakeholderBonus = Math.min((account.stakeholders?.length || 0) * 2, 10)
  const championBonus = (account.stakeholders || []).some(s => s.role === 'Champion') ? 5 : 0
  return Math.min(base + callBonus + stakeholderBonus + championBonus, 95)
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const supabase = createClient()

  try {
    // ── Accounts ─────────────────────────────────────────────────────────────
    const { data: accounts, error: accountsError } = await supabase
      .from('accounts')
      .select(`
        id, name, stage, vertical, user_id, updated_at,
        deal_value, close_date, hubspot_stage, hubspot_synced_at,
        stakeholders ( id, role ),
        transcripts ( id, date, created_at )
      `)
      .order('updated_at', { ascending: false })

    if (accountsError) throw accountsError

    // ── Last call date per account from gong_call_analyses ───────────────────
    const { data: lastCallRows } = await supabase
      .from('gong_call_analyses')
      .select('account_id, call_date')
      .not('account_id', 'is', null)
      .order('call_date', { ascending: false })

    const lastCallByAccount = {}
    for (const row of (lastCallRows || [])) {
      if (!lastCallByAccount[row.account_id]) {
        lastCallByAccount[row.account_id] = row.call_date
      }
    }

    const now = Date.now()
    function lastCallDays(accountId) {
      const dateStr = lastCallByAccount[accountId]
      if (!dateStr) return null
      return Math.floor((now - new Date(dateStr)) / (1000 * 60 * 60 * 24))
    }

    // ── Profiles ─────────────────────────────────────────────────────────────
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('id, full_name, email, role')

    if (profilesError) throw profilesError

    // ── Task health ───────────────────────────────────────────────────────────
    const today = new Date().toISOString().split('T')[0]
    const weekAgo = new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString()

    const { data: openTasks } = await supabase
      .from('tasks')
      .select('owner_id, due_date, status')
      .in('status', ['open', 'in_progress', 'blocked'])

    const { data: completedTasks } = await supabase
      .from('tasks')
      .select('owner_id, completed_at')
      .eq('status', 'complete')
      .gte('completed_at', weekAgo)

    // ── Last week's confidence snapshots ─────────────────────────────────────
    const lastWeekDate = new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    const { data: snapshots } = await supabase
      .from('rep_confidence_snapshots')
      .select('rep_name, confidence_score, snapped_at')
      .lte('snapped_at', lastWeekDate)
      .order('snapped_at', { ascending: false })

    const lastWeekScoreByRep = {}
    for (const snap of (snapshots || [])) {
      if (!lastWeekScoreByRep[snap.rep_name]) {
        lastWeekScoreByRep[snap.rep_name] = snap.confidence_score
      }
    }

    // ── Build rep summaries ──────────────────────────────────────────────────
    const reps = profiles.filter(p => p.role === 'rep')

    const snapshotUpserts = []

    const repSummaries = reps.map(rep => {
      const repAccounts = accounts.filter(a => a.user_id === rep.id)
      const repTasks = (openTasks || []).filter(t => t.owner_id === rep.id)
      const overdue = repTasks.filter(t => t.due_date && t.due_date < today)
      const doneThisWeek = (completedTasks || []).filter(t => t.owner_id === rep.id).length

      const stageCounts = {}
      for (const acct of repAccounts) {
        stageCounts[acct.stage] = (stageCounts[acct.stage] || 0) + 1
      }

      const staleAccounts = repAccounts
        .filter(a => {
          const transcripts = a.transcripts || []
          if (transcripts.length === 0) return true
          const lastDate = transcripts
            .map(t => new Date(t.added_at || t.date))
            .sort((a, b) => b - a)[0]
          const daysSince = Math.floor((now - lastDate) / (1000 * 60 * 60 * 24))
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
            return Math.floor((now - lastDate) / (1000 * 60 * 60 * 24))
          })()
        }))

      const activeAccounts = repAccounts.filter(a => a.stage !== 'closed_won' && a.stage !== 'closed_lost')
      const repConfidence = activeAccounts.length > 0
        ? Math.round(activeAccounts.reduce((sum, a) => sum + accountConfidence(a), 0) / activeAccounts.length)
        : null

      // Confidence trend vs last week's snapshot
      const lastWeekScore = lastWeekScoreByRep[rep.full_name || rep.email] ?? null
      let confidenceTrend = null
      if (repConfidence != null && lastWeekScore != null) {
        const delta = repConfidence - lastWeekScore
        if (delta >= 2) confidenceTrend = { direction: 'up', delta }
        else if (delta <= -2) confidenceTrend = { direction: 'down', delta }
        else confidenceTrend = { direction: 'flat', delta }
      }

      if (repConfidence != null) {
        snapshotUpserts.push({ rep_name: rep.full_name || rep.email, confidence_score: repConfidence, snapped_at: today })
      }

      const totalPipeline = activeAccounts.reduce((sum, a) => sum + (a.deal_value || 0), 0)
      const weightedPipeline = activeAccounts.reduce((sum, a) => {
        return sum + ((a.deal_value || 0) * accountConfidence(a) / 100)
      }, 0)

      // Per-account heat data for expanded rows
      const accountList = activeAccounts.map(a => ({
        id: a.id,
        name: a.name,
        stage: a.stage,
        lastCallDays: lastCallDays(a.id),
      }))

      // Activity density summary: hot (<7d), warm (7-14d), cold (>14d or no calls)
      const hotCount = accountList.filter(a => a.lastCallDays != null && a.lastCallDays < 7).length
      const coldCount = accountList.filter(a => a.lastCallDays == null || a.lastCallDays > 14).length

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
        confidenceTrend,
        totalPipeline: Math.round(totalPipeline),
        weightedPipeline: Math.round(weightedPipeline),
        accountsWithValue: activeAccounts.filter(a => a.deal_value).length,
        accountList,
        hotCount,
        coldCount,
      }
    })

    // ── Upsert today's confidence snapshots (fire-and-forget) ────────────────
    if (snapshotUpserts.length > 0) {
      supabase
        .from('rep_confidence_snapshots')
        .upsert(snapshotUpserts, { onConflict: 'rep_name,snapped_at' })
        .then(() => {})
        .catch(() => {})
    }

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
