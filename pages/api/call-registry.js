// GET /api/call-registry
// Paginated, filterable registry of all Gong calls with analysis status + account linkage.
// Query: page, limit, rep, status (all|analyzed|pending|ignored), callType, search, dateFrom, dateTo

import { createServerSupabaseClient, getSupabase } from '../../lib/supabase';
import { apiError, apiSuccess, logRequest } from '../../lib/apiUtils';

// Derived from title keywords — ordered by specificity (implementation before recurring)
function deriveCallType(title) {
  if (!title) return 'unknown'
  const t = title.toLowerCase()
  if (/\bimplementation\b|\bonboarding\b|\bgo.?live\b/.test(t)) return 'implementation'
  if (/\btraining\b/.test(t)) return 'training'
  if (/\bintro\b|\bintroduction\b/.test(t)) return 'intro'
  if (/\bdemo\b/.test(t)) return 'demo'
  if (/\bpilot\b|\bpoc\b|\bevaluation\b/.test(t)) return 'evaluation'
  if (/\bdiscovery\b|\bscoping\b/.test(t)) return 'discovery'
  if (/\bpricing\b|\bproposal\b/.test(t)) return 'pricing'
  if (/\blegal\b|\bcontract\b|\bmsa\b/.test(t)) return 'contract'
  if (/\bqbr\b|\bbusiness review\b/.test(t)) return 'qbr'
  if (/\bcustomer success\b|\boffice hours\b/.test(t)) return 'cs'
  if (/\bweekly\b|\bbiweekly\b|\bmonthly\b|\bquarterly\b|\bcadence\b|\bcheck.?in\b|\bsync\b/.test(t)) return 'recurring'
  return 'other'
}

// Extract likely company name from call title for unlinked calls
function extractPossibleCompany(title) {
  if (!title) return null
  let m = title.match(/^Banner\s*[\|\/]\s*([^:\-]+?)(\s*[-:].+)?$/i)
  if (m) return m[1].trim()
  m = title.match(/^Banner\s*-\s*([^:]+?)\s*:/i)
  if (m) return m[1].trim()
  m = title.match(/^(.+?)\s*[\|\/]\s*Banner/i)
  if (m) return m[1].trim()
  m = title.match(/^(.+?)\s+-\s+Banner/i)
  if (m) return m[1].trim()
  return null
}

export default async function handler(req, res) {
  logRequest(req, 'call-registry');
  if (req.method !== 'GET') return apiError(res, 405, 'GET only');

  const auth = createServerSupabaseClient(req, res);
  const { data: { user } } = await auth.auth.getUser();
  if (!user) return apiError(res, 401, 'Unauthorized');

  const db = getSupabase();

  const {
    page = '0',
    limit = '50',
    rep = '',
    status = 'all',
    callType = '',
    callCategory = '',
    search = '',
    dateFrom = '',
    dateTo = '',
  } = req.query;

  const pageNum = Math.max(0, parseInt(page, 10) || 0);
  const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 50));
  const from = pageNum * limitNum;
  const to = from + limitNum - 1;

  // Account name search: resolve matching account IDs first
  let searchAccountIds = null;
  if (search) {
    const { data: accts } = await db.from('accounts')
      .select('id')
      .ilike('name', `%${search}%`);
    searchAccountIds = (accts || []).map(a => a.id);
  }

  // Main paginated query
  let q = db.from('gong_call_analyses')
    .select(
      `id, gong_call_id, title, call_date, rep_name, rep_email, duration_seconds,
       analyzed_at, ignored, ignore_reason, account_id,
       match_method, match_confidence, derived_call_type, call_category, transcript_text, analysis,
       accounts(id, name, stage)`,
      { count: 'exact' }
    )
    .order('call_date', { ascending: false, nullsFirst: false })
    .range(from, to);

  if (status === 'analyzed') {
    q = q.not('analyzed_at', 'is', null).not('ignored', 'is', true);
  } else if (status === 'pending') {
    q = q.is('analyzed_at', null).not('ignored', 'is', true);
  } else if (status === 'ignored') {
    q = q.eq('ignored', true);
  }

  if (rep) q = q.ilike('rep_name', `%${rep}%`);
  if (callType) q = q.eq('derived_call_type', callType);
  if (callCategory) q = q.eq('call_category', callCategory);
  if (dateFrom) q = q.gte('call_date', dateFrom);
  if (dateTo) q = q.lte('call_date', dateTo + 'T23:59:59');

  if (search) {
    if (searchAccountIds && searchAccountIds.length > 0) {
      q = q.in('account_id', searchAccountIds);
    } else {
      q = q.ilike('rep_name', `%${search}%`);
    }
  }

  // Summary counts + reps list in parallel
  const [mainRes, analyzedRes, pendingRes, ignoredRes, linkedRes, repsRes] = await Promise.all([
    q,
    db.from('gong_call_analyses').select('*', { count: 'exact', head: true })
      .not('analyzed_at', 'is', null).not('ignored', 'is', true),
    db.from('gong_call_analyses').select('*', { count: 'exact', head: true })
      .is('analyzed_at', null).not('ignored', 'is', true),
    db.from('gong_call_analyses').select('*', { count: 'exact', head: true })
      .eq('ignored', true),
    db.from('gong_call_analyses').select('*', { count: 'exact', head: true })
      .not('account_id', 'is', null),
    db.from('gong_call_analyses')
      .select('rep_name, rep_email')
      .not('rep_name', 'is', null)
      .not('ignored', 'is', true),
  ]);

  if (mainRes.error) return apiError(res, 500, mainRes.error.message);

  // Deduplicate reps
  const repMap = {};
  for (const r of (repsRes.data || [])) {
    const key = (r.rep_email || r.rep_name || '').toLowerCase();
    if (key && !repMap[key]) repMap[key] = { name: r.rep_name, email: r.rep_email };
  }
  const reps = Object.values(repMap)
    .filter(r => r.name)
    .sort((a, b) => (a.name || '').localeCompare(b.name || ''));

  let calls = (mainRes.data || []).map(c => {
    const title = c.title || c.analysis?.call_title || null;
    const ct = deriveCallType(title);
    return {
      id: c.id,
      callDate: c.call_date,
      repName: c.rep_name,
      repEmail: c.rep_email,
      durationSeconds: c.duration_seconds,
      analyzedAt: c.analyzed_at,
      isIgnored: c.ignored || false,
      ignoreReason: c.ignore_reason,
      accountId: c.account_id,
      accountName: c.accounts?.name || null,
      accountStage: c.accounts?.stage || null,
      matchMethod: c.match_method,
      matchConfidence: c.match_confidence,
      hasTranscript: !!c.transcript_text,
      title,
      callType: c.derived_call_type || ct,
      callCategory: c.call_category || null,
      possibleCompany: !c.account_id ? extractPossibleCompany(title) : null,
      discoveryScore: c.analysis?.discovery_score ?? null,
      icpScore: c.analysis?.icp_score ?? null,
      talkRatio: c.analysis?.rep_talk_ratio ?? null,
      nextStepCount: (c.analysis?.next_steps_mentioned || []).length,
      hasRedFlags: (c.analysis?.red_flags || []).length > 0,
      summary: c.analysis?.summary?.slice(0, 200) || null,
    };
  });

  return apiSuccess(res, {
    calls,
    total: mainRes.count || 0,
    page: pageNum,
    limit: limitNum,
    reps,
    summary: {
      analyzed: analyzedRes.count || 0,
      pending: pendingRes.count || 0,
      ignored: ignoredRes.count || 0,
      linked: linkedRes.count || 0,
    },
  });
}
