# Sales Dashboard - Project Roadmap

> **Purpose**: This document tracks all planned improvements, features, and ideas discussed across sessions. When you ask "what else do we need to do?", this is the source of truth.

---

## 🎯 Current Priority

### Ready for Team Use
- **Account Management - Gong to Email Workflow** ✅ (2026-02-15)
  - Goal: Production-ready workflow for team to use this week
  - Workflow: Load transcript from Gong → Analyze → Generate follow-up email → Edit → Send to Gmail
  - Status: **READY FOR TEAM - ENHANCED**
  - Completed:
    - ✅ Gong integration with search, filters, and import
    - ✅ Automatic transcript analysis (extracts stakeholders, pain points, MEDDICC, business areas)
    - ✅ Follow-up email generation with rich account context
    - ✅ Temperature: 0 added to all generation endpoints for consistency
    - ✅ Context-aware emails that reference stakeholders, pain points, metrics, decision criteria
    - ✅ **NEW: Editable email window** - Edit generated emails directly in the UI
    - ✅ **NEW: Gmail integration** - "Send to Gmail" button opens compose window with recipients, subject, and body pre-filled
    - ✅ **NEW: Learning system** - Tracks edits and learns from your style preferences
    - ✅ **NEW: Pattern recognition** - Analyzes what you change (subject, greeting, length, sign-off) and applies learnings to future emails
    - ✅ Meeting agenda generation with MEDDICC gap filling
    - ✅ Sales coaching feedback system
    - ✅ Team guide created: `TEAM_GUIDE_GONG_WORKFLOW.md`
    - ✅ Style guide created: `BANNER_EMAIL_STYLE_GUIDE.md`

### Recently Completed
- **Outbound Engine - Phase 1** (2026-02-15)
  - ✅ Dense spreadsheet-style table view (14 columns)
  - ✅ Company list with filters (vertical, status, search)
  - ✅ Sortable columns (name, % prospected, contacts, properties, units, last contacted)
  - ✅ Data model matching exact spreadsheet structure
  - ✅ Sample data seeded from spreadsheet (5 companies)
  - ✅ Percent prospected calculation algorithm
  - ✅ Company detail modal with 4 tabs (Overview, Contacts, Notes, Activity)
  - ✅ Contact management enhancement:
    - 12-column contact table (Name, Title, Department, Classification, Status, Email, Phone, Calls, Emails, Last Call, Last Email, Actions)
    - Search and filter by classification (ATL/BTL/Potential Champion), department (6 options alphabetically), status (6 options)
    - Sort by name, times called/emailed, last call/email
    - New contact fields: email, company/direct/mobile lines, LinkedIn profile
    - Department dropdown: Accounting/Finance, Acquisitions, Asset Management, C-suite, Construction, Development
    - Multi-select tools UI with color coding (PMS purple, Accounting green, PM orange)
    - 15 sample contacts with realistic activity data
  - ✅ Notes system with type categorization
  - ✅ Activity tracking (calls, emails, sequences, HeyReach)
  - ✅ Real-time % prospected updates when data changes

  **Phase 2 (Paused - will return)**:
  - Add new company modal (currently "TODO" in UI)
  - Edit company details
  - Edit contact details (currently can only add/delete)
  - Bulk operations (delete multiple contacts, export contacts)
  - Org chart visualization
  - AI-powered % prospected scoring enhancement
  - AI outreach content generation (email sequences, LinkedIn messages)
  - CSV import for bulk companies
  - Export companies/contacts to CSV
  - HubSpot integration
  - Contact enrichment (Apollo, ZoomInfo, etc.)
  - Email tracking integration
  - Call logging from Gong/Chorus
  - Playbooks per vertical (recommended talk tracks, questions, objection handling)

- **Testing analysis consistency** (2026-02-05)
  - Implemented `temperature: 0` for deterministic AI analysis
  - Target: 95% consistency when analyzing same transcript multiple times
  - Status: Testing in progress

