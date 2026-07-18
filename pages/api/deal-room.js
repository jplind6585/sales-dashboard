// POST /api/deal-room { accountId } — create (or return the existing) shareable Deal Room token
// for an account. GET ?accountId= returns the room + view count. Auth required (reps only).
import { randomBytes } from 'crypto';
import { createServerSupabaseClient, getSupabase } from '../../lib/supabase';
import { apiError, apiSuccess, logRequest } from '../../lib/apiUtils';

export default async function handler(req, res) {
  logRequest(req, 'deal-room');
  const auth = createServerSupabaseClient(req, res);
  const { data: { user } } = await auth.auth.getUser();
  if (!user) return apiError(res, 401, 'Unauthorized');
  const db = getSupabase();

  const accountId = req.method === 'POST' ? req.body?.accountId : req.query.accountId;
  if (!accountId) return apiError(res, 400, 'accountId required');

  const { data: existing } = await db.from('deal_rooms').select('token, views, last_viewed_at').eq('account_id', accountId).order('created_at', { ascending: false }).limit(1);
  let room = existing?.[0];

  if (!room && req.method === 'POST') {
    const token = randomBytes(9).toString('hex');
    const { error } = await db.from('deal_rooms').insert({ account_id: accountId, token, created_by: user.id });
    if (error) return apiError(res, 500, error.message);
    room = { token, views: 0, last_viewed_at: null };
  }
  if (!room) return apiSuccess(res, { room: null });

  return apiSuccess(res, { room: { token: room.token, path: `/share/deal-room/${room.token}`, views: room.views || 0, lastViewedAt: room.last_viewed_at } });
}
