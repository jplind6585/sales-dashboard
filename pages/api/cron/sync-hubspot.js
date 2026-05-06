// Nightly cron: sync HubSpot deals → accounts, then re-match unlinked Gong calls.
// Runs at 1am UTC daily (before nightly-intel at 2am so accounts are fresh).

export default async function handler(req, res) {
  if (req.headers['authorization'] !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const base = process.env.NEXTAUTH_URL || process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : 'http://localhost:3000';

  const authHeader = { Authorization: `Bearer ${process.env.CRON_SECRET}` };

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

    return res.status(200).json({ success: true, sync: syncData, match: matchData });
  } catch (e) {
    console.error('[cron/sync-hubspot] error:', e.message);
    return res.status(500).json({ error: e.message });
  }
}