### Recently Completed
- **Modular platform architecture** (2026-02-05)
  - Created modules landing page with tile-based navigation
  - Google OAuth integration via Supabase (works with/without auth)
  - Moved Account Pipeline to `/modules/account-pipeline`
  - Smart routing: auth-enabled → login → modules; auth-disabled → direct to pipeline
  - 8 modules configured:
    1. Account Management (active)
    2. Outbound Engine
    3. Sales Reports
    4. Pipeline Review
    5. Rep Coaching
    6. Content
    7. Sales Processes
    8. Settings (always last)
  - Large gradient icons with hover animations
  - "Coming Soon" badges for unavailable modules

- **Platform AI Assistant** (2026-02-05)
  - Added AI assistant to modules page (top right button)
  - Helps with navigation ("Where do I find...")
  - Content generation ("I need a call script for...")
  - Sales coaching ("What am I doing wrong?")
  - Suggests relevant modules based on user needs
  - API: `/api/platform-assistant`

- **Sales coaching feedback** (2026-02-05)
  - Added coaching feedback button to each transcript
  - Generates 3 actionable bullet points from senior sales consultant perspective
  - Structured feedback: Issue → Why it matters → How to improve
  - Focused on enterprise selling for experienced AEs
  - API: `/api/generate-coaching-feedback`

- **AI Assistant account operations** (2026-02-05)
  - AI can now delete accounts
  - AI can rename accounts
  - Actions require confirmation before applying

- **Banner team auto-labeling** (2026-02-05)
  - Created `lib/bannerTeam.js` config for team members
  - Automatically identifies and labels Banner team in stakeholder lists
  - Marks department as "Banner" with full name and title
  - Persists across accounts and sessions

---

## 📋 Planned Improvements

### High Priority

#### Perfect Analysis Determinism (Option 2)
**Status**: Planned
**Added**: 2026-02-05
**Context**: Currently at ~95% consistency with `temperature: 0`. This would achieve 100% perfect determinism.

**Implementation**:
1. Hash transcript content before analysis
2. Check cache for existing analysis by hash
3. Return cached result for identical transcripts
4. Only call Claude API for new/modified transcripts
5. Add cache invalidation strategy (optional manual refresh)

