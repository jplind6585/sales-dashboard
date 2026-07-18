// /api/work-requests — cross-team work requests (PLATFORM_REVIEW cross-team scope, MVP).
// A rep asks a non-sales teammate (designer, sales engineer) for something; the full account
// context is auto-snapshotted at request time so the fulfiller gets all the correct data.
//   GET ?scope=mine|all · POST (create + snapshot) · PATCH (advance status)
import { createServerSupabaseClient, getSupabase } from '../../lib/supabase';
import { apiError, apiSuccess, logRequest } from '../../lib/apiUtils';
import { buildAccountContext } from '../../lib/accountContext';

export default async function handler(req, res) {
  logRequest(req, 'work-requests');
  const auth = createServerSupabaseClient(req, res);
  const { data: { user } } = await auth.auth.getUser();
  if (!user) return apiError(res, 401, 'Unauthorized');
  const db = getSupabase();

  if (req.method === 'POST') {
    const b = req.body || {};
    if (!b.title) return apiError(res, 400, 'title required');
    const { data: prof } = await db.from('profiles').select('full_name').eq('id', user.id).maybeSingle();
    let snapshot = null;
    if (b.accountId) {
      try { const { account, contextText } = await buildAccountContext(db, b.accountId); snapshot = { account: account?.name || null, context: contextText }; }
      catch (e) { console.error('[work-requests] snapshot failed:', e.message); }
    }
    const { data, error } = await db.from('work_requests').insert({
      account_id: b.accountId || null, requester_id: user.id, requester_name: prof?.full_name || null,
      assignee_role: b.assigneeRole || 'other', type: b.type || 'other', title: b.title, details: b.details || null,
      context_snapshot: snapshot, status: 'open', due_date: b.dueDate || null,
    }).select('id').single();
    if (error) return apiError(res, 500, error.message);
    return apiSuccess(res, { id: data.id });
  }

  if (req.method === 'PATCH') {
    const { id, status } = req.body || {};
    if (!id || !status) return apiError(res, 400, 'id and status required');
    const { error } = await db.from('work_requests').update({ status, updated_at: new Date().toISOString() }).eq('id', id);
    if (error) return apiError(res, 500, error.message);
    return apiSuccess(res, { updated: true });
  }

  if (req.method !== 'GET') return apiError(res, 405, 'Method not allowed');
  const scope = req.query.scope || 'all';
  let q = db.from('work_requests').select('*, accounts(name, stage)').order('created_at', { ascending: false }).limit(200);
  if (scope === 'mine') q = q.eq('requester_id', user.id);
  const { data } = await q;
  return apiSuccess(res, { requests: data || [] });
}
