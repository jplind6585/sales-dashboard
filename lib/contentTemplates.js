/**
 * Content Templates for Banner Sales Platform
 *
 * This file defines all content templates (1-pagers, decks, integration guides)
 * with variable placeholders that get populated with account data.
 */

// Template variable syntax: {{variable_name}}
// Conditional sections: {{#if condition}}...{{/if}}
// Lists: {{#each items}}...{{/each}}

export const TEMPLATE_TYPES = {
  ONE_PAGER: 'one_pager',
  SALES_DECK: 'sales_deck',
  INTEGRATION_GUIDE: 'integration_guide',
  BUSINESS_CASE: 'business_case'
};

export const VERTICALS = {
  MULTIFAMILY: 'multifamily',
  COMMERCIAL: 'commercial',
  STUDENT_HOUSING: 'student',
  SENIOR_HOUSING: 'senior',
  MIXED_USE: 'mixed_use'
};

export const INTEGRATION_PARTNERS = [
  { id: 'yardi', name: 'Yardi' },
  { id: 'mri', name: 'MRI' },
  { id: 'realpage', name: 'RealPage' },
  { id: 'appfolio', name: 'AppFolio' },
  { id: 'resman', name: 'ResMan' },
  { id: 'entrata', name: 'Entrata' },
  { id: 'oracle', name: 'Oracle' },
  { id: 'sage', name: 'Sage Intacct' }
];

// ============================================================================
// 1-PAGER TEMPLATES
// ============================================================================

