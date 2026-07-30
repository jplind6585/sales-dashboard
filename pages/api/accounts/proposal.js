// Proposal / Eval-Doc generator (plan 2026-07-29). FRESH-from-transcripts every run — no doc-patch.
// Reads the editable global instructions (proposal_config) + per-account context, grounds on the
// SELECTED call transcripts + the 19-area floor + account context + ROI + ICP, emits the structured
// doc (lib/proposalSpec), self-critiques once, then deterministically verifies every quote against
// the source transcripts before persisting. Modes: generate | feedback | apply_instruction | config.
import crypto from 'crypto';
import { createServerSupabaseClient, getSupabase } from '../../../lib/supabase';
import { callAnthropic, parseClaudeJson, logRequest } from '../../../lib/apiUtils';
import { CLAUDE_MODELS, BUSINESS_AREAS } from '../../../lib/constants';
import { buildAccountContext } from '../../../lib/accountContext';
import { buildSalesProcessContext, getSalesProcessConfig } from '../../../lib/salesProcess';
import { computeDealValue, BANNER_BENEFITS, BANNER_PROOF } from '../../../lib/dealValue';
import { BANNER_SOLUTIONS } from '../../../lib/bannerSolutions';
import { SCHEMA_INSTRUCTION, docToMarkdown, validateDoc } from '../../../lib/proposalSpec';

const TRANSCRIPT_CHAR_CAP = 280000; // full transcripts fit Sonnet's context; the time cost is OUTPUT, not input
const MAX_VERSIONS = 12;
const AREA_IDS = BUSINESS_AREAS.map((a) => a.id);

// Long generation (an 8000-token doc, optionally a self-critique pass) — allow the full serverless budget.
export const config = { maxDuration: 300 };

