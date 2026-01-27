/**
 * Application constants and definitions
 */

// Brand colors
export const BRAND_COLORS = {
  coral: '#E86A58',
  navy: '#1E2A3A',
  white: '#FFFFFF',
  lightGray: '#F5F5F5',
};

// The 12 Verticals
export const VERTICALS = [
  { id: 'multifamily', label: 'Multifamily' },
  { id: 'builder_developer', label: 'Builder/Developer' },
  { id: 'iwl', label: 'I/W/L', description: 'Industrial/Warehousing/Logistics' },
  { id: 'senior', label: 'Senior' },
  { id: 'student', label: 'Student' },
  { id: 'hospitality', label: 'Hospitality' },
  { id: 'healthcare_medical', label: 'Healthcare/Medical' },
  { id: 'office', label: 'Office' },
  { id: 'retail', label: 'Retail' },
  { id: 'corporate', label: 'Corporate' },
  { id: 'government', label: 'Government' },
  { id: 'mixed_use', label: 'Mixed Use' },
];

// Ownership Types
export const OWNERSHIP_TYPES = [
  { id: 'own', label: 'Own' },
  { id: 'own_and_manage', label: 'Own & Manage' },
  { id: 'third_party_manage', label: '3rd Party Manage' },
];

// Deal Stages
export const STAGES = [
  { id: 'qualifying', label: 'Qualifying', order: 1, color: 'gray' },
  { id: 'active_pursuit', label: 'Active Pursuit', order: 2, color: 'blue' },
  { id: 'solution_validation', label: 'Solution Validation', order: 3, color: 'purple' },
  { id: 'proposal', label: 'Proposal', order: 4, color: 'orange' },
  { id: 'legal', label: 'Legal', order: 5, color: 'yellow' },
  { id: 'closed_won', label: 'Closed Won', order: 6, color: 'green' },
  { id: 'closed_lost', label: 'Closed Lost', order: 7, color: 'red' },
];

// Core metrics (apply to all verticals)
export const CORE_METRICS = [
  { id: 'annual_construction_spend', label: 'Annual Construction Spend', type: 'currency', unit: '$' },
  { id: 'num_properties', label: 'Number of Properties', type: 'number', unit: 'properties' },
];

// Vertical-specific metrics
export const VERTICAL_METRICS = {
  multifamily: [
    { id: 'num_units', label: 'Number of Units', type: 'number', unit: 'units' },
    { id: 'unit_renos_per_year', label: 'Unit Renos per Year', type: 'number', unit: 'renos' },
    { id: 'avg_rent', label: 'Average Rent', type: 'currency', unit: '$/month' },
  ],
  builder_developer: [
    { id: 'num_projects', label: 'Number of Projects', type: 'number', unit: 'projects' },
  ],
  iwl: [
    { id: 'sqft_portfolio', label: 'Portfolio Sq Ft', type: 'number', unit: 'sq ft' },
  ],
  senior: [
    { id: 'num_units', label: 'Number of Units', type: 'number', unit: 'units' },
    { id: 'num_beds', label: 'Number of Beds', type: 'number', unit: 'beds' },
  ],
  student: [
    { id: 'num_units', label: 'Number of Units', type: 'number', unit: 'units' },
    { id: 'num_beds', label: 'Number of Beds', type: 'number', unit: 'beds' },
  ],
  hospitality: [
    { id: 'num_rooms', label: 'Number of Rooms', type: 'number', unit: 'rooms' },
  ],
  healthcare_medical: [
    { id: 'sqft_portfolio', label: 'Portfolio Sq Ft', type: 'number', unit: 'sq ft' },
  ],
  office: [
    { id: 'sqft_portfolio', label: 'Portfolio Sq Ft', type: 'number', unit: 'sq ft' },
  ],
  retail: [
    { id: 'sqft_portfolio', label: 'Portfolio Sq Ft', type: 'number', unit: 'sq ft' },
  ],
  corporate: [],
  government: [],
  mixed_use: [
    { id: 'num_units', label: 'Number of Units', type: 'number', unit: 'units' },
    { id: 'sqft_portfolio', label: 'Portfolio Sq Ft', type: 'number', unit: 'sq ft' },
  ],
};

