// Nightly bulk enrichment: finds all gong_call_analyses with no HubSpot check yet
// and runs them through intel-enrich in batches. Safe to re-run (idempotent via
// hubspot_checked_at). Secured with CRON_SECRET; also callable by admins.

import { getSupabase } from '../../../lib/supabase';
import { apiError, apiSuccess, logRequest } from '../../../lib/apiUtils';

const BATCH_SIZE = 100;

export default async function handler(req, res) {
  logRequest(req, 'cron/enrich-calls-bulk');
  if (req.method !== 'POST') return apiError(res, 405, 'POST only');

  const isCron = process.env.CRON_SECRET && req.headers['authorization'] === `Bearer ${process.env.CRON_SECRET}`;
  if (!isCron) return apiError(res, 401, 'Unauthorized');

  const db = getSupabase();

  // Fetch all call IDs that haven't been checked against HubSpot yet
  const { data: unchecked, error } = await db
    .from('gong_call_analyses')
    .select('gong_call_id')
    .is('hubspot_checked_at', null)
    .limit(2000);

  if (error) return apiError(res, 500, error.message);
  if (!unchecked?.length) return apiSuccess(res, { total: 0, batches: 0, withDeals: 0, accountsLinked: 0 });

  const callIds = unchecked.map(r => r.gong_call_id);
  const baseUrl = process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : 'http://localhost:3000';

  let totalWithDeals = 0;
  let totalAccountsLinked = 0;
  let batchCount = 0;
  const errors = [];

  for (let i = 0; i < callIds.length; i += BATCH_SIZE) {
    const batch = callIds.slice(i, i + BATCH_SIZE);
    batchCount++;
    try {
      const r = await fetch(`${baseUrl}/api/gong/intel-enrich`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${process.env.CRON_SECRET}`,
        },
        body: JSON.stringify({ callIds: batch }),
      });
      if (r.ok) {
        const d = await r.json().catch(() => ({}));
        totalWithDeals += d.withDeals || 0;
        totalAccountsLinked += d.accountsLinked || 0;
      } else {
        errors.push(`batch ${batchCount}: HTTP ${r.status}`);
      }
    } catch (e) {
      errors.push(`batch ${batchCount}: ${e.message}`);
    }
  }

  console.log(`[enrich-calls-bulk] processed ${callIds.length} calls in ${batchCount} batches; deals=${totalWithDeals} accounts=${totalAccountsLinked}`);
  return apiSuccess(res, {
    total: callIds.length,
    batches: batchCount,
    withDeals: totalWithDeals,
    accountsLinked: totalAccountsLinked,
    errors: errors.length ? errors : undefined,
  });
}
