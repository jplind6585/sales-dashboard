/**
 * Slack integration — sends messages via Bot Token (chat.postMessage).
 *
 * Setup:
 * 1. Go to api.slack.com/apps → Create New App → From scratch
 * 2. Add Bot Token Scopes: chat:write, chat:write.public
 * 3. Install to workspace → copy "Bot User OAuth Token" (xoxb-...)
 * 4. Add to Vercel env vars:
 *    SLACK_BOT_TOKEN       — xoxb-... bot token
 *    SLACK_DEFAULT_CHANNEL — #sales-team (fallback channel)
 *    SLACK_MANAGER_CHANNEL — #sales-leadership (manager digest)
 *
 * Per-account routing:
 * - Each account can store a slack_channel field (e.g. "#udr-inc")
 * - If not set, the channel is derived from the account name: "UDR Inc" → "#udr-inc"
 * - Falls back to SLACK_DEFAULT_CHANNEL
 */

const BOT_TOKEN = process.env.SLACK_BOT_TOKEN

/**
 * Derive a Slack channel name from an account name.
 * "UDR Inc" → "pursuit_udr", "American Healthcare REIT" → "pursuit_americanhealthcarereit"
 */
export function deriveChannelName(accountName) {
  if (!accountName) return null
  const slug = accountName
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '') // strip punctuation
    .trim()
    .replace(/\s+/g, '')          // remove all spaces
    .slice(0, 74)                  // leave room for "pursuit_" prefix (80 char limit)
  return slug ? `pursuit_${slug}` : null
}

/**
 * Resolve the best Slack channel for an account.
 * Priority: explicit slack_channel → derived from name → SLACK_DEFAULT_CHANNEL
 */
export function resolveAccountChannel(account) {
  if (!account) return process.env.SLACK_DEFAULT_CHANNEL || null
  const explicit = account.slackChannel || account.slack_channel
  if (explicit) return explicit
  const derived = deriveChannelName(account.name)
  return derived ? `#${derived}` : (process.env.SLACK_DEFAULT_CHANNEL || null)
}

/**
 * Send a Slack message via chat.postMessage.
 * @param {Object} payload - Slack Block Kit payload (blocks, text, etc.)
 * @param {string} channel - Channel name ("#udr-inc") or ID ("C1234567")
 * @returns {Promise<{ok: boolean, error?: string}>}
 */
export async function sendSlackMessage(payload, channel) {
  if (!BOT_TOKEN) {
    console.warn('SLACK_BOT_TOKEN not set — skipping Slack message')
    return { ok: false, error: 'SLACK_BOT_TOKEN not configured' }
  }

  const targetChannel = channel || process.env.SLACK_DEFAULT_CHANNEL
  if (!targetChannel) {
    console.warn('No Slack channel specified and SLACK_DEFAULT_CHANNEL not set')
    return { ok: false, error: 'No channel configured' }
  }

  try {
    const res = await fetch('https://slack.com/api/chat.postMessage', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${BOT_TOKEN}`,
      },
      body: JSON.stringify({ ...payload, channel: targetChannel }),
    })

    const data = await res.json()
    if (!data.ok) {
      console.error(`Slack API error [${targetChannel}]:`, data.error)
      return { ok: false, error: data.error }
    }

    return { ok: true }
  } catch (err) {
    console.error('Slack send failed:', err)
    return { ok: false, error: err.message }
  }
}

/**
 * Build a rep digest message (Block Kit format).
 *
 * @param {Object} params
 * @param {string} params.name          - Rep's display name
 * @param {Array}  params.openTasks     - All open tasks for this rep
 * @param {Array}  params.overdueTasks  - Overdue tasks
 * @param {Object|null} params.flaggedAccount - Account needing attention
 * @returns {Object} Slack Block Kit payload (no channel — pass separately to sendSlackMessage)
 */
export function buildRepDigest({ name, openTasks, overdueTasks, flaggedAccount }) {
  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
  const top5 = openTasks.slice(0, 5)

  const blocks = [
    {
      type: 'header',
      text: { type: 'plain_text', text: `📋 Your day — ${today}`, emoji: true },
    },
    {
      type: 'section',
      text: { type: 'mrkdwn', text: `Hey *${name}* — here's your task queue for today.` },
    },
    { type: 'divider' },
  ]

  if (overdueTasks.length > 0) {
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `🔴 *${overdueTasks.length} overdue task${overdueTasks.length > 1 ? 's' : ''}*\n${
          overdueTasks.slice(0, 3).map(t => `• ${t.title}${t.accounts ? ` _(${t.accounts.name})_` : ''}`).join('\n')
        }${overdueTasks.length > 3 ? `\n_...and ${overdueTasks.length - 3} more_` : ''}`,
      },
    })
    blocks.push({ type: 'divider' })
  }

  if (top5.length === 0) {
    blocks.push({
      type: 'section',
      text: { type: 'mrkdwn', text: '✅ No open tasks. Use the time to get ahead.' },
    })
  } else {
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*Top tasks*\n${top5.map(t => {
          const priority = t.priority === 1 ? '🔴' : t.priority === 2 ? '🟡' : '⚪'
          const account = t.accounts ? ` _(${t.accounts.name})_` : ''
          const due = t.due_date ? ` — due ${new Date(t.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}` : ''
          return `${priority} ${t.title}${account}${due}`
        }).join('\n')}`,
      },
    })
  }

  if (flaggedAccount) {
    blocks.push({ type: 'divider' })
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `⚠️ *Account needing attention*\n*${flaggedAccount.name}* — ${flaggedAccount.reason}`,
      },
    })
  }

  blocks.push({ type: 'divider' })
  blocks.push({
    type: 'context',
    elements: [{
      type: 'mrkdwn',
      text: `Open tasks: *${openTasks.length}* | Overdue: *${overdueTasks.length}* | <https://sales-dashboard-james-projects-87ec0089.vercel.app/modules/tasks|Open Tasks →>`,
    }],
  })

  return { blocks }
}

