// POST /api/gong/intel-analyze-batch
// { calls: [{gongCallId, title, date, callType, repName, repEmail, durationSeconds, gongUrl}] }
//
// Sends 202 immediately, then continues processing server-side.
// Vercel keeps the Lambda alive until this handler function returns, so the
// client can navigate away without stopping analysis — each call that completes
// is saved to DB via intel-analyze (which uses service-role client when called
// with CRON_SECRET auth).

import { createServerSupabaseClient } from '../../../lib/supabase';
import { logRequest } from '../../../lib/apiUtils';

export default async function handler(req, res) {
  logRequest(req, 'gong/intel-analyze-batch');
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const authClient = createServerSupabaseClient(req, res);
  const { data: { user } } = await authClient.auth.getUser();
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  const { calls } = req.body || {};
  if (!calls?.length) return res.status(400).json({ error: 'calls array required' });

  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return res.status(500).json({ error: 'CRON_SECRET not configured' });

  // Construct internal API base URL from request host
  const host = req.headers.host || '';
  const protocol = host.includes('localhost') ? 'http' : 'https';
  const baseUrl = `${protocol}://${host}`;

  // Send 202 immediately — processing continues server-side after this
  res.status(202).json({ success: true, queued: calls.length });

  // ── Process each call server-side ──────────────────────────────────────────
  // Client may disconnect at any point, but Vercel keeps this function alive
  // until it returns. Each completed call is immediately persisted to DB.
  let analyzed = 0;
  let failed = 0;

  for (const call of calls) {
    try {
      const r = await fetch(`${baseUrl}/api/gong/intel-analyze`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${cronSecret}`,
        },
        body: JSON.stringify({
          callId: call.gongCallId,
          title: call.title,
          date: call.date,
          callType: call.callType,
          repName: call.repName,
          repEmail: call.repEmail,
          durationSeconds: call.durationSeconds,
          gongUrl: call.gongUrl,
        }),
      });
      const data = await r.json().catch(() => ({}));
      if (data.analysis) {
        analyzed++;
      } else {
        failed++;
        console.error(`[batch] Failed: ${call.title}`, data.error);
      }
    } catch (e) {
      failed++;
      console.error(`[batch] Error on ${call.title}:`, e.message);
    }
    // Pace requests to avoid Gong API rate limits
    await new Promise(r => setTimeout(r, 300));
  }

  console.log(`[intel-analyze-batch] Done: ${analyzed} analyzed, ${failed} failed of ${calls.length} total`);
}
