// POST /api/hubspot/match-calls
// Bulk fuzzy-matches unlinked gong_call_analyses to accounts by call title.
// Run after initial sync-deals and on-demand when new calls are imported.
// intel-analyze.js handles inline matching for new calls.

import { apiError, apiSuccess, logRequest } from '../../../lib/apiUtils';
import { createServerSupabaseClient, getSupabase } from '../../../lib/supabase';

// Preferred stages: active prospects score a bonus so they beat closed_won on ties
const STAGE_PRIORITY = {
  legal: 10, proposal: 10, solution_validation: 9, demo: 9,
  active_pursuit: 8, intro_scheduled: 7, qualifying: 6,
  inactive_ae_follow_up: 3, inactive_sdr_follow_up: 3,
  closed_lost: 1, closed_won: 0,
};

function stagePriority(stage) {
  return STAGE_PRIORITY[stage] ?? 4;
}

// Extract the prospect company name from structured Gong title formats:
//   "Banner - Company: Topic"
//   "Banner | Company - Topic"
//   "Company | Banner: Topic"
//   "Company - Banner - Topic"
//   "Company + Banner - Topic"
function extractCompanyFromTitle(title) {
  if (!title) return null;

  // "Banner - Company: Topic", "Banner | Company - Topic", "Banner/Company: Topic"
  // Stop at `: ` or ` - ` which separate company name from call topic
  let m = title.match(/^Banner\s*[-|/]\s*(.+?)(?:\s*[:|]\s*\S.*|\s+-\s+\S.*)?$/i);
  if (m) return m[1].trim();

  // "Company | Banner..."
  m = title.match(/^(.+?)\s*[|]\s*Banner\b/i);
  if (m) return m[1].trim();

  // "Company - Banner..."
  m = title.match(/^(.+?)\s+-\s+Banner\b/i);
  if (m) return m[1].trim();

  // "Company + Banner..."
  m = title.match(/^(.+?)\s*\+\s*Banner\b/i);
  if (m) return m[1].trim();

  return null;
}

function normalizeName(s) {
  return (s || '')
    .toLowerCase()
    .replace(/banner[\s\-–—|+]*/gi, '')
    .replace(/[\-–—:|+,]/g, ' ')
    .replace(/\b(intro|demo|presentation|follow\s*up|meeting|call|new deal|year \d+|weekly|monthly|check\s*in|training|implementation|onboarding|review|update|sync|status|overview|assoc\.?|associates|llc|inc\.?|corp\.?|ltd\.?)\b/gi, '')
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// Returns match quality 0-10. Higher = more confident.
// extracted=true means we parsed the company from a structured title pattern.
function scoreMatch(accountName, targetText, extracted) {
  const a = normalizeName(accountName);
  const d = normalizeName(targetText);
  if (!a || !d) return 0;

  if (a === d) return extracted ? 10 : 8;
  if (d.startsWith(a) || a.startsWith(d)) return extracted ? 9 : 7;
  if (d.includes(a) || a.includes(d)) return extracted ? 8 : 6;

  const aWords = new Set(a.split(' ').filter(w => w.length > 3));
  const dWords = d.split(' ').filter(w => w.length > 3);
  const overlap = dWords.filter(w => aWords.has(w)).length;

  if (overlap >= 3) return 5;
  if (overlap >= 2) return extracted ? 5 : 3;

  // Single distinctive word: only fire when the word is the account's first word
  // and is long enough to be meaningful (≥ 6 chars avoids "real", "group", etc.)
  if (overlap === 1) {
    const firstAccountWord = a.split(' ')[0];
    if (firstAccountWord.length >= 6 && dWords.includes(firstAccountWord)) {
      return extracted ? 3 : 2;
    }
  }

  return 0;
}

export function matchScore(accountName, callTitle) {
  const extracted = extractCompanyFromTitle(callTitle);
  if (extracted) {
    return scoreMatch(accountName, extracted, true);
  }
  return scoreMatch(accountName, callTitle, false);
}

export { normalizeName };

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

  // Load all accounts with stage for priority scoring
  const [{ data: accounts }, { data: calls }] = await Promise.all([
    db.from('accounts').select('id, name, stage'),
    db.from('gong_call_analyses')
      .select('id, gong_call_id, title')
      .is('account_id', null)
      .eq('ignored', false)
      .not('title', 'is', null),
  ]);

  if (!accounts?.length) return apiSuccess(res, { matched: 0, total: 0, reason: 'no accounts synced yet' });
  if (!calls?.length) return apiSuccess(res, { matched: 0, total: 0 });

  // Minimum quality thresholds
  const MIN_SCORE_EXTRACTED = 6;   // structured title extraction: need a solid name match
  const MIN_SCORE_FALLBACK = 2;    // unstructured: only single distinctive-word matches

  const updates = [];

  for (const call of calls) {
    const extracted = extractCompanyFromTitle(call.title);
    const minScore = extracted ? MIN_SCORE_EXTRACTED : MIN_SCORE_FALLBACK;

    let bestAccount = null;
    let bestScore = 0;
    let bestStagePriority = -1;

    for (const account of accounts) {
      const score = extracted
        ? scoreMatch(account.name, extracted, true)
        : scoreMatch(account.name, call.title, false);

      if (score < minScore) continue;

      const sp = stagePriority(account.stage);

      // Prefer higher score; break ties by stage priority (active prospects win)
      if (
        score > bestScore ||
        (score === bestScore && sp > bestStagePriority)
      ) {
        bestScore = score;
        bestStagePriority = sp;
        bestAccount = account;
      }
    }

    if (bestAccount) {
      updates.push({
        id:               call.id,
        gong_call_id:     call.gong_call_id,
        account_id:       bestAccount.id,
        match_confidence: bestScore / 10,
        match_method:     extracted ? 'title_structured' : 'title_fuzzy',
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

  console.log(`[hubspot/match-calls] matched ${matched} of ${calls.length} unlinked calls`);
  return apiSuccess(res, { matched, total: calls.length, accountsSearched: accounts.length });
}
