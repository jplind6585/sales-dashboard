// GET /api/cron/nightly-intel
// Nightly job: lists recent Gong calls, analyzes any that haven't been analyzed yet.
// Protected by CRON_SECRET. Called nightly via Vercel cron.
//
// Flow:
//   1. Fetch last 30 days of calls from Gong API
//   2. Query gong_call_analyses to find which are unanalyzed
//   3. POST to /api/gong/intel-analyze for each (with CRON_SECRET auth so it uses service role DB client)
//   4. Log results

import { createGongHeaders } from '../../../lib/apiUtils';
import { getSupabase } from '../../../lib/supabase';

const GONG_API_BASE = 'https://api.gong.io';

// Reps to auto-analyze (from project config — James only; others are manual)
const AUTO_ANALYZE_REPS = ['James Lindberg'];

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const secret = process.env.CRON_SECRET;
  if (secret && req.headers['authorization'] !== `Bearer ${secret}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const gongAccessKey = process.env.GONG_ACCESS_KEY;
  const gongSecretKey = process.env.GONG_SECRET_KEY;
  if (!gongAccessKey || !gongSecretKey) {
    return res.status(500).json({ error: 'Gong credentials not configured' });
  }

  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  if (!anthropicKey) {
    return res.status(500).json({ error: 'ANTHROPIC_API_KEY not configured' });
  }

  const gongHeaders = createGongHeaders(gongAccessKey, gongSecretKey);

  // Quick mode (?quick=1): short lookback for frequent intraday runs
  const isQuick = req.query.quick === '1';
  const lookbackHours = isQuick ? 8 : 30 * 24;
  const callCap = isQuick ? 5 : 10;

  // 1. Fetch recent calls from Gong
  const toDate = new Date();
  const fromDate = new Date(Date.now() - lookbackHours * 60 * 60 * 1000);

  let allCalls = [];
  let cursor = null;
  let pageCount = 0;

  // Fetch Gong users to get rep names
  let userMap = {};
  try {
    const usersRes = await fetch(`${GONG_API_BASE}/v2/users`, { method: 'GET', headers: gongHeaders });
    if (usersRes.ok) {
      const usersData = await usersRes.json();
      (usersData.users || []).forEach(u => {
        const name = `${u.firstName || ''} ${u.lastName || ''}`.trim();
        userMap[u.id] = { name, email: u.emailAddress };
      });
    }
  } catch { /* continue */ }

  try {
    do {
      let url = `${GONG_API_BASE}/v2/calls?fromDateTime=${fromDate.toISOString()}&toDateTime=${toDate.toISOString()}`;
      if (cursor) url += `&cursor=${encodeURIComponent(cursor)}`;
      if (pageCount > 0) await new Promise(r => setTimeout(r, 150));

      const response = await fetch(url, { method: 'GET', headers: gongHeaders });
      if (!response.ok) break;
      const data = await response.json();
      allCalls = allCalls.concat(data.calls || []);
      cursor = data.records?.cursor || null;
      pageCount++;
    } while (cursor && pageCount < 5);
  } catch (e) {
    return res.status(500).json({ error: `Gong API error: ${e.message}` });
  }

  if (!allCalls.length) {
    return res.status(200).json({ analyzed: 0, message: 'No calls in last 30 days' });
  }

  // 2. Check which are already analyzed in DB
  const db = getSupabase();
  const gongCallIds = allCalls.map(c => c.id);

  const { data: existingRows } = await db
    .from('gong_call_analyses')
    .select('gong_call_id, analyzed_at')
    .in('gong_call_id', gongCallIds);

  const analyzedIds = new Set((existingRows || []).filter(r => r.analyzed_at).map(r => r.gong_call_id));

  // 3. Filter to unanalyzed calls by auto-analyze reps
  const getCallType = (title) => {
    const t = (title || '').toLowerCase();
    if (t.includes('intro') || t.includes('introduction')) return 'intro';
    if (t.includes('demo')) return 'demo';
    return 'solution_validation';
  };

  const toAnalyze = allCalls
    .filter(call => !analyzedIds.has(call.id))
    .filter(call => {
      const user = userMap[call.primaryUserId];
      return user && AUTO_ANALYZE_REPS.includes(user.name);
    })
    .slice(0, callCap);

  if (!toAnalyze.length) {
    console.log(`[nightly-intel] All ${AUTO_ANALYZE_REPS.join(', ')} calls already analyzed`);
    return res.status(200).json({ analyzed: 0, total: allCalls.length, message: 'All calls already analyzed' });
  }

  // 4. Analyze each call via intel-analyze (with CRON_SECRET auth)
  const baseUrl = process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : 'http://localhost:3000';

  const results = { analyzed: 0, failed: 0 };

  for (const call of toAnalyze) {
    const user = userMap[call.primaryUserId] || null;
    try {
      const r = await fetch(`${baseUrl}/api/gong/intel-analyze`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${secret}`,
        },
        body: JSON.stringify({
          callId: call.id,
          title: call.title || 'Untitled',
          date: call.started || null,
          callType: getCallType(call.title),
          repName: user?.name || null,
          repEmail: user?.email || null,
          durationSeconds: call.duration || 0,
          gongUrl: call.url || null,
        }),
      });
      const data = await r.json().catch(() => ({}));
      if (data.analysis) {
        results.analyzed++;
        console.log(`[nightly-intel] Analyzed: ${call.title}`);
      } else {
        results.failed++;
        console.error(`[nightly-intel] Failed: ${call.title}`, data.error);
      }
    } catch (e) {
      results.failed++;
      console.error(`[nightly-intel] Error analyzing ${call.title}:`, e.message);
    }
    // Small delay between calls to avoid rate limiting
    await new Promise(r => setTimeout(r, 500));
  }

  console.log(`[nightly-intel] Done: ${results.analyzed} analyzed, ${results.failed} failed`);
  return res.status(200).json({ ...results, total: allCalls.length, queued: toAnalyze.length });
}
