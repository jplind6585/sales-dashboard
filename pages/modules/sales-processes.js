import { useState, useEffect } from 'react';
import {
  RefreshCw,
  ChevronDown, ChevronRight, ToggleLeft, ToggleRight, GitBranch
} from 'lucide-react';
import { useAuthStore } from '../../stores/useAuthStore';
import AppShell from '../../components/layout/AppShell';

const HARDCODED_CONFIG = {
  icp_definition: `# Banner ICP Definition

## Who We Sell To (Ideal)

**Primary target:** Capital project owners managing $10M+ annual CapEx across multiple active projects who lack a dedicated system for budget control, approval workflows, and project-level accountability.

**Verticals (ranked by fit):**
- Real estate development (multifamily, commercial, mixed-use) — multi-project portfolio, complex cost structures, investor reporting requirements
- Infrastructure / utilities — long-horizon capital programs, regulatory compliance, multi-stakeholder approvals
- Defense & government contractors — cost segregation, compliance, detailed approval chains
- Owner-operators (manufacturing, campus, large commercial) — ongoing facility CapEx, CFO owns the budget, no dedicated PM software

**Ownership types (ranked by fit):**
- Privately held companies ($50M–$2B revenue) — enough complexity to need software, flexible enough to buy
- Family offices and PE-backed real estate — portfolio-level visibility is a clear pain driver
- Public companies with capital disclosure requirements — accuracy and audit trail are selling points
- Government / quasi-governmental entities — budget justification cycles, complex approvals

**Decision maker profile:**
- Title: VP Finance, CFO, VP Capital Projects, Director of Real Estate, Owner/Principal
- Pain: Managing CapEx in spreadsheets or generic PM tools; budget overruns discovered too late; no single source of truth across projects; board or investor reporting is manual and error-prone
- Budget authority: yes, or direct line to economic buyer
- Timeline driver: active project starting, audit requirement, recent budget overrun, board demand

## Who We Don't Sell To

- Companies with < $5M annual CapEx (complexity doesn't justify Banner)
- Pure residential homebuilders (transactional, wrong workflow)
- Organizations where Finance has no involvement and IT owns the buy (IT-only purchases stall)
- Companies already in active contract negotiations with a direct competitor

## ICP Score Guide (1–10)

**10:** CFO or VP Finance is the champion. Active CapEx > $50M. Using spreadsheets or a clearly broken system. Pain acknowledged and budgeted. Decision in current quarter.
**8–9:** Finance or Capital Projects leader engaged. $20M+ CapEx. Acknowledged pain, reasonable timeline.
**6–7:** Right vertical and size, right pain language, but no budget decision or key decision maker not yet engaged.
**4–5:** One or two ICP signals present, others missing. Worth qualifying further.
**1–3:** Wrong vertical, too small, wrong buyer, or no apparent pain.`,

  discovery_framework: `# Banner Discovery Framework

## What Must Be Uncovered (MEDDICC)

**M — Metrics**
- What is their total annual CapEx? Per project?
- What does a 1% budget overrun cost them in dollar terms?
- How many hours per month does their team spend on CapEx reporting?
- What does a delayed approval cost them in project velocity?

**E — Economic Buyer**
- Who owns the capital budget? Who signs software spend at this level?
- Is the CFO or VP Finance involved? If not, what is the path to get them involved?
- Does your champion have authority to move forward, or do they need sign-off from above?

**D — Decision Criteria**
- What does success look like to them in year 1? What would they measure?
- Who else is involved in the evaluation? What are their must-haves?
- Is there a procurement process (RFP, IT review, legal)?

**D — Decision Process**
- What does the path from "yes" to signed contract look like?
- Who is involved at each step — Legal, IT, Finance, Operations?
- Has the company bought software of this type before? What was that process like?

**I — Identify Pain**
- What is their current state? Spreadsheets? Procore only? Something custom?
- Where does their process break down? Budget overruns? Reporting lag? Approval bottlenecks?
- What is the consequence of not solving this? Who feels that pain?
- Is the pain acknowledged by the economic buyer, or only by the operational contact?

**C — Champion**
- Who inside the company wants Banner to win? Why?
- Has this person navigated us through the org? Made introductions? Shared internal context?
- What is at stake for them personally if this project succeeds or fails?

**C — Competition**
- Are they evaluating anyone else? Northspyre? Procore? Staying in Excel?
- What do they like about the alternative? What concerns them?
- Have they seen a demo elsewhere? What was their reaction?

## Must Answer Before Advancing to Demo

- Pain is real, acknowledged, and tied to a business consequence
- Economic buyer identified by name (doesn't need to be in the room yet)
- Champion identified — someone who wants Banner to win
- Current state documented — what are they using today and where does it fail?
- Timeline is real — there is a specific reason to move in the next 1–2 quarters

## Discovery Red Flags

- "We're just looking" with no stated pain or timeline
- Only an operational contact engaged; no Finance involvement after 3+ touches
- Champion won't or can't introduce us to the economic buyer
- Decision criteria is price-first with no discussion of business value or risk
- They mention a competitor they're "already pretty far along with"`,

  stage_exit_criteria: `# Stage Exit Criteria

## Qualifying → Intro Scheduled
- Confirmed right vertical and CapEx scale (ICP score ≥ 5)
- Active CapEx program that Banner could serve
- Intro meeting booked with someone who can speak to the pain
- Account created and HubSpot deal linked

## Intro Scheduled → Active Pursuit
- Pain confirmed: they acknowledged a specific problem Banner solves
- Economic buyer or champion identified by name
- Next step agreed and scheduled
- MEDDICC partially complete: at minimum Metrics and Identify Pain answered

## Active Pursuit → Demo
- Champion identified and engaged (agreed to attend or facilitate the demo)
- Pain acknowledged by someone with economic authority or a clear line-of-sight to it
- Not sole-sourced to a competitor
- Demo audience confirmed: who is attending and what they care about

## Demo → Solution Validation
- Demo completed; key attendees confirmed interest in moving forward
- Economic buyer has been introduced (even if not in the demo)
- MEDDICC ≥ 60% complete
- Next step defined: stakeholder review, technical review, or internal champion briefing

## Solution Validation → Proposal
- Economic buyer engaged directly (on a call or in email)
- Decision criteria surfaced: what must be true for them to say yes?
- Competitive situation understood
- Champion has advocated for Banner internally
- Verbal intent to move forward if proposal terms are acceptable

## Proposal → Legal
- Proposal delivered and acknowledged
- Commercial range accepted (not rejected)
- At least one stakeholder confirmed as deal sponsor
- Legal / procurement contact identified

## Legal → Closed Won
- Contract in legal review with confirmed intent to proceed
- No open commercial objections
- Clear close date confirmed with champion or economic buyer`,

  disqualification_signals: `# Disqualification Signals

## Hard Stops (disengage)
- Company manages < $5M annual CapEx with no near-term growth plan
- No one in the company sees a problem with their current process — no pain, no urgency
- Deal controlled by a third-party consultant with a committed competitor relationship
- Procurement mandates a full RFP with no opportunity to shape criteria
- Company policy requires on-premise deployment only

## Soft Stops (do not advance without resolving)
- Only an operational user engaged — no path to Finance or the economic buyer after 3+ touches
- Champion cannot or will not introduce us to the economic buyer
- Actively in final contract negotiations with a direct competitor
- "We'll be ready in Q3" said more than once with no concrete trigger for readiness
- Timeline keeps slipping without a new reason — vague timelines die in committee
- Stated decision criteria is price-first with no discussion of business value or risk

## Language Patterns That Signal a Limping Deal
- "We love it, we just need to figure out the budget" — budget was never in motion
- "Let me loop in IT" unprompted — IT is a blocker, not a buyer
- "Can you send me something to share internally?" — champion is not willing to advocate verbally
- "We're happy with what we have" — this is not an objection, this is disqualification
- "We're talking to a lot of vendors" — no urgency, no champion; evaluate before investing more time
- Missed two consecutive scheduled calls without proactive rescheduling

## What to Do When You Soft-Stop
- Document the reason in account notes
- Set a reengagement date 60–90 days out
- Move to inactive_ae_follow_up or inactive_sdr_follow_up as appropriate
- Run the reengagement campaign when the date arrives — do not ghost them`,

  coaching_priorities: `# Coaching Priorities

Ranked by revenue impact. These drive all AI coaching output and rep development focus.

## 1. Identify and Engage the Economic Buyer Early
The most common reason deals stall: the rep has a champion but has never been in front of the person who controls the budget. Every deal in demo stage or later with no documented economic buyer contact is at risk. Coach reps to ask for the introduction by call 3, not call 8. If the champion won't make the introduction after two asks, that is a champion problem — not a timing problem.

## 2. Pain Depth Before Demo
A demo to someone without acknowledged, specific pain is a product tour, not a sales call. Reps who go to demo without surfacing a concrete consequence — a budget overrun cost, a board presentation that was wrong, an approval process that failed — win at roughly half the rate. Coach to disqualify on pain before booking the demo.

## 3. Talk Ratio — Let Them Talk More
Target: rep talk ratio below 50% on discovery and qualification calls. Reps who talk more than the prospect are pitching instead of diagnosing. The AI flags calls where rep talk ratio exceeds 60%. These calls get coaching cards first.

## 4. Champion Development
A champion who hasn't done anything for you yet is a promoter. A true champion has navigated internally on your behalf — made an introduction, shared internal context, forwarded a brief. Coach reps to ask their champion to take one small action before claiming them as a true champion.

## 5. Specific Next Steps
Every call should end with a specific next step: date, time, attendees, purpose. "I'll follow up" is not a next step. The AI flags calls with no committed next step. These are the highest-risk calls in the pipeline.

## 6. Competitive Positioning
Reps know the features but often hesitate when a competitor comes up. When Northspyre is in the conversation, three specific differentiators matter. When Procore comes up, the angle is entirely different. Coach to the specific competitive situation, not the generic pitch.

## 7. Objection Response Quality
Not all objection responses are equal. "Let me think about it" handled correctly vs. incorrectly is the difference between a deal advancing and dying quietly. Coach reps to recognize delay tactics vs. real objections, and respond with a clarifying question instead of a counter-pitch.`,

  qualification_framework: `# Qualification Framework

## ICP Score (1–10)

**1. Vertical fit (0–3)**
- 3: Top verticals — real estate development, infrastructure, defense / government contractor
- 2: Adjacent vertical with clear CapEx complexity
- 1: Possible fit but unusual for Banner
- 0: Wrong vertical

**2. CapEx scale (0–3)**
- 3: $50M+ annual CapEx
- 2: $20–50M annual CapEx
- 1: $5–20M annual CapEx
- 0: Under $5M

**3. Buyer profile (0–2)**
- 2: CFO or VP Finance engaged or identified as pain owner
- 1: Operational champion with clear Finance line-of-sight
- 0: IT-only or operational-only with no Finance path

**4. Pain match (0–2)**
- 2: Explicit pain around budget overruns, reporting failures, or approval workflow breakdown
- 1: Pain implied but not stated directly
- 0: No pain expressed

**Score interpretation:**
- 9–10: Ideal — prioritize aggressively
- 7–8: Strong fit — active pursuit warranted
- 5–6: Partial fit — qualify further before heavy investment
- 3–4: Weak fit — low-effort only, monitor for change signals
- 0–2: Poor fit — disengage

---

## Discovery Score (1–10)

**1. Pain depth (0–3)**
- 3: Pain acknowledged, quantified, and tied to a business consequence by someone with economic authority
- 2: Pain acknowledged with specific examples
- 1: Pain acknowledged generally
- 0: No pain surfaced

**2. Economic buyer status (0–3)**
- 3: Economic buyer engaged directly (on a call or in email)
- 2: Economic buyer identified; champion has made an introduction
- 1: Economic buyer identified but not yet engaged
- 0: Unknown

**3. Champion quality (0–2)**
- 2: Champion has taken action on our behalf (intro, internal share, verbal advocacy)
- 1: Champion identified and positive, but passive so far
- 0: No champion identified

**4. Timeline and process (0–2)**
- 2: Specific decision timeline with a named driver (board deadline, project start, audit)
- 1: General timeline stated
- 0: "No rush" or completely undefined

**Score interpretation:**
- 9–10: Fully qualified — advance with confidence
- 7–8: Well qualified — fill minor gaps before proposal
- 5–6: Partially qualified — proceed to demo but flag open items; do not advance to proposal without resolving
- 3–4: Under-qualified — run another discovery call before any product demonstration
- 0–2: Not qualified — identify whether a champion exists before investing further`,

  winning_tactics: `# Winning Tactics

## 1. The Reference-First Intro
When reaching out to a new prospect in a vertical where Banner has a win, lead with the reference, not the product. "We just helped [similar company] solve [specific CapEx challenge] in the first 60 days" opens doors that "let me show you Banner" does not. The specific peer company matters more than any feature claim.

## 2. Stakeholder Map Before the Demo
Before every demo, ask your champion to walk you through who will be in the room and what each person cares about. Tailor the first five minutes of the demo to their specific pain, not the standard flow. Demos that start with the prospect's own language close faster.

## 3. The 10-Minute Executive Call
Exec sponsors don't want demos. They want two things: confirmation you understand their business challenge, and a rough answer to what it's costing them not to solve it. Book a 10-minute call with the exec sponsor before the formal demo, not after. Use it to confirm the business outcome and get their buy-in on evaluation criteria.

## 4. The Breakup Email That Reopens Deals
Subject line: "Should I close your file?" Response rates on this email are consistently higher than any standard follow-up. Use it when a deal has gone cold for 3+ weeks with no scheduled next step. Loss aversion is more powerful than FOMO. Do not overuse — once per deal cycle.

## 5. The Dock (Information Room)
A live, account-specific Dock functions as an always-on sales presence. When a champion is internally selling on your behalf, the Dock is what they share. Make it account-specific: their vertical, their pain language, their reference cases. Generic decks die in committee; specific briefs don't.

## 6. Multi-Thread Before You Need It
Start multi-threading in Active Pursuit, not when the deal stalls. Once you have a champion, ask them to introduce you to the economic buyer and one operational stakeholder who would use Banner daily. Three relationships is the floor. If your only contact leaves, the deal typically dies within 30 days.

## 7. The Commitment Ladder
Every call should end with a micro-commitment that raises the stakes slightly from the last one. First call: schedule a demo. Demo: agree to an internal review. Review: agree to a stakeholder meeting. Each step should feel like a natural next move, not a push. Deals that stall usually stall because a rep skipped a rung.

## 8. Quarterly Timing
Q1 and Q3 are the strongest buying windows — companies are setting or revisiting capital budgets. Time executive intros, proposals, and big pushes to land in January–March and July–August wherever possible.`,

  competitor_playbook: `# Competitor Playbook

## Northspyre
**What they are:** The most direct competitor. CapEx intelligence platform focused on real estate development and infrastructure. Strong in the NYC and coastal real estate market. Good reporting and predictive analytics.

**Where they win:** Accounts where the CFO wants dashboards and investor reporting above all else. Large real estate portfolios where forecasting is the primary pain driver.

**Where Banner wins:** Accounts where approval workflows, budget controls, and project-level accountability are the core pain. Mid-market accounts where Northspyre's enterprise pricing is a blocker. Companies that need process automation, not just analytics.

**How to handle:**
- Don't lead with "we're better than Northspyre" — ask what specifically they liked first.
- If they love the dashboards: "Northspyre's reporting is strong. The question is whether dashboards alone solve the budget overrun problem, or whether you also need controls upstream before costs are committed."
- If they are in active contract with Northspyre: soft-stop. Don't compete head-to-head mid-evaluation — park the account for 12 months.
- On price: only surface if they bring it up first.

---

## Procore
**What they are:** Construction project management platform. Industry standard for general contractor workflows — RFIs, submittals, daily logs, project management.

**Where they win:** General contractors who live in Procore daily. Accounts where the GC-side construction workflow is the center of gravity.

**Where Banner wins:** The owner's side — developers, owners, government agencies who manage the capital budget and need owner-side CapEx visibility. Procore is built for the builder; Banner is built for the owner.

**How to handle:**
- The frame: "Procore manages the construction. Banner manages the capital."
- Ask: "Who holds your Procore licenses — your contractors or your internal team?" If contractors, Banner is not redundant.
- If they push back: "Procore tracks what the contractor is doing. Banner tracks what you committed to, what was approved, and whether you're on budget at the owner level. Most customers run both."
- Common entry point: company is deep in Procore but the CFO has no visibility. That's the Banner gap.

---

## Smartsheet
**What they are:** Flexible work management tool used everywhere, including DIY capital project tracking.

**Where they win:** Accounts with a capable internal ops person who built a custom solution. Low-budget environments. IT-driven purchases.

**Where Banner wins:** Any account where the Smartsheet setup is fragile, manually maintained, or has broken before. The sell is process durability vs. person dependency.

**How to handle:**
- Don't dismiss Smartsheet — acknowledge it works up to a point.
- Fragility pivot: "How much would it cost you if the person who built and maintains that sheet left tomorrow?"
- Upgrade frame: "Smartsheet is a general tool adapted for CapEx. Banner is built specifically for CapEx from day one — approvals, cost codes, budget controls, audit trail. You don't have to maintain it."

---

## Excel / Spreadsheets
**The most common competitive situation. Every account has someone managing CapEx in Excel somewhere.**

**How to handle:**
- Never say "Excel doesn't scale" — it's dismissive and they'll get defensive.
- Ask: "When was the last time a budget changed mid-project and it took longer than it should to update all the downstream reporting?"
- The close frame: "The question isn't whether Excel works — it clearly does because you've made it work. The question is what it's costing you in time, risk, and the occasional fire drill."
- Quantify together: if a 1% overrun on a $50M project is $500K, and Banner prevents even one overrun per year, help them do that math out loud.

---

## "We'll Build It Internally"
**Not a vendor — a common objection in tech-forward companies.**

**How to handle:**
- Take it seriously: "That makes sense. What's your timeline, and who owns it internally?"
- Surface the build cost: a CapEx system with approval workflows, audit trails, cost codes, and reporting is 6–12 months of senior engineering time plus ongoing maintenance.
- Risk question: "If the engineer who built it leaves, what happens to the system?"
- Reframe: "We're not competing with your engineering team. We're giving them back the time to build things that are actually differentiated for your business."`,
};

