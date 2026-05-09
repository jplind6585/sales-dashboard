import { createServerSupabaseClient } from '../../lib/supabase'
import { getSupabase } from '../../lib/supabase'

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  // Auth check
  const supabase = createServerSupabaseClient(req, res)
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return res.status(401).json({ error: 'Unauthorized' })

  const db = getSupabase()

  // Fetch all accounts with stage and dates
  const { data: accounts, error } = await db
    .from('accounts')
    .select('id, name, stage, vertical, updated_at, user_id, owner_name, created_at')
    .order('created_at', { ascending: true })

  if (error) return res.status(500).json({ error: error.message })

  // Also fetch profiles for rep name lookup
  const { data: profiles } = await db
    .from('profiles')
    .select('id, full_name, email, role')

  // Stage order — full pipeline
  const STAGE_ORDER = [
    'qualifying', 'intro_scheduled', 'active_pursuit', 'demo',
    'solution_validation', 'proposal', 'legal', 'closed_won', 'closed_lost'
  ]

  const ACTIVE_STAGES = STAGE_ORDER.filter(s => s !== 'closed_won' && s !== 'closed_lost')

  // Count per stage
  const stageCounts = {}
  for (const s of STAGE_ORDER) stageCounts[s] = 0
  for (const a of accounts) {
    if (stageCounts[a.stage] !== undefined) stageCounts[a.stage]++
  }

  // Win rate
  const wonCount = stageCounts['closed_won'] || 0
  const lostCount = stageCounts['closed_lost'] || 0
  const winRate = wonCount + lostCount > 0 ? Math.round((wonCount / (wonCount + lostCount)) * 100) : null

  // Compute conversion rates between consecutive active stages
  const conversions = []
  for (let i = 0; i < ACTIVE_STAGES.length - 1; i++) {
    const from = ACTIVE_STAGES[i]
    const to = ACTIVE_STAGES[i + 1]
    const fromCount = stageCounts[from] || 0
    const toCount = stageCounts[to] || 0
    const total = fromCount + toCount
    const rate = total > 0 ? Math.round((toCount / total) * 100) : null
    conversions.push({ from, to, fromCount, toCount, rate })
  }

  // Identify bottleneck: stage with highest absolute drop to next stage
  let bottleneckStage = null
  let worstDrop = 0
  for (const conv of conversions) {
    const drop = conv.fromCount - conv.toCount
    if (drop > worstDrop && conv.fromCount > 2) {
      worstDrop = drop
      bottleneckStage = conv.from
    }
  }

  // Per-rep breakdown
  const repBreakdown = {}
  for (const a of accounts) {
    if (!a.owner_name) continue
    if (!repBreakdown[a.owner_name]) {
      repBreakdown[a.owner_name] = { name: a.owner_name, stages: {}, total: 0 }
      for (const s of ACTIVE_STAGES) repBreakdown[a.owner_name].stages[s] = 0
    }
    if (repBreakdown[a.owner_name].stages[a.stage] !== undefined) {
      repBreakdown[a.owner_name].stages[a.stage]++
      repBreakdown[a.owner_name].total++
    }
  }

  // Stall alerts: accounts in high-value stages not updated in >21 days
  const STALL_STAGES = ['demo', 'solution_validation', 'proposal', 'legal']
  const stalls = accounts
    .filter(a => STALL_STAGES.includes(a.stage))
    .map(a => {
      const days = Math.floor((Date.now() - new Date(a.updated_at).getTime()) / (1000 * 60 * 60 * 24))
      return { ...a, daysSinceUpdate: days }
    })
    .filter(a => a.daysSinceUpdate > 21)
    .sort((a, b) => b.daysSinceUpdate - a.daysSinceUpdate)
    .slice(0, 10)

  return res.status(200).json({
    stageCounts,
    stageOrder: STAGE_ORDER,
    activeStages: ACTIVE_STAGES,
    conversions,
    bottleneckStage,
    winRate,
    wonCount,
    lostCount,
    repBreakdown: Object.values(repBreakdown),
    stalls,
    totalAccounts: accounts.length,
    activeCount: accounts.filter(a => ACTIVE_STAGES.includes(a.stage)).length,
  })
}
