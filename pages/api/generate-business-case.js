import { BUSINESS_AREAS } from '../../lib/constants';

// Banner's standard solutions for each business area
const BANNER_SOLUTIONS = {
  budgeting: [
    'Mobile app to create budgets during site walk',
    'Capital planning module to create multi-year capital plans',
    'Standardize process across owners/regions',
    'Clear visibility into future fee revenue'
  ],
  project_tracking: [
    'Single source of truth for all project data',
    'Consistent project updates across owners',
    'Clear oversight and real-time status',
    'Key workflows auto-update trackers'
  ],
  project_design: [
    'Standard scope documents & bid templates stored within Banner',
    'Meeting minutes associated with projects',
    'Version control for project documents'
  ],
  bidding: [
    'All bids obtained through standardized process with vendors',
    'Pre-leveled bids for easy comparison',
    'Simple process to get additional bids',
    'Manager oversight into bidding process'
  ],
  rfa_process: [
    'One-click RFA creation from project data',
    'Standardized approval workflows',
    'Automated Docusign integration',
    'Full audit trail of approvals'
  ],
  contracting: [
    'Auto-create contract at end of approval workflow',
    'Track Docusign status in central location',
    'Reduce contract queueing',
    'CM visibility into contract status'
  ],
  project_management: [
    'Schedules, milestones, tasks tracked in one place',
    'Update key details from the field on mobile',
    'Meeting minutes stored with project',
    'Automated notifications and reminders'
  ],
  invoicing: [
    'Streamlined portal submission process',
    'Integrated approval workflows',
    'Integration with accounting systems',
    'Easily collect waivers and documentation'
  ],
  cm_fees: [
    'Robust CM Fee tracking & projection',
    'Simple process to create fee invoices post approval',
    'Tie out reports across all invoices',
    'Real-time fee revenue forecasting'
  ],
  change_orders: [
    'Submitted directly by vendors through portal',
    'Approval triggers necessary signing documents',
    'Auto-update project trackers and budgets'
  ],
  project_closeout: [
    'Standardized close-out checklist and process',
    'Centralized repository with owner access',
    'Automated handoff documentation'
  ],
  reporting: [
    'Standardized owner reporting & updates',
    'Live reporting based on latest updates',
    'Built-in analytics and dashboards',
    'Custom report builder'
  ],
  unit_renos: [
    'Standardized unit reno process across clients',
    'Easily change scopes & issue POs from mobile',
    'Integration with property management systems',
    'Simplified by-unit cost tracking'
  ],
  data_loading: [
    'Data loaded on agreed SLA (e.g., 1 business day)',
    'Access to dedicated data resource',
    'Automated data imports where possible'
  ],
  due_diligence: [
    'Create budget items from field with notes and photos',
    'Complete inspection checklist from mobile',
    'Single source of truth for DD budgets'
  ],
  asset_tracking: [
    'Track all key assets with warranty dates and details',
    'Set up critical notifications',
    'Update asset condition from field'
  ]
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { account } = req.body;

  if (!account) {
    return res.status(400).json({ error: 'Account data is required' });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    return res.status(500).json({ error: 'API key not configured' });
  }

  // Build detailed context for each business area
  const businessAreasForPrompt = BUSINESS_AREAS.map(area => {
    const data = account.businessAreas?.[area.id] || {};
    const solutions = BANNER_SOLUTIONS[area.id] || [];

    return {
      id: area.id,
      label: area.label,
      description: area.description,
      currentState: data.currentState || [],
      opportunities: data.opportunities || [],
      quotes: data.quotes || [],
      bannerSolutions: solutions,
      hasData: (data.currentState?.length > 0 || data.opportunities?.length > 0),
      irrelevant: data.irrelevant || false
    };
  });

  const areasWithData = businessAreasForPrompt.filter(a => a.hasData && !a.irrelevant);
  const areasWithoutData = businessAreasForPrompt.filter(a => !a.hasData && !a.irrelevant);

  const stakeholders = (account.stakeholders || [])
    .map(s => `${s.name} (${s.title || 'Unknown'}) - ${s.role}`)
    .join('\n');

  const metrics = Object.entries(account.metrics || {})
    .filter(([_, data]) => data?.value)
    .map(([key, data]) => `${key.replace(/_/g, ' ')}: ${data.value}`)
    .join('\n');

  const systemPrompt = `You are creating a CapEx Process Evaluation document for Banner, a CapEx management software company for multifamily real estate.

Your output should follow this exact structure (similar to the Greystar evaluation deck):

1. EXECUTIVE SUMMARY (2-3 paragraphs)
   - Brief overview of the company and their CapEx challenges
   - Key findings from discovery calls
   - High-level opportunity areas

2. STAKEHOLDER DISCOVERY
   - List key stakeholders by department/role

3. CURRENT PROCESS EVALUATION
   For EACH business area with data, create a section with:
   - Process Name (e.g., "Budgeting", "Project Tracking")
   - Current State: Bullet points describing their current workflow
   - Observed Opportunities: Bullet points describing pain points and areas for improvement

4. POTENTIAL PROCESS WITH BANNER
   For EACH business area, show:
   - Process Name
   - Current State (brief summary)
   - Banner Process: How Banner would improve this (use the provided Banner solutions)

Format as clean markdown with clear headers and bullet points. Be specific and detailed based on the data provided. If limited data exists for an area, note that more discovery is needed.`;

  const userPrompt = `Create a CapEx Process Evaluation for ${account.name}.

STAKEHOLDERS:
${stakeholders || 'No stakeholders identified yet'}

KEY METRICS:
${metrics || 'No metrics captured yet'}

BUSINESS AREAS WITH DATA:
${areasWithData.map(area => `
### ${area.label}
Current State:
${area.currentState.length > 0 ? area.currentState.map(s => `- ${s}`).join('\n') : '- No data captured'}

Opportunities:
${area.opportunities.length > 0 ? area.opportunities.map(s => `- ${s}`).join('\n') : '- No opportunities identified'}

Quotes:
${area.quotes.length > 0 ? area.quotes.map(q => `> "${q}"`).join('\n') : '- No direct quotes'}

Banner Solutions for this area:
${area.bannerSolutions.map(s => `- ${s}`).join('\n')}
`).join('\n')}

BUSINESS AREAS NEEDING MORE DISCOVERY:
${areasWithoutData.map(a => `- ${a.label}: ${a.description}`).join('\n')}

Generate the evaluation document now. Make it professional, specific, and actionable.`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 8000,
        system: systemPrompt,
        messages: [{
          role: 'user',
          content: userPrompt
        }]
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return res.status(response.status).json({
        error: errorData.error?.message || `API error: ${response.status}`
      });
    }

    const data = await response.json();
    const content = data.content?.[0]?.text || '';

    return res.status(200).json({
      success: true,
      content
    });
  } catch (error) {
    console.error('Error generating business case:', error);
    return res.status(500).json({
      error: 'Failed to generate business case'
    });
  }
}