const DEFAULT_REENGAGEMENT_PLAYBOOK = {
  framework: "Based on Jeb Blount's Fanatical Prospecting (pattern-interrupt re-engagement), The Challenger Sale multi-threaded re-entry (Dixon & Adamson, 2011), and Gong's 2023 research showing multi-channel + specific pain reference + social proof produces 3x response rate vs generic outreach.",
  core_principles: [
    "Never re-engage a single contact — multi-thread across champion, exec sponsor, and promoters",
    "Reference something specific from the last real conversation — no generic 'just checking in'",
    "Intel first, executive entry second — don't go to the exec sponsor cold",
    "Detractors are neutralized through your champion or exec sponsor, never contacted directly",
    "The Dock is a credibility asset, not a pitch deck — it shows you've done the work",
  ],
  role_definitions: {
    champion: "Has helped navigate us internally — facilitated introductions, shared internal context, advocated for the project. Behavioral, not just a title.",
    exec_sponsor: "SVP level and above, or VP with P&L ownership. Economic authority. Goal: outcome-focused conversation, not a demo.",
    promoter: "Engaged, positive sentiment, asks good questions. Not yet a champion but a potential one.",
    detractor: "Raised repeated objections, went quiet, or expressed concern about the project. Strategy: neutralize via champion — understand their objection and address it before it surfaces again.",
  },
  stages: [
    {
      number: 1,
      name: "Intel Gathering",
      days: "1–3",
      contacts: ["champion", "promoter"],
      objective: "Re-establish contact. Confirm the pain is still live. Understand what changed since you last spoke.",
      guidance: "Low-ask outreach. Reference something specific — a pain point, a commitment they made, something they said. Don't ask for a meeting on the first touch. Ask one question.",
      touches: [
        {
          day: 1,
          channel: "LinkedIn DM",
          purpose: "Pattern interrupt — unexpected, personal, specific",
          template: "{{name}} — it's been a while. I was looking back at our last conversation and saw you mentioned {{specific_pain_or_challenge}}. Has that gotten better or worse for you since we spoke?",
        },
        {
          day: 3,
          channel: "Email",
          purpose: "Value-add — new insight or case study relevant to their stated pain",
          template: "Subject: Quick question about {{pain_area}}\n\n{{name}} — I've been working with a few {{vertical}} companies recently and kept thinking about the challenge you mentioned around {{specific_pain}}. One of them just solved it in a way that might be useful for you. Worth a 10-minute call this week?",
        },
      ],
    },
    {
      number: 2,
      name: "Executive Entry",
      days: "4–7",
      contacts: ["exec_sponsor"],
      objective: "Reach the exec sponsor armed with Stage 1 intel. Peer-level, outcome-focused, short. One question. No product talk.",
      guidance: "Use what your champion told you in Stage 1 to frame the exec entry. The exec sponsor doesn't need context — they need to know you understand their business outcome.",
      touches: [
        {
          day: 4,
          channel: "Email",
          purpose: "Executive-level re-entry — business outcome framing",
          template: "Subject: {{business_outcome}} for {{company}}\n\n{{exec_name}} — {{champion_name}} and I reconnected recently about {{pain_area}}. Given your focus on {{exec_priority}}, I thought it was worth reaching out directly. One question: is {{pain_area}} still a priority for {{company}} this {{quarter_year}}?",
        },
        {
          day: 6,
          channel: "Phone",
          purpose: "Direct call — 2 minutes, one question",
          template: "Opening: '{{exec_name}}, this is {{rep_name}} from Banner. I'll keep this short — I work with {{champion_name}} and wanted your perspective on something directly. Is this a good 2 minutes?' If yes: 'We've been working with a few {{vertical}} companies on {{pain_area}} — the results have been significant. Is that still a priority for you this year?'",
        },
      ],
    },
    {
      number: 3,
      name: "Multi-Channel Push",
      days: "8–14",
      contacts: ["champion", "exec_sponsor", "promoter"],
      objective: "Full push across all contacts with credibility assets. Dock + reference accounts + call track.",
      guidance: "This is where the Dock comes in. Don't send it cold — reference it in context of their specific pain. Cite similar companies by name.",
      touches: [
        {
          day: 8,
          channel: "Phone",
          purpose: "Champion call — specific objection response + what changed",
          template: "Opening: '{{name}}, I know we haven't spoken in a while — I wanted to reconnect specifically about {{objection_they_raised}}. Since we last spoke, we've worked with {{reference_account}} who had the exact same concern. Here's what happened...' Ask: 'Does that change how you'd think about moving forward?'",
        },
        {
          day: 10,
          channel: "Email",
          purpose: "Dock delivery",
          template: "Subject: How {{reference_account}} handled {{pain}}\n\n{{name}} — I put together a quick Dock for {{company}}. It covers {{topic_1}}, {{topic_2}}, and includes how {{reference_account}} approached the same challenge. {{dock_url_or_build_note}} Worth 5 minutes if {{pain}} is still on your radar.",
        },
      ],
    },
    {
      number: 4,
      name: "Decision or Breakup",
      days: "14+",
      contacts: ["most_responsive_contact"],
      objective: "Force a decision. Re-engage or close the loop cleanly. Silence is not an answer.",
      guidance: "Loss framing activates loss aversion — research shows 'should I close your file?' outperforms 'are you still interested?' by 2:1 (Blount). Keep it short. One sentence of context, one question, easy CTA.",
      touches: [
        {
          day: 14,
          channel: "Email",
          purpose: "Breakup — loss framing + easy re-engage CTA",
          template: "Subject: Should I close your file?\n\n{{name}} — I've reached out a few times since we last connected. I don't want to keep bothering you if the timing isn't right for {{company}}. Should I close your file and circle back in {{timeframe}}? Or if {{pain}} is still a priority, I'm happy to pick up where we left off — just say the word.",
        },
      ],
    },
  ],
  detractor_strategy: "Do not contact detractors directly. Use your champion and exec sponsor conversations to surface and address their objection before it blocks the deal. If the detractor is the economic buyer, use exec sponsor entry to go around them with a business outcome conversation.",
  information_room_guide: "The Dock is a credibility asset. When no Dock URL is stored for the account, generate a build brief: (1) Opening — what you heard from them + what has changed in their space since you last spoke, (2) The problem Banner solves for companies like theirs, (3) Reference case study — a similar company by vertical and ownership type, (4) How it works — 3 differentiators tied to their stated pain points, (5) Social proof — relevant customer references by industry. Keep it short enough to read in 5 minutes.",
};

