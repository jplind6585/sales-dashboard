// GET /api/lead-intelligence?year=2026
// Aggregates lead_pipeline data for the Lead Intelligence dashboard.
// All math is done in JS — no heavy SQL needed since the table is small (~220 rows/year).

import { apiError, apiSuccess, logRequest } from '../../lib/apiUtils';
import { getSupabase } from '../../lib/supabase';

const SDR_NAMES = {
  KW: 'Kristin',
  TA: 'Tony Alic',
  NB: 'Nash',
  SD: 'Stephen',
  LK: 'Logan King',
  JL: 'James',
  JA: 'Jovan',
  MM: 'Mark',
};

const AE_NAMES = {
  JL: 'James Lindberg',
  LK: 'Logan King',
  JA: 'Jovan Arsovski',
  MM: 'Mark Murphy',
};

function pct(n, d) { return d ? n / d : 0; }
function fmt(n) { return parseFloat((n || 0).toFixed(2)); }

export default async function handler(req, res) {
  logRequest(req, 'lead-intelligence');
  if (req.method !== 'GET') return apiError(res, 405, 'Method not allowed');

  const year = parseInt(req.query.year || '2026');
  const db = getSupabase();

  const { data: leads, error } = await db
    .from('lead_pipeline')
    .select('*')
    .eq('year', year)
    .order('date_booked', { ascending: true });

  if (error) return apiError(res, 500, error.message);
  if (!leads?.length) return apiSuccess(res, { leads: [], meta: { year, total: 0, lastSynced: null } });

  const lastSynced = leads.reduce((m, l) => (l.synced_at > m ? l.synced_at : m), leads[0].synced_at);

  const is = (lead, field, val) => (lead[field] || '').trim() === val;
  const cnt = (fn) => leads.filter(fn).length;
  const sumField = (fn, field) => leads.filter(fn).reduce((s, l) => s + (l[field] || 0), 0);

  // ─── Funnel ────────────────────────────────────────────────────────────
  const booked    = leads.length;
  const showed    = cnt(l => is(l, 'intro_status', 'Showed'));
  const qualified = cnt(l => is(l, 'qualify_status', 'Qualified'));
  const presented = cnt(l => ['Presented', 'Still Evaluating'].includes((l.evaluation_status || '').trim()));
  const won       = cnt(l => is(l, 'closed_status', 'Won'));
  const lost      = cnt(l => is(l, 'closed_status', 'Lost'));
  const open      = booked - won - lost;
  const arrWon    = sumField(l => is(l, 'closed_status', 'Won'), 'arr_value');
  const arrOpen   = sumField(l => !['Won', 'Lost'].includes((l.closed_status || '').trim()), 'arr_estimate_open');

  const funnel = [
    { stage: 'Booked',    count: booked,    convFromPrev: null,                  convFromBooked: 1 },
    { stage: 'Showed',    count: showed,    convFromPrev: fmt(pct(showed, booked)),    convFromBooked: fmt(pct(showed, booked)) },
    { stage: 'Qualified', count: qualified, convFromPrev: fmt(pct(qualified, showed)), convFromBooked: fmt(pct(qualified, booked)) },
    { stage: 'Presented', count: presented, convFromPrev: fmt(pct(presented, qualified)), convFromBooked: fmt(pct(presented, booked)) },
    { stage: 'Won',       count: won,       convFromPrev: fmt(pct(won, presented)),    convFromBooked: fmt(pct(won, booked)) },
  ];

  // ─── By SDR ─────────────────────────────────────────────────────────────
  const sdrMap = {};
  for (const l of leads) {
    const key = l.sdr || 'Unknown';
    if (!sdrMap[key]) sdrMap[key] = { sdr: key, name: SDR_NAMES[key] || key, booked: 0, showed: 0, demos: 0, won: 0, arr: 0 };
    sdrMap[key].booked++;
    if (is(l, 'intro_status', 'Showed')) sdrMap[key].showed++;
    if (['Presented', 'Still Evaluating'].includes((l.evaluation_status || '').trim())) sdrMap[key].demos++;
    if (is(l, 'closed_status', 'Won')) { sdrMap[key].won++; sdrMap[key].arr += (l.arr_value || 0); }
  }
  const bySDR = Object.values(sdrMap)
    .map(s => ({ ...s, showRate: fmt(pct(s.showed, s.booked)), demoRate: fmt(pct(s.demos, s.showed)), winRate: fmt(pct(s.won, s.booked)) }))
    .sort((a, b) => b.booked - a.booked);

  // ─── By AE ───────────────────────────────────────────────────────────────
  const aeMap = {};
  for (const l of leads) {
    const key = l.ae || 'Unknown';
    if (!aeMap[key]) aeMap[key] = { ae: key, name: AE_NAMES[key] || key, assigned: 0, showed: 0, presented: 0, won: 0, arr: 0 };
    aeMap[key].assigned++;
    if (is(l, 'intro_status', 'Showed')) aeMap[key].showed++;
    if (['Presented', 'Still Evaluating'].includes((l.evaluation_status || '').trim())) aeMap[key].presented++;
    if (is(l, 'closed_status', 'Won')) { aeMap[key].won++; aeMap[key].arr += (l.arr_value || 0); }
  }
  const byAE = Object.values(aeMap)
    .map(a => ({ ...a, showRate: fmt(pct(a.showed, a.assigned)), closeRate: fmt(pct(a.won, a.presented)) }))
    .sort((a, b) => b.assigned - a.assigned);

  // ─── By Source ───────────────────────────────────────────────────────────
  const srcMap = {};
  for (const l of leads) {
    const key = l.booked_via || 'Unknown';
    if (!srcMap[key]) srcMap[key] = { source: key, booked: 0, showed: 0, qualified: 0, won: 0, arr: 0 };
    srcMap[key].booked++;
    if (is(l, 'intro_status', 'Showed')) srcMap[key].showed++;
    if (is(l, 'qualify_status', 'Qualified')) srcMap[key].qualified++;
    if (is(l, 'closed_status', 'Won')) { srcMap[key].won++; srcMap[key].arr += (l.arr_value || 0); }
  }
  const bySource = Object.values(srcMap)
    .map(s => ({ ...s, showRate: fmt(pct(s.showed, s.booked)), qualRate: fmt(pct(s.qualified, s.showed)), winRate: fmt(pct(s.won, s.booked)) }))
    .sort((a, b) => b.booked - a.booked);

  // ─── By Vertical ──────────────────────────────────────────────────────────
  const vertMap = {};
  for (const l of leads) {
    const key = l.vertical || 'Unknown';
    if (!vertMap[key]) vertMap[key] = { vertical: key, booked: 0, showed: 0, qualified: 0, presented: 0, won: 0, arr: 0 };
    vertMap[key].booked++;
    if (is(l, 'intro_status', 'Showed')) vertMap[key].showed++;
    if (is(l, 'qualify_status', 'Qualified')) vertMap[key].qualified++;
    if (['Presented', 'Still Evaluating'].includes((l.evaluation_status || '').trim())) vertMap[key].presented++;
    if (is(l, 'closed_status', 'Won')) { vertMap[key].won++; vertMap[key].arr += (l.arr_value || 0); }
  }
  const byVertical = Object.values(vertMap)
    .map(v => ({ ...v, showRate: fmt(pct(v.showed, v.booked)), demoRate: fmt(pct(v.presented, v.showed)) }))
    .sort((a, b) => b.booked - a.booked);

  // ─── By Company Size ──────────────────────────────────────────────────────
  const sizeMap = {};
  for (const l of leads) {
    const key = l.company_size || 'Unknown';
    if (!sizeMap[key]) sizeMap[key] = { size: key, booked: 0, won: 0, arr: 0 };
    sizeMap[key].booked++;
    if (is(l, 'closed_status', 'Won')) { sizeMap[key].won++; sizeMap[key].arr += (l.arr_value || 0); }
  }
  const SIZE_ORDER = ['0-20', '21-50', '51-100', '101-250', '251-500', '501-1,000', '1,000+', 'Unknown'];
  const bySize = Object.values(sizeMap)
    .map(s => ({ ...s, winRate: fmt(pct(s.won, s.booked)) }))
    .sort((a, b) => SIZE_ORDER.indexOf(a.size) - SIZE_ORDER.indexOf(b.size));

  // ─── Lost Reasons ─────────────────────────────────────────────────────────
  const lostMap = {};
  for (const l of leads) {
    if (!is(l, 'closed_status', 'Lost')) continue;
    const tag = (l.lost_tags || 'Unknown').trim();
    lostMap[tag] = (lostMap[tag] || 0) + 1;
  }
  const lostReasons = Object.entries(lostMap)
    .map(([reason, count]) => ({ reason, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  // ─── Recent Activity ──────────────────────────────────────────────────────
  const recent = [...leads]
    .sort((a, b) => (b.date_booked || '').localeCompare(a.date_booked || ''))
    .slice(0, 40)
    .map(l => ({
      seq: l.seq,
      company: l.company,
      vertical: l.vertical,
      sdr: l.sdr,
      ae: l.ae,
      booked_via: l.booked_via,
      date_booked: l.date_booked,
      intro_status: l.intro_status,
      qualify_status: l.qualify_status,
      evaluation_status: l.evaluation_status,
      closed_status: l.closed_status,
      arr_value: l.arr_value,
      pipeline_age_flag: l.pipeline_age_flag,
      days_since_booked: l.days_since_booked,
    }));

  return apiSuccess(res, {
    meta: { year, total: booked, showed, qualified, presented, won, lost, open, arrWon, arrOpen, lastSynced },
    funnel,
    bySDR,
    byAE,
    bySource,
    byVertical,
    bySize,
    lostReasons,
    recent,
  });
}