const norm = (s) => (s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();

export default async function handler(req, res) {
  logRequest(req, 'accounts/proposal');
  const auth = createServerSupabaseClient(req, res);
  const { data: { user } } = await auth.auth.getUser();
  if (!user) return res.status(401).json({ error: 'Unauthorized' });
  const db = getSupabase();

  try {
    if (req.method === 'GET') {
      const { accountId } = req.query;
      if (accountId) return res.status(200).json(await loadState(db, accountId));
      return res.status(400).json({ error: 'accountId required' });
    }
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const { mode, accountId } = req.body || {};

    if (mode === 'config') return res.status(200).json({ config: await loadConfig(db) });

    if (mode === 'apply_instruction') {
      const { instructionEdit } = req.body || {};
      if (!instructionEdit) return res.status(400).json({ error: 'instructionEdit required' });
      const cfg = await applyInstructionEdit(db, instructionEdit, user.email);
      return res.status(200).json({ config: cfg });
    }

    if (!accountId) return res.status(400).json({ error: 'accountId required' });

    if (mode === 'feedback') {
      const { message } = req.body || {};
      if (!message) return res.status(400).json({ error: 'message required' });
      return res.status(200).json(await handleFeedback(db, accountId, message));
    }

    if (mode === 'generate') {
      const { callIds } = req.body || {};
      if (!Array.isArray(callIds) || callIds.length === 0) return res.status(400).json({ error: 'callIds required' });
      const out = await generate(db, accountId, callIds, user, req.body.critique === true);
      return res.status(200).json(out);
    }

    return res.status(400).json({ error: 'unknown mode' });
  } catch (e) {
    console.error('[proposal] error:', e);
    return res.status(500).json({ error: e.message || 'proposal failed' });
  }
}

async function loadConfig(db) {
  const { data } = await db.from('proposal_config').select('*').order('version', { ascending: false }).limit(1).maybeSingle();
  return data || { instructions: '', rubric: '', exemplars: [], version: 0 };
}

async function loadState(db, accountId) {
  const [{ data: proposal }, { data: messages }] = await Promise.all([
    db.from('account_proposals').select('*').eq('account_id', accountId).maybeSingle(),
    db.from('account_proposal_messages').select('role, content, metadata, created_at').eq('account_id', accountId).order('created_at', { ascending: true }).limit(60),
  ]);
  return { proposal: proposal || null, messages: messages || [] };
}

// ---- generation ------------------------------------------------------------

async function generate(db, accountId, callIds, user, wantCritique) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY not configured');

  const [pconf, { account, contextText }, acctRow, callRows, salesConfig, { data: existing }] = await Promise.all([
    loadConfig(db),
    buildAccountContext(db, accountId),
    db.from('accounts').select('id, name, stage, deal_value, metrics').eq('id', accountId).single().then((r) => r.data),
    db.from('gong_call_analyses')
      .select('gong_call_id, title, call_date, rep_name, transcript_text, analysis')
      .eq('account_id', accountId).in('gong_call_id', callIds)
      .order('call_date', { ascending: true }),
    getSalesProcessConfig(),
    db.from('account_proposals').select('*').eq('account_id', accountId).maybeSingle().then((r) => r),
  ]);

  const calls = (callRows.data || []).filter((c) => c.transcript_text && c.transcript_text.length > 40);
  if (calls.length === 0) throw new Error('No transcripts found for the selected calls');

  // Build the fenced transcript block (per-call titled), capped.
  let used = 0;
  const blocks = [];
  for (const c of calls) {
    const header = `### CALL: ${c.title || 'Untitled'} (${String(c.call_date || '').slice(0, 10)}${c.rep_name ? `, rep ${c.rep_name}` : ''})`;
    let body = c.transcript_text;
    if (used + body.length > TRANSCRIPT_CHAR_CAP) body = body.slice(0, Math.max(0, TRANSCRIPT_CHAR_CAP - used));
    used += body.length;
    blocks.push(`${header}\n<transcript>\n${body}\n</transcript>`);
    if (used >= TRANSCRIPT_CHAR_CAP) break;
  }
  const transcriptBlock = blocks.join('\n\n');
  const combinedTranscript = norm(calls.map((c) => c.transcript_text).join(' \n '));

  // Reference inputs.
  const processReviewList = BUSINESS_AREAS.map((a) => `- ${a.id} — ${a.label}: ${a.description}${BANNER_SOLUTIONS[a.id] ? ` | with Banner: ${BANNER_SOLUTIONS[a.id].join('; ')}` : ''}`).join('\n');
  const dv = computeDealValue(acctRow || {});
  const roiBlock = [
    dv.hasData ? `Grounded value lines (from this account's metrics): ${dv.lines.map((l) => `${l.label} ~$${l.value.toLocaleString()}/yr (${l.detail})`).join(' | ')}` : 'No grounded metric-based ROI available yet — mark ROI [NEEDS INPUT] where metrics are missing.',
    `Qualitative benefits: ${BANNER_BENEFITS.map((b) => `${b.title} — ${b.detail}`).join(' | ')}`,
    `Proof customers: ${BANNER_PROOF.join(', ')}`,
    'Default labor rate $40/hr unless a metric provides otherwise.',
  ].join('\n');
  const icpBlock = salesConfig ? buildSalesProcessContext(salesConfig) : '';
  const dealContext = existing?.account_context ? `\n\nDEAL-SPECIFIC CONTEXT (authoritative — overrides transcript inference):\n${existing.account_context}` : '';
  const priorVersion = existing?.version || 0;

  const grounding = `ACCOUNT: ${account?.name || acctRow?.name || 'Unknown'} | stage: ${account?.stage || '?'}

=== SELECTED CALL TRANSCRIPTS (quote ONLY from inside these; timestamps appear as (mm:ss) when present) ===
${transcriptBlock}

=== PROCESS REVIEW LIST (the floor — cover every one in the coverage map; surface inferred areas too) ===
${processReviewList}

=== ACCOUNT CONTEXT (stakeholders, tasks, gaps, MEDDIC, notes) ===
${contextText}

=== ROI GUIDANCE ===
${roiBlock}

=== ICP / SALES PROCESS ===
${icpBlock}${dealContext}`;

  // Split into two PARALLEL generations so neither truncates at the output-token cap: (A) the
  // champion-facing deck copy + summary + ROI + quotes; (B) the internal rep-working section (19-area
  // coverage map + stakeholders + questions + deal health). Same grounding for both; merged below.
  const askDeck = `${pconf.instructions}

=== OUTPUT OVERRIDE FOR THIS REQUEST (obey exactly, overrides any "output all sections" instruction above) ===
Produce ONLY a JSON object with these top-level keys: versionLog, section1_deckReady, dealSummary, roiSnapshot, voiceOfCustomer.
Do NOT include section2_repWorking or any other key — the rep-working section is generated in a SEPARATE request, so omitting it here is required. Set versionLog[0].version = ${priorVersion + 1} (describe what changed, or "Initial build" if ${priorVersion} is 0).
Schema (emit only the keys listed above):
${SCHEMA_INSTRUCTION}`;
  const askWorking = `${pconf.instructions}

=== OUTPUT OVERRIDE FOR THIS REQUEST (obey exactly, overrides any "output all sections" instruction above) ===
Produce ONLY a JSON object with the SINGLE top-level key: section2_repWorking.
Do NOT include section1_deckReady, dealSummary, roiSnapshot, voiceOfCustomer, or versionLog — those are generated in a SEPARATE request, so omitting them here is required.
coverageMap MUST include every one of these ${AREA_IDS.length} process areas (plus any inferred you surface): ${AREA_IDS.join(', ')}.
Schema (emit only section2_repWorking):
${SCHEMA_INSTRUCTION}`;

  const [deckRaw, workRaw] = await Promise.all([
    callAnthropic(apiKey, { model: CLAUDE_MODELS.SONNET, maxTokens: 12000, temperature: 0.3, system: askDeck, messages: [{ role: 'user', content: grounding }] }),
    callAnthropic(apiKey, { model: CLAUDE_MODELS.SONNET, maxTokens: 12000, temperature: 0.2, system: askWorking, messages: [{ role: 'user', content: grounding }] }),
  ]);
  const deck = parseClaudeJson(deckRaw, null);
  const work = parseClaudeJson(workRaw, null);
  const bad = (o) => !o || o.parseError || typeof o !== 'object';
  if (bad(deck) && bad(work)) {
    return { error: 'parse_failed', _raw: {
      deckLen: (deckRaw || '').length, workLen: (workRaw || '').length,
      deckErr: deck?.parseError, workErr: work?.parseError,
      deckHead: (deckRaw || '').slice(0, 120), deckTail: (deckRaw || '').slice(-200),
      workTail: (workRaw || '').slice(-200),
    } };
  }
  let doc = {
    versionLog: (!bad(deck) && deck.versionLog) || [{ version: priorVersion + 1, changed: priorVersion ? 'Regenerated' : 'Initial build' }],
    section1_deckReady: (!bad(deck) && deck.section1_deckReady) || [],
    dealSummary: (!bad(deck) && deck.dealSummary) || '',
    roiSnapshot: (!bad(deck) && deck.roiSnapshot) || [],
    voiceOfCustomer: (!bad(deck) && deck.voiceOfCustomer) || [],
    section2_repWorking: (!bad(work) && work.section2_repWorking) || {},
  };

  // Self-critique pass — grade against the rubric + fix, return the full revised doc. Opt-in
  // (req.body.critique): it doubles generation time, so the interactive path runs one pass by default.
  if (wantCritique && pconf.rubric) {
    try {
      const critiqued = parseClaudeJson(await callAnthropic(apiKey, {
        model: CLAUDE_MODELS.SONNET, maxTokens: 8000, temperature: 0,
        system: `You are a strict editor. Grade the DRAFT against the checklist and return the FULL corrected doc as JSON in the same schema. Fix every violation. Do not add facts or quotes not present in the draft. Return ONLY JSON.\n\nCHECKLIST:\n${pconf.rubric}\n\n${SCHEMA_INSTRUCTION}`,
        messages: [{ role: 'user', content: `DRAFT:\n${JSON.stringify(doc)}` }],
      }), null);
      if (critiqued && Array.isArray(critiqued.section1_deckReady)) doc = critiqued;
    } catch (e) { /* keep the draft if critique fails */ }
  }

  // Deterministic quote verification — every quote must appear (normalized) in the selected transcripts.
  // Verbatim check: a 40-char normalized window of the quote must appear in a selected transcript.
  // Unverified quotes are FLAGGED (not dropped) so nothing is lost; the UI shows an amber note.
  const verify = (qt) => {
    if (!qt || !qt.text) return false;
    const n = norm(qt.text);
    return combinedTranscript.includes(n.slice(0, 40)) || (n.length > 70 && combinedTranscript.includes(n.slice(25, 70)));
  };
  let flagged = 0;
  for (const a of (doc.section1_deckReady || [])) {
    if (a.quote && !verify(a.quote)) { a.quote = { ...a.quote, unverified: true }; flagged++; }
  }
  for (const v of (doc.voiceOfCustomer || [])) {
    v.quotes = (v.quotes || []).map((qt) => verify(qt) ? qt : (flagged++, { ...qt, unverified: true }));
  }

  const gate = validateDoc(doc, AREA_IDS);
  const markdown = docToMarkdown(doc, account?.name || acctRow?.name || '');
  const changeSummary = doc.versionLog?.[0]?.changed || 'Regenerated';

  // Persist — push prior into versions[], version++.
  const nextVersion = priorVersion + 1;
  const priorVersions = Array.isArray(existing?.versions) ? existing.versions : [];
  if (existing?.content) priorVersions.push({ version: priorVersion, content: existing.content, transcript_ids: existing.transcript_ids, change_summary: existing.content?.versionLog?.[0]?.changed || null });
  const versions = priorVersions.slice(-MAX_VERSIONS);

  const row = {
    account_id: accountId, content: doc, markdown, transcript_ids: callIds,
    account_context: existing?.account_context || null, version: nextVersion, versions,
    source_call_count: calls.length, created_by: user.email, updated_at: new Date().toISOString(),
  };
  await db.from('account_proposals').upsert(row, { onConflict: 'account_id' });
  await db.from('account_proposal_messages').insert({ account_id: accountId, role: 'assistant', content: changeSummary, metadata: { doc_version: nextVersion, flagged_quotes: flagged, gate_issues: gate.issues } });

  return { proposal: { ...row, versions }, gate, flaggedQuotes: flagged,
    _debug: { deckLen: (deckRaw || '').length, workLen: (workRaw || '').length, deckOk: !bad(deck), workOk: !bad(work), deckErr: deck?.parseError, workErr: work?.parseError } };
}