const SECTIONS = [
  { id: 'icp_definition', label: 'ICP Definition', description: 'Who we sell to, who we don\'t, and how to score fit.', color: 'blue' },
  { id: 'discovery_framework', label: 'Discovery Framework', description: 'What must be uncovered on every call. Drives discovery scoring in Call Intelligence.', color: 'green' },
  { id: 'stage_exit_criteria', label: 'Stage Exit Criteria', description: 'What must be true before advancing an account to the next stage.', color: 'purple' },
  { id: 'disqualification_signals', label: 'Disqualification Signals', description: 'Hard stops, soft stops, and the language that signals a deal is limping.', color: 'red' },
  { id: 'coaching_priorities', label: 'Coaching Priorities', description: 'What to coach on first. Ranked by revenue impact. Drives all rep coaching output.', color: 'orange' },
  { id: 'qualification_framework', label: 'Qualification Framework', description: 'The scoring guide for ICP fit (1–10) and discovery quality (1–10).', color: 'teal' },
  { id: 'winning_tactics', label: 'Winning Tactics', description: 'Proven plays from the field. What works, and when to use it.', color: 'emerald' },
  { id: 'competitor_playbook', label: 'Competitor Playbook', description: 'How to handle Northspyre, Procore, Smartsheet, and the status quo.', color: 'yellow' },
  { id: 'reengagement_playbook', label: 'Reengagement Playbook', description: 'Staged outreach framework for reactivating inactive accounts. Drives the AI campaign builder.', color: 'indigo' },
];

