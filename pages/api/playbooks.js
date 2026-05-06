import { apiError, apiSuccess, validateMethod, logRequest } from '../../lib/apiUtils';
import { createServerSupabaseClient, getSupabase } from '../../lib/supabase';

export default async function handler(req, res) {
  logRequest(req, 'playbooks');
  const db = getSupabase();

  if (req.method === 'GET') {
    const { data, error } = await db
      .from('task_playbooks')
      .select('*')
      .order('created_at', { ascending: true });
    if (error) return apiError(res, 500, error.message);
    return apiSuccess(res, { playbooks: data || [] });

  } else if (req.method === 'POST') {
    const authClient = createServerSupabaseClient(req, res);
    const { data: { user } } = await authClient.auth.getUser();
    if (!user) return apiError(res, 401, 'Unauthorized');

    const { name, trigger, role, description, steps } = req.body;
    if (!name || !trigger) return apiError(res, 400, 'name and trigger are required');

    const { data, error } = await db
      .from('task_playbooks')
      .insert({ name, trigger, role: role || 'all', description: description || '', steps: steps || [] })
      .select()
      .single();
    if (error) return apiError(res, 500, error.message);
    return apiSuccess(res, { playbook: data });

  } else if (req.method === 'PATCH') {
    const authClient = createServerSupabaseClient(req, res);
    const { data: { user } } = await authClient.auth.getUser();
    if (!user) return apiError(res, 401, 'Unauthorized');

    const { id, ...updates } = req.body;
    if (!id) return apiError(res, 400, 'id is required');

    const allowed = ['name', 'trigger', 'role', 'description', 'steps', 'active'];
    const filtered = Object.fromEntries(Object.entries(updates).filter(([k]) => allowed.includes(k)));

    const { data, error } = await db
      .from('task_playbooks')
      .update({ ...filtered, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    if (error) return apiError(res, 500, error.message);
    return apiSuccess(res, { playbook: data });

  } else if (req.method === 'DELETE') {
    const authClient = createServerSupabaseClient(req, res);
    const { data: { user } } = await authClient.auth.getUser();
    if (!user) return apiError(res, 401, 'Unauthorized');

    const { id } = req.body;
    if (!id) return apiError(res, 400, 'id is required');

    const { error } = await db.from('task_playbooks').delete().eq('id', id);
    if (error) return apiError(res, 500, error.message);
    return apiSuccess(res, { deleted: true });

  } else {
    return apiError(res, 405, 'Method not allowed');
  }
}