// ---- feedback classification ----------------------------------------------

async function handleFeedback(db, accountId, message) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY not configured');

  await db.from('account_proposal_messages').insert({ account_id: accountId, role: 'user', content: message });

  const cls = parseClaudeJson(await callAnthropic(apiKey, {
    model: CLAUDE_MODELS.HAIKU, maxTokens: 500, temperature: 0,
    system: `Classify feedback on a generated proposal/eval doc. Return ONLY JSON:
{"scope":"systemic"|"deal_specific","instruction_edit":"<if systemic: one imperative rule to append to the GLOBAL instructions, else null>","context_note":"<if deal_specific: restate as an authoritative fact/priority about THIS account, else null>"}
- systemic = a rule for ALL future docs (formatting, ordering, what to include/exclude, tone).
- deal_specific = a fact or priority about THIS one account (e.g. "invoicing is their #1 pain", "the economic buyer is the CFO").`,
    messages: [{ role: 'user', content: message }],
  }), { scope: 'deal_specific', instruction_edit: null, context_note: message });

  if (cls.scope === 'deal_specific') {
    // Append to the account's authoritative context; the client then re-runs generate.
    const { data: existing } = await db.from('account_proposals').select('account_context').eq('account_id', accountId).maybeSingle();
    const note = cls.context_note || message;
    const merged = existing?.account_context ? `${existing.account_context}\n- ${note}` : `- ${note}`;
    await db.from('account_proposals').update({ account_context: merged }).eq('account_id', accountId);
    await db.from('account_proposal_messages').insert({ account_id: accountId, role: 'system', content: `Saved as deal context: ${note}`, metadata: { scope: 'deal_specific' } });
    return { scope: 'deal_specific', contextNote: note, rerun: true };
  }
  // systemic: return the drafted instruction edit for approval (not auto-applied).
  return { scope: 'systemic', instructionEdit: cls.instruction_edit || message, rerun: false };
}

async function applyInstructionEdit(db, instructionEdit, email) {
  const cfg = await loadConfig(db);
  const instructions = `${cfg.instructions}\n- ${instructionEdit}`.trim();
  const version = (cfg.version || 0) + 1;
  await db.from('proposal_config').update({ instructions, version, updated_by: email, updated_at: new Date().toISOString() }).eq('version', cfg.version);
  await db.from('proposal_config_history').insert({ version, instructions, rubric: cfg.rubric, exemplars: cfg.exemplars, updated_by: email });
  return { ...cfg, instructions, version };
}