const COLOR_MAP = {
  blue: 'border-blue-200 bg-blue-50', green: 'border-green-200 bg-green-50',
  purple: 'border-purple-200 bg-purple-50', red: 'border-red-200 bg-red-50',
  orange: 'border-orange-200 bg-orange-50', teal: 'border-teal-200 bg-teal-50',
  emerald: 'border-emerald-200 bg-emerald-50', yellow: 'border-yellow-200 bg-yellow-50',
  indigo: 'border-indigo-200 bg-indigo-50',
};
const DOT_MAP = {
  blue: 'bg-blue-500', green: 'bg-green-500', purple: 'bg-purple-500', red: 'bg-red-500',
  orange: 'bg-orange-500', teal: 'bg-teal-500', emerald: 'bg-emerald-500', yellow: 'bg-yellow-500',
  indigo: 'bg-indigo-500',
};

const ROLE_LABELS = { sdr: 'SDR', ae: 'AE', admin: 'Admin', manager: 'Manager', all: 'Everyone' };
const DUE_ANCHOR_LABELS = { trigger: 'when triggered', meeting: 'before/after meeting' };

function parseInline(text) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  if (parts.length === 1) return text;
  return parts.map((part, i) =>
    part.startsWith('**') && part.endsWith('**')
      ? <strong key={i} className="font-semibold text-gray-900">{part.slice(2, -2)}</strong>
      : part
  );
}

