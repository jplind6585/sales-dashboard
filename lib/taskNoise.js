// Shared low-signal task heuristic — the same rules the Gong extraction gate uses
// (pages/api/gong/intel-analyze.js), so the "clear the noise" action can retroactively flag tasks
// that were created BEFORE the gate existed (in-call demo narration, generic boilerplate).
// Kept deliberately high-precision: a task with a concrete deliverable survives.
const LOW_SIGNAL_PATTERNS = [
  /^(rep\s+)?(will\s+)?(follow[\s-]?up|circle back|check in|touch base|keep\s+.*\s+posted|stay in touch|reach out|be in touch)\.?$/i,
  /^(rep\s+)?(will\s+)?(send|share)\s+(the\s+|over\s+|some\s+)?(deck|info(rmation)?|details?|materials?|stuff)\.?$/i,
]
const IN_CALL_NARRATION = [
  /\b(in a (sec|second|minute|bit)|as we go|right (here|now|there)|over (here|there)|down here|up here|for a (sec|second)|real quick)\b/i,
  /\b(come back to|get\s+(?:\w+\s+){0,2}into|jump\s+(?:back\s+)?into|circle back to|show|walk through|pull up|open|close|scroll|expand|collapse|dive into)\b\s+(that|this|it|these|those|everything|here|there|one|(?:the\s+)?(?:\w+\s+){0,4}(?:bidding|workflow|workflows|feature|features|screen|tab|page|section|part|piece|options?|settings?|report|dashboard))\b/i,
  /^\s*(i'?ll|i will|i can|i'?m going to|i am going to|let me|let'?s)\s+[\w\s]{0,20}\b(that|this|it|one|these|those|here|there)\s*\.?$/i,
]

export function isLowSignalTitle(title) {
  const s = (title || '').trim()
  const core = s.replace(/^(rep|i)\s+(will|to|'ll|am going to|going to)\s+/i, '').trim()
  if (core.length < 12) return true
  if (LOW_SIGNAL_PATTERNS.some((re) => re.test(s))) return true
  return IN_CALL_NARRATION.some((re) => re.test(s))
}
