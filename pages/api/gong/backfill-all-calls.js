import { createGongHeaders } from '../../../lib/apiUtils';
import { createServerSupabaseClient, getSupabase } from '../../../lib/supabase';

const GONG_API_BASE = 'https://api.gong.io';
const AUTO_ANALYZE_REPS = ['James Lindberg'];
const BATCH_SIZE = 50;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const auth = createServerSupabaseClient(req, res);
  const { data: { user } } = await auth.auth.getUser();
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  const db = getSupabase();
  const { data: profile } = await db
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (!['manager','admin'].includes(profile?.role)) {
    return res.status(403).json({ error: 'Manager role required' });
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
  const fromDate = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000);

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
      if (pageCount > 0) await new Promise(r => setTimeout(r, 200));

      const response = await fetch(url, { method: 'GET', headers: gongHeaders });
      if (!response.ok) break;
      const data = await response.json();
      allCalls = allCalls.concat(data.calls || []);
      cursor = data.records?.cursor || null;
      pageCount++;
    } while (cursor && pageCount < 20);
  } catch (e) {
    return res.status(500).json({ error: `Gong API error: ${e.message}` });
  }

  const autoRepCalls = allCalls.filter(call => {
    const user = userMap[call.primaryUserId];
    return user && AUTO_ANALYZE_REPS.includes(user.name);
  });

  if (!autoRepCalls.length) {
    return res.status(200).json({ processed: 0, remaining: 0, done: true, message: 'No calls found for configured reps' });
  }

  const gongCallIds = autoRepCalls.map(c => c.id);
  const { data: existingRows } = await db
    .from('gong_call_analyses')
    .select('gong_call_id')
    .in('gong_call_id', gongCallIds)
    .not('analyzed_at', 'is', null);

  const analyzedIds = new Set((existingRows || []).map(r => r.gong_call_id));

  const toAnalyze = autoRepCalls.filter(call => !analyzedIds.has(call.id));
  const batch = toAnalyze.slice(0, BATCH_SIZE);
  const remaining = Math.max(0, toAnalyze.length - BATCH_SIZE);

  if (!batch.length) {
    return res.status(200).json({ processed: 0, remaining: 0, done: true, message: 'All calls already analyzed' });
  }

  const getCallType = (title) => {
    const t = (title || '').toLowerCase();
    if (t.includes('intro') || t.includes('introduction')) return 'intro';
    if (t.includes('demo')) return 'demo';
    return 'solution_validation';
  };

  const baseUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : 'http://localhost:3000';

  const cronSecret = process.env.CRON_SECRET;
  let processed = 0;
  const errors = [];

  for (const call of batch) {
    const repUser = userMap[call.primaryUserId] || null;
    try {
      const r = await fetch(`${baseUrl}/api/gong/intel-analyze`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${cronSecret}`,
        },
        body: JSON.stringify({
          callId: call.id,
          title: call.title || 'Untitled',
          date: call.started || null,
          callType: getCallType(call.title),
          repName: repUser?.name || null,
          repEmail: repUser?.email || null,
          durationSeconds: call.duration || 0,
          gongUrl: call.url || null,
        }),
      });
      const data = await r.json().catch(() => ({}));
      if (data.analysis) {
        processed++;
      } else {
        errors.push({ callId: call.id, error: data.error || 'No analysis returned' });
      }
    } catch (e) {
      errors.push({ callId: call.id, error: e.message });
    }
    await new Promise(r => setTimeout(r, 300));
  }

  return res.status(200).json({
    processed,
    remaining,
    done: remaining === 0,
    errors: errors.length ? errors : undefined,
  });
}
