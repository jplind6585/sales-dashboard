// The structured shape of a proposal / eval doc — single source for the generator prompt (SCHEMA_INSTRUCTION),
// the export renderer (docToMarkdown), and the quality gate (validateDoc). The prose that STEERS the output
// (instructions / rubric / exemplars) lives in the editable proposal_config table, NOT here.

export const COVERAGE_STATUSES = [
  'Confirmed pain',
  'Discussed - unclear',
  'Not yet discussed',
  'Inferred',
  'Confirmed not relevant',
];

// The exact JSON the model must emit. Kept terse but unambiguous.
export const SCHEMA_INSTRUCTION = `Return ONLY valid JSON in exactly this shape (no markdown, no commentary):
{
  "versionLog": [ { "version": <int>, "changed": "<one line: what changed vs the prior version>" } ],
  "section1_deckReady": [
    {
      "area": "<business area id>",
      "label": "<human label>",
      "painRank": <int, 1 = most pain>,
      "currentState": ["<bullet, ~10-15 words>", ...],
      "problems": ["<the problem it causes, ~10-15 words>", ...],
      "quote": { "text": "<verbatim from a transcript>", "speaker": "<name>", "call": "<call name/date>", "timestamp": "<mm:ss or null>" },
      "idealStateWithBanner": ["<with-Banner bullet>", ...]
    }
  ],
  "dealSummary": "<4-6 sentence exec paragraph, business-case tone>",
  "roiSnapshot": [
    {
      "area": "<id>", "label": "<label>",
      "estimate": "<$X/yr or X hrs/yr, or null>",
      "assumptions": ["<explicit assumption>", ...],
      "questionsToSharpen": ["<question>", ...],
      "notQuantifiable": <true if no ROI data yet>
    }
  ],
  "voiceOfCustomer": [
    { "area": "<id>", "label": "<label>", "quotes": [ { "text": "<verbatim>", "speaker": "<name>", "call": "<call>", "timestamp": "<mm:ss or null>" } ] }
  ],
  "section2_repWorking": {
    "coverageMap": [ { "area": "<id or inferred name>", "label": "<label>", "status": "<one of: ${COVERAGE_STATUSES.join(' | ')}>", "confidence": "High|Medium|Low", "notes": "<brief>" } ],
    "stakeholderMap": [ { "name": "<name>", "title": "<title>", "concerns": ["<concern>", ...], "notes": "<champion/skeptic/gatekeeper etc>" } ],
    "openQuestions": { "confirmPain": ["..."], "completeRoi": ["..."], "uncoverAreas": ["..."], "advanceDeal": ["..."] },
    "dealHealth": { "confirmedPains": ["..."], "stillUnqualified": ["..."], "keyNextStep": "<specific>", "risks": ["..."] }
  }
}
- section1_deckReady: only areas with confirmed/expressed pain, ordered by painRank (1 first). Omit irrelevant + not-yet-discussed here.
- coverageMap: include EVERY process-review-list area plus any inferred, sorted in the status order above.
- Every quote must be copied verbatim from a provided transcript. Use "timestamp": null when the transcript line has no timestamp.`;