export const ONE_PAGER_TEMPLATES = {

  // General Enterprise 1-Pager
  enterprise: {
    id: 'one_pager_enterprise',
    name: 'Banner 1-Page Overview - Enterprise',
    type: TEMPLATE_TYPES.ONE_PAGER,
    description: 'General enterprise 1-pager for all verticals',
    applicableVerticals: ['all'],
    content: `# Banner CapEx Management Platform

## Eliminate Spreadsheet Chaos, Accelerate Project Delivery

**{{account_name}}** – Your partner in modern CapEx management for {{vertical_label}} real estate.

---

### The Challenge You're Facing

Most {{vertical_label}} operators manage capital projects with:
• Disconnected spreadsheets across teams
• Manual data entry and error-prone reporting
• No real-time visibility into project status
• Delayed budget approvals and payment processing
• Difficulty tracking ROI and compliance

**Result:** Projects delayed, budgets overrun, teams frustrated.

---

### Banner's Solution

**Centralized Platform** for end-to-end CapEx lifecycle management:

**1. Budget Planning & Approval**
   • Multi-year capital planning with scenario modeling
   • Customizable approval workflows (property → regional → corporate)
   • Real-time budget vs. actual tracking

**2. Project Execution**
   • Vendor management and bid comparison
   • Purchase order automation
   • Progress tracking with photos and milestones
   • Invoice matching and payment processing

**3. Financial Reporting**
   • Live dashboards by property, region, category
   • Variance analysis and forecasting
   • Audit trails for compliance (SOX, insurance)
   • Executive reporting with drill-down capability

**4. Integration**
   • Native connections to {{integration_systems}}
   • Automated GL coding and journal entries
   • Bank reconciliation

---

### Why {{account_name}} Should Choose Banner

✓ **Purpose-Built for Real Estate** – Not a generic PM tool adapted for CRE
✓ **Fast Implementation** – Live in 4-6 weeks, not 6 months
✓ **Flexible & Scalable** – Works for {{property_count}} properties to 10,000+
✓ **Proven ROI** – Customers see 40% faster project delivery, 30% reduction in admin time
✓ **Trusted by Leaders** – Used by {{competitor_clients}}

---

### Success Story: {{case_study_name}}

"{{case_study_quote}}"

**Results:**
• {{result_1}}
• {{result_2}}
• {{result_3}}

---

### Next Steps

**Let's schedule a 30-minute demo** to show you how Banner eliminates the bottlenecks slowing down your {{business_area}} projects.

**Contact:**
James Lindberg
Account Executive, Banner
james@withbanner.com
(555) 123-4567

---

*Banner is the leading CapEx management platform for commercial real estate, trusted by over 200 operators managing $5B+ in annual capital spend.*
`
  },

  // Multifamily-specific 1-Pager
  multifamily: {
    id: 'one_pager_multifamily',
    name: 'Banner 1-Page Overview - Multifamily',
    type: TEMPLATE_TYPES.ONE_PAGER,
    description: 'Multifamily-focused 1-pager with turn-focused messaging',
    applicableVerticals: [VERTICALS.MULTIFAMILY],
    content: `# Banner CapEx Management for Multifamily

## Reduce Turn Times, Maximize NOI

**{{account_name}}** – Streamline capital projects across your {{property_count}} multifamily properties.

---

### The Multifamily CapEx Challenge

You're managing hundreds of projects across your portfolio:
• **Unit Turns** – Appliances, flooring, cabinets, paint
• **Property Upgrades** – Amenities, exteriors, common areas
• **Deferred Maintenance** – HVAC, roofs, parking lots, pools
• **Value-Add Renovations** – Kitchen/bath upgrades, smart home tech

**Problem:** Spreadsheets can't keep up. Projects delay, budgets overrun, and you lack visibility into what's actually happening on-site.

---

### Banner's Multifamily Solution

**Purpose-built for high-volume, multi-site capital management:**

**Turn Acceleration**
• Fast-track work orders for turns (appliance replacement, flooring, paint)
• Vendor scorecarding (quality, speed, cost)
• Turn cost tracking by unit type
• Average days-to-turn dashboard

**Budget Control**
• Property-level capital budgets with corporate oversight
• Approval workflows that match your org structure
• Real-time spend visibility across portfolio
• Variance alerts when projects exceed budget

**Project Execution**
• Mobile app for property managers (submit requests, upload photos, approve invoices)
• Vendor portal for bid submission and payment tracking
• Automated PO generation and 3-way matching
• Progress tracking with photo documentation

**Financial Integration**
• Bi-directional sync with {{integration_systems}}
• Automated GL coding (CapEx vs. R&M, property rollup)
• Close books faster with real-time accruals

---

### Why Multifamily Operators Choose Banner

✓ **Turn-Time Reduction** – 30-40% faster unit turns with better vendor coordination
✓ **Budget Accuracy** – 95%+ budget vs. actual correlation
✓ **Time Savings** – 20+ hours/week saved per regional manager
✓ **Scalability** – From 20 properties to 2,000+
✓ **Proven in Multifamily** – Used by {{competitor_clients}}

---

### By the Numbers: Typical Multifamily Operator

**Before Banner:**
• 15-20 hours/week on spreadsheet updates
• 45-day average turn time
• 15-20% budget variance
• Limited visibility into project pipeline

**After Banner:**
• 2-3 hours/week on reporting (automated)
• 30-day average turn time
• 5-8% budget variance
• Real-time dashboard for entire portfolio

---

### Success Story: {{case_study_name}}

{{case_study_quote}}

**Results:**
• 35% reduction in turn time (60 days → 39 days)
• $2.3M saved annually through better vendor management
• 90% reduction in time spent on manual reporting

---

### See Banner in Action

**30-minute demo** tailored to your portfolio:
• Walk through a typical turn workflow
• Show budget tracking for {{property_count}} properties
• Demonstrate {{integration_systems}} integration
• Review implementation timeline (4-6 weeks)

**Contact:**
James Lindberg
Account Executive, Banner
james@withbanner.com
(555) 123-4567

---

*Banner powers CapEx management for 200+ multifamily operators managing 500,000+ units nationwide.*
`
  },

  // Commercial Real Estate 1-Pager
  commercial: {
    id: 'one_pager_commercial',
    name: 'Banner 1-Page Overview - Commercial',
    type: TEMPLATE_TYPES.ONE_PAGER,
    description: 'Commercial real estate focused 1-pager (office, retail, industrial)',
    applicableVerticals: [VERTICALS.COMMERCIAL],
    content: `# Banner CapEx Management for Commercial Real Estate

## Control Costs, Accelerate Tenant Projects

**{{account_name}}** – Centralize capital project management across your {{property_count}} commercial properties.

---

### The Commercial CapEx Challenge

Managing capital projects across office, retail, and industrial properties is complex:
• **Tenant Improvement Projects** – Build-outs, renovations, expansions
• **Building Systems** – HVAC, elevators, electrical, plumbing
• **Property Upgrades** – Lobbies, parking structures, landscaping
• **Deferred Maintenance** – Roofs, facades, life safety systems

**Problem:** Disconnected tools, delayed approvals, budget overruns, and frustrated tenants waiting for projects to complete.

---

### Banner's Commercial Solution

**Enterprise CapEx platform built for commercial real estate:**

**Tenant Project Management**
• TI project tracking from LOI through completion
• Tenant approval workflows and change orders
• Allowance tracking and reimbursements
• Project timeline visibility for leasing teams

**Multi-Stakeholder Approvals**
• Custom workflows (property → asset → portfolio → investment committee)
• Budget threshold rules and delegation
• Electronic signatures and audit trails
• Mobile approvals for executives

**Vendor & Contractor Management**
• RFP and bid comparison tools
• Vendor performance tracking
• Insurance and compliance documentation
• Payment scheduling and lien waivers

**Financial Controls**
• Project-level budget vs. actual
• Commitment tracking (POs + contracts)
• Forecast to completion
• Integration with {{integration_systems}} for GL posting

---

### Why Commercial Owners Choose Banner

✓ **Faster Project Delivery** – 25-35% reduction in approval cycle time
✓ **Budget Predictability** – Eliminate surprise overruns with commitment tracking
✓ **Tenant Satisfaction** – Real-time project visibility improves communication
✓ **Audit Ready** – Complete documentation and approval history
✓ **Scalable** – From 10 properties to 1,000+

---

### Use Case: {{business_area}} Projects at {{account_name}}

Based on our conversation, Banner would streamline:
{{#each pain_points}}
• {{this}}
{{/each}}

**Key Benefits for Your Team:**
• {{benefit_1}}
• {{benefit_2}}
• {{benefit_3}}

---

### Success Story: {{case_study_name}}

{{case_study_quote}}

**Results:**
• $8M in TI projects completed 40% faster
• 50% reduction in approval cycle time
• 95% tenant satisfaction with project transparency

---

### Next Steps

**Custom demo for {{account_name}}:**
• Review your current process for {{business_area}} projects
• Show how Banner would handle your specific workflows
• Discuss {{integration_systems}} integration
• Outline 4-6 week implementation plan

**Contact:**
James Lindberg
Account Executive, Banner
james@withbanner.com
(555) 123-4567

---

*Banner is trusted by leading commercial real estate owners and operators managing $10B+ in assets.*
`
  }
};

