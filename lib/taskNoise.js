// Shared task-extraction heuristics — the single source of truth used by every Gong→task path
// (intel-analyze auto-creation, the "From Recent Calls" feed, and the retroactive "clear noise"
// action). Kept high-precision: a step with a concrete deliverable survives.

// Steps whose subject is the prospect, not the rep — never a rep's own to-do.
export const PROSPECT_STEP_PREFIXES = [
  'prospect to ', 'customer to ', 'client to ', 'they will ', 'they to ',
  'implied:', 'implicit:', 'no explicit', 'conditional on', 'if ',
]

export function isProspectStep(step) {
  const lower = (step || '').toLowerCase().trim()
  if (PROSPECT_STEP_PREFIXES.some(p => lower.startsWith(p))) return true
  // First-person ("I'll send the deck", "we'll follow up") is the REP's own action, not the prospect's.
  if (/^(i|we|i'?ll|we'?ll|i'?m|let me|let'?s)\b/.test(lower)) return false
  // A third-party subject + "to/will" ("Todd to review", "they will send it") is prospect-owned.
  if (/^[a-z]+ (to |will )/.test(lower) && !lower.startsWith('rep ')) return true
  return false
}

export function isRepOwnedStep(step) {
  if (!step || step.trim().length < 10) return false
  return !isProspectStep(step)
}

// Rejects a step only when the WHOLE thing is generic boilerplate with no specific deliverable
// (conservative — anything with a concrete object survives).
const LOW_SIGNAL_PATTERNS = [
  /^(rep\s+)?(will\s+)?(follow[\s-]?up|circle back|check in|touch base|keep\s+.*\s+posted|stay in touch|reach out|be in touch)\.?$/i,
  /^(rep\s+)?(will\s+)?(send|share)\s+(the\s+|over\s+|some\s+)?(deck|info(rmation)?|details?|materials?|stuff)\.?$/i,
]
// In-call demo narration ("I'll show that", "come back to that in a second", "open this one"): the
// model extracts these as commitments because they start with "I'll", but they are the rep narrating
// the live demo, not a post-call deliverable. High-precision so real deliverables survive.
const IN_CALL_NARRATION = [
  /\b(in a (sec|second|minute|bit)|as we go|right (here|now|there)|over (here|there)|down here|up here|for a (sec|second)|real quick)\b/i,
  /\b(come back to|get\s+(?:\w+\s+){0,2}into|jump\s+(?:back\s+)?into|circle back to|show|walk through|pull up|open|close|scroll|expand|collapse|dive into)\b\s+(that|this|it|these|those|everything|here|there|one|(?:the\s+)?(?:\w+\s+){0,4}(?:bidding|workflow|workflows|feature|features|screen|tab|page|section|part|piece|options?|settings?|report|dashboard))\b/i,
  /^\s*(i'?ll|i will|i can|i'?m going to|i am going to|let me|let'?s)\s+[\w\s]{0,20}\b(that|this|it|one|these|those|here|there)\s*\.?$/i,
]

export function isLowSignalStep(step) {
  const s = (step || '').trim()
  const core = s.replace(/^(rep|i)\s+(will|to|'ll|am going to|going to)\s+/i, '').trim()
  if (core.length < 12) return true
  if (LOW_SIGNAL_PATTERNS.some(re => re.test(s))) return true
  return IN_CALL_NARRATION.some(re => re.test(s))
}

// Backward-compatible alias (the retroactive "clear noise" backlog action imports this name).
export const isLowSignalTitle = isLowSignalStep

export const normStep = (s) => (s || '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim()

// Turn a raw extracted step into a clean task title: drop the "Rep will / I'll / to " lead-in and capitalize.
export const cleanStepTitle = (s) => {
  const t = (s || '').replace(/^(rep|i|we)\s+(to\s+|will\s+|'ll\s+|should\s+|am going to\s+|going to\s+)?/i, '').replace(/^to\s+/i, '').trim()
  return t ? t.charAt(0).toUpperCase() + t.slice(1) : (s || '')
}

// Token set for one step (words > 2 chars), for Jaccard comparison.
const tokenSet = (s) => new Set(normStep(s).split(' ').filter(w => w.length > 2))

// Jaccard overlap of two token sets.
export function tokenOverlap(aToks, bToks) {
  if (!aToks.size || !bToks.size) return 0
  const inter = [...aToks].filter(t => bToks.has(t)).length
  const uni = new Set([...aToks, ...bToks]).size
  return uni > 0 ? inter / uni : 0
}

// Drop near-identical steps within one set (the "Rep will keep Todd posted" ×5 problem) via
// token-Jaccard ≥ threshold. Keeps the first occurrence.
export function dedupSteps(steps, threshold = 0.8) {
  const out = [], seen = []
  for (const s of steps) {
    const toks = tokenSet(s)
    if (!toks.size) continue
    if (seen.some(prev => tokenOverlap(toks, prev) >= threshold)) continue
    out.push(s); seen.push(toks)
  }
  return out
}
