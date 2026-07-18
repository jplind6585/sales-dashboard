// GET /api/public/deal-room?token= — PUBLIC (no auth) data for a shared Deal Room. Returns only
// what is safe for a prospect to see: their account name/vertical, a value estimate grounded in
// their own metrics, and Banner's standard benefits/proof. No rep names, MEDDIC, or call detail.
// Increments the view counter for engagement tracking (M5).
import { getSupabase } from '../../../lib/supabase';
import { apiError, apiSuccess, logRequest } from '../../../lib/apiUtils';
import { computeDealValue, BANNER_BENEFITS, BANNER_PROOF } from '../../../lib/dealValue';

export default async function handler(req, res) {
  logRequest(req, 'public/deal-room');
  if (req.method !== 'GET') return apiError(res, 405, 'GET only');
  const token = req.query.token;
  if (!token) return apiError(res, 400, 'token required');

  const db = getSupabase();
  const { data: room } = await db.from('deal_rooms').select('id, account_id, headline, views').eq('token', token).maybeSingle();
  if (!room) return apiError(res, 404, 'Deal room not found');

  const { data: account } = await db.from('accounts').select('id, name, vertical, metrics').eq('id', room.account_id).maybeSingle();
  if (!account) return apiError(res, 404, 'Account not found');

  const value = computeDealValue(account);

  // Engagement tracking — fire and forget.
  db.from('deal_rooms').update({ views: (room.views || 0) + 1, last_viewed_at: new Date().toISOString() }).eq('id', room.id).then(() => {}, () => {});

  return apiSuccess(res, {
    account: { name: account.name, vertical: account.vertical || null },
    headline: room.headline || null,
    value,
    benefits: BANNER_BENEFITS,
    proof: BANNER_PROOF,
  });
}