// ============================================================================
// INTEGRATION GUIDE TEMPLATES
// ============================================================================

export const INTEGRATION_GUIDE_TEMPLATES = {

  yardi: {
    id: 'integration_yardi',
    name: 'Banner + Yardi Integration Overview',
    partner: 'Yardi',
    type: TEMPLATE_TYPES.INTEGRATION_GUIDE,
    content: `# Banner + Yardi Integration

## Seamless Financial Sync for {{account_name}}

---

### Overview

Banner integrates bi-directionally with Yardi Voyager to provide real-time financial synchronization while keeping your CapEx project management centralized in Banner.

**Integration Type:** REST API (real-time)
**Yardi Products Supported:** Voyager (7S, 7.4, 8.x), RENTCafé
**Setup Time:** 2-3 weeks
**Frequency:** Real-time + nightly batch reconciliation

---

### What Syncs (Banner → Yardi)

**1. Projects & Budgets**
   • New CapEx projects created in Banner flow to Yardi as capital projects
   • Budget allocations by GL account
   • Property/portfolio assignments

**2. Purchase Orders**
   • POs approved in Banner automatically create PO records in Yardi
   • Vendor information, line items, GL codes
   • Project/property attribution

**3. Invoices & Payments**
   • Invoice approvals in Banner trigger AP invoice entry in Yardi
   • 3-way match (PO + invoice + receipt)
   • Payment status updates flow back to Banner

**4. Journal Entries**
   • Budget adjustments, project transfers, accruals
   • Automated GL coding based on project type and property

---

### What Syncs (Yardi → Banner)

**1. Chart of Accounts**
   • GL accounts, cost centers, properties
   • Vendor master file
   • Budget hierarchies

**2. Financial Data**
   • Actual spending by project/property
   • Budget vs. actual reporting
   • Payment confirmations

**3. Master Data**
   • Property information (name, address, ID)
   • Vendor details (name, address, payment terms)
   • Department/cost center structure

---

### Key Benefits for {{account_name}}

✓ **Single Source of Truth** – All project activity in Banner, all financial records in Yardi
✓ **Eliminate Double Entry** – Data flows automatically, no rekeying
✓ **Real-Time Visibility** – See committed and actual spend instantly
✓ **Faster Month-End Close** – Automated accruals and reconciliation
✓ **Audit Trail** – Complete documentation from requisition through payment

---

### Integration Architecture

\`\`\`
[Banner Platform] <--> [REST API] <--> [Yardi Voyager]
                           |
                    [Nightly Batch Sync]
                           |
                    [Reconciliation Report]
\`\`\`

**Authentication:** OAuth 2.0 or Yardi API credentials
**Data Format:** JSON
**Error Handling:** Automated retry logic + email alerts
**Monitoring:** Real-time sync status dashboard

---

### Implementation Timeline

**Week 1-2: Discovery & Configuration**
• Mapping session (Banner fields → Yardi fields)
• GL account structure review
• Approval workflow alignment
• API credential setup

**Week 3: Testing**
• Test environment sync
• Sample transactions (projects, POs, invoices)
• Reconciliation verification
• User acceptance testing

**Week 4: Go-Live**
• Production cutover
• Live transaction monitoring
• Training on sync dashboards
• Post-launch support

---

### Security & Compliance

• **Data Encryption:** TLS 1.3 in transit, AES-256 at rest
• **Access Control:** Role-based permissions, API key rotation
• **Audit Logging:** Complete transaction history
• **SOC 2 Type II Certified:** Banner infrastructure
• **Yardi Certified Integration Partner**

---

### Ongoing Support

• **Dedicated Integration Specialist** during implementation
• **24/7 Monitoring** of sync status
• **Automatic Error Resolution** for common issues
• **Quarterly Sync Health Reviews**

---

### Next Steps

**Let's schedule a technical review** with your Yardi administrator and Banner's integration team:
• Review your specific Yardi configuration
• Map your GL structure to Banner
• Discuss any custom fields or workflows
• Finalize implementation timeline

**Contact:**
James Lindberg
Account Executive, Banner
james@withbanner.com
(555) 123-4567

---

*Banner has completed 50+ Yardi integrations with portfolio sizes from 20 to 2,000+ properties.*
`
  }

  // Additional integration partners would follow the same structure
  // (MRI, RealPage, AppFolio, ResMan, Entrata, Oracle, Sage)
};

