/**
 * Application constants and definitions
 */

// The 16 CapEx Business Areas for evaluation
export const BUSINESS_AREAS = [
  { id: 'budgeting', label: 'Budgeting', description: 'Site walks, budget creation, capital planning' },
  { id: 'project_tracking', label: 'Project Tracking', description: 'Source of truth, trackers, project status' },
  { id: 'project_design', label: 'Project Design', description: 'Scope documents, bid templates, specs' },
  { id: 'bidding', label: 'Bidding', description: 'RFP process, bid leveling, vendor selection' },
  { id: 'rfa_process', label: 'RFA Process', description: 'Request for approval creation and workflow' },
  { id: 'contracting', label: 'Contracting', description: 'Contract creation, signatures, tracking' },
  { id: 'project_management', label: 'Project Management', description: 'Scheduling, tasks, updates, meeting minutes' },
  { id: 'invoicing', label: 'Invoicing', description: 'Invoice submission, review, approval, payment' },
  { id: 'cm_fees', label: 'CM Fees', description: 'Construction management fee tracking and projection' },
  { id: 'change_orders', label: 'Change Orders', description: 'Change order submission and approval' },
  { id: 'project_closeout', label: 'Project Close Out', description: 'Close out process and documentation' },
  { id: 'reporting', label: 'Reporting', description: 'Reports, analytics, dashboards' },
  { id: 'unit_renos', label: 'Unit Renos', description: 'Unit renovation tracking and workflow' },
  { id: 'data_loading', label: 'Data Loading', description: 'Data entry, imports, system updates' },
  { id: 'due_diligence', label: 'Due Diligence', description: 'Acquisition DD process and budgeting' },
  { id: 'asset_tracking', label: 'Asset Tracking', description: 'Asset inventory, warranties, conditions' },
];

// MEDDICC Sales Methodology Categories
export const MEDDICC = {
  metrics: { id: 'metrics', label: 'Metrics', description: 'Quantifiable measures of success' },
  economic_buyer: { id: 'economic_buyer', label: 'Economic Buyer', description: 'Person with budget authority' },
  decision_criteria: { id: 'decision_criteria', label: 'Decision Criteria', description: 'Formal criteria for evaluation' },
  decision_process: { id: 'decision_process', label: 'Decision Process', description: 'Steps to make a decision' },
  identify_pain: { id: 'identify_pain', label: 'Identify Pain', description: 'Key pain points driving change' },
  champion: { id: 'champion', label: 'Champion', description: 'Internal advocate for your solution' },
  competition: { id: 'competition', label: 'Competition', description: 'Alternative solutions being considered' },
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

// Key metrics to extract for ROI calculations
export const KEY_METRICS = [
  { id: 'projects_per_year', label: 'Projects per Year', type: 'number', unit: 'projects' },
  { id: 'construction_spend', label: 'Annual Construction Spend', type: 'currency', unit: '$' },
  { id: 'num_regions', label: 'Number of Regions', type: 'number', unit: 'regions' },
  { id: 'num_properties', label: 'Number of Properties', type: 'number', unit: 'properties' },
  { id: 'num_units', label: 'Number of Units', type: 'number', unit: 'units' },
  { id: 'num_ftes', label: 'Number of FTEs', type: 'number', unit: 'FTEs' },
  { id: 'unit_renos_per_year', label: 'Unit Renos per Year', type: 'number', unit: 'renos' },
  { id: 'avg_project_value', label: 'Average Project Value', type: 'currency', unit: '$' },
  { id: 'cm_fee_rate', label: 'CM Fee Rate', type: 'percent', unit: '%' },
  { id: 'avg_rent', label: 'Average Rent', type: 'currency', unit: '$/month' },
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

// Empty business area state template
export const createEmptyBusinessAreaState = () => {
  return BUSINESS_AREAS.reduce((acc, area) => {
    acc[area.id] = {
      currentState: [],      // Array of observations about current process
      opportunities: [],     // Array of identified opportunities/pain points
      bannerSolution: [],    // How Banner addresses this (future use)
      confidence: 'none',    // none, low, medium, high
      lastUpdated: null,
    };
    return acc;
  }, {});
};

// Empty MEDDICC state template
export const createEmptyMeddiccState = () => {
  return Object.keys(MEDDICC).reduce((acc, key) => {
    acc[key] = {
      status: 'unknown',     // unknown, identified, confirmed
      notes: [],
      confidence: 'none',
      lastUpdated: null,
    };
    return acc;
  }, {});
};
