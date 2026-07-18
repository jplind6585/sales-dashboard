// GET /api/pipeline/cohort-funnel
// A TRUE cohort funnel + stage velocity from account_stage_history — replaces the pseudo-funnels
// that computed conversion as a ratio of current head-counts (PLATFORM_REVIEW §6.2). "Reached
// stage X" = the account ever transitioned into X or is currently at/past it. Conversion X→X+1 =
// reached[X+1]/reached[X]. Velocity = median dwell time in each stage. Populates as history
// accumulates (the HubSpot sync now records every move).

import { createServerSupabaseClient, getSupabase } from '../../../lib/supabase';
import { apiError, apiSuccess, logRequest } from '../../../lib/apiUtils';
import { ACTIVE_STAGE_ORDER, ALL_STAGE_ORDER, STAGE_LABELS } from '../../../lib/constants';

const median = (arr) => {
  if (!arr.length) return null;
  const s = [...arr].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2);
};
const stageIdx = (s) => ALL_STAGE_ORDER.indexOf(s);

export default async function handler(req, res) {
  logRequest(req, 'pipeline/cohort-funnel');
  if (req.method !== 'GET') return apiError(res, 405, 'GET only');

  const auth = createServerSupabaseClient(req, res);
  const { data: { user } } = await auth.auth.getUser();
  if (!user) return apiError(res, 401, 'Unauthorized');

  const db = getSupabase();
  const [acctRes, histRes] = await Promise.all([
    db.from('accounts').select('id, stage').limit(2000),
    db.from('account_stage_history').select('account_id, from_stage, to_stage, days_in_prior_stage, changed_at').order('changed_at', { ascending: true }).limit(10000),
  ]);
  const accounts = acctRes.data || [];
  const history = histRes.data || [];

  // Furthest ACTIVE stage each account reached (from current stage + every historical to_stage).
  const furthestIdxByAccount = {};
  const activeMax = ACTIVE_STAGE_ORDER.length - 1;
  const consider = (accId, stage) => {
    const i = ACTIVE_STAGE_ORDER.indexOf(stage);
    if (i < 0) return;
    if (furthestIdxByAccount[accId] == null || i > furthestIdxByAccount[accId]) furthestIdxByAccount[accId] = i;
  };
  for (const a of accounts) {
    // A closed account still "reached" the last active stage it passed through; current active stage counts directly.
    if (ACTIVE_STAGE_ORDER.includes(a.stage)) consider(a.id, a.stage);
    else if (a.stage === 'closed_won') furthestIdxByAccount[a.id] = Math.max(furthestIdxByAccount[a.id] ?? 0, activeMax);
  }
  for (const h of history) { consider(h.account_id, h.to_stage); consider(h.account_id, h.from_stage); }

  // reached[i] = accounts whose furthest active stage index >= i.
  const reached = ACTIVE_STAGE_ORDER.map((_, i) =>
    Object.values(furthestIdxByAccount).filter((fi) => fi >= i).length
  );

  const funnel = ACTIVE_STAGE_ORDER.map((stage, i) => {
    const next = i < ACTIVE_STAGE_ORDER.length - 1 ? reached[i + 1] : null;
    const conversionToNext = next != null && reached[i] > 0 ? Math.round((next / reached[i]) * 100) : null;
    // Dwell time in this stage = median days_in_prior_stage over transitions leaving this stage.
    const dwell = median(history.filter((h) => h.from_stage === stage && h.days_in_prior_stage != null).map((h) => h.days_in_prior_stage));
    return { stage, label: STAGE_LABELS[stage] || stage, reached: reached[i], conversionToNext, medianDaysInStage: dwell };
  });

  // Overall sales cycle proxy = sum of median dwell across active stages (days).
  const salesCycleDays = funnel.reduce((s, f) => s + (f.medianDaysInStage || 0), 0) || null;
  const biggestDropoff = funnel
    .filter((f) => f.conversionToNext != null)
    .sort((a, b) => a.conversionToNext - b.conversionToNext)[0] || null;

  return apiSuccess(res, {
    funnel,
    salesCycleDays,
    biggestDropoff: biggestDropoff ? { stage: biggestDropoff.stage, label: biggestDropoff.label, conversion: biggestDropoff.conversionToNext } : null,
    historyRows: history.length,
    note: history.length < 20 ? 'Funnel fills in as stage transitions accumulate (recording started with the HubSpot sync change).' : null,
  });
}
