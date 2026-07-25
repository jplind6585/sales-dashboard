// GET /api/search — lightweight account list for the ⌘K command palette (PLATFORM_REVIEW §3.1).
import { createServerSupabaseClient, getSupabase } from '../../lib/supabase';
import { apiError, apiSuccess, logRequest } from '../../lib/apiUtils';

export default async function handler(req, res) {
  logRequest(req, 'search');
  if (req.method !== 'GET') return apiError(res, 405, 'GET only');
  const auth = createServerSupabaseClient(req, res);
  const { data: { user } } = await auth.auth.getUser();
  if (!user) return apiError(res, 401, 'Unauthorized');
  const db = getSupabase();
  const { data } = await db.from('accounts').select('id, name, stage, owner_name').order('name').limit(5000);
  return apiSuccess(res, { accounts: data || [] });
}
