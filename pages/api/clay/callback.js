// POST /api/clay/callback — Clay posts enriched records here from an "HTTP API" column in the table.
// No user session (Clay is the caller); protect with CLAY_CALLBACK_SECRET as a Bearer token. Stores
// the enriched payload keyed by your record_id for later correlation.
import { getSupabase } from '../../../lib/supabase';
import { apiError, apiSuccess, logRequest } from '../../../lib/apiUtils';

export default async function handler(req, res) {
  logRequest(req, 'clay/callback');
  if (req.method !== 'POST') return apiError(res, 405, 'POST only');
  const secret = process.env.CLAY_CALLBACK_SECRET;
  if (secret && req.headers['authorization'] !== `Bearer ${secret}`) return apiError(res, 401, 'Unauthorized');

  const body = req.body || {};
  const db = getSupabase();
  try {
    await db.from('clay_enrichments').insert({
      record_id: body.record_id || body.recordId || null,
      account_id: body.account_id || null,
      data: body,
    });
  } catch (e) {
    console.error('[clay/callback] store failed:', e.message);
    return apiError(res, 500, 'store failed');
  }
  return apiSuccess(res, { received: true });
}
