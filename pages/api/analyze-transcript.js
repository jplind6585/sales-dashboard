import {
  apiError,
  apiSuccess,
  validateMethod,
  validateAnthropicKey,
  callAnthropic,
  parseClaudeJson,
  sanitizeString,
  logRequest,
} from '../../lib/apiUtils';
import { labelBannerTeamInAnalysis } from '../../lib/bannerTeam';

/**
 * Build user prompt with existing context for incremental analysis
 */
function buildUserPrompt(newTranscript, previousTranscripts, existingBusinessAreas, existingStakeholders, existingMetrics) {
  let prompt = `Analyze this NEW sales call transcript and extract structured data. Return ONLY valid JSON.\n\n`;

  // Include summary of previous transcripts if any
  if (previousTranscripts.length > 0) {
    prompt += `=== PREVIOUS CALL CONTEXT ===\n`;
    prompt += `We have ${previousTranscripts.length} previous transcript(s). Here are the summaries:\n\n`;
    previousTranscripts.forEach((t, i) => {
      prompt += `Call ${i + 1} (${t.date || 'Unknown date'}):\n${t.summary || 'No summary available'}\n\n`;
    });
    prompt += `\n`;
  }

  // Include existing stakeholders
  if (existingStakeholders.length > 0) {
    prompt += `=== KNOWN STAKEHOLDERS ===\n`;
    existingStakeholders.forEach(s => {
      prompt += `- ${s.name} (${s.title || 'Unknown title'}) - Role: ${s.role || 'Unknown'}\n`;
    });
    prompt += `\n`;
  }

  // Include existing metrics
  const knownMetrics = Object.entries(existingMetrics)
    .filter(([_, data]) => data?.value != null)
    .map(([key, data]) => `${key}: ${data.value}`);

  if (knownMetrics.length > 0) {
    prompt += `=== KNOWN METRICS ===\n`;
    prompt += knownMetrics.join('\n') + '\n\n';
  }

  // Include summary of what we know about business areas
  const areasWithData = Object.entries(existingBusinessAreas)
    .filter(([_, data]) => data?.currentState?.length > 0 || data?.opportunities?.length > 0)
    .map(([areaId]) => areaId);

  if (areasWithData.length > 0) {
    prompt += `=== AREAS WITH EXISTING DATA ===\n`;
    prompt += `We already have insights for: ${areasWithData.join(', ')}\n`;
    prompt += `Build on this existing knowledge - add new insights, don't repeat what we know.\n\n`;
  }

  prompt += `=== NEW TRANSCRIPT TO ANALYZE ===\n${newTranscript}`;

  return prompt;
}

