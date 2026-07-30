// Banner's standard "with Banner" capabilities per business area (the ideal-state bullets).
// Extracted from generate-business-case.js so both that generator and the proposal/eval-doc
// generator (pages/api/accounts/proposal.js) share one source. Keyed by BUSINESS_AREAS id.
export const BANNER_SOLUTIONS = {
  budgeting: [
    'Mobile app to create budgets during site walk',
    'Capital planning module to create multi-year capital plans',
    'Standardize process across owners/regions',
    'Clear visibility into future fee revenue'
  ],
  cost_tracking: [
    'Real-time budget vs actual tracking with automatic updates',
    'Clear visibility into "open to spend" for all projects',
    'Integration with accounting systems for live data',
    'Automated variance alerts and forecasting'
  ],
  cost_control: [
    'Proactive budget management with threshold alerts',
    'Track budget reallocations automatically',
    'Multi-level approval workflows for over-budget scenarios',
    'Predictive analytics for cost overrun risk'
  ],
  warranties: [
    'Centralized warranty database with expiration tracking',
    'Automated reminders before warranty expiration',
    'Simple claim submission and tracking',
    'Mobile access to warranty details from the field'
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
