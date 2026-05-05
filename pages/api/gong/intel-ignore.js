import {
  apiError,
  apiSuccess,
  validateMethod,
  logRequest,
} from '../../../lib/apiUtils';
import { createServerSupabaseClient } from '../../../lib/supabase';

export default async function handler(req, res) {
  logRequest(req, 'gong/intel-ignore');
  if (!validateMethod(req, res, 'POST')) return;

  const { callId, ignored, ignoreReason } = req.body || {};
  if (!callId) return apiError(res, 400, 'callId is required');

  const db = createServerSupabaseClient(req, res);

  const { error } = await db.from('gong_call_analyses').upsert(
    {
      gong_call_id: callId,
      ignored: Boolean(ignored),
      ignore_reason: ignoreReason || null,
    },
    { onConflict: 'gong_call_id' }
  );

  if (error) return apiError(res, 500, error.message);
  return apiSuccess(res, { callId, ignored: Boolean(ignored) });
}