export default async function handler(req, res) {
  logRequest(req, 'analyze-transcript');

  if (!validateMethod(req, res, 'POST')) return;

  const { transcript, existingContext } = req.body;
  const cleanTranscript = sanitizeString(transcript, 100000);

  if (!cleanTranscript) {
    return apiError(res, 400, 'Transcript is required');
  }

  if (cleanTranscript.length < 50) {
    return apiError(res, 400, 'Transcript is too short to analyze. Please provide a complete transcript.');
  }

  const apiKey = validateAnthropicKey(res);
  if (!apiKey) return;

  // Build context from existing transcripts and account data
  const previousTranscripts = existingContext?.transcripts || [];
  const existingBusinessAreas = existingContext?.businessAreas || {};
  const existingStakeholders = existingContext?.stakeholders || [];
  const existingMetrics = existingContext?.metrics || {};

  const systemPrompt = `You are an expert sales analyst for Banner, a CapEx management software company serving multifamily real estate. Your job is to analyze sales call transcripts and extract structured information in the EXACT format specified for Sunrise Senior Living's current state analysis.

CRITICAL FORMATTING RULES:
1. Bullets must be DETAILED and specific with full context - aim for 1-2 complete sentences per bullet
2. Do NOT guess - only extract what is explicitly discussed
3. When a process is not discussed, leave arrays empty
4. Current State = what they do today (tools, workflows, systems) AND the pain/problem it causes
5. Opportunities = improvement suggestions, ways to solve the problems (separate from pain points)
6. Each bullet should stand alone as a complete thought with clear cause and effect
7. Derive PRIORITY from how much the process was discussed and pain level expressed

CURRENT STATE STRUCTURE:
Format each current state bullet to show BOTH the current process AND its impact:
- "They [current process/tool/workflow] which causes/results in [specific pain point or problem]"
- Include direct quotes when they illustrate the pain point well
- Example: "Budgets are created manually in Excel with formulas for each of 200+ properties, which requires extensive man-hours and makes it impossible to see real-time budget status"
- Example: "They download raw data from PeopleSoft monthly and manually filter by project codes, but have no visibility into what's still open to spend"

OPPORTUNITIES STRUCTURE:
Format opportunities as improvement suggestions, NOT pain points:
- Focus on what could be better or what they wish they had
- Example: "Need a real-time dashboard that automatically syncs with accounting software"
- Example: "Want ability to track budget reallocations without manual spreadsheet updates"

INTELLIGENT PROCESS MAPPING:
Recognize different terms for the same process:
- "RFA Process" = "adding unbudgeted projects", "request for authorization", "project approval", "scope additions", "mid-year project requests"
- "Cost Tracking" = "budget tracking", "financial tracking", "spend monitoring"
- "Invoicing" = "invoice processing", "payment processing", "AP process"
Map these to the correct standard process category.

PRIORITY DETERMINATION (derive from transcript):
- High Priority: Extensively discussed (5+ minutes), significant pain expressed, multiple examples given, strong emotion
- Medium Priority: Discussed briefly (2-5 minutes), some pain mentioned, acknowledged as issue
- Low Priority: Mentioned in passing (<2 minutes), minor pain or no pain
- null: Not discussed at all

You must return ONLY valid JSON with no additional text. The JSON must follow this EXACT structure:

{
  "callDate": "YYYY-MM-DD or null if not found",
  "callType": "intro|discovery|demo|pricing|negotiation|follow_up|other",
  "attendees": ["Name 1", "Name 2"],
  "summary": "2-3 sentence summary of the call",
  "stakeholders": [
    {
      "name": "Full Name",
      "title": "Job Title or null",
      "department": "Department or null",
      "role": "Champion|Economic Buyer|Technical Buyer|User Buyer|Influencer|Blocker|Unknown",
      "notes": "Any relevant context about this person"
    }
  ],
  "businessAreas": {
    "budgeting": {
      "currentState": [
        "Budgets are created manually in Excel with complex formulas for each property, which requires extensive man-hours and makes it impossible to see real-time budget status as work progresses",
        "Site walks are conducted over 2-3 months to build the annual budget, but by the time they're complete, some of the initial data is already outdated"
      ],
      "opportunities": [
        "Need a real-time dashboard that automatically syncs with accounting software to show current budget vs actual",
        "Want to streamline the budget creation process to reduce the 2-3 month timeline"
      ],
      "quotes": ["We're exhausting man hours on manual tracking"],
      "priority": "high|medium|low|null",
      "notDiscussed": false
    },
    "cost_tracking": { "currentState": [], "opportunities": [], "quotes": [], "priority": null, "notDiscussed": true },
    "project_tracking": { "currentState": [], "opportunities": [], "quotes": [], "priority": null, "notDiscussed": false },
    "project_design": { "currentState": [], "opportunities": [], "quotes": [], "priority": null, "notDiscussed": false },
    "bidding": { "currentState": [], "opportunities": [], "quotes": [], "priority": null, "notDiscussed": false },
    "rfa_process": { "currentState": [], "opportunities": [], "quotes": [], "priority": null, "notDiscussed": false },
    "contracting": { "currentState": [], "opportunities": [], "quotes": [], "priority": null, "notDiscussed": false },
    "project_management": { "currentState": [], "opportunities": [], "quotes": [], "priority": null, "notDiscussed": false },
    "invoicing": { "currentState": [], "opportunities": [], "quotes": [], "priority": null, "notDiscussed": false },
    "cost_control": { "currentState": [], "opportunities": [], "quotes": [], "priority": null, "notDiscussed": false },
    "cm_fees": { "currentState": [], "opportunities": [], "quotes": [], "priority": null, "notDiscussed": false },
    "change_orders": { "currentState": [], "opportunities": [], "quotes": [], "priority": null, "notDiscussed": false },
    "project_closeout": { "currentState": [], "opportunities": [], "quotes": [], "priority": null, "notDiscussed": false },
    "reporting": { "currentState": [], "opportunities": [], "quotes": [], "priority": null, "notDiscussed": false },
    "unit_renos": { "currentState": [], "opportunities": [], "quotes": [], "priority": null, "notDiscussed": false },
    "warranties": { "currentState": [], "opportunities": [], "quotes": [], "priority": null, "notDiscussed": false },
    "data_loading": { "currentState": [], "opportunities": [], "quotes": [], "priority": null, "notDiscussed": false },
    "due_diligence": { "currentState": [], "opportunities": [], "quotes": [], "priority": null, "notDiscussed": false },
    "asset_tracking": { "currentState": [], "opportunities": [], "quotes": [], "priority": null, "notDiscussed": false }
  },
  "metrics": {
    "projects_per_year": null,
    "construction_spend": null,
    "num_regions": null,
    "num_properties": null,
    "num_units": null,
    "num_ftes": null,
    "unit_renos_per_year": null,
    "avg_project_value": null,
    "cm_fee_rate": null,
    "avg_rent": null
  },
  "metricsContext": {
    "projects_per_year": "source/context for this number",
    "construction_spend": null
  },
  "informationGaps": [
    {
      "question": "Key question we still need to answer",
      "category": "business or sales"
    }
  ],
  "nextSteps": ["Action item or follow-up mentioned"]
}

Business Area Definitions (recognize variations of these terms):
- budgeting: Annual budget creation, site walks, capital planning, how they build yearly budgets
- cost_tracking: Budget vs. actual tracking, financial reporting, forecasting, "open to spend" visibility
- project_tracking: Source of truth for projects, project status management, tracking systems
- project_design: Scope documents, bid templates, specifications, RFP creation
- bidding: RFP/bid process, bid leveling, vendor selection, getting competitive bids
- rfa_process: Adding unbudgeted projects, request for approval/authorization, scope change approvals (RECOGNIZE ALIASES)
- contracting: Contract creation, signatures, DocuSign, contract management
- project_management: Scheduling, Gantt charts, tasks, project updates, meeting minutes, status tracking
- invoicing: Invoice submission, review, approval, payment processing, AP workflow
- cost_control: Budget management, variance tracking, spend optimization, cost containment
- cm_fees: Construction management fee tracking (ONLY for third-party managers)
- change_orders: Change order submission, approval, tracking, anticipated changes
- project_closeout: Closeout process, punch lists, documentation, warranty handoff
- reporting: Owner reports, executive dashboards, analytics, financial reporting
- unit_renos: Unit turn process, renovation tracking, make-ready workflows
- warranties: Warranty tracking, expiration dates, claims management
- data_loading: Manual data entry, system imports, data migration
- due_diligence: Acquisition DD, site assessments, pre-acquisition budgeting
- asset_tracking: Equipment inventory, asset registers, condition tracking

Information Gap Categories:
- "business": Questions about their CapEx processes (how they budget, track projects, handle invoices, etc.) - things we need to understand to build a better evaluation
- "sales": MEDDICC-related questions - things we need to know to sell within the company:
  * Metrics: What metrics/KPIs matter to them? How do they measure success?
  * Economic Buyer: Who controls the budget? Who signs off on purchases?
  * Decision Criteria: What factors will they use to evaluate solutions?
  * Decision Process: What is their buying process? Timeline? Approvals needed?
  * Identify Pain: What are the consequences of not solving this problem?
  * Champion: Who is advocating internally for this solution?
  * Competition: Are they evaluating other solutions? What else are they considering?

YOU MUST generate both business AND sales gaps. Always identify what MEDDICC information is missing.

Example sales gaps:
- "Who is the economic buyer that will sign off on this purchase?"
- "What is their budget approval process and timeline?"
- "Who will be our internal champion to advocate for Banner?"
- "What other solutions are they evaluating?"
- "What metrics/ROI would they need to see to justify the purchase?"

Extract information explicitly stated or clearly implied in the transcript. Do not make assumptions. Leave arrays empty and metrics null if not mentioned. Focus on NEW information from this transcript while being aware of existing context.`;

  try {
    const userPrompt = buildUserPrompt(cleanTranscript, previousTranscripts, existingBusinessAreas, existingStakeholders, existingMetrics);

    console.log('Calling Anthropic API with transcript length:', cleanTranscript.length);

    const rawText = await callAnthropic(apiKey, {
      maxTokens: 8000,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    });

    let analysis = parseClaudeJson(rawText, null);

    if (!analysis || analysis.parseError) {
      console.error('Failed to parse JSON response');
      return apiSuccess(res, {
        success: false,
        parseError: true,
        rawAnalysis: rawText,
        analysis: null,
      });
    }

    // Label Banner team members in stakeholders
    analysis = labelBannerTeamInAnalysis(analysis);

    return apiSuccess(res, { analysis });
  } catch (error) {
    console.error('Error in analyze-transcript:', error);
    return apiError(res, 500, error.message || 'Failed to process transcript');
  }
}