function ReadOnlySectionContent({ text }) {
  if (!text || !text.trim()) {
    return <p className="text-sm text-gray-400 italic">No content defined.</p>;
  }

  const lines = text.split('\n');
  const elements = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (line.startsWith('# ') && !line.startsWith('## ')) {
      elements.push(
        <h2 key={i} className="text-base font-bold text-gray-900 mb-3 pb-2 border-b border-gray-100">
          {line.slice(2)}
        </h2>
      );
    } else if (line.startsWith('## ')) {
      elements.push(
        <h3 key={i} className="text-sm font-bold text-gray-800 mt-5 mb-2 first:mt-0">
          {line.slice(3)}
        </h3>
      );
    } else if (line.startsWith('---')) {
      elements.push(<hr key={i} className="border-gray-100 my-5" />);
    } else if (line.startsWith('- ') || line.startsWith('* ')) {
      const bullets = [];
      while (i < lines.length && (lines[i].startsWith('- ') || lines[i].startsWith('* '))) {
        bullets.push(lines[i].slice(2));
        i++;
      }
      elements.push(
        <ul key={`ul-${i}`} className="space-y-1.5 mb-3">
          {bullets.map((b, bi) => (
            <li key={bi} className="flex items-start gap-2 text-sm text-gray-700">
              <span className="mt-[6px] w-1.5 h-1.5 rounded-full bg-gray-400 shrink-0" />
              <span>{parseInline(b)}</span>
            </li>
          ))}
        </ul>
      );
      continue;
    } else if (line.trim() === '') {
      // skip — spacing handled by margins
    } else {
      elements.push(
        <p key={i} className="text-sm text-gray-700 leading-relaxed mb-1.5">
          {parseInline(line)}
        </p>
      );
    }
    i++;
  }

  return <div>{elements}</div>;
}

