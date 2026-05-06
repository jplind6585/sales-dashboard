import { apiError, apiSuccess, validateMethod, logRequest } from '../../lib/apiUtils';
import { createServerSupabaseClient, getSupabase } from '../../lib/supabase';

export default async function handler(req, res) {
  logRequest(req, 'sales-process');

  if (req.method === 'GET') {
    const db = getSupabase();
    const { data, error } = await db
      .from('sales_process_config')
      .select('*')
      .limit(1)
      .single();

    if (error && error.code !== 'PGRST116') {
      return apiError(res, 500, error.message);
    }
    return apiSuccess(res, { config: data || null });

  } else if (req.method === 'PATCH') {
    const authClient = createServerSupabaseClient(req, res);
    const { data: { user } } = await authClient.auth.getUser();
    if (!user) return apiError(res, 401, 'Unauthorized');

    const db = getSupabase();
    const { data: existing } = await db.from('sales_process_config').select('id, version, *').limit(1).single();

    const updates = req.body;
    const allowedFields = [
      'icp_definition', 'discovery_framework', 'stage_exit_criteria',
      'disqualification_signals', 'coaching_priorities', 'qualification_framework',
      'winning_tactics', 'competitor_playbook', 'notes',
    ];
    const filtered = Object.fromEntries(Object.entries(updates).filter(([k]) => allowedFields.includes(k)));

    if (existing) {
      // Save history snapshot before updating
      await db.from('sales_process_config_history').insert({
        config_id: existing.id,
        version: existing.version,
        saved_by: user.email,
        snapshot: existing,
      });

      const { data: updated, error: updateErr } = await db
        .from('sales_process_config')
        .update({ ...filtered, version: existing.version + 1, updated_at: new Date().toISOString(), updated_by: user.email })
        .eq('id', existing.id)
        .select()
        .single();

      if (updateErr) return apiError(res, 500, updateErr.message);
      return apiSuccess(res, { config: updated });

    } else {
      const { data: created, error: createErr } = await db
        .from('sales_process_config')
        .insert({ ...filtered, version: 1, updated_by: user.email })
        .select()
        .single();

      if (createErr) return apiError(res, 500, createErr.message);
      return apiSuccess(res, { config: created });
    }

  } else {
    return apiError(res, 405, 'Method not allowed');
  }
}
