import { createServerSupabaseClient, getSupabase } from '../../../lib/supabase';
import { apiError, apiSuccess } from '../../../lib/apiUtils';

export default async function handler(req, res) {
  if (req.method !== 'PATCH') {
    return apiError(res, 405, 'Method not allowed');
  }

  const supabase = createServerSupabaseClient(req, res);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return apiError(res, 401, 'Unauthorized');

  const db = getSupabase();

  const { data: profile, error: profileError } = await db
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (profileError || !profile) return apiError(res, 403, 'Manager access required');
  if (!['manager','admin'].includes(profile.role)) return apiError(res, 403, 'Manager access required');

  const { callId, note } = req.body;
  if (!callId) return apiError(res, 400, 'callId is required');

  const { data: existing, error: fetchError } = await db
    .from('gong_call_analyses')
    .select('analysis')
    .eq('gong_call_id', callId)
    .single();

  if (fetchError || !existing) return apiError(res, 404, 'Call analysis not found');

  const trimmedNote = typeof note === 'string' ? note.trim() : '';

  const updatedAnalysis = {
    ...existing.analysis,
    manager_note: trimmedNote || null,
    manager_note_at: trimmedNote ? new Date().toISOString() : null,
    manager_note_by: trimmedNote ? user.email : null,
  };

  const { error: updateError } = await db
    .from('gong_call_analyses')
    .update({ analysis: updatedAnalysis })
    .eq('gong_call_id', callId);

  if (updateError) return apiError(res, 500, updateError.message);

  return apiSuccess(res, { updatedAnalysis });
}
