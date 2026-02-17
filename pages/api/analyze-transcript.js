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

  const systemPrompt = `You are an expert sales analyst for Banner, a CapEx management software company serving multifamily real estate. Your job is to analyze sales call transcripts and extract structured information.

IMPORTANT: You are building INCREMENTALLY on existing knowledge. Do not contradict or remove existing information unless the new transcript explicitly corrects it. ADD new insights, REFINE existing ones, and EXPAND our understanding.

You must return ONLY valid JSON with no additional text. The JSON must follow this exact structure:

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
      "currentState": ["observation 1", "observation 2"],
      "opportunities": ["pain point or opportunity 1"],
      "quotes": ["relevant direct quote if any"]
    },
    "project_tracking": { "currentState": [], "opportunities": [], "quotes": [] },
    "project_design": { "currentState": [], "opportunities": [], "quotes": [] },
    "bidding": { "currentState": [], "opportunities": [], "quotes": [] },
    "rfa_process": { "currentState": [], "opportunities": [], "quotes": [] },
    "contracting": { "currentState": [], "opportunities": [], "quotes": [] },
    "project_management": { "currentState": [], "opportunities": [], "quotes": [] },
    "invoicing": { "currentState": [], "opportunities": [], "quotes": [] },
    "cm_fees": { "currentState": [], "opportunities": [], "quotes": [] },
    "change_orders": { "currentState": [], "opportunities": [], "quotes": [] },
    "project_closeout": { "currentState": [], "opportunities": [], "quotes": [] },
    "reporting": { "currentState": [], "opportunities": [], "quotes": [] },
    "unit_renos": { "currentState": [], "opportunities": [], "quotes": [] },
    "data_loading": { "currentState": [], "opportunities": [], "quotes": [] },
    "due_diligence": { "currentState": [], "opportunities": [], "quotes": [] },
    "asset_tracking": { "currentState": [], "opportunities": [], "quotes": [] }
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

Business Area Definitions:
- budgeting: Site walks, budget creation, capital planning, how they build budgets
- project_tracking: Source of truth for projects, trackers, project status management
- project_design: Scope documents, bid templates, specifications
- bidding: RFP process, bid leveling, vendor selection, getting bids
- rfa_process: Request for approval creation and approval workflows
- contracting: Contract creation, signatures, DocuSign, contract tracking
- project_management: Scheduling, tasks, project updates, meeting minutes
- invoicing: Invoice submission, review, approval, payment tracking
- cm_fees: Construction management fee tracking, projection, billing
- change_orders: Change order submission, approval, tracking
- project_closeout: Close out process, documentation, handoff
- reporting: Reports, analytics, dashboards, owner reporting
- unit_renos: Unit renovation tracking, turn process, make-ready
- data_loading: Data entry into systems, imports, manual data work
- due_diligence: Acquisition due diligence process and budgeting
- asset_tracking: Asset inventory, warranties, equipment tracking

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