// ============================================================================
// BUSINESS CASE TEMPLATES
// ============================================================================

export const BUSINESS_CASE_TEMPLATES = {

  currentProcess: {
    id: 'business_case_current_process',
    name: 'Current Process Analysis',
    type: TEMPLATE_TYPES.BUSINESS_CASE,
    description: 'Detailed current state analysis by business process',
    content: `# {{account_name}} - Current Process Analysis

## Overview

This document outlines {{account_name}}'s current business processes for capital project management, identifying areas for potential improvement with Banner's platform.

---

{{current_process_table}}

---

## Summary

Based on our conversations, {{account_name}} has identified {{high_priority_count}} high-priority areas where Banner can provide immediate value:

{{high_priority_summary}}

---

## Recommended Next Steps

1. **Deep-dive demo** focused on {{top_pain_area}}
2. **Technical review** of {{integration_systems}} integration requirements
3. **ROI analysis** based on {{team_size}} team members spending {{time_savings}} hours/week on manual processes

---

**Prepared for:** {{account_name}}
**Date:** {{current_date}}
**Banner Account Executive:** James Lindberg
**Contact:** james@withbanner.com | (555) 123-4567
`
  }
};

// ============================================================================
// TEMPLATE DATA POPULATION
// ============================================================================

/**
 * Generate current process table from business areas
 */
