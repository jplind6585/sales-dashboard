// Nightly cron: sync HubSpot deals → accounts, then re-match unlinked Gong calls.
// Runs at 1am UTC daily (before nightly-intel at 2am so accounts are fresh).

import { getSupabase } from '../../../lib/supabase'

export default async function handler(req, res) {
  if (req.headers['authorization'] !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const base = process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : 'http://localhost:3000';

  const authHeader = { Authorization: `Bearer ${process.env.CRON_SECRET}` };
  const db = getSupabase();

  try {
    // Step 1: sync deals → accounts
    const syncRes = await fetch(`${base}/api/hubspot/sync-deals`, {
      method: 'POST',
      headers: authHeader,
    });
    const syncData = await syncRes.json().catch(() => ({}));
    console.log('[cron/sync-hubspot] sync-deals:', syncData);

    // Step 2: match unlinked calls to the freshly-synced accounts
    const matchRes = await fetch(`${base}/api/hubspot/match-calls`, {
      method: 'POST',
      headers: authHeader,
    });
    const matchData = await matchRes.json().catch(() => ({}));
    console.log('[cron/sync-hubspot] match-calls:', matchData);

    // Write audit log entry for the nightly sync run
    db.from('hubspot_sync_log').insert({
      action: 'nightly_sync',
      payload: { step: 'sync-deals', result: syncData },
      result: { step: 'match-calls', result: matchData },
      triggered_by: 'cron',
      success: syncRes.ok && matchRes.ok,
    }).then().catch(e => console.error('[sync-hubspot] audit log write failed:', e.message));

    return res.status(200).json({ success: true, sync: syncData, match: matchData });
  } catch (e) {
    console.error('[cron/sync-hubspot] error:', e.message);

    db.from('hubspot_sync_log').insert({
      action: 'nightly_sync',
      payload: {},
      result: { error: e.message },
      triggered_by: 'cron',
      success: false,
    }).then().catch(() => {});

    return res.status(500).json({ error: e.message });
  }
}
