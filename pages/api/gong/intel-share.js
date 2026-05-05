import { apiError, apiSuccess, logRequest } from '../../../lib/apiUtils';
import { createServerSupabaseClient } from '../../../lib/supabase';

export default async function handler(req, res) {
  logRequest(req, 'gong/intel-share');
  const db = createServerSupabaseClient(req, res);

  if (req.method === 'POST') {
    // Create a share token — requires auth
    const { data: { user } } = await db.auth.getUser();
    if (!user) return apiError(res, 401, 'Unauthorized');

    const token = crypto.randomUUID();
    const { error } = await db.from('report_shares').insert({
      token,
      created_by: user.id,
    });
    if (error) return apiError(res, 500, 'Failed to create share link');

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || `https://${req.headers.host}`;
    return apiSuccess(res, { url: `${baseUrl}/share/call-intelligence?t=${token}` });

  } else if (req.method === 'GET') {
    // Validate token and return latest aggregate — no auth required
    const { t: token } = req.query;
    if (!token) return apiError(res, 400, 'Token required');

    const { data: share, error } = await db
      .from('report_shares')
      .select('*')
      .eq('token', token)
      .single();

    if (error || !share) return apiError(res, 404, 'Share link not found or expired');
    if (share.expires_at && new Date(share.expires_at) < new Date()) {
      return apiError(res, 410, 'Share link has expired');
    }

    const { data: aggregateRow } = await db
      .from('gong_aggregate_analysis')
      .select('*')
      .order('computed_at', { ascending: false })
      .limit(1)
      .single();

    if (!aggregateRow) return apiError(res, 404, 'No report available yet');

    return apiSuccess(res, {
      aggregate: aggregateRow.analysis,
      callCount: aggregateRow.call_count,
      computedAt: aggregateRow.computed_at,
    });

  } else {
    return apiError(res, 405, 'Method not allowed');
  }
}