function generateCurrentProcessTable(account) {
  if (!account?.businessAreas) {
    return 'No current process data available.';
  }

  const businessAreas = account.businessAreas;
  const BUSINESS_AREAS = [
    { id: 'budgeting', label: 'Budgeting' },
    { id: 'cost_tracking', label: 'Cost Tracking' },
    { id: 'project_tracking', label: 'Project Tracking' },
    { id: 'project_design', label: 'Project Design' },
    { id: 'bidding', label: 'Bidding' },
    { id: 'rfa_process', label: 'RFA Process' },
    { id: 'contracting', label: 'Contracting' },
    { id: 'project_management', label: 'Project Management' },
    { id: 'invoicing', label: 'Invoicing' },
    { id: 'cost_control', label: 'Cost Control' },
    { id: 'cm_fees', label: 'CM Fees' },
    { id: 'change_orders', label: 'Change Orders' },
    { id: 'project_closeout', label: 'Project Close Out' },
    { id: 'reporting', label: 'Reporting' },
    { id: 'unit_renos', label: 'Unit Renos' },
    { id: 'warranties', label: 'Warranties' },
    { id: 'data_loading', label: 'Data Loading' },
    { id: 'due_diligence', label: 'Due Diligence' },
    { id: 'asset_tracking', label: 'Asset Tracking' }
  ];

  let table = '';

  // Only include processes that have data
  const processesWithData = BUSINESS_AREAS.filter(area => {
    const data = businessAreas[area.id];
    if (!data || data.irrelevant) return false;

    const hasCurrentState = data.currentState?.length > 0;
    const hasOpportunities = data.opportunities?.length > 0;
    return hasCurrentState || hasOpportunities;
  });

  // Sort by priority
  const priorityOrder = { high: 0, medium: 1, low: 2, null: 3 };
  processesWithData.sort((a, b) => {
    const priorityA = businessAreas[a.id]?.priority || null;
    const priorityB = businessAreas[b.id]?.priority || null;
    return priorityOrder[priorityA] - priorityOrder[priorityB];
  });

  processesWithData.forEach(area => {
    const data = businessAreas[area.id];
    const priority = data.priority ? ` [${data.priority.toUpperCase()} PRIORITY]` : '';

    table += `### ${area.label}${priority}\n\n`;

    // Current State section
    if (data.currentState?.length > 0) {
      table += `**Current State:**\n`;
      data.currentState.forEach(item => {
        const bullet = typeof item === 'string' ? item : item?.bullet || item;
        table += `• ${bullet}\n`;
      });
      table += '\n';
    }

    // Observed Opportunities section
    if (data.opportunities?.length > 0) {
      table += `**Observed Opportunities:**\n`;
      data.opportunities.forEach(item => {
        const bullet = typeof item === 'string' ? item : item?.bullet || item;
        table += `• ${bullet}\n`;
      });
      table += '\n';
    }

    table += '---\n\n';
  });

  return table || 'No process data captured yet.';
}

/**
 * Generate high priority summary
 */
function generateHighPrioritySummary(account) {
  if (!account?.businessAreas) return '';

  const BUSINESS_AREAS = [
    { id: 'budgeting', label: 'Budgeting' },
    { id: 'cost_tracking', label: 'Cost Tracking' },
    { id: 'project_tracking', label: 'Project Tracking' },
    { id: 'bidding', label: 'Bidding' },
    { id: 'contracting', label: 'Contracting' },
    { id: 'invoicing', label: 'Invoicing' },
    { id: 'reporting', label: 'Reporting' },
    { id: 'project_management', label: 'Project Management' },
    { id: 'change_orders', label: 'Change Orders' },
    { id: 'cost_control', label: 'Cost Control' }
  ];

  const highPriorityAreas = BUSINESS_AREAS
    .filter(area => account.businessAreas[area.id]?.priority === 'high')
    .map(area => `• **${area.label}**`)
    .join('\n');

  return highPriorityAreas || '• No high-priority areas identified yet';
}

