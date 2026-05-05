import {
  apiError,
  apiSuccess,
  validateMethod,
  validateGongCredentials,
  createGongHeaders,
  logRequest,
} from '../../../lib/apiUtils';
import { createServerSupabaseClient } from '../../../lib/supabase';

const GONG_API_BASE = 'https://api.gong.io';

export default async function handler(req, res) {
  logRequest(req, 'gong/intel-calls');
  if (!validateMethod(req, res, 'GET')) return;

  const credentials = validateGongCredentials(res);
  if (!credentials) return;
  const { accessKey, secretKey } = credentials;
  const headers = createGongHeaders(accessKey, secretKey);

  const toDate = new Date();
  const fromDate = new Date();
  fromDate.setMonth(fromDate.getMonth() - 6);

  try {
    // Paginate through all calls in the 6-month window
    let allCalls = [];
    let cursor = null;
    let pageCount = 0;

    do {
      let url = `${GONG_API_BASE}/v2/calls?fromDateTime=${fromDate.toISOString()}&toDateTime=${toDate.toISOString()}`;
      if (cursor) url += `&cursor=${encodeURIComponent(cursor)}`;

      const response = await fetch(url, { method: 'GET', headers });
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        return apiError(res, response.status, err.errors?.[0]?.message || 'Gong API error');
      }
      const data = await response.json();
      allCalls = allCalls.concat(data.calls || []);
      cursor = data.records?.cursor || null;
      pageCount++;
    } while (cursor && pageCount < 20);

    // Filter to calls with "intro" or "demo" in title (case-insensitive)
    const filtered = allCalls.filter(call => {
      const title = (call.title || '').toLowerCase();
      return title.includes('intro') || title.includes('demo');
    });

    // Fetch rep names from Gong users
    let userMap = {};
    try {
      const usersRes = await fetch(`${GONG_API_BASE}/v2/users`, { method: 'GET', headers });
      if (usersRes.ok) {
        const usersData = await usersRes.json();
        (usersData.users || []).forEach(u => {
          userMap[u.id] = {
            name: `${u.firstName || ''} ${u.lastName || ''}`.trim(),
            email: u.emailAddress,
          };
        });
      }
    } catch { /* continue without names */ }

    // Fetch ALL cached analyses from Supabase — avoid .in() with 200+ IDs (URL length limits)
    const db = createServerSupabaseClient(req, res);
    let cachedMap = {};

    const { data: rows, error: dbError } = await db
      .from('gong_call_analyses')
      .select('gong_call_id, analysis, analyzed_at');

    if (dbError) {
      console.error('intel-calls: Supabase read error:', dbError);
    }
    (rows || []).forEach(row => {
      cachedMap[row.gong_call_id] = { analysis: row.analysis, analyzedAt: row.analyzed_at };
    });

    const getCallType = (title) => {
      const t = (title || '').toLowerCase();
      if (t.includes('intro')) return 'intro';
      if (t.includes('demo')) return 'demo';
      return 'other';
    };

    const calls = filtered.map(call => {
      const user = userMap[call.primaryUserId] || null;
      const cached = cachedMap[call.id] || null;
      return {
        gongCallId: call.id,
        title: call.title || 'Untitled',
        date: call.started || null,
        callType: getCallType(call.title),
        repName: user?.name || null,
        repEmail: user?.email || null,
        durationSeconds: call.duration || 0,
        gongUrl: call.url || null,
        analysis: cached?.analysis || null,
        analyzedAt: cached?.analyzedAt || null,
      };
    });

    calls.sort((a, b) => new Date(b.date) - new Date(a.date));

    return apiSuccess(res, {
      calls,
      totalCount: calls.length,
      analyzedCount: calls.filter(c => c.analysis).length,
      dateRange: { from: fromDate.toISOString(), to: toDate.toISOString() },
    });
  } catch (error) {
    console.error('intel-calls error:', error);
    return apiError(res, 500, error.message);
  }
}
