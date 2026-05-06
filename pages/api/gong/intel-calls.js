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

    // Fetch rep names from Gong users first — needed for rep filtering
    let userMap = {};
    try {
      const usersRes = await fetch(`${GONG_API_BASE}/v2/users`, { method: 'GET', headers });
      if (usersRes.ok) {
        const usersData = await usersRes.json();
        (usersData.users || []).forEach(u => {
          const name = `${u.firstName || ''} ${u.lastName || ''}`.trim();
          userMap[u.id] = { name, email: u.emailAddress };
        });
      }
    } catch { /* continue without names */ }

    do {
      let url = `${GONG_API_BASE}/v2/calls?fromDateTime=${fromDate.toISOString()}&toDateTime=${toDate.toISOString()}`;
      if (cursor) url += `&cursor=${encodeURIComponent(cursor)}`;

      // Small delay between pages to avoid Gong rate limiting
      if (pageCount > 0) await new Promise(r => setTimeout(r, 150));

      const response = await fetch(url, { method: 'GET', headers });
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        // If we already have some calls, return them with a warning rather than failing entirely
        if (allCalls.length > 0) break;
        return apiError(res, response.status, err.errors?.[0]?.message || 'Gong API error');
      }
      const data = await response.json();
      allCalls = allCalls.concat(data.calls || []);
      cursor = data.records?.cursor || null;
      pageCount++;
    } while (cursor && pageCount < 15);

    // Fetch ALL cached analyses from Supabase — avoid .in() with 200+ IDs (URL length limits)
    const db = createServerSupabaseClient(req, res);
    let cachedMap = {};

    const { data: rows, error: dbError } = await db
      .from('gong_call_analyses')
      .select('gong_call_id, analysis, analyzed_at, ignored, ignore_reason, hubspot_deal_id, hubspot_deal_stage, hubspot_checked_at, deal_close_date, deal_name, account_id, scoring_version');

    if (dbError) {
      console.error('intel-calls: Supabase read error:', dbError);
    }
    (rows || []).forEach(row => {
      cachedMap[row.gong_call_id] = {
        analysis: row.analysis,
        analyzedAt: row.analyzed_at,
        ignored: row.ignored || false,
        ignoreReason: row.ignore_reason || null,
        hubspotDealId: row.hubspot_deal_id || null,
        dealStage: row.hubspot_deal_stage || null,
        hubspotCheckedAt: row.hubspot_checked_at || null,
        dealCloseDate: row.deal_close_date || null,
        dealName: row.deal_name || null,
        accountId: row.account_id || null,
        scoringVersion: row.scoring_version || null,
      };
    });

    // Exclude post-sale calls: calls that happened after their deal's close date
    // (requires HubSpot enrichment to have run first; un-enriched calls are always included)
    const filtered = allCalls.filter(call => {
      const closeDate = cachedMap[call.id]?.dealCloseDate;
      if (!closeDate) return true;
      return new Date(call.started || 0) <= new Date(closeDate);
    });

    const getCallType = (title) => {
      const t = (title || '').toLowerCase();
      if (t.includes('intro') || t.includes('introduction')) return 'intro';
      if (t.includes('demo')) return 'demo';
      return 'solution_validation';
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
        ignored: cached?.ignored || false,
        ignoreReason: cached?.ignoreReason || null,
        hubspotDealId: cached?.hubspotDealId || null,
        dealStage: cached?.dealStage || null,
        hubspotCheckedAt: cached?.hubspotCheckedAt || null,
        dealCloseDate: cached?.dealCloseDate || null,
        dealName: cached?.dealName || null,
        accountId: cached?.accountId || null,
        scoringVersion: cached?.scoringVersion || null,
      };
    });

    calls.sort((a, b) => new Date(b.date) - new Date(a.date));

    // Build user list only from reps who actually have calls in the dataset
    const repCounts = {};
    calls.forEach(c => {
      if (c.repName) repCounts[c.repName] = (repCounts[c.repName] || 0) + 1;
    });
    const allUsers = Object.entries(repCounts)
      .map(([name, callCount]) => ({ name, callCount }))
      .sort((a, b) => b.callCount - a.callCount);

    const closedWonCount = calls.filter(c => c.dealStage?.toLowerCase() === 'closedwon').length;
    const uncheckedCount = calls.filter(c => !c.hubspotCheckedAt).length;

    return apiSuccess(res, {
      calls,
      allUsers,
      totalCount: calls.length,
      analyzedCount: calls.filter(c => c.analysis).length,
      closedWonCount,
      uncheckedCount,
      dateRange: { from: fromDate.toISOString(), to: toDate.toISOString() },
    });
  } catch (error) {
    console.error('intel-calls error:', error);
    return apiError(res, 500, error.message);
  }
}
