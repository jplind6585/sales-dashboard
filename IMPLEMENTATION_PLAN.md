# Sales Dashboard V3 - Implementation Plan

## Overview
Major enhancement to transform the sales dashboard into a comprehensive sales intelligence platform with AI-powered assistance, deal health tracking, and content generation.

---

## Phase 1: Core Data Model Updates

### 1.1 Verticals & Metrics Schema
```javascript
const VERTICALS = [
  'builder_developer', 'corporate', 'government', 'healthcare_medical',
  'hospitality', 'iwl', 'mixed_use', 'multifamily', 'office',
  'retail', 'senior', 'student'
];

const OWNERSHIP_TYPES = ['own', 'own_and_manage', 'third_party_manage'];

const STAGES = [
  'qualifying', 'active_pursuit', 'solution_validation',
  'proposal', 'legal', 'closed_won', 'closed_lost'
];

// Vertical-specific metrics
const VERTICAL_METRICS = {
  _core: ['annual_construction_spend', 'num_properties'],
  multifamily: ['num_units', 'unit_renos_per_year', 'avg_rent'],
  builder_developer: ['num_projects'],
  iwl: ['sqft_portfolio'],
  _third_party: ['num_clients'] // Added when ownership = third_party_manage
};
```

### 1.2 Deal Health Score Algorithm
- Stage progression: 20 points
- Gaps resolved %: 20 points
- Champion identified: 15 points
- Economic Buyer identified: 15 points
- Days since activity (inverse): 15 points
- Key metrics captured: 15 points

---

## Phase 2: AI Assistant Sidebar

### 2.1 Design
- Collapsible sidebar (right side)
- Always accessible via floating button
- Session-based conversation (no persistence)
- Context-aware suggested prompts based on current tab
- Can update any account data via natural language

### 2.2 Capabilities
- Update stakeholder roles
- Add/modify metrics
- Mark processes as irrelevant
- Resolve gaps
- Add notes
- Answer questions about the account

---

## Phase 3: Tab Enhancements

### 3.1 Overview Tab
- [ ] Add Stage dropdown (7 stages)
- [ ] Add Vertical dropdown (12 verticals)
- [ ] Add Ownership Type dropdown
- [ ] Dynamic metrics based on vertical
- [ ] Deal Health Score badge
- [ ] Suggested Next Actions widget (AI-generated)
- [ ] Reposition AI assistant access

### 3.2 Transcripts Tab
- [ ] Add Call Feedback button
- [ ] Structured scorecard:
  - Discovery depth (1-5)
  - Value articulation (1-5)
  - Objection handling (1-5)
  - Next steps secured (1-5)
  - Talk ratio %
- [ ] Expandable feedback with improvement suggestions
- [ ] Score rubric reference (what each level means)

### 3.3 Current State Tab
- [ ] AI assistant button for updates
- [ ] Auto-reorder processes: High priority → Low → None → Irrelevant
- [ ] Irrelevant items struck through at bottom
- [ ] Visual priority indicators

### 3.4 Stakeholders Tab
- [ ] Only import specifically named people from calls
- [ ] Display with available info (name, title, company)
- [ ] Filter out passing mentions

### 3.5 Gaps Tab
- [ ] AI assistant for updates ("ignore that gap", "add new gap")
- [ ] Expandable gap details:
  - Why this gap matters
  - Suggested questions to resolve
- [ ] Sales Process gaps organized by MEDDICC category:
  - Metrics
  - Economic Buyer
  - Decision Criteria
  - Decision Process
  - Identify Pain
  - Champion
  - Competition

### 3.6 Content Tab
- [ ] Template-based generation system
- [ ] Quick buttons: Business Case, 1-Pager, Case Study
- [ ] Custom generation via AI chat
- [ ] PDF export capability

---

## Phase 4: Reference Database

### 4.1 Client Database Schema
```javascript
{
  id: string,
  name: string,
  vertical: string,
  ownership_type: string,
  portfolio_size: number, // units, sqft, or properties depending on vertical
  region: string,
  is_reference: boolean,
  modules_used: string[],
  logo_url: string
}
```

### 4.2 Features
- CSV upload for initial population
- Manual add/edit
- Auto-suggest similar references based on:
  - Same vertical
  - Similar portfolio size
  - Same region
  - Same ownership type

---

## Phase 5: 1-Pager Generation

### 5.1 Template Structure
- Header: Banner logo + headline
- Module icons (customized to relevant modules)
- 3 value props (customized to pain points discovered)
- Customer testimonials (from similar references)
- Client logos (filtered by vertical/similarity)

### 5.2 Output
- HTML preview
- PDF export
- Customizable before export

---

## Implementation Order

### Sprint 1: Foundation
1. Update data model (verticals, stages, metrics)
2. AI sidebar component
3. Deal health score

### Sprint 2: Tab Enhancements
4. Overview tab updates
5. Current State reordering
6. Gaps tab MEDDICC organization

### Sprint 3: Call Intelligence
7. Call Feedback scorecard
8. Stakeholder extraction improvements
9. Suggested Next Actions

### Sprint 4: Content Generation
10. Reference database + CSV import
11. 1-pager generation
12. Template system for documents

---

## Files to Create/Modify

### New Files
- `components/layout/AISidebar.jsx`
- `components/common/DealHealthBadge.jsx`
- `components/common/CallScorecard.jsx`
- `components/common/GapDetail.jsx`
- `pages/api/generate-call-feedback.js`
- `pages/api/generate-next-actions.js`
- `pages/api/generate-one-pager.js`
- `pages/api/references/upload.js`
- `pages/api/references/list.js`
- `lib/verticals.js`
- `lib/dealHealth.js`

### Modified Files
- `lib/constants.js` - Add verticals, stages, metrics schemas
- `hooks/useAccounts.js` - Add vertical-specific logic
- `components/tabs/OverviewTab.jsx` - Major redesign
- `components/tabs/TranscriptsTab.jsx` - Add feedback
- `components/tabs/CurrentStateTab.jsx` - Add reordering
- `components/tabs/InformationGapsTab.jsx` - MEDDICC organization
- `components/tabs/ContentTab.jsx` - Template system
- `pages/index.js` - Add sidebar layout

---

## Brand Assets Needed
- Banner logo (SVG preferred)
- Brand colors: Navy (#1a2744), Coral (#e85a4f)
- Client logos for reference database
