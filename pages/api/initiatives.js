// /api/initiatives — ROI tracker (PLATFORM_REVIEW ROI-tracker scope).
//   GET  → initiatives with attributed pipeline/revenue + ROI/CAC (time-window attribution; for
//          hire_sdr, filtered to that rep's accounts). POST → create an initiative.
// Attribution is honestly rough (created/closed since started_on) — labeled as such in the UI.
import { createServerSupabaseClient, getSupabase } from '../../lib/supabase';
import { apiError, apiSuccess, validateMethod, logRequest } from '../../lib/apiUtils';
import { isActiveStage } from '../../lib/metrics';

const num = (v) => (typeof v === 'number' ? v : parseFloat(v)) || 0;

export default async function handler(req, res) {
  logRequest(req, 'initiatives');
  const auth = createServerSupabaseClient(req, res);
  const { data: { user } } = await auth.auth.getUser();
  if (!user) return apiError(res, 401, 'Unauthorized');
  const db = getSupabase();

  if (req.method === 'POST') {
    const b = req.body || {};
    if (!b.name) return apiError(res, 400, 'name required');
    const { data, error } = await db.from('initiatives').insert({
      name: b.name, type: b.type || 'other', cost: b.cost != null ? num(b.cost) : null,
      cost_period: b.cost_period || 'one_time', started_on: b.started_on || null, ended_on: b.ended_on || null,
      status: b.status || 'active', owner_name: b.owner_name || null, expected_outcome: b.expected_outcome || null,
      notes: b.notes || null, created_by: user.id,
    }).select('id').single();
    if (error) return apiError(res, 500, error.message);
    return apiSuccess(res, { id: data.id });
  }
  if (!validateMethod(req, res, 'GET')) return;

  const [initRes, acctRes] = await Promise.all([
    db.from('initiatives').select('*').order('created_at', { ascending: false }),
    db.from('accounts').select('stage, deal_value, close_date, created_at, owner_name'),
  ]);
  const initiatives = initRes.data || [];
  const accounts = acctRes.data || [];

  const enriched = initiatives.map((it) => {
    const start = it.started_on ? new Date(it.started_on) : null;
    const repScoped = it.type === 'hire_sdr' && it.owner_name;
    const inWindow = accounts.filter((a) => {
      if (start && a.created_at && new Date(a.created_at) < start) return false;
      if (repScoped && a.owner_name !== it.owner_name) return false;
      return true;
    });
    const pipeline = inWindow.filter((a) => isActiveStage(a.stage)).reduce((s, a) => s + num(a.deal_value), 0);
    const won = inWindow.filter((a) => a.stage === 'closed_won' && (!start || (a.close_date && new Date(a.close_date) >= start)));
    const revenue = won.reduce((s, a) => s + num(a.deal_value), 0);

    const monthsElapsed = start ? Math.max(0.5, (Date.now() - start.getTime()) / (30 * 86400000)) : null;
    let totalCost = num(it.cost);
    if (it.cost_period === 'monthly' && monthsElapsed) totalCost = num(it.cost) * monthsElapsed;
    else if (it.cost_period === 'annual' && monthsElapsed) totalCost = num(it.cost) * (monthsElapsed / 12);

    return {
      ...it,
      attribution: repScoped ? `${it.owner_name}'s accounts since ${it.started_on}` : it.started_on ? `all accounts since ${it.started_on}` : 'no start date set',
      spentToDate: Math.round(totalCost),
      pipelineInfluenced: Math.round(pipeline),
      revenueAttributed: Math.round(revenue),
      wonCount: won.length,
      roi: totalCost > 0 ? Math.round((revenue / totalCost) * 100) / 100 : null,
      cac: won.length > 0 ? Math.round(totalCost / won.length) : null,
    };
  });

  return apiSuccess(res, { initiatives: enriched });
}