**Benefits**:
- 100% identical results for identical transcripts
- Reduced API costs (cached transcripts don't re-analyze)
- Faster response times for duplicate uploads
- Perfect repeatability for testing/demos

**Files to modify**:
- `pages/api/analyze-transcript.js` - Add caching layer
- `lib/cache.js` - Create new cache utility (in-memory or Redis)
- `hooks/useAccounts.js` - Add cache invalidation option

---

### Medium Priority

#### Content Generation System
**Status**: In Progress (2026-02-15)
**Context**: Comprehensive content management system with Google Drive integration for generating client-ready materials.

**Phase 1 Features** (In Development):
- **Content Module**: New module for content generation with template selection and preview
- **Google Drive Integration**: Export content to shared Sales drive as editable Docs/Slides/Sheets
- **Template Engine**: Variable interpolation with account data, transcripts, and manual inputs
- **1-Pagers**: 3-4 template versions (Enterprise, Mid-market, Case Study, etc.)
- **Sales Decks**: 2-3 template versions (Intro, Follow-up/Demo, Proposal)
- **Integration Guides**: 8 tech partners (Yardi, MRI, Real Page, Appfolio, Resman, Entrata, Oracle, Sage) - 1-pager and slide formats
- **Account Management Tab**: View all generated content per account, grouped by type with dates
- **Transcript-Based Deck Creation**: "Create Deck" button that analyzes transcript and generates contextual deck with "What We Heard" and suggested agenda

**Future Enhancements**:
- Business case generator (comprehensive, based on all account data)
- ROI calculator content
- Competitive battle cards
- Value proposition customization
- QBR/EBR presentation builder
- Custom content templates
- **Content-level permissioning and access control** (limit content visibility based on user roles/teams)
- Admin UI for editing templates (currently hardcoded)

**Current State**:
- Follow-up email generation ✅
- Next meeting agenda generation ✅
- Sales coaching feedback ✅

**Files**:
- `/pages/modules/content.js` - Content generation module
- `/lib/contentTemplates.js` - Template definitions
- `/lib/googleDrive.js` - Drive API integration
- Database tables: `generated_content`, `content_templates`

---

#### Authentication System
**Status**: Deprioritized (2026-02-05)
**Context**: Auth infrastructure partially built but paused to focus on analysis consistency.

**What's Done**:
- Supabase integration setup (`lib/supabase.js`)
- Auth components created (`components/auth/`, `lib/auth.js`)
- Login page (`pages/login.js`)
- Database utilities (`lib/db/`)
- State management with Zustand (`stores/`)
- Data migration utility (`lib/migrateLocalStorage.js`)

**What Remains**:
- Complete auth flow testing
- Session management
- Protected routes
- User data migration from localStorage to Supabase
- Multi-user account sharing/permissions

**Files Modified** (ready to resume):
- `pages/_app.js` - Auth provider integrated
- `pages/index.js` - Auth checks added
- `hooks/useAccounts.js` - Supabase mode implemented

---

## 💡 Ideas & Suggestions

### Analysis Improvements
- [ ] Confidence scoring for each insight (low/medium/high based on evidence)
- [ ] Citation linking - connect insights back to specific transcript quotes
- [ ] Timeline view - show how understanding evolved across transcripts
- [ ] Diff view - highlight what changed between analyses

### MEDDICC Enhancement
- [ ] Automated MEDDICC scoring
- [ ] Gap prioritization based on deal stage
- [ ] Suggested questions to ask based on missing MEDDICC elements

### Performance
- [ ] Lazy load transcripts (currently loads all)
- [ ] Paginate transcript list for accounts with 50+ calls
- [ ] Background analysis queue for bulk imports

### UX Improvements
- [ ] Bulk transcript upload (drag & drop multiple files)
- [ ] Export account data to PDF/Word
- [ ] Keyboard shortcuts for common actions
- [ ] Dark mode

---

## 🏗️ Architecture Decisions

### Current State
- **Storage**: Hybrid (localStorage + optional Supabase)
- **AI Provider**: Anthropic Claude Sonnet 4
- **Analysis Mode**: Real-time (on transcript upload)
- **Caching**: None (planned)

### Key Design Principles
1. **Consistency over speed** - Deterministic analysis is critical
2. **Incremental enhancement** - Each transcript builds on previous knowledge
3. **Transparency** - Always show confidence and source of insights
4. **Simplicity** - Avoid over-engineering, solve current needs

---

## 📝 Session Notes

### 2026-02-05: Analysis Consistency
**Problem**: Analysis consistency was 4/10 - same transcript produced different stakeholders, gaps, and insights each time.

**Root Cause**: Missing `temperature` parameter in API calls, defaulting to `temperature: 1.0` (high randomness).

**Solution**: Added `temperature: 0` to `lib/apiUtils.js` for deterministic output.

**Next Steps**: Test consistency improvement, consider implementing perfect caching (Option 2) if needed.

---

## 🗑️ Removed/Deprecated

_Nothing yet_

---

## 📌 How to Use This Document

1. **Adding new items**: Create new sections under appropriate priority level
2. **Updating status**: Change status tags (Planned → In Progress → Done)
3. **Removing items**: Move to "Removed/Deprecated" section with reason
4. **Session notes**: Add dated entries with context about decisions made

**Triggers to reference this document**:
- "What's next?"
- "What have we discussed?"
- "What should we work on?"
- "What improvements are planned?"
- "Remind me about..."
- Any question about future work or previous context