/**
 * Get count of high priority areas
 */
function getHighPriorityCount(account) {
  if (!account?.businessAreas) return 0;

  return Object.values(account.businessAreas)
    .filter(data => data?.priority === 'high')
    .length;
}

/**
 * Get top pain area
 */
function getTopPainArea(account) {
  if (!account?.businessAreas) return 'capital project management';

  const BUSINESS_AREAS = [
    { id: 'budgeting', label: 'budgeting' },
    { id: 'cost_tracking', label: 'cost tracking' },
    { id: 'project_tracking', label: 'project tracking' },
    { id: 'bidding', label: 'bidding' },
    { id: 'contracting', label: 'contracting' },
    { id: 'invoicing', label: 'invoicing' },
    { id: 'reporting', label: 'reporting' }
  ];

  // Find high priority area with most opportunities
  const topArea = BUSINESS_AREAS
    .filter(area => account.businessAreas[area.id]?.priority === 'high')
    .sort((a, b) => {
      const aOpps = account.businessAreas[a.id]?.opportunities?.length || 0;
      const bOpps = account.businessAreas[b.id]?.opportunities?.length || 0;
      return bOpps - aOpps;
    })[0];

  return topArea?.label || 'capital project management';
}

/**
 * Populate template with account data
 * @param {Object} template - Template object with content string
 * @param {Object} data - Data object with account info, transcripts, etc.
 * @returns {string} - Populated content
 */
