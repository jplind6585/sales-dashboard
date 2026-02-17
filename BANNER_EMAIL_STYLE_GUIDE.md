# Banner Email Style Guide

## Default Style (Baked In)

This is the official Banner style for all AI-generated follow-up emails. This style is automatically applied when clicking "Follow-up Email" on any transcript.

## Core Principles

1. **Ultra-concise** - No fluff, no filler, every sentence adds value
2. **Action-oriented** - Crystal clear next steps in every email
3. **Professional but direct** - Skip the pleasantries, get to business
4. **Context-aware** - Reference specific discussions, pain points, and stakeholders

## Email Format (Always Applied)

### Subject Line
**Format:** "Banner Follow Up - MM/DD"
- Short and scannable
- Date is call date, not send date
- Examples: "Banner Follow Up - 2/15", "Banner Follow Up - 11/3"

### Greeting
**Smart greeting based on attendee count:**
- **3 or fewer external attendees:** Use first names
  - "Hi Sarah," or "Hi Sarah and Mike,"
- **More than 3 attendees:** Use group greeting
  - "Hi everybody,"

### Body Structure
1. **Opening line** - Brief, warm but professional
   - "Great connecting today." or "Great demo call yesterday."

2. **Key takeaways** (2-3 bullets max)
   - Only highlight critical points
   - Reference specific numbers, pain points, or requirements
   - No generic platitudes

3. **Attachments list** (3-5 items max)
   - "Attaching:" or "Sending you:"
   - Simple bullet format: `- Item name`
   - Only include what was discussed or is clearly relevant:
     - Banner overview deck (for socializing internally)
     - Integration overviews (Yardi, QuickBooks, etc.)
     - Case studies (matching their vertical/size)
     - One-pagers on specific capabilities
     - Security documentation
     - ROI calculator
     - Gong recording link

4. **Next Steps** - Most important section
   - Start with "Next steps:" or "Next Steps:"
   - Be VERY specific:
     - What's happening next (demo, evaluation, proposal)
     - When it's happening (specific dates)
     - Who needs to be involved
     - What you need from them to proceed
   - Use Banner's sales stages as context:
     1. Introduction call
     2. Demo
     3. Evaluation (business process review)
     4. Proposal
     5. Legal/Contract

### Sign-off
**Just "James"** - Nothing else
- No "Best regards"
- No "Sincerely"
- No "Thanks"
- Just the name

## Examples

### Example 1: Intro Call (2 attendees)
```
Subject: Banner Follow Up - 2/15

Hi Sarah and Mike,

Good intro call today. Clear that Banner can solve your visibility and coordination challenges across your 45-property portfolio, especially with the major renovation program starting next quarter.

Key points from our discussion:
• Manual Excel tracking and lack of project visibility are major pain points
• Need seamless coordination between asset management and construction teams
• Yardi/QuickBooks integration is critical for your workflow

Attaching:
- Banner overview deck
- Yardi integration overview
- Multifamily portfolio case study (similar scale)

Next steps:
Demo scheduled for Feb 22 with you both and Jennifer Thompson. I'll send calendar invite today.

Need from you: Confirm Jennifer's availability and any specific workflows you want me to focus on during the demo.

James
```

### Example 2: Demo Call (4 attendees)
```
Subject: Banner Follow Up - 2/21

Hi everybody,

Great demo call yesterday. Key takeaways:
• Strong alignment on Banner's portfolio visibility and mobile capabilities for your 45 properties
• QuickBooks integration and Yardi connectivity meet your technical requirements
• Ready to move into evaluation phase starting March 1

Attaching:
- Security documentation for Tom's review
- Financial reporting samples
- Case study from similar portfolio

Next Steps:
I need to schedule our evaluation kickoff for March 1. Please send me 2-3 time slots that work for Sarah, Jennifer, and your implementation team. We'll spend 90 minutes mapping your current process and configuring Banner for your workflow.

Tom - please review the security docs and let me know if you need additional documentation before we kick off.

James
```

## What Makes This Style Work

✅ **Scannable** - Busy executives can read in 30 seconds
✅ **Actionable** - Always clear what happens next
✅ **Specific** - References actual numbers, pain points, and people
✅ **Professional** - Direct without being curt
✅ **Efficient** - Respects their time and yours

## Technical Implementation

- Style is baked into `/api/generate-follow-up` endpoint
- Uses `temperature: 0` for consistent output
- Automatically pulls context from:
  - Transcript (attendees, summary, next steps)
  - Account (stakeholders, pain points, MEDDICC)
  - Business areas (pain points, capabilities)
  - Metrics (deal size, property count, etc.)

## When to Deviate

This style is the default. Only deviate when:
- Prospect explicitly prefers more formal communication
- Cultural context requires different approach
- Executive sponsor relationship warrants more warmth

Even then, keep it concise and action-oriented.
