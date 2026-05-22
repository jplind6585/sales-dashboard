// POST /api/playbooks/execute-for-stage
// Auto-executes all active playbooks whose stage_trigger matches the given stage.
// Called by useAccountStore on every stage change.
// Body: { stage, accountId, userId }

import { apiError, apiSuccess, logRequest } from '../../../lib/apiUtils';
import { getSupabase } from '../../../lib/supabase';

function computeDueDate(step) {
  const offsetHours = step.due_offset_hours ?? 0;
  if (offsetHours === 0) return new Date().toISOString().split('T')[0];
  const now = new Date();
  now.setHours(now.getHours() + offsetHours);
  return now.toISOString().split('T')[0];
}

export default async function handler(req, res) {
  logRequest(req, 'playbooks/execute-for-stage');
  if (req.method !== 'POST') return apiError(res, 405, 'POST only');

  const { stage, accountId, userId } = req.body;
  if (!stage || !accountId || !userId) return apiError(res, 400, 'stage, accountId, and userId are required');

  const db = getSupabase();

  // Find all active playbooks that fire on this stage
  const { data: playbooks, error: pbErr } = await db
    .from('task_playbooks')
    .select('*')
    .eq('stage_trigger', stage)
    .eq('active', true);

  if (pbErr) return apiError(res, 500, pbErr.message);
  if (!playbooks?.length) return apiSuccess(res, { triggered: 0, message: 'No playbooks for this stage' });

  const { data: account } = await db
    .from('accounts')
    .select('id, name')
    .eq('id', accountId)
    .single();

  if (!account) return apiError(res, 404, 'Account not found');

  const results = [];

  for (const playbook of playbooks) {
    const steps = playbook.steps || [];
    if (!steps.length) continue;

    // Skip if this playbook already has open tasks for this account
    const { data: existing } = await db
      .from('tasks')
      .select('id')
      .eq('account_id', accountId)
      .eq('source', 'playbook')
      .eq('source_id', playbook.id)
      .in('status', ['open', 'in_progress']);

    if (existing?.length > 0) {
      results.push({ playbookName: playbook.name, skipped: true, reason: 'already active' });
      continue;
    }

    const taskRows = steps.map((step, i) => ({
      title: step.title || `Step ${i + 1}`,
      description: step.description || null,
      status: 'open',
      priority: step.priority || 2,
      type: step.type || 'triggered',
      owner_id: userId,
      account_id: accountId,
      due_date: computeDueDate(step),
      source: 'playbook',
      source_id: playbook.id,
      source_type: 'playbook_step',
      rationale: `From playbook: ${playbook.name}`,
      primary_action: step.primary_action || null,
    }));

    const { data: created, error: insertErr } = await db.from('tasks').insert(taskRows).select();

    if (insertErr) {
      console.error(`[execute-for-stage] Failed to create tasks for playbook "${playbook.name}":`, insertErr.message);
      results.push({ playbookName: playbook.name, skipped: true, reason: insertErr.message });
      continue;
    }

    console.log(`[execute-for-stage] Created ${created?.length || 0} tasks for "${account.name}" from playbook "${playbook.name}" (stage: ${stage})`);
    results.push({ playbookName: playbook.name, tasksCreated: created?.length || 0 });
  }

  return apiSuccess(res, { triggered: results.filter(r => !r.skipped).length, results });
}