export function populateTemplate(template, data) {
  let content = template.content;

  // Simple variable replacement: {{variable_name}}
  const variables = {
    account_name: data.account?.name || '[Account Name]',
    vertical_label: getVerticalLabel(data.account?.vertical),
    property_count: data.account?.metrics?.propertyCount?.value || '[X]',
    integration_systems: getIntegrationSystems(data.account),
    business_area: getPrimaryBusinessArea(data.account),
    competitor_clients: getCompetitorClients(data.account?.vertical),
    case_study_name: getCaseStudyName(data.account?.vertical),
    case_study_quote: getCaseStudyQuote(data.account?.vertical),
    result_1: 'Result placeholder 1',
    result_2: 'Result placeholder 2',
    result_3: 'Result placeholder 3',
    benefit_1: 'Benefit placeholder 1',
    benefit_2: 'Benefit placeholder 2',
    benefit_3: 'Benefit placeholder 3',
    // Business case specific
    current_process_table: generateCurrentProcessTable(data.account),
    high_priority_summary: generateHighPrioritySummary(data.account),
    high_priority_count: getHighPriorityCount(data.account),
    top_pain_area: getTopPainArea(data.account),
    team_size: data.account?.metrics?.num_ftes?.value || '[X]',
    time_savings: '10-20',
    current_date: new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
  };

  // Replace all variables
  Object.entries(variables).forEach(([key, value]) => {
    const regex = new RegExp(`{{${key}}}`, 'g');
    content = content.replace(regex, value);
  });

  // Handle conditionals: {{#if condition}}...{{/if}}
  // Simple implementation for now
  content = content.replace(/{{#if\s+(\w+)}}([\s\S]*?){{\/if}}/g, (match, condition, innerContent) => {
    return data[condition] ? innerContent : '';
  });

  // Handle lists: {{#each items}}...{{/each}}
  content = content.replace(/{{#each\s+(\w+)}}([\s\S]*?){{\/each}}/g, (match, arrayName, itemTemplate) => {
    const items = data[arrayName] || [];
    return items.map(item => {
      return itemTemplate.replace(/{{this}}/g, item);
    }).join('\n');
  });

  return content;
}

// Helper functions
function getVerticalLabel(vertical) {
  const labels = {
    multifamily: 'Multifamily',
    commercial: 'Commercial',
    student: 'Student Housing',
    senior: 'Senior Housing',
    mixed_use: 'Mixed-Use'
  };
  return labels[vertical] || 'Real Estate';
}

function getIntegrationSystems(account) {
  // Look for systems mentioned in account data
  const systems = [];

  // Check if mentioned in transcripts or notes
  if (account?.transcripts) {
    account.transcripts.forEach(t => {
      const text = (t.summary || '') + (t.text || '');
      if (text.toLowerCase().includes('yardi')) systems.push('Yardi');
      if (text.toLowerCase().includes('mri')) systems.push('MRI');
      if (text.toLowerCase().includes('realpage')) systems.push('RealPage');
      if (text.toLowerCase().includes('appfolio')) systems.push('AppFolio');
    });
  }

  return systems.length > 0 ? systems.join(', ') : 'Yardi, MRI, RealPage, or other property management systems';
}

function getPrimaryBusinessArea(account) {
  if (!account?.businessAreas) return 'capital projects';

  // Find business area with most data
  const areas = Object.entries(account.businessAreas)
    .filter(([key, data]) => data?.painPoints?.length > 0 || data?.currentState?.length > 0)
    .sort((a, b) => {
      const aPoints = (a[1].painPoints?.length || 0) + (a[1].currentState?.length || 0);
      const bPoints = (b[1].painPoints?.length || 0) + (b[1].currentState?.length || 0);
      return bPoints - aPoints;
    });

  if (areas.length > 0) {
    const areaKey = areas[0][0];
    const areaLabels = {
      budgetPlanning: 'budget planning',
      projectExecution: 'project execution',
      vendorManagement: 'vendor management',
      financialReporting: 'financial reporting'
    };
    return areaLabels[areaKey] || 'capital projects';
  }

  return 'capital projects';
}

function getCompetitorClients(vertical) {
  const clients = {
    multifamily: 'MAA, Livcor, Olympus Property, and Tourmaline',
    commercial: 'Hines, CBRE, and Brookfield',
    student: 'American Campus Communities and EdR',
    senior: 'Brookdale and Five Star Senior Living'
  };
  return clients[vertical] || 'leading real estate operators';
}

function getCaseStudyName(vertical) {
  const cases = {
    multifamily: 'Livcor (22,000 units)',
    commercial: 'Hines (150M SF)',
    student: 'American Campus (175 properties)',
    senior: 'Brookdale (700+ communities)'
  };
  return cases[vertical] || 'Leading Operator';
}

function getCaseStudyQuote(vertical) {
  const quotes = {
    multifamily: 'Banner cut our turn time from 60 days to 39 days, which directly improved our occupancy and NOI. The ROI was immediate.',
    commercial: 'We went from spreadsheet chaos to complete visibility. Our investment committee now has real-time data on every capital project.',
    student: 'Banner helped us standardize CapEx across 175 properties. We now close our books 10 days faster every quarter.',
    senior: 'Managing deferred maintenance across 700+ communities was impossible in Excel. Banner gave us the control and visibility we needed.'
  };
  return quotes[vertical] || 'Banner transformed how we manage capital projects across our portfolio.';
}

/**
 * Get template by ID
 */
export function getTemplateById(templateId) {
  // Search in all template collections
  const allTemplates = {
    ...ONE_PAGER_TEMPLATES,
    ...INTEGRATION_GUIDE_TEMPLATES,
    ...BUSINESS_CASE_TEMPLATES
  };
  return allTemplates[templateId] || allTemplates.currentProcess; // Default to currentProcess
}

/**
 * Get templates by type
 */
export function getTemplatesByType(type) {
  const allTemplates = {
    ...ONE_PAGER_TEMPLATES,
    ...INTEGRATION_GUIDE_TEMPLATES,
    ...BUSINESS_CASE_TEMPLATES
  };

  return Object.values(allTemplates).filter(t => t.type === type);
}

/**
 * Get templates applicable for a vertical
 */
export function getTemplatesForVertical(vertical, type = null) {
  const allTemplates = {
    ...ONE_PAGER_TEMPLATES,
    ...INTEGRATION_GUIDE_TEMPLATES,
    ...BUSINESS_CASE_TEMPLATES
  };

  return Object.values(allTemplates).filter(t => {
    const typeMatch = !type || t.type === type;
    const verticalMatch = !t.applicableVerticals ||
                         t.applicableVerticals.includes('all') ||
                         t.applicableVerticals.includes(vertical);
    return typeMatch && verticalMatch;
  });
}
