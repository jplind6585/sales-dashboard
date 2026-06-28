// taskActions — the "never start blank" engine.
//
// Every task should arrive with a pre-generated AI action the rep can adapt
// (draft-only — nothing sends without a human). This module derives the right
// KIND of action from the task's trigger/source, builds context from the
// account + call history, and asks Claude to produce the first draft. The
// Work-in-Claude window then continues the conversation from that seed.

import { callAnthropic } from './apiUtils';
import { CLAUDE_MODELS } from './constants';

// Map a task to { kind, role } — role aligns with work-in-claude's instruction set.
export function deriveTaskAction(task) {
  const st = (task.sourceType || task.source_type || '').toLowerCase();
  const tr = (task.trigger || '').toLowerCase();
  const title = (task.title || '').toLowerCase();
  const emailish = /\bemail\b|\bsend\b|follow.?up|recap|\bshare\b|forward|reply|respond/.test(title);

  if (tr === 'calendar_prep') return { kind: 'call_prep', role: 'prepare-deck' };
  if (tr === 'calendar_followup') return { kind: 'email', role: 'email-draft' };
  if (st === 'gong_commitment' || st === 'gong_next_step' || tr.startsWith('gong')) {
    return emailish ? { kind: 'email', role: 'email-draft' } : { kind: 'generic', role: 'gong-deliverable' };
  }
  if (emailish) return { kind: 'email', role: 'email-draft' };
  if (/\bprep\b|prepare|\bdeck\b|\bdemo\b/.test(title)) return { kind: 'call_prep', role: 'prepare-deck' };
  if (/\bplan\b|next step|mutual action/.test(title)) return { kind: 'plan', role: 'next-step-planner' };
  return { kind: 'generic', role: null };
}

// Role-specific drafting instructions (kept consistent with work-in-claude.js).
const ROLE_INSTRUCTIONS = {
  'prepare-deck': 'Produce a tight pre-call brief: opening recommendation, 3-4 objectives, the discovery gaps to close, and one specific ask to land at the end. Reference real things from the call history. No generic advice.',
  'email-draft': 'Draft the follow-up email. Reference specific things from the call history (not generic). Under 130 words, one clear ask at the end. No "per our conversation" / "as discussed" openings, no em dashes. Format: Subject line, then body.',
  'gong-deliverable': 'Produce the actual deliverable this task calls for (the thing the rep committed to on the call). Draft it in full — do not explain what you are about to do. Be specific to this account.',
  'next-step-planner': 'Recommend the single best next step (specific, not "schedule a meeting"), how to ask for it, and how to handle pushback. Ground it in the deal stage and MEDDIC gaps.',
};

const FIRST_ASK = {
  'prepare-deck': 'Produce the prep brief for this meeting now.',
  'email-draft': 'Draft the follow-up email now.',
  'gong-deliverable': 'Draft the deliverable for this task now.',
  'next-step-planner': 'Give me the next-step plan now.',
  default: 'Produce the first draft of what this task needs now. Be specific and ready-to-use.',
};

function buildCallContext(calls = []) {
  if (!calls.length) return '';
  return '\n\nACCOUNT CALL HISTORY (AI-analyzed Gong recordings):\n' + calls.slice(0, 6).map((c, i) => {
    const parts = [`Call ${i + 1}: "${c.title || 'Untitled'}" (${(c.date || '').slice(0, 10) || 'date unknown'})`];
    if (c.summary) parts.push(`Summary: ${String(c.summary).slice(0, 400)}`);
    if (c.painPoints?.length) parts.push(`Pain: ${c.painPoints.slice(0, 3).join(' | ')}`);
    if (c.nextSteps?.length) parts.push(`Next steps: ${c.nextSteps.slice(0, 2).join(' | ')}`);
    if (c.commitments?.length) parts.push(`Rep commitments: ${c.commitments.slice(0, 2).join(' | ')}`);
    if (c.objections?.length) parts.push(`Objections: ${c.objections.slice(0, 2).join(' | ')}`);
    return parts.join('\n');
  }).join('\n\n---\n\n');
}

// Generate the initial draft. Returns the ai_draft object, or null on failure.
export async function generateTaskDraft({ task, account = null, calls = [], repName = 'the rep' }) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;

  const { kind, role } = deriveTaskAction(task);
  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

  const system = [
    `You are a sales AI assistant for Banner (CapEx software). You produce the FIRST draft of a task's deliverable so ${repName} never starts from a blank page. Draft-only: a human reviews and sends — so make it ready to use, not a description of what you'd do.`,
    ``,
    `TASK: ${task.title || 'Untitled'}`,
    task.rationale ? `WHY IT MATTERS: ${task.rationale}` : null,
    task.description ? `CONTEXT: ${task.description}` : null,
    account?.name ? `ACCOUNT: ${account.name}${account.stage ? ` (stage: ${account.stage})` : ''}` : null,
    buildCallContext(calls) || null,
    ``,
    role ? ROLE_INSTRUCTIONS[role] : 'Produce the concrete, ready-to-use output this task needs. Be specific to the account and context. No filler.',
    ``,
    `TODAY: ${today}`,
  ].filter(Boolean).join('\n');

  const ask = FIRST_ASK[role] || FIRST_ASK.default;
  const maxTokens = role === 'prepare-deck' ? 1400 : role === 'email-draft' ? 700 : 1000;

  try {
    const content = await callAnthropic(apiKey, {
      model: CLAUDE_MODELS.SONNET,
      maxTokens,
      system,
      messages: [{ role: 'user', content: ask }],
    });
    if (!content || !content.trim()) return null;
    return {
      kind,
      role: role || 'generic',
      content: content.trim(),
      model: CLAUDE_MODELS.SONNET,
      generated_at: new Date().toISOString(),
      edited: false,
    };
  } catch (e) {
    console.error('[taskActions] generateTaskDraft failed:', e.message);
    return null;
  }
}
