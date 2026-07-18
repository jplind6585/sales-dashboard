// POST /api/hubspot/push-stage { accountId } — push an account's current stage to its HubSpot deal.
import { createServerSupabaseClient, getSupabase } from '../../../lib/supabase';
import { apiError, apiSuccess, validateMethod, logRequest } from '../../../lib/apiUtils';
import { pushStageToHubspot } from '../../../lib/hubspotPush';

export default async function handler(req, res) {
  logRequest(req, 'hubspot/push-stage');
  if (!validateMethod(req, res, 'POST')) return;
  const auth = createServerSupabaseClient(req, res);
  const { data: { user } } = await auth.auth.getUser();
  if (!user) return apiError(res, 401, 'Unauthorized');
  if (!process.env.HUBSPOT_API_KEY) return apiError(res, 503, 'HUBSPOT_API_KEY not configured');
  const { accountId } = req.body || {};
  if (!accountId) return apiError(res, 400, 'accountId required');

  const result = await pushStageToHubspot(getSupabase(), accountId);
  if (!result.pushed) {
    const msg = result.reason === 'no_deal' ? 'Account has no linked HubSpot deal'
      : result.reason === 'no_mapping' ? `No HubSpot stage ID for "${result.stage}" — set HUBSPOT_STAGE_${(result.stage || '').toUpperCase()} in Vercel (find the ID via /api/hubspot/pipeline-stages)`
      : `HubSpot push failed (${result.reason})`;
    return apiSuccess(res, { pushed: false, reason: result.reason, message: msg });
  }
  return apiSuccess(res, { pushed: true, stage: result.stage });
}
