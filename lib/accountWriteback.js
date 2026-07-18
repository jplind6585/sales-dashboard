// Account write-back — the North Star "output (a)" that was never built (PLATFORM_REVIEW §1.8/§2.2).
// The Gong engine analyzes every call but never wrote MEDDICC/stakeholders/gaps back to the account,
// so reps hand-entered them and accounts.meddicc (read by ~9 generators) was always empty. This
// persists the engine's per-call extraction onto the account. Best-effort — never throws into the
// analysis path. Merges conservatively so manual edits are never clobbered.
import { STAKEHOLDER_ROLES } from './constants';

const VALID_ROLES = new Set(STAKEHOLDER_ROLES.map((r) => r.value));
const MEDDIC_KEYS = ['metrics', 'economic_buyer', 'decision_criteria', 'decision_process', 'identify_pain', 'champion', 'competition'];
const isBlank = (v) => {
  const s = typeof v === 'string' ? v.trim() : v?.value ? String(v.value) : '';
  return !s || ['unknown', 'none', 'n/a', 'null'].includes(s.toLowerCase());
};

export async function writeBackFromAnalysis(db, accountId, analysis) {
  if (!db || !accountId || !analysis) return;
  try {
    // 1) MEDDICC → accounts.meddicc. Prefer the model's emitted meddicc, fall back to the flat
    //    fields it already produces. Only fill keys that are currently empty (manual wins).
    const emitted = analysis.meddicc || {};
    const synth = {
      identify_pain: analysis.pain_depth_notes || null,
      champion: analysis.champion_health_notes || null,
      competition: (analysis.competitor_mentions || []).map((c) => (typeof c === 'string' ? c : c?.name)).filter(Boolean).join(', ') || null,
    };
    const { data: acct } = await db.from('accounts').select('meddicc').eq('id', accountId).maybeSingle();
    const existing = (acct && acct.meddicc) || {};
    const merged = { ...existing };
    let changed = false;
    for (const k of MEDDIC_KEYS) {
      if (!isBlank(existing[k])) continue;
      const val = !isBlank(emitted[k]) ? String(emitted[k]).trim() : synth[k];
      if (val && !isBlank(val)) { merged[k] = val; changed = true; }
    }
    if (changed) await db.from('accounts').update({ meddicc: merged }).eq('id', accountId);

    // 2) Stakeholders → upsert by (account_id, name). New names inserted; known names get title/role
    //    filled only if missing (don't overwrite a human-set role).
    for (const s of (analysis.stakeholders || []).slice(0, 8)) {
      const name = (s?.name || '').trim();
      if (!name || name.length < 2) continue;
      let role = VALID_ROLES.has(s.role) ? s.role : null;
      if (!role && s.is_champion) role = 'Champion'; // champion is captured via role (no is_champion column)
      const { data: ex } = await db.from('stakeholders').select('id, title, role').eq('account_id', accountId).ilike('name', name).maybeSingle();
      if (ex?.id) {
        const patch = {};
        if (!ex.title && s.title) patch.title = s.title;
        if (!ex.role && role) patch.role = role;
        if (Object.keys(patch).length) await db.from('stakeholders').update(patch).eq('id', ex.id);
      } else {
        await db.from('stakeholders').insert({ account_id: accountId, name, title: s.title || null, role });
      }
    }

    // 3) Information gaps → insert new open questions (dedup by question text).
    const gaps = (analysis.information_gaps || []).slice(0, 6);
    if (gaps.length) {
      const { data: exGaps } = await db.from('information_gaps').select('question').eq('account_id', accountId);
      const seen = new Set((exGaps || []).map((g) => (g.question || '').toLowerCase().trim()));
      const toInsert = gaps
        .map((g) => ({ question: (typeof g === 'string' ? g : g?.question) || '', category: (typeof g === 'object' ? g?.category : null) || 'other', status: 'open', account_id: accountId }))
        .filter((g) => g.question.length > 5 && !seen.has(g.question.toLowerCase().trim()));
      if (toInsert.length) await db.from('information_gaps').insert(toInsert);
    }
  } catch (e) {
    console.error('[accountWriteback] failed for', accountId, e.message);
  }
}
