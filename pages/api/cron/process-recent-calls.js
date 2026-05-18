import { createGongHeaders } from '../../../lib/apiUtils';
import { getSupabase } from '../../../lib/supabase';
import { sendCallCoachingDM } from '../../../lib/coaching';

const GONG_API_BASE = 'https://api.gong.io';
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

  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(500).json({ error: 'ANTHROPIC_API_KEY not configured' });
  }

  const gongHeaders = createGongHeaders(gongAccessKey, gongSecretKey);

  const toDate = new Date();
  const fromDate = new Date(Date.now() - 2 * 60 * 60 * 1000);

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

  let allCalls = [];
  let cursor = null;
  let pageCount = 0;

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
    } while (cursor && pageCount < 3);
  } catch (e) {
    return res.status(500).json({ error: `Gong API error: ${e.message}` });
  }

  if (!allCalls.length) {
    return res.status(200).json({ processed: 0, skipped: 0, errors: [], message: 'No calls in last 2 hours' });
  }

  const db = getSupabase();
  const gongCallIds = allCalls.map(c => c.id);

  const { data: existingRows } = await db
    .from('gong_call_analyses')
    .select('gong_call_id, analyzed_at')
    .in('gong_call_id', gongCallIds);

  const analyzedIds = new Set((existingRows || []).filter(r => r.analyzed_at).map(r => r.gong_call_id));

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
    });

  const skipped = allCalls.length - toAnalyze.length;

  if (!toAnalyze.length) {
    return res.status(200).json({ processed: 0, skipped, errors: [], message: 'All recent calls already analyzed' });
  }

  const baseUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : 'http://localhost:3000';

  let processed = 0;
  const errors = [];

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
        processed++;
        console.log(`[process-recent-calls] Analyzed: ${call.title}`);
        if (user?.email) {
          sendCallCoachingDM({
            analysis: data.analysis,
            callTitle: call.title || 'Untitled',
            callDate: call.started || null,
            accountName: data.analysis?.account_name || null,
            repEmail: user.email,
            gongCallId: call.id,
          }).catch(e => console.error('[coaching-dm]', e.message));
        }
      } else {
        errors.push({ callId: call.id, title: call.title, error: data.error || 'No analysis returned' });
        console.error(`[process-recent-calls] Failed: ${call.title}`, data.error);
      }
    } catch (e) {
      errors.push({ callId: call.id, title: call.title, error: e.message });
      console.error(`[process-recent-calls] Error analyzing ${call.title}:`, e.message);
    }
    await new Promise(r => setTimeout(r, 500));
  }

  console.log(`[process-recent-calls] Done: ${processed} processed, ${skipped} skipped, ${errors.length} errors`);
  return res.status(200).json({ processed, skipped, errors });
}