// Deterministic markdown render of the structured doc — used for export + the account_proposals.markdown column.
export function docToMarkdown(doc, accountName = '') {
  if (!doc || typeof doc !== 'object') return '';
  const L = [];
  const bullets = (arr) => (arr || []).map((b) => `- ${b}`).join('\n');
  const q = (x) => (x ? `"${x.text}" — ${x.speaker || 'Unknown'}, ${x.call || 'call'}${x.timestamp ? `, ${x.timestamp}` : ''}` : '');

  if (accountName) L.push(`# ${accountName} — Proposal / Eval Doc\n`);

  const vl = doc.versionLog?.[0];
  if (vl) L.push(`_Updated v${vl.version}: ${vl.changed}_\n`);

  L.push('## Deck-Ready Copy\n');
  for (const a of (doc.section1_deckReady || [])) {
    L.push(`### ${a.label}`);
    if (a.currentState?.length) L.push(bullets(a.currentState));
    if (a.problems?.length) L.push(bullets(a.problems));
    if (a.quote?.text) L.push(`\n> ${q(a.quote)}`);
    L.push('\n→\n');
    if (a.idealStateWithBanner?.length) L.push(bullets(a.idealStateWithBanner));
    L.push('');
  }

  if (doc.dealSummary) { L.push('## Deal Summary\n'); L.push(doc.dealSummary + '\n'); }

  if (doc.roiSnapshot?.length) {
    L.push('## ROI Snapshot\n');
    for (const r of doc.roiSnapshot) {
      L.push(`**${r.label}**`);
      if (r.notQuantifiable) L.push('- ROI not yet quantifiable — see questions below');
      else if (r.estimate) L.push(`- Estimate: ${r.estimate}`);
      if (r.assumptions?.length) L.push(`- Assumptions: ${r.assumptions.join('; ')}`);
      if (r.questionsToSharpen?.length) L.push(`- To sharpen, ask: ${r.questionsToSharpen.join(' ')}`);
      L.push('');
    }
  }

  if (doc.voiceOfCustomer?.length) {
    L.push('## Voice of Customer\n');
    for (const v of doc.voiceOfCustomer) {
      L.push(`**${v.label}**`);
      for (const quote of (v.quotes || [])) L.push(`- ${q(quote)}`);
      L.push('');
    }
  }

  const rw = doc.section2_repWorking;
  if (rw) {
    L.push('---\n## Rep Working (internal — do not share)\n');
    if (rw.coverageMap?.length) {
      L.push('### Process Coverage Map\n');
      L.push('| Area | Status | Confidence | Notes |');
      L.push('|---|---|---|---|');
      for (const c of rw.coverageMap) L.push(`| ${c.label} | ${c.status} | ${c.confidence || ''} | ${(c.notes || '').replace(/\|/g, '/')} |`);
      L.push('');
    }
    if (rw.stakeholderMap?.length) {
      L.push('### Stakeholder Map\n');
      for (const s of rw.stakeholderMap) L.push(`- **${s.name}** (${s.title || '—'}) — ${(s.concerns || []).join('; ')}${s.notes ? ` _(${s.notes})_` : ''}`);
      L.push('');
    }
    if (rw.openQuestions) {
      L.push('### Open Questions\n');
      const oq = rw.openQuestions;
      const grp = (t, arr) => { if (arr?.length) { L.push(`_${t}_`); L.push(bullets(arr)); } };
      grp('To confirm/deepen pain', oq.confirmPain);
      grp('To complete ROI', oq.completeRoi);
      grp('To uncover process areas', oq.uncoverAreas);
      grp('To advance the deal', oq.advanceDeal);
      L.push('');
    }
    if (rw.dealHealth) {
      const dh = rw.dealHealth;
      L.push('### Deal Health\n');
      if (dh.confirmedPains?.length) L.push(`- Confirmed pains: ${dh.confirmedPains.join(', ')}`);
      if (dh.stillUnqualified?.length) L.push(`- Still unqualified: ${dh.stillUnqualified.join(', ')}`);
      if (dh.keyNextStep) L.push(`- Key next step: ${dh.keyNextStep}`);
      if (dh.risks?.length) L.push(`- Risks: ${dh.risks.join(' ')}`);
    }
  }

  return L.join('\n');
}

// Light structural validation for the quality gate (not faithfulness — that's the quote check in the endpoint).
export function validateDoc(doc, businessAreaIds = []) {
  const issues = [];
  if (!doc || typeof doc !== 'object') return { ok: false, issues: ['doc is not an object'] };
  if (!Array.isArray(doc.section1_deckReady) || doc.section1_deckReady.length === 0) issues.push('section1_deckReady empty');
  if (!doc.dealSummary) issues.push('dealSummary missing');
  if (!doc.section2_repWorking?.coverageMap?.length) issues.push('coverageMap missing');
  if (businessAreaIds.length) {
    const covered = new Set((doc.section2_repWorking?.coverageMap || []).map((c) => c.area));
    const missing = businessAreaIds.filter((id) => !covered.has(id));
    if (missing.length) issues.push(`coverageMap missing areas: ${missing.join(', ')}`);
  }
  return { ok: issues.length === 0, issues };
}
