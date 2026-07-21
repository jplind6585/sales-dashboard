// POST /api/assistant/execute  { actions: [resolved actions], idempotencyKey? }
// Performs user-confirmed actions server-side (service role). This endpoint is the SINGLE
// authority boundary — it re-validates every action and enforces authorization regardless
// of what the client sent (the client confirm bar can be bypassed by a hand-crafted POST).

import { createServerSupabaseClient, getSupabase } from '../../../lib/supabase';
import { apiError, apiSuccess, validateMethod, logRequest } from '../../../lib/apiUtils';
import { createTask, findTaskBySource, updateTask, dismissTask } from '../../../lib/db/tasks';
import { addNote } from '../../../lib/db/notes';
import { isExcludedRep } from '../../../lib/repConfig';
import { VERTICALS } from '../../../lib/constants';
import { pushStageToHubspot } from '../../../lib/hubspotPush';

const VALID_STAGES = new Set(['qualifying', 'intro_scheduled', 'active_pursuit', 'demo', 'solution_validation', 'proposal', 'legal', 'closed_won', 'closed_lost']);
const UPDATABLE_FIELDS = new Set(['vertical', 'tier', 'owner_name', 'close_date']);
const VALID_TIERS = new Set(['hot', 'active', 'watching', 'archived']);
const VALID_VERTICALS = new Set((VERTICALS || []).map(v => v.id));
const TEAM_CAP = 25;

function validFieldValue(field, value) {
  if (value == null) return false;
  if (field === 'tier') return VALID_TIERS.has(value);
  if (field === 'vertical') return VALID_VERTICALS.has(value);
  if (field === 'close_date') return /^\d{4}-\d{2}-\d{2}$/.test(value);
  if (field === 'owner_name') return typeof value === 'string' && value.trim().length > 0;
  return false;
}

