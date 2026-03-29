# Content Generation & Email Attachment Workflow

## Overview

The email workflow now **automatically generates relevant content** and includes Google Drive links when you generate a follow-up email. No more manual content creation!

---

## How It Works

### Automatic Content Generation

When you click "Generate Follow-up Email", the system:

1. **Analyzes the call context**
   - Vertical (multifamily, commercial, etc.)
   - Call stage (intro, demo, technical, evaluation, proposal)
   - Systems mentioned (Yardi, MRI, RealPage, etc.)
   - Gong recording availability

2. **Generates relevant content automatically**
   - Creates Google Docs with populated account data
   - Uploads to "Generated Content" folder in Google Drive
   - Gets shareable links

3. **Inserts Drive links into email**
   - Replaces generic "Attaching:" section with actual links
   - Each attachment is clickable Drive link
   - Ready to send immediately

---

## What Gets Auto-Generated

### 1-Pagers (Based on Vertical + Stage)

**Intro or Demo Calls:**
- **Multifamily accounts** → "Banner 1-Page Overview - Multifamily"  - **Commercial accounts** → "Banner 1-Page Overview - Commercial"
- **Other verticals** → "Banner 1-Page Overview - Enterprise"

Each 1-pager is customized with:
- Account name
- Property count from metrics
- Integration systems mentioned in transcripts
- Primary business area pain points
- Vertical-specific case studies and messaging

### Integration Guides (Based on Transcript Content)

If the transcript mentions:
- **Yardi** → "Banner + Yardi Integration Overview"
- **MRI** → "Banner + MRI Integration Overview"
- **RealPage** → "Banner + RealPage Integration Overview"
- **AppFolio** → "Banner + AppFolio Integration Overview"

Integration guides include:
- Technical sync details (what data flows, how often)
- Implementation timeline
- Security & compliance info
- Benefits specific to that system

### Demo Recordings

If Gong recording exists:
- Includes link to "Demo Recording" in attachments

---

## Example Workflow

**Before (Manual Process):**
```
1. Generate email → "Attaching: Banner 1-Pager, Yardi Integration Overview"
2. Go to Google Drive
3. Find templates
4. Copy template
5. Replace placeholders manually
6. Share and copy link
7. Paste link into email
8. Repeat for each attachment
9. Send email
```

**After (Automated):**
```
1. Generate email → Content auto-created with Drive links
2. Send email (or edit first)
```

**Time saved:** 10-15 minutes per email

---

## Email Output Example

**Old format:**
```
Attaching:
• Banner 1-Page Overview - Multifamily
• Yardi integration overview
• Demo recording for team review
```

**New format:**
```
Attaching:
• Banner 1-Pager - Multifamily: https://docs.google.com/document/d/abc123...
• Yardi Integration Overview: https://docs.google.com/document/d/def456...
• Demo Recording: https://us-65537.app.gong.io/call?id=789...
```

Recipients can click directly to view the documents.

---

## Content Templates

### Available 1-Pagers

| Template | Vertical | Focus |
|----------|----------|-------|
| Enterprise | All | General enterprise messaging |
| Multifamily | Multifamily | Turn-time reduction, unit-level tracking |
| Commercial | Commercial | Tenant improvements, multi-stakeholder approvals |

### Available Integration Guides

| Partner | Status |
|---------|--------|
| Yardi | ✅ Complete |
| MRI | 🚧 Coming soon |
| RealPage | 🚧 Coming soon |
| AppFolio | 🚧 Coming soon |
| ResMan | 🚧 Coming soon |
| Entrata | 🚧 Coming soon |
| Oracle | 🚧 Coming soon |
| Sage Intacct | 🚧 Coming soon |

---

## Template Data Population

Templates use account data to populate:

### From Account Record
- **{{account_name}}** - Account name
- **{{vertical_label}}** - Multifamily, Commercial, etc.
- **{{property_count}}** - From metrics
- **{{business_area}}** - Primary pain point area

### From Transcripts
- **{{integration_systems}}** - Systems mentioned (Yardi, MRI, etc.)
- Detects competitors mentioned
- Identifies specific pain points discussed

### Vertical-Specific Content
- **Case studies** - Relevant to vertical (e.g., Livcor for multifamily)
- **Competitor clients** - Who else uses Banner in that vertical
- **Messaging** - Industry-specific language and metrics

---

## Google Drive Organization

```
Sales Content (root)
├── Generated Content/
│   ├── Banner 1-Pager - Prometheus (Feb 17, 2026)
│   ├── Banner 1-Pager - Acme Properties (Feb 17, 2026)
│   ├── Yardi Integration Overview - Prometheus (Feb 17, 2026)
│   └── ...
├── Templates/ (source templates)
├── Company Logos/
└── Archive/
```

**Naming convention:**
`[Template Name] - [Account Name] ([Date])`

---

## Technical Implementation

### API Endpoints

**`/api/generate-follow-up`** (Enhanced)
- Detects what content is needed
- Calls `/api/generate-content` for each piece
- Inserts Drive links into email
- Returns email with attachments

**`/api/generate-content`** (New)
- Takes template ID + account data
- Populates template variables
- Converts markdown to Google Docs format
- Uploads to Google Drive
- Returns document URL

### Template Engine

**Location:** `/lib/contentTemplates.js`

**Features:**
- Variable interpolation: `{{account_name}}`
- Conditional sections: `{{#if condition}}...{{/if}}`
- Lists: `{{#each items}}...{{/each}}`
- Vertical-specific templates
- Smart data extraction from account/transcripts

### Google Docs Formatting

Markdown-style syntax converted to Google Docs:
- `# Heading` → Heading 1 style
- `## Heading` → Heading 2 style
- `### Heading` → Heading 3 style
- `• Bullet` → Bullet list
- `**Bold**` → Bold text

---

## Benefits

✅ **Time Savings:** 10-15 minutes saved per email
✅ **Consistency:** Every document uses latest template
✅ **Personalization:** Auto-populated with account data
✅ **No Manual Errors:** No copy-paste mistakes
✅ **Immediate Access:** Recipients get Drive links, not attachments
✅ **Version Control:** All docs in centralized Drive folder
✅ **Scalability:** Works for 1 email or 100 emails/day

---

## Next Steps

### Phase 1 (Complete)
- ✅ Template engine
- ✅ 1-pager templates (Enterprise, Multifamily, Commercial)
- ✅ Yardi integration guide
- ✅ Auto-generation in email workflow
- ✅ Google Docs formatting

### Phase 2 (Next)
- [ ] Complete remaining 7 integration guides
- [ ] Student Housing & Senior Housing 1-pagers
- [ ] Business case template
- [ ] Case study template
- [ ] Content tab in Account Management (view all generated docs)

### Phase 3 (Future)
- [ ] Custom template editor UI
- [ ] Slide deck generation (Google Slides)
- [ ] Competitor battle cards
- [ ] ROI calculator
- [ ] QBR presentation builder

---

## Troubleshooting

**Content not generating?**
- Check Google Drive credentials in `.env.local`
- Verify `GOOGLE_SERVICE_ACCOUNT_CREDENTIALS` is set
- Ensure "Generated Content" folder exists in Drive

**Drive links not working?**
- Check sharing permissions on folder
- Service account must have access to Sales Content folder

**Wrong content being generated?**
- System uses keywords from transcript to detect
- Check transcript summary includes relevant systems/context
- Templates are vertical-specific (check account vertical is set)

---

## Questions?

Contact James (james@withbanner.com) for:
- Adding new templates
- Modifying existing templates
- Custom content types
- Integration issues
