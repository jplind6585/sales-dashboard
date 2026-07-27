import { createServerSupabaseClient, getSupabase } from '../../../lib/supabase'
import { callAnthropic, parseClaudeJson, logRequest } from '../../../lib/apiUtils'

export default async function handler(req, res) {
  logRequest(req, 'rep/morning-brief')
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const authClient = createServerSupabaseClient(req, res)
  const { data: { user } } = await authClient.auth.getUser()
  if (!user) return res.status(401).json({ error: 'Unauthorized' })

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return res.status(500).json({ error: 'ANTHROPIC_API_KEY not configured' })

  const db = getSupabase()
  const today = new Date().toISOString().split('T')[0]
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
  const twoWeeksAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString()

  const [tasksRes, gongRes, accountsRes] = await Promise.all([
    db.from('tasks')
      .select('id, title, description, priority, due_date, source, source_type, rationale, primary_action, type')
      .eq('owner_id', user.id)
      .in('status', ['open', 'in_progress', 'blocked'])
      .is('dismissed_at', null)
      .order('due_date', { ascending: true, nullsFirst: false })
      .order('priority', { ascending: true }),
    db.from('gong_call_analyses')
      .select('title, call_date, rep_email, analysis, account_id')
      .eq('rep_email', user.email)
      .gte('call_date', weekAgo)
      .not('analyzed_at', 'is', null)
      .order('call_date', { ascending: false })
      .limit(5),
    db.from('accounts')
      .select('id, name, stage')
      .not('stage', 'in', '(closed_won,closed_lost)')
      .order('name')
      .limit(150),
  ])

  // Setup/onboarding tasks (Connect Google, Slack ID) are not sales work — keep them out of the
  // brief so it never opens with "DO FIRST: connect your calendar".
  const allTasks = (tasksRes.data || []).filter(t => t.source !== 'onboarding')
  const recentCalls = gongRes.data || []
  const activeAccounts = accountsRes.data || []

  const accountMap = {}
  activeAccounts.forEach(a => { accountMap[a.id] = a })

  // Find last call date per account
  const accountIdList = activeAccounts.map(a => a.id).filter(Boolean)
  let lastCallByAccount = {}
  if (accountIdList.length > 0) {
    const { data: allCalls } = await db
      .from('gong_call_analyses')
      .select('account_id, call_date')
      .in('account_id', accountIdList.slice(0, 80))
      .not('analyzed_at', 'is', null)
      .order('call_date', { ascending: false })

    if (allCalls) {
      for (const c of allCalls) {
        if (c.account_id && !lastCallByAccount[c.account_id]) {
          lastCallByAccount[c.account_id] = c.call_date
        }
      }
    }
  }

  // Stale: active accounts with no call in 14+ days
  const staleAccounts = activeAccounts
    .filter(a => {
      const last = lastCallByAccount[a.id]
      if (!last) return true
      return new Date(last) < new Date(twoWeeksAgo)
    })
    .slice(0, 5)

  // Partition tasks
  const overdueTasks = allTasks.filter(t => t.due_date && t.due_date < today)
  const dueTodayTasks = allTasks.filter(t => t.due_date === today)
  const highPriority = allTasks.filter(t => t.priority === 1).slice(0, 5)

  const taskSummary = [
    ...overdueTasks.slice(0, 3).map(t => `[OVERDUE] ${t.title}${t.rationale ? ` — ${t.rationale.slice(0, 80)}` : ''}`),
    ...dueTodayTasks.slice(0, 5).map(t => `[DUE TODAY] ${t.title}`),
    ...highPriority
      .filter(t => !overdueTasks.includes(t) && !dueTodayTasks.includes(t))
      .slice(0, 3)
      .map(t => `[HIGH] ${t.title}`),
  ].join('\n')

  const callSummary = recentCalls.slice(0, 3).map(c => {
    const a = c.analysis || {}
    const acct = accountMap[c.account_id]?.name || null
    const nextSteps = (a.next_steps_mentioned || []).slice(0, 2).join('; ')
    const commitments = (a.commitments || []).slice(0, 2).join('; ')
    return [
      acct ? `${acct} — "${c.title}"` : c.title,
      `(${c.call_date?.split('T')[0]})`,
      a.summary?.slice(0, 120) || 'No summary',
      nextSteps ? `Open next steps: ${nextSteps}` : null,
      commitments ? `Your commitments: ${commitments}` : null,
    ].filter(Boolean).join(' | ')
  }).join('\n')

  const staleSummary = staleAccounts
    .map(a => `${a.name} (${a.stage?.replace(/_/g, ' ')}) — last call: ${lastCallByAccount[a.id]?.split('T')[0] || 'never'}`)
    .join('\n')

  const lateStageDeals = activeAccounts
    .filter(a => ['demo', 'solution_validation', 'proposal', 'legal'].includes(a.stage))
    .slice(0, 5)
    .map(a => `${a.name} — ${a.stage?.replace(/_/g, ' ')}`)
    .join('\n')

  const prompt = `You are a sales AI assistant. Generate a specific, data-driven morning brief. Use the REAL account and deal names below — never give generic advice.

OPEN TASKS (${allTasks.length} total — ${overdueTasks.length} overdue, ${dueTodayTasks.length} due today):
${taskSummary || 'No urgent tasks.'}

RECENT GONG CALLS (last 7 days):
${callSummary || 'No recent calls analyzed.'}

LATE-STAGE ACTIVE DEALS (demo/proposal/legal):
${lateStageDeals || 'None currently.'}

STALE ACCOUNTS (no call in 14+ days):
${staleSummary || 'All accounts have recent activity.'}

Today's date: ${new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}

Keep it tight — this is a quick morning read, not a report. Three things only: what to do first, a couple of deals to watch, one observation.

Rules:
- "deals_to_watch" must name specific accounts with specific reasons (not generic advice); at most 2
- "insight" must be grounded in a specific call or account from the data above
- If no relevant data exists for a field, return an empty array/null

Return ONLY valid JSON:
{
  "headline": "One punchy sentence naming specific accounts or task counts (e.g. 'Coastal Ridge needs a call and you have 2 overdue commitments')",
  "top_priority": "The single most important thing to do first today with specific account name (1-2 sentences)",
  "deals_to_watch": ["Account name — specific reason why it needs attention today", "..."],
  "insight": "One specific coaching observation from the recent call data, naming the account (1 sentence)",
  "task_count": { "overdue": ${overdueTasks.length}, "today": ${dueTodayTasks.length}, "total": ${allTasks.length} }
}`

  try {
    const raw = await callAnthropic(apiKey, {
      model: 'claude-haiku-4-5-20251001',
      maxTokens: 600,
      messages: [{ role: 'user', content: prompt }],
    })

    const brief = parseClaudeJson(raw, {
      headline: `You have ${allTasks.length} open tasks${overdueTasks.length ? `, including ${overdueTasks.length} overdue` : ''}.`,
      top_priority: overdueTasks[0]?.title || dueTodayTasks[0]?.title || highPriority[0]?.title || 'Review your task list.',
      deals_to_watch: staleAccounts.slice(0, 2).map(a => `${a.name} — no call in 14+ days`),
      insight: null,
      task_count: { overdue: overdueTasks.length, today: dueTodayTasks.length, total: allTasks.length },
    })

    return res.status(200).json({ success: true, brief, generatedAt: new Date().toISOString() })
  } catch (e) {
    console.error('[morning-brief] Error:', e.message)
    return res.status(500).json({ error: e.message })
  }
}
