// Shared follow-up email format — Banner's canonical post-call template.
// Used by BOTH the initial draft (lib/taskActions) and the Work-in-Claude chat
// (pages/api/work-in-claude) so every follow-up comes out in the same, client-ready shape.
// These emails are meant to send as-is, so the anti-AI-tell rules are hard requirements.

export function followUpEmailGuide(repName = 'AE') {
  return `Draft a post-call follow-up email in EXACTLY this structure. Fill every [bracket] from the actual call transcript. Do not invent names, priorities, attachments, or agreements. If something did not come up on the call, keep the bracket placeholder rather than guessing.

Subject: Banner Follow Up - MM/DD   (MM/DD is the call's date, e.g. 07/22)

Hi [first name],

It was great speaking with you today. Based on our conversation, I think Banner would be a strong fit for [company] based on your focus on:
- [their top priority, in their words]: [one short sentence on how Banner fits]
- [their second priority]: [one short sentence on how Banner fits]
- [their third priority, ONLY if it clearly came up and is strong]: [one short sentence on how Banner fits]

[Include ONE line here only if the rep promised to send something on the call: "I have attached [what was promised]." It can instead be pricing, or the specific questions needed to scope pricing. If nothing was promised, omit this line entirely.]

As a next step, [if a next step was agreed, restate it plainly: "we agreed on [meeting or call] on MM/DD"; if none was agreed, propose one specific next step and date]. Can you confirm that works, and should anybody else be included?

Best,
${repName}

HARD RULES (this email is sent to a client as-is, so treat these as non-negotiable):
- NEVER use em dashes or en dashes. Use commas, periods, or plain hyphens only.
- No AI-writing tells or filler. Banned phrases include: "I hope this email finds you well", "great to connect", "excited to", "circle back", "touch base", "reach out", "leverage", "seamless", "robust", "delve into", "at your earliest convenience", "happy to jump on a quick call".
- Plain, direct, human. Two or three fit bullets maximum, never more.
- Use only facts stated on the call. Keep the whole email under about 150 words.
- Output the subject line first, then the body. Nothing else, no preamble like "Here is your email".`;
}

// Deterministic guarantee: strip every em/en dash from a client-facing draft, regardless of what the
// model produced. Replaces a dash (with its surrounding spaces) with a comma, fixes doubled commas, and
// collapses runs of spaces/tabs. Newlines are preserved so email structure stays intact.
export function stripDashes(text) {
  return String(text || '')
    .replace(/[ \t]*[—–][ \t]*/g, ', ')
    .replace(/,\s*,/g, ', ')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

// Capitalize an email-prefix / first name for a signature ("james" -> "James").
export function displayName(raw = '') {
  const s = String(raw).split('@')[0].replace(/[._-]+/g, ' ').trim();
  return s ? s.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ') : 'AE';
}
