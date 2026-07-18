// GET /api/sales-reports/team-dashboard
// Comprehensive team performance — call quality, pipeline health, rep scorecards, coaching signals.
// Reads: gong_call_analyses, accounts, lead_pipeline.

import { apiError, apiSuccess, logRequest } from '../../../lib/apiUtils';
import { getSupabase } from '../../../lib/supabase';

function avg(arr) {
  return arr.length ? arr.reduce((s, n) => s + n, 0) / arr.length : null;
}

function round1(n) {
  return n != null ? Math.round(n * 10) / 10 : null;
}

export default async function handler(req, res) {
  logRequest(req, 'sales-reports/team-dashboard');
  if (req.method !== 'GET') return apiError(res, 405, 'Method not allowed');

  const db = getSupabase();
  const days = parseInt(req.query.days || '90');
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  const [callsRes, accountsRes, leadsRes] = await Promise.all([
    db.from('gong_call_analyses')
      .select('id, gong_call_id, title, call_date, call_type, rep_name, duration_seconds, analysis, deal_stage_at_call, account_id, hubspot_deal_stage')
      .gte('call_date', since)
      .not('ignored', 'eq', true)
      .not('analyzed_at', 'is', null)
      .order('call_date', { ascending: false }),
    db.from('accounts')
      .select('id, name, stage, owner_name, deal_value, close_date, hubspot_stage')
      .order('deal_value', { ascending: false })
      .limit(600),
    db.from('lead_pipeline')
      .select('year, seq, sdr, ae, intro_status, qualify_status, closed_status, arr_value, date_booked')
      .order('year', { ascending: true }),
  ]);

  const calls = callsRes.data || [];
  const accounts = accountsRes.data || [];
  const leads = leadsRes.data || [];

  // ── Rep Scorecards ────────────────────────────────────────────────────────
  const repMap = {};

  for (const c of calls) {
    const rep = c.rep_name || 'Unknown';
    if (!repMap[rep]) repMap[rep] = {
      name: rep,
      calls: 0,
      intros: 0,
      demos: 0,
      solutionCalls: 0,
      discoveryScores: [],
      talkRatios: [],
      painDepthScores: [],
      nextStepsPerCall: [],
      durationsMins: [],
      recentCallDate: null,
    };

    const r = repMap[rep];
    r.calls++;
    if (c.call_type === 'intro') r.intros++;
    else if (c.call_type === 'demo') r.demos++;
    else r.solutionCalls++;
    if (c.duration_seconds) r.durationsMins.push(c.duration_seconds / 60);
    if (!r.recentCallDate || c.call_date > r.recentCallDate) r.recentCallDate = c.call_date;

    const a = c.analysis || {};
    const ds = parseFloat(a.discovery_score);
    if (!isNaN(ds) && ds > 0) r.discoveryScores.push(ds);
    const tr = parseFloat(a.rep_talk_ratio);
    if (!isNaN(tr) && tr > 0) r.talkRatios.push(tr);
    const pd = parseFloat(a.pain_depth_score);
    if (!isNaN(pd) && pd > 0) r.painDepthScores.push(pd);
    const ns = Array.isArray(a.next_steps_mentioned) ? a.next_steps_mentioned.length : 0;
    r.nextStepsPerCall.push(ns);
  }

  const repCards = Object.values(repMap)
    .map(r => {
      const disc = avg(r.discoveryScores);
      const pain = avg(r.painDepthScores);
      const talk = avg(r.talkRatios);
      const ns = avg(r.nextStepsPerCall);
      const health = [
        disc != null ? (disc / 10) * 40 : null,
        pain != null ? (pain / 10) * 30 : null,
        ns != null ? Math.min(ns / 3, 1) * 20 : null,
      ].filter(x => x != null);
      const healthScore = health.length ? Math.round(health.reduce((s, n) => s + n, 0)) : null;

      return {
        name: r.name,
        calls: r.calls,
        intros: r.intros,
        demos: r.demos,
        avgDiscovery: round1(disc),
        avgPainDepth: round1(pain),
        avgTalkRatio: talk != null ? Math.round(talk) : null,
        avgNextSteps: round1(ns),
        avgCallMin: r.durationsMins.length ? Math.round(avg(r.durationsMins)) : null,
        healthScore,
        lastCall: r.recentCallDate,
      };
    })
    .filter(r => r.calls >= 1)
    .sort((a, b) => b.calls - a.calls);

  // ── Team call quality ────────────────────────────────────────────────────
  const allDiscovery = calls.map(c => parseFloat(c.analysis?.discovery_score)).filter(n => !isNaN(n) && n > 0);
  const allPain = calls.map(c => parseFloat(c.analysis?.pain_depth_score)).filter(n => !isNaN(n) && n > 0);
  const allTalk = calls.map(c => parseFloat(c.analysis?.rep_talk_ratio)).filter(n => !isNaN(n) && n > 0);

  // ── Objection + buying signal aggregation ────────────────────────────────
  const objCounts = {};
  const buyCounts = {};

  for (const c of calls) {
    const a = c.analysis || {};
    for (const item of (Array.isArray(a.objections) ? a.objections : [])) {
      const key = (typeof item === 'string' ? item : item?.text || '').trim().slice(0, 100);
      if (key) objCounts[key] = (objCounts[key] || 0) + 1;
    }
    for (const item of (Array.isArray(a.buying_signals) ? a.buying_signals : [])) {
      const key = (typeof item === 'string' ? item : item?.signal || '').trim().slice(0, 100);
      if (key) buyCounts[key] = (buyCounts[key] || 0) + 1;
    }
  }

  const topObjections = Object.entries(objCounts)
    .sort(([, a], [, b]) => b - a).slice(0, 8)
    .map(([text, count]) => ({ text, count }));
  const topBuyingSignals = Object.entries(buyCounts)
    .sort(([, a], [, b]) => b - a).slice(0, 8)
    .map(([text, count]) => ({ text, count }));

  // ── Pipeline by stage ────────────────────────────────────────────────────
  const ACTIVE_STAGES = ['qualifying', 'intro_scheduled', 'active_pursuit', 'demo', 'solution_validation', 'proposal', 'legal'];
  const STAGE_LABELS = {
    qualifying: 'Qualifying',
    intro_scheduled: 'Intro Scheduled',
    active_pursuit: 'Active Pursuit',
    demo: 'Demo',
    solution_validation: 'Solution Validation',
    proposal: 'Proposal',
    legal: 'Legal',
  };

  const stageMap = {};
  let totalPipelineValue = 0;

  for (const acct of accounts) {
    const stage = acct.stage || 'other';
    if (!ACTIVE_STAGES.includes(stage)) continue;
    if (!stageMap[stage]) stageMap[stage] = { stage, label: STAGE_LABELS[stage] || stage, count: 0, value: 0 };
    stageMap[stage].count++;
    stageMap[stage].value += acct.deal_value || 0;
    totalPipelineValue += acct.deal_value || 0;
  }

  const pipelineByStage = ACTIVE_STAGES
    .map(s => stageMap[s] || { stage: s, label: STAGE_LABELS[s] || s, count: 0, value: 0 })
    .filter(s => s.count > 0);

  // ── Deals by owner ───────────────────────────────────────────────────────
  const ownerMap = {};
  for (const acct of accounts) {
    if (!ACTIVE_STAGES.includes(acct.stage)) continue;
    const owner = acct.owner_name || 'Unassigned';
    if (!ownerMap[owner]) ownerMap[owner] = { owner, count: 0, value: 0, lateStage: 0 };
    ownerMap[owner].count++;
    ownerMap[owner].value += acct.deal_value || 0;
    if (['proposal', 'legal', 'solution_validation'].includes(acct.stage)) ownerMap[owner].lateStage++;
  }
  const dealsByOwner = Object.values(ownerMap).sort((a, b) => b.count - a.count);

  // ── At-risk accounts (no call in 21 days, in late stage) ─────────────────
  const recentCallsByAccountId = {};
  for (const c of calls) {
    if (!c.account_id) continue;
    if (!recentCallsByAccountId[c.account_id] || c.call_date > recentCallsByAccountId[c.account_id]) {
      recentCallsByAccountId[c.account_id] = c.call_date;
    }
  }

  const cutoff21 = new Date(Date.now() - 21 * 24 * 60 * 60 * 1000).toISOString();
  const atRisk = accounts
    .filter(a => ['demo', 'solution_validation', 'proposal', 'legal'].includes(a.stage))
    .filter(a => !recentCallsByAccountId[a.id] || recentCallsByAccountId[a.id] < cutoff21)
    .map(a => ({
      name: a.name,
      stage: a.stage,
      owner: a.owner_name,
      value: a.deal_value,
      lastCall: recentCallsByAccountId[a.id] || null,
      daysSinceCall: recentCallsByAccountId[a.id]
        ? Math.floor((Date.now() - new Date(recentCallsByAccountId[a.id]).getTime()) / 86400000)
        : null,
    }))
    .sort((a, b) => (b.daysSinceCall || 999) - (a.daysSinceCall || 999))
    .slice(0, 10);

  // ── Multi-year lead summary ───────────────────────────────────────────────
  const yearMap = {};
  for (const l of leads) {
    const y = l.year;
    if (!yearMap[y]) yearMap[y] = { year: y, total: 0, showed: 0, qualified: 0, won: 0, arr: 0 };
    yearMap[y].total++;
    if ((l.intro_status || '').trim() === 'Showed') yearMap[y].showed++;
    if ((l.qualify_status || '').trim() === 'Qualified') yearMap[y].qualified++;
    if ((l.closed_status || '').trim() === 'Won') { yearMap[y].won++; yearMap[y].arr += (l.arr_value || 0); }
  }

  const multiYear = Object.values(yearMap)
    .map(s => ({
      ...s,
      showRate: s.total ? round1(s.showed / s.total) : 0,
      closeRate: s.total ? round1(s.won / s.total) : 0,
    }))
    .sort((a, b) => a.year - b.year);

  // ── Monthly call cadence (last 6 months) ─────────────────────────────────
  const monthMap = {};
  for (const c of calls) {
    const d = new Date(c.call_date);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    if (!monthMap[key]) monthMap[key] = { month: key, calls: 0, intros: 0, demos: 0 };
    monthMap[key].calls++;
    if (c.call_type === 'intro') monthMap[key].intros++;
    else if (c.call_type === 'demo') monthMap[key].demos++;
  }
  const callCadence = Object.values(monthMap).sort((a, b) => a.month.localeCompare(b.month));

  // ── Open rep next steps from last 28 days ─────────────────────────────────
  const repCommitments = calls
    .filter(c => c.call_date >= new Date(Date.now() - 28 * 86400000).toISOString())
    .flatMap(c => {
      const a = c.analysis || {};
      const ns = Array.isArray(a.next_steps_mentioned) ? a.next_steps_mentioned : [];
      return ns
        .filter(s => typeof s === 'string' && /\brep\b/i.test(s))
        .map(s => ({ callTitle: c.title, callDate: c.call_date, rep: c.rep_name, step: s }));
    })
    .slice(0, 30);

  // ── Summary ───────────────────────────────────────────────────────────────
  const now30 = new Date(Date.now() - 30 * 86400000).toISOString();
  const summary = {
    totalCalls: calls.length,
    callsLast30: calls.filter(c => c.call_date >= now30).length,
    totalPipelineValue,
    activeAccounts: pipelineByStage.reduce((s, p) => s + p.count, 0),
    teamAvgDiscovery: round1(avg(allDiscovery)),
    teamAvgPainDepth: round1(avg(allPain)),
    teamAvgTalkRatio: allTalk.length ? Math.round(avg(allTalk)) : null,
    atRiskCount: atRisk.length,
    leadsHaveData: leads.length > 0,
    days,
  };

  return apiSuccess(res, {
    data: {
      summary,
      repCards,
      pipelineByStage,
      dealsByOwner,
      atRisk,
      topObjections,
      topBuyingSignals,
      callCadence,
      multiYear,
      repCommitments,
    }
  });
}
