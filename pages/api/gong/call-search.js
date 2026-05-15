import { apiError, apiSuccess, logRequest } from '../../../lib/apiUtils';
import { createServerSupabaseClient, getSupabase } from '../../../lib/supabase';

function extractSnippet(text, keyword, radius = 100) {
  if (!text || !keyword) return null;
  const lower = text.toLowerCase();
  const idx = lower.indexOf(keyword.toLowerCase());
  if (idx === -1) return null;
  const start = Math.max(0, idx - radius);
  const end = Math.min(text.length, idx + keyword.length + radius);
  const snippet = text.slice(start, end);
  return (start > 0 ? '…' : '') + snippet + (end < text.length ? '…' : '');
}

export default async function handler(req, res) {
  logRequest(req, 'gong/call-search');
  if (req.method !== 'GET') return apiError(res, 405, 'GET only');

  const auth = createServerSupabaseClient(req, res);
  const { data: { user } } = await auth.auth.getUser();
  if (!user) return apiError(res, 401, 'Unauthorized');

  const { q, accountId } = req.query;
  if (!q || q.trim().length < 2) return apiError(res, 400, 'q must be at least 2 characters');

  const keyword = q.trim();
  const db = getSupabase();

  const results = [];
  const seenCallIds = new Set();

  try {
    let analysisQuery = db
      .from('gong_call_analyses')
      .select('gong_call_id, title, call_date, call_type, rep_name, gong_url, account_id, analysis, accounts(name)')
      .not('analysis', 'is', null)
      .limit(30)
      .order('call_date', { ascending: false });

    if (accountId) analysisQuery = analysisQuery.eq('account_id', accountId);

    const { data: analysisRows, error: analysisError } = await analysisQuery;

    if (analysisError) {
      console.error('[call-search] analysis query error:', analysisError.message);
    }

    const analysisFieldKeys = [
      'summary',
      'pain_points_identified',
      'next_steps_mentioned',
      'objections',
      'buying_signals',
      'red_flags',
    ];

    const kw = keyword.toLowerCase();

    for (const row of (analysisRows || [])) {
      const a = row.analysis || {};
      const matchedFields = [];

      for (const field of analysisFieldKeys) {
        const val = a[field];
        if (!val) continue;
        const text = typeof val === 'string' ? val : JSON.stringify(val);
        if (text.toLowerCase().includes(kw)) {
          matchedFields.push(field);
        }
      }

      if (matchedFields.length > 0) {
        seenCallIds.add(row.gong_call_id);
        const primaryField = matchedFields[0];
        const primaryVal = a[primaryField];
        const primaryText = typeof primaryVal === 'string' ? primaryVal : JSON.stringify(primaryVal);
        const snippet = extractSnippet(primaryText, keyword);
        results.push({
          id: row.gong_call_id,
          accountId: row.account_id,
          accountName: row.accounts?.name || null,
          callDate: row.call_date,
          callTitle: row.title,
          callType: row.call_type,
          repName: row.rep_name,
          gongUrl: row.gong_url,
          matchType: 'analysis',
          snippet,
          analysisFields: matchedFields,
        });
      }
    }
  } catch (e) {
    console.error('[call-search] analysis search error:', e.message);
  }

  try {
    let transcriptQuery = db
      .from('transcripts')
      .select('id, gong_call_id, account_id, date, text, accounts(name)')
      .ilike('text', `%${keyword}%`)
      .not('text', 'is', null)
      .not('text', 'ilike', '[%')
      .limit(20)
      .order('date', { ascending: false });

    if (accountId) transcriptQuery = transcriptQuery.eq('account_id', accountId);

    const { data: transcriptRows, error: transcriptError } = await transcriptQuery;

    if (transcriptError) {
      console.error('[call-search] transcript query error:', transcriptError.message);
    }

    for (const row of (transcriptRows || [])) {
      if (!row.gong_call_id || seenCallIds.has(row.gong_call_id)) continue;

      let callTitle = null;
      let callType = null;
      let repName = null;
      let gongUrl = null;
      let callDate = row.date;

      try {
        const { data: callRow } = await db
          .from('gong_call_analyses')
          .select('title, call_type, rep_name, gong_url, call_date')
          .eq('gong_call_id', row.gong_call_id)
          .maybeSingle();
        if (callRow) {
          callTitle = callRow.title;
          callType = callRow.call_type;
          repName = callRow.rep_name;
          gongUrl = callRow.gong_url;
          callDate = callRow.call_date || row.date;
        }
      } catch { /* continue without call metadata */ }

      const snippet = extractSnippet(row.text, keyword);
      seenCallIds.add(row.gong_call_id);
      results.push({
        id: row.gong_call_id || row.id,
        accountId: row.account_id,
        accountName: row.accounts?.name || null,
        callDate,
        callTitle,
        callType,
        repName,
        gongUrl,
        matchType: 'transcript',
        snippet,
        analysisFields: [],
      });
    }
  } catch (e) {
    console.error('[call-search] transcript search error:', e.message);
  }

  results.sort((a, b) => {
    if (!a.callDate && !b.callDate) return 0;
    if (!a.callDate) return 1;
    if (!b.callDate) return -1;
    return new Date(b.callDate) - new Date(a.callDate);
  });

  return apiSuccess(res, { results: results.slice(0, 30), keyword });
}
