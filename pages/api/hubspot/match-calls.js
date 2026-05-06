// POST /api/hubspot/match-calls
// Bulk fuzzy-matches all unlinked gong_call_analyses to accounts by call title.
// Run once after initial sync-deals; intel-analyze.js handles new calls inline.
// No Gong API needed — pure computation on existing DB records.

import { apiError, apiSuccess, logRequest } from '../../../lib/apiUtils';
import { createServerSupabaseClient, getSupabase } from '../../../lib/supabase';

function normalizeName(s) {
  return (s || '')
    .toLowerCase()
    .replace(/banner[\s\-–—]*/gi, '')
    .replace(/[\-–—:|]/g, ' ')
    .replace(/\b(intro|demo|discovery|presentation|follow\s*up|meeting|call|new deal|year \d+)\b/gi, '')
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function matchScore(accountName, callTitle) {
  const a = normalizeName(accountName);
  const d = normalizeName(callTitle);
  if (!a || !d) return 0;
  if (a === d) return 10;
  if (d.startsWith(a) || a.startsWith(d)) return 8;
  if (d.includes(a) || a.includes(d)) return 6;
  const aWords = new Set(a.split(' ').filter(w => w.length > 2));
  const dWords = d.split(' ').filter(w => w.length > 2);
  const overlap = dWords.filter(w => aWords.has(w)).length;
  if (overlap >= 3) return 5;
  if (overlap >= 2) return 3;
  if (overlap === 1 && aWords.size === 1) return 2;
  return 0;
}

export { normalizeName, matchScore };

export default async function handler(req, res) {
  logRequest(req, 'hubspot/match-calls');
  if (req.method !== 'POST') return apiError(res, 405, 'Method not allowed');

  const isCron = process.env.CRON_SECRET && req.headers['authorization'] === `Bearer ${process.env.CRON_SECRET}`;
  if (!isCron) {
    const authClient = createServerSupabaseClient(req, res);
    const { data: { user } } = await authClient.auth.getUser();
    if (!user) return apiError(res, 401, 'Unauthorized');
  }

  const db = getSupabase();

  const [{ data: accounts }, { data: calls }] = await Promise.all([
    db.from('accounts').select('id, name'),
    db.from('gong_call_analyses')
      .select('id, gong_call_id, title')
      .is('account_id', null)
      .not('title', 'is', null),
  ]);

  if (!accounts?.length) return apiSuccess(res, { matched: 0, total: 0, reason: 'no accounts synced yet' });
  if (!calls?.length) return apiSuccess(res, { matched: 0, total: 0 });

  const MIN_SCORE = 6;
  const updates = [];

  for (const call of calls) {
    let bestAccount = null;
    let bestScore = 0;

    for (const account of accounts) {
      const score = matchScore(account.name, call.title);
      if (score > bestScore) {
        bestScore = score;
        bestAccount = account;
      }
    }

    if (bestAccount && bestScore >= MIN_SCORE) {
      updates.push({
        id:               call.id,
        gong_call_id:     call.gong_call_id,
        account_id:       bestAccount.id,
        match_confidence: bestScore / 10,
        match_method:     'title_fuzzy',
      });
    }
  }

  let matched = 0;
  for (let i = 0; i < updates.length; i += 100) {
    const { error } = await db
      .from('gong_call_analyses')
      .upsert(updates.slice(i, i + 100), { onConflict: 'gong_call_id' });
    if (!error) matched += updates.slice(i, i + 100).length;
  }

  console.log(`[hubspot/match-calls] matched ${matched} of ${calls.length} unlinked calls to accounts`);
  return apiSuccess(res, { matched, total: calls.length, accountsSearched: accounts.length });
}