function StepCard({ step, depth = 0 }) {
  const [open, setOpen] = useState(true);
  const isBranch = step.type === 'branch';
  const offsetLabel = step.due_offset_hours === 0
    ? 'Immediately'
    : step.due_offset_hours < 0
      ? `${Math.abs(step.due_offset_hours)}h before ${DUE_ANCHOR_LABELS[step.due_anchor] || 'meeting'}`
      : `${step.due_offset_hours}h after ${DUE_ANCHOR_LABELS[step.due_anchor] || 'trigger'}`;

  return (
    <div className={`border border-gray-200 rounded-lg bg-white ${depth > 0 ? 'ml-4' : ''}`}>
      <div className="flex items-start gap-3 p-4 cursor-pointer" onClick={() => setOpen(o => !o)}>
        <div className="mt-0.5 shrink-0">
          {isBranch
            ? <GitBranch className="w-4 h-4 text-purple-500" />
            : <div className="w-4 h-4 rounded-full border-2 border-gray-300" />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-semibold text-gray-900">{step.title}</p>
            {isBranch && <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full font-medium">Branching step</span>}
            {step.condition === 'no_show' && <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">If no-show</span>}
          </div>
          {!isBranch && (
            <div className="flex items-center gap-3 mt-1">
              <span className="text-xs text-gray-400">{offsetLabel}</span>
              {step.assignee_role && <span className="text-xs text-gray-400">· {ROLE_LABELS[step.assignee_role] || step.assignee_role}</span>}
            </div>
          )}
        </div>
        {open ? <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" /> : <ChevronRight className="w-4 h-4 text-gray-400 shrink-0" />}
      </div>

      {open && (
        <div className="px-4 pb-4 border-t border-gray-100 pt-3">
          {!isBranch && <p className="text-sm text-gray-600 leading-relaxed">{step.description}</p>}
          {isBranch && step.branches?.map(branch => (
            <div key={branch.value} className="mb-4 last:mb-0">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs font-semibold text-purple-700 bg-purple-50 border border-purple-200 px-2.5 py-1 rounded-full">{branch.label}</span>
              </div>
              <p className="text-xs text-gray-500 mb-2">{step.description}</p>
              <div className="space-y-2">
                {branch.steps?.map(s => <StepCard key={s.id} step={s} depth={depth + 1} />)}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function PlaybookCard({ playbook, onToggle }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className={`border rounded-xl bg-white overflow-hidden ${playbook.active ? 'border-gray-200' : 'border-gray-100 opacity-60'}`}>
      <div className="flex items-start justify-between p-5 cursor-pointer" onClick={() => setExpanded(e => !e)}>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <h3 className="text-base font-bold text-gray-900">{playbook.name}</h3>
            <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full font-medium">
              {ROLE_LABELS[playbook.role] || playbook.role}
            </span>
            <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full font-medium font-mono">
              {playbook.trigger}
            </span>
            {!playbook.active && <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">Inactive</span>}
          </div>
          <p className="text-sm text-gray-500">{playbook.description}</p>
          <p className="text-xs text-gray-400 mt-1">{playbook.steps?.length || 0} steps · Last updated {new Date(playbook.updated_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0 ml-4">
          <button
            onClick={e => { e.stopPropagation(); onToggle(playbook); }}
            className="text-gray-400 hover:text-gray-700"
            title={playbook.active ? 'Deactivate' : 'Activate'}
          >
            {playbook.active
              ? <ToggleRight className="w-5 h-5 text-green-500" />
              : <ToggleLeft className="w-5 h-5 text-gray-400" />}
          </button>
          {expanded ? <ChevronDown className="w-5 h-5 text-gray-400" /> : <ChevronRight className="w-5 h-5 text-gray-400" />}
        </div>
      </div>

      {expanded && (
        <div className="border-t border-gray-100 px-5 py-4 bg-gray-50 space-y-3">
          {(playbook.steps || []).map(step => (
            <StepCard key={step.id} step={step} />
          ))}
          {(!playbook.steps || playbook.steps.length === 0) && (
            <p className="text-sm text-gray-400 italic">No steps defined yet.</p>
          )}
        </div>
      )}
    </div>
  );
}

const CHANNEL_COLORS = {
  'LinkedIn DM': 'bg-blue-100 text-blue-700',
  'Email': 'bg-green-100 text-green-700',
  'Phone': 'bg-orange-100 text-orange-700',
};

function ReengagementPlaybookView({ data }) {
  if (!data || typeof data !== 'object') return null;
  const playbook = typeof data === 'string'
    ? (() => { try { return JSON.parse(data); } catch { return null; } })()
    : data;
  if (!playbook) return null;

  return (
    <div className="space-y-6">
      {playbook.framework && (
        <p className="text-xs text-gray-500 italic leading-relaxed border-l-2 border-indigo-200 pl-3">{playbook.framework}</p>
      )}

      {playbook.core_principles?.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-gray-800 mb-2">Core Principles</h3>
          <ul className="space-y-1.5">
            {playbook.core_principles.map((p, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-indigo-400 shrink-0" />
                {p}
              </li>
            ))}
          </ul>
        </div>
      )}

      {playbook.role_definitions && (
        <div>
          <h3 className="text-sm font-semibold text-gray-800 mb-2">Role Definitions</h3>
          <div className="border border-gray-200 rounded-lg overflow-hidden">
            {Object.entries(playbook.role_definitions).map(([role, def], i, arr) => (
              <div key={role} className={`flex gap-3 p-3 text-sm ${i < arr.length - 1 ? 'border-b border-gray-100' : ''}`}>
                <span className="font-medium text-gray-900 capitalize w-28 shrink-0">{role.replace(/_/g, ' ')}</span>
                <span className="text-gray-600">{def}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {playbook.stages?.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-gray-800 mb-3">Outreach Stages</h3>
          <div className="space-y-4">
            {playbook.stages.map((stage) => (
              <div key={stage.number} className="border border-gray-200 rounded-xl overflow-hidden">
                <div className="flex items-center gap-3 px-4 py-3 bg-gray-50 border-b border-gray-200">
                  <div className="w-7 h-7 rounded-full bg-indigo-600 text-white text-xs font-bold flex items-center justify-center shrink-0">
                    {stage.number}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-gray-900">{stage.name}</span>
                      <span className="text-xs text-gray-400">Days {stage.days}</span>
                      <div className="flex gap-1 flex-wrap">
                        {stage.contacts?.map(c => (
                          <span key={c} className="text-xs bg-indigo-50 text-indigo-700 border border-indigo-100 px-2 py-0.5 rounded-full capitalize">{c.replace(/_/g, ' ')}</span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="p-4 space-y-3">
                  <div>
                    <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Objective</span>
                    <p className="text-sm text-gray-700 mt-0.5">{stage.objective}</p>
                  </div>
                  <div>
                    <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Guidance</span>
                    <p className="text-sm text-gray-700 mt-0.5">{stage.guidance}</p>
                  </div>

                  {stage.touches?.length > 0 && (
                    <div className="space-y-3 pt-1">
                      {stage.touches.map((touch, ti) => (
                        <div key={ti} className="border border-gray-100 rounded-lg p-3 bg-white">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-xs text-gray-400">Day {touch.day}</span>
                            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${CHANNEL_COLORS[touch.channel] || 'bg-gray-100 text-gray-600'}`}>{touch.channel}</span>
                            <span className="text-xs text-gray-500">{touch.purpose}</span>
                          </div>
                          <pre className="text-xs text-gray-600 whitespace-pre-wrap font-sans leading-relaxed bg-gray-50 rounded-lg p-3 border border-gray-100">{touch.template}</pre>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {playbook.detractor_strategy && (
        <div className="rounded-lg bg-red-50 border border-red-100 p-4">
          <h3 className="text-xs font-semibold text-red-700 uppercase tracking-wide mb-1">Detractor Strategy</h3>
          <p className="text-sm text-gray-700">{playbook.detractor_strategy}</p>
        </div>
      )}

      {playbook.information_room_guide && (
        <div className="rounded-lg bg-indigo-50 border border-indigo-100 p-4">
          <h3 className="text-xs font-semibold text-indigo-700 uppercase tracking-wide mb-1">Dock Guide</h3>
          <p className="text-sm text-gray-700">{playbook.information_room_guide}</p>
        </div>
      )}

      <p className="text-xs text-gray-400 italic pt-1">This playbook drives the AI campaign builder in Account Management.</p>
    </div>
  );
}

export default function SalesProcesses() {
  const { user } = useAuthStore();

  const [activeTab, setActiveTab] = useState('playbooks');
  const [draft, setDraft] = useState({});
  const [activeSection, setActiveSection] = useState(SECTIONS[0].id);
  const [configLoading, setConfigLoading] = useState(true);
  const [configError, setConfigError] = useState(null);
  const [playbooks, setPlaybooks] = useState([]);
  const [playbooksLoading, setPlaybooksLoading] = useState(true);

  useEffect(() => { fetchConfig(); fetchPlaybooks(); }, []);

  async function fetchConfig() {
    setConfigLoading(true);
    try {
      const res = await fetch('/api/sales-process');
      const data = await res.json();
      const cfg = (data.success && data.config) ? data.config : {};
      setDraft(cfg);

      // Seed any empty sections to DB
      const missing = {};
      Object.entries(HARDCODED_CONFIG).forEach(([key, val]) => {
        if (!cfg[key]) missing[key] = val;
      });
      if (!cfg.reengagement_playbook) missing.reengagement_playbook = DEFAULT_REENGAGEMENT_PLAYBOOK;

      if (Object.keys(missing).length > 0) {
        fetch('/api/sales-process', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(missing),
        }).then(r => r.json()).then(d => {
          if (d.success && d.config) setDraft(d.config);
        }).catch(() => {});
      }
    } catch { setConfigError('Failed to load config.'); }
    finally { setConfigLoading(false); }
  }

  async function fetchPlaybooks() {
    setPlaybooksLoading(true);
    try {
      const res = await fetch('/api/playbooks');
      const data = await res.json();
      if (data.success) setPlaybooks(data.playbooks || []);
    } catch { }
    finally { setPlaybooksLoading(false); }
  }

  async function togglePlaybook(playbook) {
    setPlaybooks(prev => prev.map(p => p.id === playbook.id ? { ...p, active: !p.active } : p));
    await fetch('/api/playbooks', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: playbook.id, active: !playbook.active }),
    });
  }

  const activeS = SECTIONS.find(s => s.id === activeSection);

  return (
    <AppShell title="Sales Processes" subtitle="The playbooks and config that drive the AI across the whole platform">
      {/* Tab bar */}
      <div className="bg-white border-b border-gray-200 shrink-0">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex gap-0">
            {[
              { id: 'playbooks', label: `Automations (${playbooks.length})` },
              { id: 'config', label: 'AI Config' },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-5 py-3.5 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab.id
                    ? 'border-gray-900 text-gray-900'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* AI Config banner */}
      {activeTab === 'config' && (
        <div className="bg-gray-900 text-white px-6 py-3 shrink-0">
          <div className="max-w-7xl mx-auto text-sm text-gray-300">
            <span className="font-semibold text-white">This document drives the AI.</span> Every call analysis, ICP score, discovery score, coaching card, and disqualification flag reads from here. Changes are made via Claude, not in-app.
          </div>
        </div>
      )}

      {configError && (
        <div className="bg-red-50 border-b border-red-200 px-6 py-3 shrink-0">
          <div className="max-w-7xl mx-auto text-sm text-red-700">{configError}</div>
        </div>
      )}

      <div className="flex-1 max-w-7xl mx-auto w-full px-6 py-8">

        {/* Automations tab */}
        {activeTab === 'playbooks' && (
          <div>
            <div className="mb-6">
              <h2 className="text-lg font-bold text-gray-900">Trigger Automations</h2>
              <p className="text-sm text-gray-500 mt-0.5">When an event fires (stage change, meeting booked), these task batches are created automatically. Different from the strategic playbooks in AI Config.</p>
            </div>

            {playbooksLoading ? (
              <div className="flex items-center justify-center py-16">
                <RefreshCw className="w-5 h-5 text-gray-400 animate-spin" />
              </div>
            ) : (
              <div className="space-y-4">
                {playbooks.map(p => (
                  <PlaybookCard key={p.id} playbook={p} onToggle={togglePlaybook} />
                ))}
                {playbooks.length === 0 && (
                  <div className="text-center py-16 text-gray-400">
                    <p className="text-sm">No automations defined yet.</p>
                    <p className="text-xs mt-1 text-gray-300">Add trigger-based task sequences here — e.g., "Demo Booked" creates 5 prep tasks automatically.</p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* AI Config tab */}
        {activeTab === 'config' && (
          configLoading ? (
            <div className="flex items-center justify-center py-16">
              <RefreshCw className="w-5 h-5 text-gray-400 animate-spin" />
            </div>
          ) : (
            <div className="flex gap-8 min-h-0">
              {/* Section nav */}
              <div className="w-56 shrink-0">
                <nav className="space-y-1 sticky top-8">
                  {SECTIONS.map(s => (
                    <button
                      key={s.id}
                      onClick={() => setActiveSection(s.id)}
                      className={`w-full text-left px-3 py-2.5 rounded-lg text-sm transition-colors flex items-center gap-2.5 ${
                        activeSection === s.id ? 'bg-gray-900 text-white font-medium' : 'text-gray-600 hover:bg-gray-100'
                      }`}
                    >
                      <div className={`w-2 h-2 rounded-full shrink-0 ${activeSection === s.id ? 'bg-white' : DOT_MAP[s.color]}`} />
                      {s.label}
                    </button>
                  ))}
                </nav>
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                {activeS && (
                  <div>
                    <div className={`rounded-xl border p-5 mb-4 ${COLOR_MAP[activeS.color]}`}>
                      <h2 className="text-lg font-bold text-gray-900 mb-1">{activeS.label}</h2>
                      <p className="text-sm text-gray-600">{activeS.description}</p>
                    </div>

                    <div className="border border-gray-200 rounded-xl p-6 bg-white">
                      {activeS.id === 'reengagement_playbook' ? (
                        <ReengagementPlaybookView
                          data={draft.reengagement_playbook || DEFAULT_REENGAGEMENT_PLAYBOOK}
                        />
                      ) : (
                        <ReadOnlySectionContent
                          text={draft[activeS.id] || HARDCODED_CONFIG[activeS.id]}
                        />
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )
        )}
      </div>
    </AppShell>
  );
}
