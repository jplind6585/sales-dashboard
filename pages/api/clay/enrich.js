// POST /api/clay/enrich { record } — push a record to Clay for enrichment via its inbound webhook
// (Clay has no synchronous REST API — results come back async to /api/clay/callback). Include your
// own `record_id` in the record so the async callback can be correlated.
import { createServerSupabaseClient } from '../../../lib/supabase';
import { apiError, apiSuccess, validateMethod, logRequest } from '../../../lib/apiUtils';

export default async function handler(req, res) {
  logRequest(req, 'clay/enrich');
  if (!validateMethod(req, res, 'POST')) return;
  const auth = createServerSupabaseClient(req, res);
  const { data: { user } } = await auth.auth.getUser();
  if (!user) return apiError(res, 401, 'Unauthorized');
  const url = process.env.CLAY_WEBHOOK_URL;
  if (!url) return apiError(res, 503, 'CLAY_WEBHOOK_URL not configured — create a "Pull data from a webhook" source in a Clay table and paste its URL in Vercel');
  const record = req.body?.record;
  if (!record || typeof record !== 'object') return apiError(res, 400, 'record object required (include your own record_id)');

  const headers = { 'Content-Type': 'application/json' };
  if (process.env.CLAY_WEBHOOK_AUTH) headers['x-clay-webhook-auth'] = process.env.CLAY_WEBHOOK_AUTH;
  const r = await fetch(url, { method: 'POST', headers, body: JSON.stringify(record) });
  if (!r.ok) return apiError(res, 502, `Clay webhook rejected the record (HTTP ${r.status})`);
  return apiSuccess(res, { sent: true, note: 'Enriched fields will arrive async at /api/clay/callback' });
}