/**
 * Build a manager digest message showing the full team summary.
 * @param {Array} repSummaries - Array of { name, open, overdue, completedThisWeek }
 * @returns {Object} Slack Block Kit payload
 */
export function buildManagerDigest(repSummaries) {
  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
  const totalOpen = repSummaries.reduce((s, r) => s + r.open, 0)
  const totalOverdue = repSummaries.reduce((s, r) => s + r.overdue, 0)
  const totalDone = repSummaries.reduce((s, r) => s + r.completedThisWeek, 0)

  const blocks = [
    {
      type: 'header',
      text: { type: 'plain_text', text: `📊 Team digest — ${today}`, emoji: true },
    },
    {
      type: 'section',
      fields: [
        { type: 'mrkdwn', text: `*Open tasks*\n${totalOpen}` },
        { type: 'mrkdwn', text: `*Overdue*\n${totalOverdue > 0 ? `🔴 ${totalOverdue}` : '✅ 0'}` },
        { type: 'mrkdwn', text: `*Done this week*\n${totalDone}` },
      ],
    },
    { type: 'divider' },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*Team breakdown*\n${repSummaries.map(r => {
          const overdueFlag = r.overdue > 0 ? ` 🔴 ${r.overdue} overdue` : ''
          return `• *${r.name}* — ${r.open} open, ${r.completedThisWeek} done this wk${overdueFlag}`
        }).join('\n')}`,
      },
    },
    { type: 'divider' },
    {
      type: 'context',
      elements: [{
        type: 'mrkdwn',
        text: `<https://sales-dashboard-james-projects-87ec0089.vercel.app/modules/tasks|View team tasks →>`,
      }],
    },
  ]

  return { blocks }
}

/**
 * Build a stage-change notification for an account channel.
 * @param {Object} params
 * @param {string} params.accountName
 * @param {string} params.fromStage
 * @param {string} params.toStage
 * @param {string} params.repName
 * @returns {Object} Slack Block Kit payload
 */
export function buildStageChangeNotification({ accountName, fromStage, toStage, repName }) {
  const stageEmoji = {
    qualifying: '🔍',
    discovery: '🗣️',
    demo: '💻',
    solution_validation: '✅',
    proposal: '📄',
    negotiation: '🤝',
    closed_won: '🎉',
    closed_lost: '❌',
  }

  const fromEmoji = stageEmoji[fromStage] || '📍'
  const toEmoji = stageEmoji[toStage] || '📍'
  const formatStage = s => s?.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) || s

  return {
    blocks: [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `${toStage === 'closed_won' ? '🎉' : '📈'} *${accountName}* moved stages\n${fromEmoji} ${formatStage(fromStage)} → ${toEmoji} *${formatStage(toStage)}*`,
        },
      },
      {
        type: 'context',
        elements: [{ type: 'mrkdwn', text: `Updated by ${repName} • <https://sales-dashboard-james-projects-87ec0089.vercel.app/modules/account-pipeline|View Pipeline →>` }],
      },
    ],
  }
}
