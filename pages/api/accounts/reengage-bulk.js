import { getSupabase } from '../../../lib/supabase'
import { apiError, apiSuccess, callAnthropic, parseClaudeJson, validateAnthropicKey } from '../../../lib/apiUtils'

async function buildAccountPlan({ account, db, apiKey }) {
  const { data: callAnalyses } = await db
    .from('gong_call_analyses')
    .select('analysis, call_date, title')
    .eq('account_id', account.id)
    .not('analysis', 'is', null)
    .order('call_date', { ascending: false })
    .limit(3)

  const { data: accountDetails } = await db
    .from('accounts')
    .select('name, vertical, ownership_type, stage')
    .eq('id', account.id)
    .single()

  const vertical = accountDetails?.vertical || null
  const ownershipType = accountDetails?.ownership_type || null

  const refQuery = db
    .from('accounts')
    .select('name, vertical, ownership_type, stage')
    .neq('id', account.id)
    .not('stage', 'in', '("inactive_sdr_follow_up","inactive_ae_follow_up","closed_won","closed_lost","won","lost")')
    .limit(3)

  if (vertical || ownershipType) {
    refQuery.or(
      [
        vertical ? `vertical.eq.${vertical}` : null,
        ownershipType ? `ownership_type.eq.${ownershipType}` : null,
      ]
        .filter(Boolean)
        .join(',')
    )
  }

  const { data: referenceAccounts } = await refQuery

  const calls = callAnalyses || []
  const refs = referenceAccounts || []

  let daysSinceLastCall = 'Unknown'
  if (calls.length > 0 && calls[0].call_date) {
    const lastDate = new Date(calls[0].call_date)
    const now = new Date()
    daysSinceLastCall = Math.floor((now - lastDate) / (1000 * 60 * 60 * 24))
  }

  const stakeholders = account.stakeholders || []

  const callHistoryText = calls.length > 0
    ? calls.map(c => `[${c.call_date?.split('T')[0] || 'Unknown date'}] ${c.title || 'Untitled call'}
Summary: ${c.analysis?.summary || 'No summary'}
Pain points: ${(c.analysis?.pain_points_identified || []).join(', ') || 'None identified'}
Objections: ${(c.analysis?.objections || []).map(o => typeof o === 'string' ? o : o.text).join(', ') || 'None'}
Red flags: ${(c.analysis?.red_flags || []).join(', ') || 'None'}
Champion health: ${c.analysis?.champion_health_score || 'N/A'}/10`).join('\n\n')
    : 'No call history available'

  const stakeholdersText = stakeholders.length > 0
    ? stakeholders.map(s => `- ${s.name} (${s.title || 'No title'}) — Role: ${(s.role || 'unknown').toUpperCase()}`).join('\n')
    : 'No stakeholders on record'

  const referenceText = refs.length > 0
    ? refs.map(r => `- ${r.name} (${r.vertical || ''} / ${r.ownership_type || ''})`).join('\n')
    : 'None found'

  const infoRoomText = account.dockUrl
    ? `URL available: ${account.dockUrl}`
    : 'No URL — generate build brief'

  const prompt = `You are building a personalized reengagement campaign plan for a sales rep at Banner, a CapEx management software company for commercial real estate.

ACCOUNT: ${account.name}
VERTICAL: ${accountDetails?.vertical || 'Unknown'}
OWNERSHIP TYPE: ${accountDetails?.ownership_type || 'Unknown'}
DAYS SINCE LAST CONTACT: ${daysSinceLastCall}

STAKEHOLDERS AND ROLES:
${stakeholdersText}

CALL HISTORY (last 3 calls):
${callHistoryText}

REFERENCE ACCOUNTS (similar companies you've worked with):
${referenceText}

INFORMATION ROOM: ${infoRoomText}

REENGAGEMENT FRAMEWORK:
Based on Jeb Blount's Fanatical Prospecting pattern-interrupt method, Challenger Sale multi-threaded re-entry, and Gong research showing multi-channel + specific pain reference + social proof = 3x response rate.

STAGED APPROACH:
- Stage 1 (Days 1-3): Re-engage CHAMPION and PROMOTERS first — intel gathering, confirm pain is live, low-ask outreach referencing specific prior conversation
- Stage 2 (Days 4-7): Approach EXEC SPONSOR with insight from Stage 1 — peer-level, outcome-focused, one question, no pitch
- Stage 3 (Days 8-14): Full multi-channel push — call track for champion, Information Room to exec sponsor, reference accounts
- Stage 4 (Day 14+): Decision or breakup — loss framing via most responsive contact
- DETRACTORS: Never contacted directly. Neutralize via champion/exec sponsor.

Return ONLY valid JSON with this exact structure:
{
  "approach_rationale": "2-3 sentences on why this account went cold and the best re-entry angle based on what we know",
  "stakeholder_plan": {
    "champion": {
      "name": "name or null",
      "stage1_message": "specific LinkedIn DM or email — reference a specific thing they said in a prior call",
      "stage3_call_track": "opening line, talk track referencing their specific pain, objection responses"
    },
    "exec_sponsor": {
      "name": "name or null",
      "stage2_email": "subject line + short email body — outcome-focused, peer-level, one question",
      "stage2_call": "30-second opening, one question to ask"
    },
    "promoters": [
      { "name": "name", "outreach": "specific message for this person" }
    ],
    "detractors": [
      { "name": "name", "strategy": "how to neutralize through champion/exec sponsor" }
    ]
  },
  "stage3_push": {
    "call_track": "full talk track for Stage 3 champion call — reference their actual objections and what changed",
    "information_room_email": "full email body referencing the Information Room — ${account.dockUrl ? 'include the URL' : 'include specific instructions on what to build: sections, content, reference accounts to cite'}",
    "reference_accounts_to_cite": ["account name and why similar"]
  },
  "stage4_breakup": {
    "contact": "name — most responsive contact",
    "email": "full breakup email — loss framing, easy CTA, reference their stated timeline or pain"
  },
  "tasks": [
    {
      "title": "Stage 1: Reengage ${account.name} — Contact Champion/Promoters",
      "description": "full instructions including specific messages to use",
      "due_offset_days": 1,
      "priority": 1
    },
    {
      "title": "Stage 2: ${account.name} — Executive Entry",
      "description": "full instructions including exact email and call opening",
      "due_offset_days": 4,
      "priority": 1
    },
    {
      "title": "Stage 3: ${account.name} — Multi-Channel Push",
      "description": "full call track + information room instructions + reference accounts",
      "due_offset_days": 8,
      "priority": 2
    },
    {
      "title": "Stage 4: ${account.name} — Decision or Breakup",
      "description": "full breakup email and instructions",
      "due_offset_days": 14,
      "priority": 2
    }
  ]
}

Be hyper-specific. Use actual names from the stakeholder list. Reference actual pain points and objections from the call history. If data is missing, write what to do to fill the gap rather than being vague.`

  const raw = await callAnthropic(apiKey, {
    model: 'claude-sonnet-4-20250514',
    maxTokens: 3000,
    messages: [{ role: 'user', content: prompt }],
  })

  return parseClaudeJson(raw, null)
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return apiError(res, 405, 'Method not allowed')
  }

  const { accounts, assigneeId, assigneeEmail, campaignId } = req.body

  if (!accounts || !Array.isArray(accounts) || accounts.length === 0) {
    return apiError(res, 400, 'Missing or empty accounts array')
  }
  if (!assigneeId) {
    return apiError(res, 400, 'Missing required field: assigneeId')
  }
  if (!campaignId) {
    return apiError(res, 400, 'Missing required field: campaignId')
  }

  const apiKey = validateAnthropicKey(res)
  if (!apiKey) return

  const db = getSupabase()

  const { data: configRow } = await db
    .from('sales_process_config')
    .select('config')
    .single()

  const playbook = configRow?.config?.reengagement_playbook || null

  const plans = []
  let totalTasksCreated = 0

  for (const account of accounts) {
    try {
      const result = await buildAccountPlan({ account, db, apiKey, playbook })

      if (!result || !result.tasks) {
        plans.push({ accountId: account.id, error: 'Claude returned invalid or empty plan' })
        continue
      }

      let tasksCreated = 0
      for (const task of result.tasks) {
        const dueDate = new Date(Date.now() + task.due_offset_days * 24 * 60 * 60 * 1000)
          .toISOString()
          .split('T')[0]

        const { error: insertError } = await db.from('tasks').insert({
          title: task.title,
          description: task.description,
          status: 'open',
          priority: task.priority,
          type: 'triggered',
          owner_id: assigneeId,
          account_id: account.id,
          source: 'gong',
          source_type: 'campaign',
          source_id: campaignId,
          due_date: dueDate,
        })

        if (insertError) {
          console.error(`Failed to insert task for account ${account.id}:`, insertError.message)
        } else {
          tasksCreated++
        }
      }

      totalTasksCreated += tasksCreated

      plans.push({
        accountId: account.id,
        accountName: account.name,
        tasksCreated,
        plan: result,
      })
    } catch (err) {
      console.error(`Error processing account ${account.id}:`, err.message)
      plans.push({ accountId: account.id, error: err.message })
    }
  }

  return apiSuccess(res, {
    campaignId,
    plans,
    totalTasksCreated,
  })
}