// Third-party manager metrics (added when ownership = third_party_manage)
export const THIRD_PARTY_METRICS = [
  { id: 'num_clients', label: 'Number of Clients', type: 'number', unit: 'clients' },
];

// Helper to get all metrics for a vertical + ownership type
export const getMetricsForAccount = (vertical, ownershipType) => {
  const metrics = [...CORE_METRICS];

  if (vertical && VERTICAL_METRICS[vertical]) {
    metrics.push(...VERTICAL_METRICS[vertical]);
  }

  if (ownershipType === 'third_party_manage') {
    metrics.push(...THIRD_PARTY_METRICS);
  }

  return metrics;
};

// Legacy KEY_METRICS for backward compatibility
export const KEY_METRICS = [
  { id: 'annual_construction_spend', label: 'Annual Construction Spend', type: 'currency', unit: '$' },
  { id: 'num_properties', label: 'Number of Properties', type: 'number', unit: 'properties' },
  { id: 'num_units', label: 'Number of Units', type: 'number', unit: 'units' },
  { id: 'unit_renos_per_year', label: 'Unit Renos per Year', type: 'number', unit: 'renos' },
  { id: 'avg_rent', label: 'Average Rent', type: 'currency', unit: '$/month' },
  { id: 'num_projects', label: 'Number of Projects', type: 'number', unit: 'projects' },
  { id: 'sqft_portfolio', label: 'Portfolio Sq Ft', type: 'number', unit: 'sq ft' },
  { id: 'num_clients', label: 'Number of Clients', type: 'number', unit: 'clients' },
  { id: 'cm_fee_rate', label: 'CM Fee Rate', type: 'percent', unit: '%' },
  { id: 'num_ftes', label: 'Number of FTEs', type: 'number', unit: 'FTEs' },
];

// The 16 CapEx Business Areas for evaluation
export const BUSINESS_AREAS = [
  { id: 'budgeting', label: 'Budgeting', description: 'Site walks, budget creation, capital planning', priority: 'high' },
  { id: 'project_tracking', label: 'Project Tracking', description: 'Source of truth, trackers, project status', priority: 'high' },
  { id: 'project_design', label: 'Project Design', description: 'Scope documents, bid templates, specs', priority: 'medium' },
  { id: 'bidding', label: 'Bidding', description: 'RFP process, bid leveling, vendor selection', priority: 'high' },
  { id: 'rfa_process', label: 'RFA Process', description: 'Request for approval creation and workflow', priority: 'high' },
  { id: 'contracting', label: 'Contracting', description: 'Contract creation, signatures, tracking', priority: 'high' },
  { id: 'project_management', label: 'Project Management', description: 'Scheduling, tasks, updates, meeting minutes', priority: 'medium' },
  { id: 'invoicing', label: 'Invoicing', description: 'Invoice submission, review, approval, payment', priority: 'high' },
  { id: 'cm_fees', label: 'CM Fees', description: 'Construction management fee tracking and projection', priority: 'medium' },
  { id: 'change_orders', label: 'Change Orders', description: 'Change order submission and approval', priority: 'medium' },
  { id: 'project_closeout', label: 'Project Close Out', description: 'Close out process and documentation', priority: 'low' },
  { id: 'reporting', label: 'Reporting', description: 'Reports, analytics, dashboards', priority: 'high' },
  { id: 'unit_renos', label: 'Unit Renos', description: 'Unit renovation tracking and workflow', priority: 'medium' },
  { id: 'data_loading', label: 'Data Loading', description: 'Data entry, imports, system updates', priority: 'low' },
  { id: 'due_diligence', label: 'Due Diligence', description: 'Acquisition DD process and budgeting', priority: 'low' },
  { id: 'asset_tracking', label: 'Asset Tracking', description: 'Asset inventory, warranties, conditions', priority: 'low' },
];

