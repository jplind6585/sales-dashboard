// The fact graph read/write API (spec 01). Single entry point every module uses. Runs in-app (getSupabase
// service role). Reads resolve the current best value with provenance; writes run synchronous conflict
// detection. During backfill, conflicts are LOGGED to fact_conflicts_log, not turned into tasks
// (James chose suppress + summarize); the forward path can be switched to task-creation later.
import { getSupabase } from '../supabase';
import { normalize } from './facts/normalize';

let _schema = null, _schemaAt = 0;
async function schemaMap() {
  if (_schema && Date.now() - _schemaAt < 300000) return _schema;
  const { data } = await getSupabase().from('attribute_schema').select('*').eq('is_active', true);
  _schema = Object.fromEntries((data || []).map((a) => [a.key, a]));
  _schemaAt = Date.now();
  return _schema;
}

const shape = (f, status, alternatives = null) => ({
  value: f ? f.value : null,
  status,
  confidence: f?.confidence ?? null,
  source: f ? { type: f.source_type, id: f.source_id, speaker_id: f.source_speaker_id, captured_at: f.captured_at, excerpt: f.source_excerpt } : null,
  last_confirmed_at: f?.last_confirmed_at ?? null,
  confirmation_count: f?.confirmation_count ?? 0,
  fact_id: f?.id ?? null,
  alternatives,
});

function resolve(facts, attr) {
  const active = facts.filter((f) => f.status === 'active');
  const adminF = facts.find((f) => f.status === 'admin_resolved');
  if (adminF) return shape(adminF, 'admin_resolved');
  if (attr?.multi_value_allowed && active.length) return { ...shape(active[0], 'active'), value: active.map((f) => f.value) };
  if (active.length > 1) {
    const sorted = active.slice().sort((a, b) => (b.confidence || 0) - (a.confidence || 0));
    return shape(sorted[0], 'disputed', sorted.slice(1).map((f) => ({ value: f.value, source: f.source_type, confidence: f.confidence })));
  }
  if (active.length === 1) return shape(active[0], 'active');
  const nr = facts.filter((f) => f.status === 'needs_reconfirmation').sort((a, b) => new Date(b.captured_at) - new Date(a.captured_at));
  if (nr.length) return shape(nr[0], 'needs_reconfirmation');
  return shape(null, 'unknown');
}

async function readAttr(table, idCol, id, attributeKey) {
  const schema = await schemaMap();
  const { data } = await getSupabase().from(table).select('*').eq(idCol, id).eq('attribute_key', attributeKey)
    .in('status', ['active', 'admin_resolved', 'needs_reconfirmation', 'disputed']);
  return resolve(data || [], schema[attributeKey]);
}
async function readByCategory(table, idCol, id, category) {
  const schema = await schemaMap();
  const keys = Object.values(schema).filter((a) => a.category === category).map((a) => a.key);
  if (!keys.length) return {};
  const { data } = await getSupabase().from(table).select('*').eq(idCol, id).in('attribute_key', keys)
    .in('status', ['active', 'admin_resolved', 'needs_reconfirmation', 'disputed']);
  const byKey = {};
  for (const f of (data || [])) (byKey[f.attribute_key] ||= []).push(f);
  const out = {};
  for (const k of keys) out[k] = resolve(byKey[k] || [], schema[k]);
  return out;
}

export const getAccountAttribute = (accountId, key) => readAttr('account_facts', 'account_id', accountId, key);
export const getAccountAttributesByCategory = (accountId, category) => readByCategory('account_facts', 'account_id', accountId, category);
export const getStakeholderAttribute = (stakeholderId, key) => readAttr('stakeholder_facts', 'stakeholder_id', stakeholderId, key);
export const getStakeholderAttributesByCategory = (stakeholderId, category) => readByCategory('stakeholder_facts', 'stakeholder_id', stakeholderId, category);