export default async function handler(req, res) {
  logRequest(req, 'assistant/execute');
  if (!validateMethod(req, res, 'POST')) return;

  const auth = createServerSupabaseClient(req, res);
  const { data: { user } } = await auth.auth.getUser();
  if (!user) return apiError(res, 401, 'Unauthorized');

  const actions = Array.isArray(req.body?.actions) ? req.body.actions.slice(0, 30) : [];
  const idemKey = req.body?.idempotencyKey || null;
  if (!actions.length) return apiError(res, 400, 'No actions to execute');

  const db = getSupabase();
  const { data: profile } = await db.from('profiles').select('id, full_name, email, role').eq('id', user.id).maybeSingle();
  const userId = profile?.id || user.id;
  const userName = profile?.full_name || user.email;
  const isManager = ['manager','admin'].includes(profile?.role);

  // Reps may only act on accounts they own; managers on any. (acct.user_id may be null = unassigned.)
  const canTouchAccount = (acct) => isManager || !acct.user_id || acct.user_id === userId;

  const results = [];
  let idx = 0;
  for (const a of actions) {
    idx++;
    try {
      // ── Move stage ──────────────────────────────────────────────────────────
      if (a.type === 'update_account_stage') {
        if (!a.accountId || !VALID_STAGES.has(a.stage)) { results.push({ ok: false, label: a.label, error: 'invalid target' }); continue; }
        const { data: acct } = await db.from('accounts').select('stage, name, user_id').eq('id', a.accountId).maybeSingle();
        if (!acct) { results.push({ ok: false, label: a.label, error: 'account not found' }); continue; }
        if (!canTouchAccount(acct)) { results.push({ ok: false, label: a.label, error: 'not your account' }); continue; }
        const from = acct.stage || null;
        const { error: upErr } = await db.from('accounts').update({ stage: a.stage }).eq('id', a.accountId);
        if (upErr) { results.push({ ok: false, label: a.label, error: upErr.message }); continue; }
        if (from !== a.stage) {
          let daysInPrior = null;
          const { data: last } = await db.from('account_stage_history').select('changed_at').eq('account_id', a.accountId).order('changed_at', { ascending: false }).limit(1).maybeSingle();
          if (last?.changed_at) daysInPrior = Math.floor((Date.now() - new Date(last.changed_at).getTime()) / 86400000);
          await db.from('account_stage_history').insert({
            account_id: a.accountId, from_stage: from, to_stage: a.stage,
            changed_by: userId, changed_by_name: userName, days_in_prior_stage: daysInPrior,
          }).then(() => {}, () => {});
          // Two-way write-back: mirror the stage change to HubSpot (best-effort, non-blocking).
          pushStageToHubspot(db, a.accountId).then(() => {}, () => {});
        }
        results.push({ ok: true, label: a.label || `Moved ${acct.name} → ${a.stage}` });

      // ── Update a field ─────────────────────────────────────────────────────────
      } else if (a.type === 'update_account_field') {
        if (!a.accountId || !UPDATABLE_FIELDS.has(a.field) || !validFieldValue(a.field, a.value)) { results.push({ ok: false, label: a.label, error: 'invalid field or value' }); continue; }
        if (a.field === 'owner_name' && !isManager) { results.push({ ok: false, label: a.label, error: 'reassigning owner is manager-only' }); continue; }
        const { data: acct } = await db.from('accounts').select('user_id').eq('id', a.accountId).maybeSingle();
        if (!acct) { results.push({ ok: false, label: a.label, error: 'account not found' }); continue; }
        if (!canTouchAccount(acct)) { results.push({ ok: false, label: a.label, error: 'not your account' }); continue; }
        const { error } = await db.from('accounts').update({ [a.field]: a.value }).eq('id', a.accountId);
        results.push({ ok: !error, label: a.label, error: error?.message });

      // ── Create task(s) ─────────────────────────────────────────────────────────
      } else if (a.type === 'create_task') {
        if (!a.title) { results.push({ ok: false, label: a.label, error: 'missing title' }); continue; }
        const base = {
          title: a.title, accountId: a.accountId || null, dueDate: a.dueDate || null,
          priority: a.priority || 2, source: 'assistant',
          description: `Created via the assistant${a.accountName ? ` for ${a.accountName}` : ''}.`,
        };
        if (a.scope === 'team') {
          if (!isManager) { results.push({ ok: false, label: a.label, error: 'team tasks are manager-only' }); continue; }
          const sourceId = `team:${idemKey || a.title}:${new Date().toISOString().slice(0, 10)}`;
          if (await findTaskBySource('assistant', sourceId)) { results.push({ ok: true, label: a.label, detail: 'already created' }); continue; }
          const { data: team } = await db.from('profiles').select('id, full_name, email, rep_type, role');
          const recips = (team || []).filter(p =>
            (['ae', 'sdr'].includes((p.rep_type || '').toLowerCase()) || ['manager','admin'].includes(p.role)) &&
            !isExcludedRep(p.full_name) && !isExcludedRep(p.email)
          );
          if (!recips.length) { results.push({ ok: false, label: a.label, error: 'no eligible recipients' }); continue; }
          if (recips.length > TEAM_CAP) { results.push({ ok: false, label: a.label, error: `too many recipients (${recips.length})` }); continue; }
          let n = 0;
          for (const p of recips) { const { error } = await createTask(userId, { ...base, ownerId: p.id, sourceId }); if (!error) n++; }
          results.push({ ok: n > 0, label: a.label || `Team task: ${a.title}`, detail: `created for ${n}` });
        } else {
          let ownerId = userId;
          if (a.scope === 'rep') {
            if (!a.repId) { results.push({ ok: false, label: a.label, error: 'could not resolve the teammate' }); continue; }
            const { data: rep } = await db.from('profiles').select('id').eq('id', a.repId).maybeSingle();
            if (!rep) { results.push({ ok: false, label: a.label, error: 'teammate not found' }); continue; }
            ownerId = rep.id;
          }
          const sourceId = idemKey ? `asst:${idemKey}:${idx}` : null;
          if (sourceId && await findTaskBySource('assistant', sourceId)) { results.push({ ok: true, label: a.label, detail: 'already created' }); continue; }
          const { error } = await createTask(userId, { ...base, ownerId, sourceId });
          results.push({ ok: !error, label: a.label, error: error?.message });
        }

      // ── Log a note ─────────────────────────────────────────────────────────────
      } else if (a.type === 'add_account_note') {
        if (!a.accountId || !a.content) { results.push({ ok: false, label: a.label, error: 'invalid note' }); continue; }
        const { data: acct } = await db.from('accounts').select('user_id').eq('id', a.accountId).maybeSingle();
        if (!acct) { results.push({ ok: false, label: a.label, error: 'account not found' }); continue; }
        if (!canTouchAccount(acct)) { results.push({ ok: false, label: a.label, error: 'not your account' }); continue; }
        const { error } = await addNote(a.accountId, { content: a.content, category: 'Assistant' });
        results.push({ ok: !error, label: a.label, error: error?.message });

      // ── Task lifecycle (own tasks only) ─────────────────────────────────────────
      } else if (a.type === 'complete_task' || a.type === 'update_task' || a.type === 'dismiss_task') {
        if (!a.taskId) { results.push({ ok: false, label: a.label, error: 'no task' }); continue; }
        const { data: t } = await db.from('tasks').select('owner_id, title').eq('id', a.taskId).maybeSingle();
        if (!t) { results.push({ ok: false, label: a.label, error: 'task not found' }); continue; }
        if (t.owner_id !== userId) { results.push({ ok: false, label: a.label, error: 'not your task' }); continue; }
        if (a.type === 'complete_task') {
          const { error } = await updateTask(a.taskId, { status: 'complete' });
          results.push({ ok: !error, label: a.label || `Completed "${t.title}"`, error: error?.message });
        } else if (a.type === 'dismiss_task') {
          const { error } = await dismissTask(a.taskId, userId, 'Dismissed via assistant');
          results.push({ ok: !error, label: a.label || `Dismissed "${t.title}"`, error: error?.message });
        } else {
          const upd = {};
          if (a.dueDate && /^\d{4}-\d{2}-\d{2}$/.test(a.dueDate)) upd.dueDate = a.dueDate;
          if ([1, 2, 3].includes(Number(a.priority))) upd.priority = Number(a.priority);
          if (['on_me', 'waiting_on_them', 'no_next_step'].includes(a.momentum)) upd.momentum = a.momentum;
          if (!Object.keys(upd).length) { results.push({ ok: false, label: a.label, error: 'nothing to update' }); continue; }
          const { error } = await updateTask(a.taskId, upd);
          results.push({ ok: !error, label: a.label || `Updated "${t.title}"`, error: error?.message });
        }

      } else {
        results.push({ ok: false, label: a.label || a.type, error: 'unsupported action' });
      }
    } catch (e) {
      results.push({ ok: false, label: a.label || a.type, error: e.message });
    }
  }

  return apiSuccess(res, { results, applied: results.filter(r => r.ok).length, total: results.length });
}
