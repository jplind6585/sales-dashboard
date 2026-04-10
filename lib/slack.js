/**
 * Slack integration — sends messages via Incoming Webhook.
 *
 * Setup:
 * 1. Go to api.slack.com/apps → Create New App → From scratch
 * 2. Add "Incoming Webhooks" feature → activate → Add New Webhook to Workspace
 * 3. Pick your #sales-team channel (or whatever you want digests posted to)
 * 4. Copy the webhook URL → add to Vercel env vars as SLACK_WEBHOOK_URL
 */

const WEBHOOK_URL = process.env.SLACK_WEBHOOK_URL

/**
 * Send a message to Slack via webhook.
 * @param {Object} payload - Slack Block Kit message payload
 * @returns {Promise<{ok: boolean, error?: string}>}
 */
export async function sendSlackMessage(payload) {
  if (!WEBHOOK_URL) {
    console.warn('SLACK_WEBHOOK_URL not set — skipping Slack message')
    return { ok: false, error: 'SLACK_WEBHOOK_URL not configured' }
  }

  try {
    const res = await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    if (!res.ok) {
      const text = await res.text()
      console.error('Slack webhook error:', text)
      return { ok: false, error: text }
    }

    return { ok: true }
  } catch (err) {
    console.error('Slack send failed:', err)
    return { ok: false, error: err.message }
  }
}

/**
 * Build a rep digest message (Block Kit format).
 * Shows their top tasks for the day, overdue items, and one flagged account.
 *
 * @param {Object} params
 * @param {string} params.name - Rep's display name
 * @param {Array}  params.openTasks - All open tasks for this rep
 * @param {Array}  params.overdueTasks - Overdue tasks
 * @param {Object|null} params.flaggedAccount - Account needing attention (or null)
 * @returns {Object} Slack Block Kit payload
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

  // Overdue callout
  if (overdueTasks.length > 0) {
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `🔴 *${overdueTasks.length} overdue task${overdueTasks.length > 1 ? 's' : ''}*\n${
          overdueTasks.slice(0, 3).map(t => `• ${t.title}${t.account ? ` _(${t.account.name})_` : ''}`).join('\n')
        }${overdueTasks.length > 3 ? `\n_...and ${overdueTasks.length - 3} more_` : ''}`,
      },
    })
    blocks.push({ type: 'divider' })
  }

  // Top tasks
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
        text: `*Top tasks*\n${top5.map((t, i) => {
          const priority = t.priority === 1 ? '🔴' : t.priority === 2 ? '🟡' : '⚪'
          const account = t.account ? ` _(${t.account.name})_` : ''
          const due = t.dueDate ? ` — due ${new Date(t.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}` : ''
          return `${priority} ${t.title}${account}${due}`
        }).join('\n')}`,
      },
    })
  }

  // Flagged account
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
