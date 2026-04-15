import { sendSlackMessage, buildStageChangeNotification, resolveAccountChannel } from '../../../lib/slack'

/**
 * POST /api/slack/notify
 *
 * Generic Slack notification endpoint. Called by the frontend when events happen
 * (stage changes, task completions) so they get routed to the right account channel.
 *
 * Body: {
 *   event: 'stage_change' | 'task_complete'
 *   accountName: string
 *   slackChannel?: string   — explicit channel override from account record
 *   repName?: string
 *   fromStage?: string      — for stage_change
 *   toStage?: string        — for stage_change
 *   taskTitle?: string      — for task_complete
 * }
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { event, accountName, slackChannel, repName, fromStage, toStage, taskTitle } = req.body

  if (!event || !accountName) {
    return res.status(400).json({ error: 'event and accountName are required' })
  }

  // Resolve channel: explicit override → derive from account name → default
  const channel = slackChannel || resolveAccountChannel({ name: accountName })

  let payload

  if (event === 'stage_change' && fromStage && toStage) {
    payload = buildStageChangeNotification({
      accountName,
      fromStage,
      toStage,
      repName: repName || 'a rep',
    })
  } else if (event === 'task_complete' && taskTitle) {
    payload = {
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `✅ *Task completed* — ${taskTitle}\n_${accountName}${repName ? ` · ${repName}` : ''}_`,
          },
        },
      ],
    }
  } else {
    return res.status(400).json({ error: 'Unknown event or missing required fields' })
  }

  const { ok, error } = await sendSlackMessage(payload, channel)
  return res.status(200).json({ ok, error, channel })
}
