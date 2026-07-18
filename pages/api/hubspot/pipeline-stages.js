// GET /api/hubspot/pipeline-stages — lists HubSpot deal pipeline stages with their internal IDs, so
// the missing intro_scheduled / demo stage IDs can be found and set as env overrides.
import { createServerSupabaseClient } from '../../../lib/supabase';
import { apiError, apiSuccess, logRequest } from '../../../lib/apiUtils';

export default async function handler(req, res) {
  logRequest(req, 'hubspot/pipeline-stages');
  if (req.method !== 'GET') return apiError(res, 405, 'GET only');
  const auth = createServerSupabaseClient(req, res);
  const { data: { user } } = await auth.auth.getUser();
  if (!user) return apiError(res, 401, 'Unauthorized');
  const key = process.env.HUBSPOT_API_KEY;
  if (!key) return apiError(res, 503, 'HUBSPOT_API_KEY not configured');

  const r = await fetch('https://api.hubapi.com/crm/v3/pipelines/deals', { headers: { Authorization: `Bearer ${key}` } });
  if (!r.ok) return apiError(res, 502, `HubSpot pipelines fetch failed (HTTP ${r.status})`);
  const d = await r.json().catch(() => ({}));
  const stages = (d.results || []).flatMap((p) => (p.stages || []).map((s) => ({ pipeline: p.label, stageId: s.id, label: s.label, displayOrder: s.displayOrder })));
  return apiSuccess(res, { stages });
}