// MEDDICC Sales Methodology Categories
export const MEDDICC = {
  metrics: { id: 'metrics', label: 'Metrics', description: 'Quantifiable measures of success', order: 1 },
  economic_buyer: { id: 'economic_buyer', label: 'Economic Buyer', description: 'Person with budget authority', order: 2 },
  decision_criteria: { id: 'decision_criteria', label: 'Decision Criteria', description: 'Formal criteria for evaluation', order: 3 },
  decision_process: { id: 'decision_process', label: 'Decision Process', description: 'Steps to make a decision', order: 4 },
  identify_pain: { id: 'identify_pain', label: 'Identify Pain', description: 'Key pain points driving change', order: 5 },
  champion: { id: 'champion', label: 'Champion', description: 'Internal advocate for your solution', order: 6 },
  competition: { id: 'competition', label: 'Competition', description: 'Alternative solutions being considered', order: 7 },
};

// Stakeholder roles (MEDDICC-aligned)
export const STAKEHOLDER_ROLES = [
  { value: 'Champion', label: 'Champion', color: 'green', meddicc: 'champion' },
  { value: 'Economic Buyer', label: 'Economic Buyer', color: 'blue', meddicc: 'economic_buyer' },
  { value: 'Technical Buyer', label: 'Technical Buyer', color: 'purple', meddicc: null },
  { value: 'User Buyer', label: 'User Buyer', color: 'cyan', meddicc: null },
  { value: 'Influencer', label: 'Influencer', color: 'orange', meddicc: null },
  { value: 'Blocker', label: 'Blocker', color: 'red', meddicc: null },
  { value: 'Unknown', label: 'Unknown', color: 'gray', meddicc: null },
];

// Stakeholder departments (common in CapEx orgs)
export const DEPARTMENTS = [
  'Construction Services',
  'Construction Management',
  'Asset Management',
  'Operations',
  'Finance',
  'IT',
  'Procurement',
  'Executive',
  'Regional Leadership',
  'Site Management',
  'Interiors',
  'Other',
];

// Role badge color mapping
export const getRoleBadgeClasses = (role) => {
  switch (role) {
    case 'Champion':
      return 'bg-green-100 text-green-800';
    case 'Economic Buyer':
      return 'bg-blue-100 text-blue-800';
    case 'Technical Buyer':
      return 'bg-purple-100 text-purple-800';
    case 'User Buyer':
      return 'bg-cyan-100 text-cyan-800';
    case 'Influencer':
      return 'bg-orange-100 text-orange-800';
    case 'Blocker':
      return 'bg-red-100 text-red-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
};

// Tab definitions
export const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'transcripts', label: 'Transcripts' },
  { id: 'current_state', label: 'Current State' },
  { id: 'stakeholders', label: 'Stakeholders' },
  { id: 'gaps', label: 'Gaps' },
  { id: 'content', label: 'Content' },
];

// Note categories
export const NOTE_CATEGORIES = [
  'General',
  'Budget',
  'Timeline',
  'Fees',
  'Technical',
  'Competition',
];

// Call types for transcripts
export const CALL_TYPES = [
  { id: 'intro', label: 'Intro Call', color: 'bg-blue-100 text-blue-700' },
  { id: 'discovery', label: 'Discovery', color: 'bg-purple-100 text-purple-700' },
  { id: 'demo', label: 'Demo', color: 'bg-green-100 text-green-700' },
  { id: 'pricing', label: 'Pricing', color: 'bg-amber-100 text-amber-700' },
  { id: 'negotiation', label: 'Negotiation', color: 'bg-orange-100 text-orange-700' },
  { id: 'follow_up', label: 'Follow-up', color: 'bg-gray-100 text-gray-700' },
  { id: 'other', label: 'Other', color: 'bg-gray-100 text-gray-700' },
];

