// GET /api/cron/reengagement-picks
// Nightly cron: scores cold accounts (30+ days no Gong call), picks top 5,
// generates personalized re-opening hooks, sends Slack DM to James.
// Protected by CRON_SECRET.

import { getSupabase } from '../../../lib/supabase'
import { sendSlackMessage } from '../../../lib/slack'

const DASHBOARD_URL = 'https://sales-dashboard-james-projects-87ec0089.vercel.app'

const STAGE_WEIGHT = {
  legal: 50,
  proposal: 45,
  solution_validation: 40,
  demo: 35,
  active_pursuit: 20,
  intro_scheduled: 10,
  qualifying: 5,
}

const COLD_STAGES = [
  'qualifying', 'intro_scheduled', 'active_pursuit',
  'demo', 'solution_validation', 'proposal', 'legal',
]

function daysSince(dateStr) {
  if (!dateStr) return null
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24))
}

function scoreForReengagement(lastAnalysis, daysSinceContact, accountStage) {
  let score = 0
  const a = lastAnalysis?.analysis || {}

  // ICP fit — primary signal
  const icpScore = a.icp_score
  if (icpScore >= 8) score += 80
  else if (icpScore >= 6) score += 50
  else if (icpScore >= 4) score += 20
  else if (icpScore) score += 0

  // Stage reached
  score += STAGE_WEIGHT[accountStage] || 0

  // Sentiment on last call
  if (a.sentiment === 'positive') score += 25
  else if (a.sentiment === 'neutral') score += 5
  else if (a.sentiment === 'negative') score -= 15

  // Buying signals
  const buys = (a.buying_signals || []).length
  score += Math.min(buys * 12, 36)

  // Champion health
  const champ = a.champion_health_score
  if (champ >= 7) score += 20
  else if (champ >= 5) score += 10

  // Discovery score (the more they shared, the warmer the relationship)
  const disc = a.discovery_score
  if (disc >= 7) score += 15
  else if (disc >= 5) score += 8

  // Days since last contact — sweet spot is 30-120 days
  if (daysSinceContact === null) score -= 20 // no data
  else if (daysSinceContact < 30) return -1 // not cold yet, exclude
  else if (daysSinceContact <= 60) score += 30
  else if (daysSinceContact <= 120) score += 20
  else if (daysSinceContact <= 180) score += 5
  else score -= 20 // too long ago

  return score
}

async function generateReengagementHook(account, lastAnalysis) {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return null

  const a = lastAnalysis?.analysis || {}
  const daysSinceCall = daysSince(lastAnalysis?.call_date || null)

  const lines = [
    `Account: ${account.name}`,
    `Stage when last touched: ${(account.stage || '').replace(/_/g, ' ')}`,
    daysSinceCall != null ? `Days since last call: ${daysSinceCall}` : 'Days since last call: unknown',
    a.summary ? `Last call summary: ${String(a.summary).slice(0, 250)}` : null,
    (a.buying_signals || []).length ? `Buying signals from last call: ${a.buying_signals.slice(0, 2).join('; ')}` : null,
    (a.next_steps_mentioned || []).length ? `Next steps mentioned: ${a.next_steps_mentioned.slice(0, 2).join('; ')}` : null,
    a.icp_rationale ? `ICP fit: ${a.icp_rationale}` : null,
  ].filter(Boolean)

  const prompt = `You are helping a B2B sales rep (James at Banner, CapEx management software for commercial real estate) re-open a conversation with a prospect that went cold.

${lines.join('\n')}

Generate a short, specific re-opening hook. Reference something real from the last conversation. Do NOT use generic templates.

Return JSON only:
{
  "why_now": "1 sentence — what makes this account worth engaging today (tie to recent CRE trends or their prior interest)",
  "opening_line": "First sentence of a cold email or call opener. Specific, not generic. Max 30 words.",
  "subject": "Email subject line — max 8 words, no clickbait"
}`

  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 300,
        messages: [{ role: 'user', content: prompt }],
      }),
    })
    const data = await r.json()
    const raw = data.content?.[0]?.text || ''
    const match = raw.match(/\{[\s\S]*\}/)
    return match ? JSON.parse(match[0]) : null
  } catch (e) {
    console.error(`[reengagement-picks] Claude error for ${account.name}:`, e.message)
    return null
  }
}

