import { VERTICALS, OWNERSHIP_TYPES, STAGES, MEDDICC, BUSINESS_AREAS } from '../../lib/constants';
import {
  apiError,
  apiSuccess,
  validateMethod,
  validateRequired,
  validateAnthropicKey,
  callAnthropic,
  parseClaudeJson,
  logRequest,
} from '../../lib/apiUtils';

export default async function handler(req, res) {
  logRequest(req, 'account-assistant');

  if (!validateMethod(req, res, 'POST')) return;
  if (!validateRequired(req, res, ['message', 'account'])) return;

  const { message, account, context } = req.body;

  const apiKey = validateAnthropicKey(res);
  if (!apiKey) return;

  // Build context from account data
  const transcriptSummaries = (account.transcripts || [])
    .map((t, i) => `Transcript ${i + 1} (${t.date || 'unknown date'}): ${t.summary || 'No summary'}`)
    .join('\n');

  const stakeholdersList = (account.stakeholders || [])
    .map(s => `- ${s.name} (${s.title || 'Unknown title'}, ${s.department || 'Unknown dept'}) - Role: ${s.role}${s.notes ? ` - Notes: ${s.notes}` : ''}`)
    .join('\n');

  const metricsList = Object.entries(account.metrics || {})
    .filter(([_, data]) => data?.value)
    .map(([key, data]) => `- ${key.replace(/_/g, ' ')}: ${data.value}${data.context ? ` (${data.context})` : ''}`)
    .join('\n');

  const gapsList = (account.informationGaps || [])
    .filter(g => g.status !== 'resolved')
    .map(g => `- [${g.id}] ${g.question} (${g.category})`)
    .join('\n');

  const verticalOptions = VERTICALS.map(v => v.id).join(', ');
  const ownershipOptions = OWNERSHIP_TYPES.map(o => o.id).join(', ');
  const stageOptions = STAGES.map(s => s.id).join(', ');
  const meddiccCategories = Object.values(MEDDICC).map(m => m.id).join(', ');

  const systemPrompt = `You are an AI assistant helping manage a sales account for Banner, a CapEx management software company. You help the user update account information, answer questions about the account, and track sales progress.

CURRENT ACCOUNT: ${account.name}
Stage: ${account.stage || 'Not set'}
Vertical: ${account.vertical || 'Not set'}
Ownership Type: ${account.ownershipType || 'Not set'}

TRANSCRIPTS:
${transcriptSummaries || 'No transcripts yet'}

STAKEHOLDERS:
${stakeholdersList || 'No stakeholders identified yet'}

METRICS:
${metricsList || 'No metrics captured yet'}

OPEN INFORMATION GAPS:
${gapsList || 'No gaps tracked'}

CURRENT TAB: ${context?.activeTab || 'overview'}

Your job is to:
1. ANSWER QUESTIONS about the account based on the data above
2. SUGGEST UPDATES when the user provides new information
3. BE CAUTIOUS - if you're unsure what action to take, ASK for clarification

IMPORTANT RULES:
- When suggesting updates, clearly state what will be changed
- For stakeholder role changes, use: Champion, Economic Buyer, Technical Buyer, User Buyer, Influencer, Blocker, Unknown
- For metric updates, extract the specific value
- If the user's intent is unclear, ask a clarifying question
- Always confirm destructive or significant changes before executing
- DELETE ACCOUNT: Only suggest when user explicitly asks to delete/remove the account
- RENAME ACCOUNT: Suggest when user wants to change the account name or correct a misspelling

VALID OPTIONS:
- Stages: ${stageOptions}
- Verticals: ${verticalOptions}
- Ownership Types: ${ownershipOptions}
- MEDDICC Categories: ${meddiccCategories}
- Business Areas (for priority/irrelevant): ${BUSINESS_AREAS.map(a => a.id).join(', ')}
- Priority Levels: high, medium, low, none

Respond in JSON format:
{
  "response": "Your message to the user",
  "actions": [
    {
      "type": "update_stakeholder_role",
      "name": "Person Name",
      "newRole": "Champion"
    },
    {
      "type": "add_metric",
      "metric": "cm_fee_rate",
      "value": "5%",
      "context": "Mentioned by user"
    },
    {
      "type": "add_note",
      "category": "General",
      "content": "Note content"
    },
    {
      "type": "mark_area_irrelevant",
      "areaId": "cm_fees",
      "reason": "They don't do CM fees"
    },
    {
      "type": "set_area_priority",
      "areaId": "construction_management",
      "priority": "high"
    },
    {
      "type": "unmark_area_irrelevant",
      "areaId": "cm_fees"
    },
    {
      "type": "update_stage",
      "stage": "solution_validation"
    },
    {
      "type": "update_vertical",
      "vertical": "multifamily"
    },
    {
      "type": "update_ownership",
      "ownership": "own_and_manage"
    },
    {
      "type": "resolve_gap",
      "gapId": "gap_id_here",
      "resolution": "Answered in call"
    },
    {
      "type": "add_gap",
      "question": "What is their approval workflow?",
      "category": "decision_process"
    },
    {
      "type": "delete_account",
      "reason": "Duplicate or no longer needed"
    },
    {
      "type": "rename_account",
      "newName": "New Account Name"
    }
  ],
  "needsConfirmation": true,
  "confirmationQuestion": "Should I update John's role to Champion?"
}

If answering a question with no changes needed, return:
{
  "response": "Your answer here",
  "actions": [],
  "needsConfirmation": false
}`;

  try {
    const rawText = await callAnthropic(apiKey, {
      maxTokens: 2000,
      system: systemPrompt,
      messages: [{ role: 'user', content: message }],
    });

    // Try to parse the JSON response, fallback to plain text
    const result = parseClaudeJson(rawText, {
      response: rawText,
      actions: [],
      needsConfirmation: false,
    });

    return apiSuccess(res, result);
  } catch (error) {
    console.error('Error in account-assistant:', error);
    return apiError(res, 500, error.message || 'Failed to process request');
  }
}
