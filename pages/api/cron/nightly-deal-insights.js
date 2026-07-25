// Nightly cron: generates AI deal insights per rep and writes to daily_insights.
// Runs at 3:30am UTC via vercel.json.
// Auth: CRON_SECRET Bearer token.

import { getSupabase } from '../../../lib/supabase'
import { callAnthropic, parseClaudeJson } from '../../../lib/apiUtils'
import { sendSlackMessage } from '../../../lib/slack'

const STAGE_EXPECTED = {
  qualifying: 21,
  intro_scheduled: 14,
  active_pursuit: 28,
  demo: 14,
  solution_validation: 21,
  proposal: 21,
  legal: 28,
}

const LATE_STAGES = new Set(['legal', 'proposal', 'solution_validation'])

function daysBetween(dateStr) {
  if (!dateStr) return null
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24))
}

export default async function handler(req, res) {
  const authHeader = req.headers.authorization || ''
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return res.status(500).json({ error: 'ANTHROPIC_API_KEY not configured' })

  const db = getSupabase()
  const today = new Date().toISOString().slice(0, 10)
  const errors = []

  // 1. Fetch all active accounts
  const { data: accounts, error: acctErr } = await db
    .from('accounts')
    .select('id, name, stage, owner_name, updated_at, risk_score, risk_factors')
    // inactive_* are dead deals (CEO rule 2026-07-24) — exclude from risk insights + "Deal at Risk"
    // manager alerts so we don't generate noise/AI spend on accounts we've already written off.
    .not('stage', 'in', '(closed_won,closed_lost,inactive_sdr_follow_up,inactive_ae_follow_up)')
    .neq('tier', 'archived')
    .limit(200)

  if (acctErr || !accounts?.length) {
    return res.status(500).json({ error: acctErr?.message || 'No accounts found' })
  }

  const accountIds = accounts.map(a => a.id)

  // 2. Most recent call per account
  const { data: recentCalls } = await db
    .from('gong_call_analyses')
    .select('account_id, call_date')
    .in('account_id', accountIds)
    .order('call_date', { ascending: false })

  const lastCallMap = {}
  for (const c of recentCalls || []) {
    if (!lastCallMap[c.account_id]) lastCallMap[c.account_id] = c.call_date
  }

  // 3. Open task counts per account
  const { data: taskRows } = await db
    .from('tasks')
    .select('account_id, id')
    .neq('status', 'complete')
    .is('dismissed_at', null)
    .in('account_id', accountIds)

  const taskCountMap = {}
  for (const t of taskRows || []) {
    taskCountMap[t.account_id] = (taskCountMap[t.account_id] || 0) + 1
  }

  // 4. Score each account
  const scored = accounts.map(acct => {
    const daysSinceCall = lastCallMap[acct.id] ? daysBetween(lastCallMap[acct.id]) : 60
    const daysInStage = acct.updated_at ? daysBetween(acct.updated_at) : 30
    const taskCount = taskCountMap[acct.id] || 0
    const riskScore = acct.risk_score || 0
    const expectedDays = STAGE_EXPECTED[acct.stage] || 21

    let score = 0
    if (LATE_STAGES.has(acct.stage) && daysSinceCall > 14) score += 50
    else if (daysSinceCall > 30) score += 40
    else if (daysSinceCall > 14) score += 20
    if (riskScore >= 60) score += 30
    if (taskCount === 0) score += 20
    if (daysInStage > expectedDays) score += 10

    const riskFactors = Array.isArray(acct.risk_factors)
      ? acct.risk_factors
      : typeof acct.risk_factors === 'string'
      ? [acct.risk_factors]
      : []

    return { ...acct, score, daysSinceCall, daysInStage, taskCount, riskFactors }
  })

  // 5. Group by owner_name, top 5 per owner
  const byOwner = {}
  for (const acct of scored) {
    const owner = acct.owner_name || 'Unknown'
    if (!byOwner[owner]) byOwner[owner] = []
    byOwner[owner].push(acct)
  }
  for (const owner of Object.keys(byOwner)) {
    byOwner[owner].sort((a, b) => b.score - a.score)
    byOwner[owner] = byOwner[owner].slice(0, 5)
  }

  // 6. Fetch all profiles for owner→user_id lookup
  const { data: profiles } = await db
    .from('profiles')
    .select('id, full_name, email')

  let insightsGenerated = 0
  let repsProcessed = 0
  const slackAlerts = []

  for (const [ownerName, ownerAccounts] of Object.entries(byOwner)) {
    repsProcessed++

    const accountLines = ownerAccounts.map(a =>
      `- ${a.name} | Stage: ${a.stage} | Days since last call: ${a.daysSinceCall} | Risk factors: ${a.riskFactors.slice(0, 3).join(', ') || 'none'} | Open tasks: ${a.taskCount}`
    ).join('\n')

    const prompt = `You are a sales intelligence system generating daily deal insights for a rep.

Rep: ${ownerName}
Accounts needing attention:
${accountLines}

Generate insights for the top 3 most urgent accounts. Return a JSON array:
[{
  "account_name": "...",
  "account_id": "uuid",
  "headline": "max 15 words",
  "insight": "2-3 sentences: what's happening and why it matters now",
  "recommended_action": "Specific action sentence",
  "urgency": "high|medium",
  "type": "gone_cold|stalled|overdue_next_step|late_stage_risk"
}]
Return only valid JSON array.`

    let insights = []
    try {
      const raw = await callAnthropic(apiKey, {
        model: 'claude-haiku-4-5-20251001',
        maxTokens: 800,
        messages: [{ role: 'user', content: prompt }],
      })
      const parsed = parseClaudeJson(raw, [])
      insights = Array.isArray(parsed) ? parsed : []

      // Backfill account_id if Claude omitted it (match by name)
      for (const insight of insights) {
        if (!insight.account_id) {
          const match = ownerAccounts.find(a =>
            a.name.toLowerCase().includes((insight.account_name || '').toLowerCase()) ||
            (insight.account_name || '').toLowerCase().includes(a.name.toLowerCase())
          )
          if (match) insight.account_id = match.id
        }
      }
    } catch (err) {
      errors.push(`${ownerName}: ${err.message}`)
      continue
    }

    if (!insights.length) continue
    insightsGenerated += insights.length

    // 7. Look up rep user_id
    const repProfile = profiles?.find(p => {
      const n = (p.full_name || '').toLowerCase()
      const o = ownerName.toLowerCase()
      return n === o || n.includes(o) || o.includes(n)
    })
    const repUserId = repProfile?.id || null

    // 8. Upsert into daily_insights
    try {
      await db.from('daily_insights').upsert({
        user_id: repUserId,
        insight_date: today,
        insight: insights[0]?.headline || 'See insights array',
        account_name: insights[0]?.account_name || null,
        account_id: insights[0]?.account_id || null,
        action_recommendation: insights[0]?.recommended_action || null,
        insights_array: insights,
      }, { onConflict: 'user_id,insight_date' })
    } catch (err) {
      errors.push(`upsert ${ownerName}: ${err.message}`)
    }

    // 9. Slack alerts for late-stage cold deals
    for (const acct of ownerAccounts) {
      if (LATE_STAGES.has(acct.stage) && acct.daysSinceCall > 14 && acct.score > 60) {
        const topInsight = insights.find(i =>
          (i.account_name || '').toLowerCase().includes(acct.name.toLowerCase()) ||
          acct.name.toLowerCase().includes((i.account_name || '').toLowerCase())
        )
        slackAlerts.push({
          text: `*Deal at Risk:* ${acct.name} — ${acct.stage} — ${acct.daysSinceCall} days cold\n${topInsight?.headline || acct.riskFactors[0] || 'No recent activity'}`,
        })
      }
    }
  }

  // Send Slack alerts
  for (const alert of slackAlerts) {
    try {
      await sendSlackMessage(alert, process.env.SLACK_MANAGER_CHANNEL)
    } catch (err) {
      errors.push(`slack: ${err.message}`)
    }
  }

  return res.status(200).json({
    processed: accounts.length,
    insightsGenerated,
    repsProcessed,
    errors,
  })
}
