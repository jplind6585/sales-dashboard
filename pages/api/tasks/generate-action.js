// POST /api/tasks/generate-action  { taskId, force? }
// Generates (or regenerates with force) the pre-loaded AI draft for a task and
// persists it to tasks.ai_draft. Returns { aiDraft }. Draft-only — nothing sends.
//
// Called lazily by the task UI when a task has no draft yet, so no task is ever blank.

import { createServerSupabaseClient, getSupabase } from '../../../lib/supabase';
import { apiError, apiSuccess, logRequest } from '../../../lib/apiUtils';
import { generateTaskDraft } from '../../../lib/taskActions';

export default async function handler(req, res) {
  logRequest(req, 'tasks/generate-action');
  if (req.method !== 'POST') return apiError(res, 405, 'POST only');

  const auth = createServerSupabaseClient(req, res);
  const { data: { user } } = await auth.auth.getUser();
  if (!user) return apiError(res, 401, 'Unauthorized');

  const { taskId, force } = req.body || {};
  if (!taskId) return apiError(res, 400, 'taskId required');

  const db = getSupabase();

  // select('*') so this works whether or not the 20260628 migration has run yet
  // (ai_draft / trigger columns are simply absent pre-migration).
  const { data: task, error: taskErr } = await db
    .from('tasks')
    .select('*, accounts ( id, name, stage )')
    .eq('id', taskId)
    .single();
  if (taskErr || !task) return apiError(res, 404, 'Task not found');

  // Already have a draft and not forcing — return it (idempotent, cheap).
  if (task.ai_draft && !force) {
    return apiSuccess(res, { aiDraft: task.ai_draft, cached: true });
  }

  // Ground the draft. Prefer the SPECIFIC Gong call this task came from — that carries the transcript
  // and works even when no account exists yet (e.g. an inbound intro). The call id lives on source_id
  // (newer tasks) or embedded in the description ("call ID: ..."). Fall back to the account's history.
  let calls = [];
  let transcript = null;
  const callId = task.source_id || (task.description || '').match(/call ID:\s*([^\s)]+)/i)?.[1] || null;
  if (callId) {
    const { data: c } = await db
      .from('gong_call_analyses')
      .select('title, call_date, analysis, transcript_text')
      .eq('gong_call_id', callId)
      .maybeSingle();
    if (c) {
      transcript = c.transcript_text || null;
      calls = [{
        title: c.title, date: c.call_date, summary: c.analysis?.summary,
        painPoints: c.analysis?.pain_points_identified || c.analysis?.pain_points,
        nextSteps: c.analysis?.next_steps_mentioned, commitments: c.analysis?.commitments,
        objections: (c.analysis?.objections || []).map(o => (typeof o === 'string' ? o : o?.text)).filter(Boolean),
      }];
    }
  }
  if (!transcript && task.account_id) {
    const { data: rows } = await db
      .from('gong_call_analyses')
      .select('title, call_date, analysis')
      .eq('account_id', task.account_id)
      .eq('ignored', false)
      .not('analyzed_at', 'is', null)
      .order('call_date', { ascending: false })
      .limit(6);
    calls = (rows || []).map(r => ({
      title: r.title,
      date: r.call_date,
      summary: r.analysis?.summary,
      painPoints: r.analysis?.pain_points_identified || r.analysis?.pain_points,
      nextSteps: r.analysis?.next_steps_mentioned,
      commitments: r.analysis?.commitments,
      objections: (r.analysis?.objections || []).map(o => (typeof o === 'string' ? o : o?.text)).filter(Boolean),
    }));
  }

  const aiDraft = await generateTaskDraft({
    task: {
      title: task.title,
      description: task.description,
      rationale: task.rationale,
      sourceType: task.source_type,
      trigger: task.trigger,
    },
    account: task.accounts || null,
    calls,
    transcript,
    repName: user.email?.split('@')[0] || 'the rep',
  });

  if (!aiDraft) return apiError(res, 502, 'Could not generate a draft. Try again.');

  const { error: upErr } = await db.from('tasks').update({ ai_draft: aiDraft }).eq('id', taskId);
  if (upErr) console.error('[generate-action] persist failed:', upErr.message);

  return apiSuccess(res, { aiDraft, cached: false });
}