// Call feedback scoring rubric
export const CALL_SCORE_RUBRIC = {
  discovery_depth: {
    label: 'Discovery Depth',
    description: 'How well did the rep uncover pain points, current processes, and business context?',
    levels: {
      1: 'No discovery questions asked',
      2: 'Surface-level questions only',
      3: 'Good breadth but limited depth',
      4: 'Strong discovery with follow-up questions',
      5: 'Exceptional - uncovered key insights and quantified impact',
    },
  },
  value_articulation: {
    label: 'Value Articulation',
    description: 'How effectively did the rep connect Banner capabilities to prospect needs?',
    levels: {
      1: 'Feature dumping with no connection to needs',
      2: 'Generic value props not tailored to prospect',
      3: 'Some connection to stated needs',
      4: 'Clear value tied to specific pain points',
      5: 'Compelling ROI story with quantified benefits',
    },
  },
  objection_handling: {
    label: 'Objection Handling',
    description: 'How well did the rep address concerns and objections?',
    levels: {
      1: 'Ignored or dismissed objections',
      2: 'Acknowledged but did not address',
      3: 'Basic response without validation',
      4: 'Validated concern and provided solid response',
      5: 'Turned objection into opportunity, gained commitment',
    },
  },
  next_steps: {
    label: 'Next Steps Secured',
    description: 'Did the rep secure clear, committed next steps?',
    levels: {
      1: 'No next steps discussed',
      2: 'Vague "we\'ll be in touch"',
      3: 'Next step identified but not committed',
      4: 'Specific next step with date/time',
      5: 'Multiple stakeholders committed, calendar invite sent',
    },
  },
  talk_ratio: {
    label: 'Talk Ratio',
    description: 'What percentage of the call did the rep talk vs listen?',
    levels: {
      1: '>80% rep talking',
      2: '70-80% rep talking',
      3: '50-70% rep talking',
      4: '40-50% rep talking',
      5: '<40% rep talking (prospect-led conversation)',
    },
  },
};

// Empty business area state template
export const createEmptyBusinessAreaState = () => {
  return BUSINESS_AREAS.reduce((acc, area) => {
    acc[area.id] = {
      currentState: [],
      opportunities: [],
      quotes: [],
      confidence: 'none',
      priority: area.priority,
      irrelevant: false,
      irrelevantReason: null,
      lastUpdated: null,
    };
    return acc;
  }, {});
};

// Empty MEDDICC state template
export const createEmptyMeddiccState = () => {
  return Object.keys(MEDDICC).reduce((acc, key) => {
    acc[key] = {
      status: 'unknown',
      notes: [],
      confidence: 'none',
      lastUpdated: null,
    };
    return acc;
  }, {});
};

// Calculate deal health score (0-100)
export const calculateDealHealth = (account) => {
  if (!account) return 0;

  let score = 0;
  const weights = {
    stage: 20,
    gaps: 20,
    champion: 15,
    economicBuyer: 15,
    activity: 15,
    metrics: 15,
  };

  // Stage progression (20 points)
  const stageOrder = STAGES.find(s => s.id === account.stage)?.order || 1;
  score += (stageOrder / 5) * weights.stage; // Max at proposal stage

  // Gaps resolved (20 points)
  const gaps = account.informationGaps || [];
  const resolvedGaps = gaps.filter(g => g.status === 'resolved').length;
  const totalGaps = gaps.length || 1;
  score += (resolvedGaps / totalGaps) * weights.gaps;

  // Champion identified (15 points)
  const stakeholders = account.stakeholders || [];
  const hasChampion = stakeholders.some(s => s.role === 'Champion');
  score += hasChampion ? weights.champion : 0;

  // Economic Buyer identified (15 points)
  const hasEB = stakeholders.some(s => s.role === 'Economic Buyer');
  score += hasEB ? weights.economicBuyer : 0;

  // Recent activity (15 points)
  const lastTranscript = account.transcripts?.[account.transcripts.length - 1];
  if (lastTranscript) {
    const daysSince = Math.floor((Date.now() - new Date(lastTranscript.addedAt)) / (1000 * 60 * 60 * 24));
    if (daysSince <= 7) score += weights.activity;
    else if (daysSince <= 14) score += weights.activity * 0.7;
    else if (daysSince <= 30) score += weights.activity * 0.4;
  }

  // Metrics captured (15 points)
  const metrics = account.metrics || {};
  const capturedMetrics = Object.values(metrics).filter(m => m?.value != null).length;
  const minMetrics = 3; // Expect at least 3 key metrics
  score += Math.min(capturedMetrics / minMetrics, 1) * weights.metrics;

  return Math.round(score);
};

// Get health score color
export const getHealthScoreColor = (score) => {
  if (score >= 70) return 'text-green-600';
  if (score >= 40) return 'text-yellow-600';
  return 'text-red-600';
};

export const getHealthScoreBg = (score) => {
  if (score >= 70) return 'bg-green-100';
  if (score >= 40) return 'bg-yellow-100';
  return 'bg-red-100';
};
