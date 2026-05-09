// POST /api/playbooks/execute
// Executes a playbook for an account: creates tasks from each step.
// Body: { playbookId, accountId }
// Returns: { tasks: [...created tasks], skipped: number }

import { apiError, apiSuccess, validateMethod, logRequest } from '../../../lib/apiUtils';
import { createServerSupabaseClient, getSupabase } from '../../../lib/supabase';

function computeDueDate(step) {
  const offsetHours = step.due_offset_hours ?? 0;
  if (offsetHours === 0) return new Date().toISOString().split('T')[0];

  const now = new Date();
  now.setHours(now.getHours() + offsetHours);
  return now.toISOString().split('T')[0];
}

export default async function handler(req, res) {
  logRequest(req, 'playbooks/execute');
  if (req.method !== 'POST') return apiError(res, 405, 'POST only');

  const auth = createServerSupabaseClient(req, res);
  const { data: { user } } = await auth.auth.getUser();
  if (!user) return apiError(res, 401, 'Unauthorized');

  const { playbookId, accountId } = req.body;
  if (!playbookId || !accountId) return apiError(res, 400, 'playbookId and accountId are required');

  const db = getSupabase();

  // Fetch the playbook
  const { data: playbook, error: pbErr } = await db
    .from('task_playbooks')
    .select('*')
    .eq('id', playbookId)
    .single();

  if (pbErr || !playbook) return apiError(res, 404, 'Playbook not found');
  if (!playbook.active) return apiError(res, 400, 'Playbook is inactive');

  const steps = playbook.steps || [];
  if (!steps.length) return apiError(res, 400, 'Playbook has no steps');

  // Fetch the account to verify it exists
  const { data: account, error: accErr } = await db
    .from('accounts')
    .select('id, name')
    .eq('id', accountId)
    .single();

  if (accErr || !account) return apiError(res, 404, 'Account not found');

  // Check for existing playbook execution tasks for this account (avoid duplicate runs)
  const { data: existingTasks } = await db
    .from('tasks')
    .select('id, title, source_id')
    .eq('account_id', accountId)
    .eq('source', 'playbook')
    .eq('source_id', playbookId)
    .in('status', ['open', 'in_progress']);

  if (existingTasks?.length > 0) {
    return apiSuccess(res, {
      tasks: [],
      skipped: steps.length,
      message: `Playbook already has ${existingTasks.length} open task(s) for this account. Complete or dismiss them before running again.`,
      alreadyActive: true,
    });
  }

  // Create tasks for each step
  const taskRows = steps.map((step, i) => ({
    title: step.title || `Step ${i + 1}`,
    description: step.description || null,
    status: 'open',
    priority: step.priority || 2,
    type: step.type || 'triggered',
    owner_id: user.id,
    account_id: accountId,
    due_date: computeDueDate(step),
    source: 'playbook',
    source_id: playbookId,
    source_type: 'playbook_step',
    rationale: `From playbook: ${playbook.name}`,
    primary_action: step.primary_action || null,
  }));

  const { data: created, error: insertErr } = await db
    .from('tasks')
    .insert(taskRows)
    .select();

  if (insertErr) return apiError(res, 500, insertErr.message);

  console.log(`[playbooks/execute] Created ${created?.length || 0} tasks for account "${account.name}" from playbook "${playbook.name}"`);

  return apiSuccess(res, {
    tasks: created || [],
    skipped: 0,
    message: `Created ${created?.length || 0} task${created?.length !== 1 ? 's' : ''} from "${playbook.name}"`,
    playbookName: playbook.name,
    accountName: account.name,
  });
}