function buildReengagementBlocks(picks) {
  const dateStr = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })

  const blocks = [
    {
      type: 'header',
      text: { type: 'plain_text', text: `Reengagement Picks — ${dateStr}`, emoji: true },
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `${picks.length} account${picks.length !== 1 ? 's' : ''} worth reaching out to today. These went cold but have real signal.`,
      },
    },
    { type: 'divider' },
  ]

  for (const { account, lastAnalysis, daysSinceContact, hook } of picks) {
    const a = lastAnalysis?.analysis || {}
    const stage = (account.stage || '').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
    const icp = a.icp_score ? `ICP ${a.icp_score}/10` : null
    const meta = [
      stage,
      icp,
      daysSinceContact != null ? `${daysSinceContact}d silent` : null,
    ].filter(Boolean).join(' · ')

    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: [
          `*${account.name}*  _${meta}_`,
          hook?.why_now ? hook.why_now : null,
        ].filter(Boolean).join('\n'),
      },
    })

    if (hook?.subject && hook?.opening_line) {
      blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*${hook.subject}*\n${hook.opening_line}`,
        },
      })
    }

    blocks.push({ type: 'divider' })
  }

  blocks.push({
    type: 'context',
    elements: [{
      type: 'mrkdwn',
      text: `<${DASHBOARD_URL}/modules/account-pipeline|Open Pipeline →>`,
    }],
  })

  return { blocks }
}

export default async function handler(req, res) {
  if (!['GET', 'POST'].includes(req.method)) return res.status(405).end()

  const secret = process.env.CRON_SECRET
  if (secret && req.headers['authorization'] !== `Bearer ${secret}`) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const db = getSupabase()

  // Fetch all active accounts (not closed)
  const { data: accounts, error: accErr } = await db
    .from('accounts')
    .select('id, name, stage, owner_name')
    .in('stage', COLD_STAGES)

  if (accErr || !accounts?.length) {
    return res.status(200).json({ sent: 0, message: 'No active accounts' })
  }

  const accountIds = accounts.map(a => a.id)

  // Get the most recent analyzed call per account (need call_date for recency)
  const { data: analyses } = await db
    .from('gong_call_analyses')
    .select('account_id, analysis, call_date, analyzed_at')
    .in('account_id', accountIds)
    .not('analysis', 'is', null)
    .order('call_date', { ascending: false })

  // Group to latest call per account
  const latestByAccount = {}
  for (const row of (analyses || [])) {
    if (!latestByAccount[row.account_id]) {
      latestByAccount[row.account_id] = row
    }
  }

  // Score each account
  const scored = accounts
    .filter(a => latestByAccount[a.id]) // must have at least one call
    .map(account => {
      const lastAnalysis = latestByAccount[account.id]
      const daysSinceContact = daysSince(lastAnalysis.call_date)
      const score = scoreForReengagement(lastAnalysis, daysSinceContact, account.stage)
      return { account, lastAnalysis, daysSinceContact, score }
    })
    .filter(item => item.score > 0) // excludes <30 days (score = -1) and very low fit
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)

  if (!scored.length) {
    return res.status(200).json({ sent: 0, message: 'No reengagement candidates today' })
  }

  // Generate hooks in parallel
  const picks = await Promise.all(
    scored.map(async item => {
      const hook = await generateReengagementHook(item.account, item.lastAnalysis)
      return { ...item, hook }
    })
  )

  const payload = buildReengagementBlocks(picks)
  const channel = process.env.SLACK_MANAGER_CHANNEL
  const result = await sendSlackMessage(payload, channel)

  console.log(`[reengagement-picks] ${picks.length} picks, Slack: ${result.ok ? 'ok' : result.error}`)

  return res.status(200).json({
    sent: result.ok ? picks.length : 0,
    picks: picks.map(p => ({ name: p.account.name, score: p.score, days: p.daysSinceContact })),
    slackOk: result.ok,
  })
}