export async function getAccountFactHistory(accountId, key) {
  const { data } = await getSupabase().from('account_facts').select('*').eq('account_id', accountId).eq('attribute_key', key).order('captured_at', { ascending: false });
  return data || [];
}

async function propose(table, idCol, input, opts = {}) {
  const db = getSupabase();
  const schema = await schemaMap();
  const attr = schema[input.attribute_key];
  if (!attr) return { error: 'unknown_attribute', attribute_key: input.attribute_key }; // caller should propose schema instead
  const normalized_value = normalize(attr.value_type, input.value);
  const row = {
    [idCol]: input.entity_id, attribute_key: input.attribute_key, value: input.value, normalized_value,
    source_type: input.source_type, source_id: input.source_id || null, source_speaker_id: input.source_speaker_id || null,
    source_excerpt: input.source_excerpt || null, captured_at: input.captured_at || new Date().toISOString(),
    captured_by: input.captured_by || null, confidence: input.confidence ?? null, status: 'active', last_confirmed_at: input.captured_at || new Date().toISOString(),
  };

  if (input.bypass_conflict_detection) {
    const { data } = await db.from(table).insert({ ...row, status: 'admin_resolved' }).select('id').maybeSingle();
    return { fact_id: data?.id, status: 'admin_resolved' };
  }

  const { data: existing } = await db.from(table).select('id, normalized_value, confidence, last_confirmed_at, confirmation_count').eq(idCol, input.entity_id).eq('attribute_key', input.attribute_key).eq('status', 'active');
  const same = (existing || []).find((f) => f.normalized_value === normalized_value && normalized_value !== '');

  // Same value re-asserted: bump confirmation, do not duplicate.
  if (same) {
    await db.from(table).update({ last_confirmed_at: row.last_confirmed_at, confirmation_count: (same.confirmation_count || 1) + 1 }).eq('id', same.id);
    return { fact_id: same.id, status: 'active', confirmed: true };
  }
  // Multi-value, or no existing active: insert as active (no conflict).
  if (attr.multi_value_allowed || !(existing || []).length) {
    const { data } = await db.from(table).insert(row).select('id').maybeSingle();
    return { fact_id: data?.id, status: 'active' };
  }
  // Single-value conflict. No resolution rules seeded yet -> mark disputed + LOG (suppress task per backfill mode).
  const { data: inserted } = await db.from(table).insert({ ...row, status: 'disputed' }).select('id').maybeSingle();
  await db.from(table).update({ status: 'disputed' }).in('id', (existing || []).map((f) => f.id));
  await db.from('fact_conflicts_log').insert({
    entity_type: idCol === 'account_id' ? 'account' : 'stakeholder', entity_id: input.entity_id, attribute_key: input.attribute_key,
    values: [{ value: input.value, source: input.source_type, confidence: input.confidence }, ...(existing || []).map((f) => ({ fact_id: f.id }))],
  });
  // opts.onConflictTask lets the forward path create a validation task; backfill leaves it null.
  if (opts.onConflictTask) await opts.onConflictTask({ entity_id: input.entity_id, attribute_key: input.attribute_key, fact_ids: [inserted?.id, ...(existing || []).map((f) => f.id)] });
  return { fact_id: inserted?.id, status: 'disputed' };
}

export const proposeAccountFact = (input, opts) => propose('account_facts', 'account_id', input, opts);
export const proposeStakeholderFact = (input, opts) => propose('stakeholder_facts', 'stakeholder_id', input, opts);

export async function proposeAttributeSchema(input) {
  const { data } = await getSupabase().from('attribute_schema_proposals').insert({
    proposed_key: input.proposed_key, entity_type: input.entity_type, category: input.category || null, value_type: input.value_type || null,
    example_value: input.example_value || null, example_excerpt: input.example_excerpt || null, rationale: input.rationale || null,
  }).select('id').maybeSingle();
  return { proposal_id: data?.id };
}
