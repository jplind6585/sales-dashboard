// GET /api/rep/cadence — this week's role goal + progress + picks for the caller.
//   AE  → advance 5 deals/week (distinct accounts moved to a later stage this week) + active deals to push.
//   SDR → book 3 meetings/week (from sdr_touches).
// Targets default to 5 / 3; overridable per-user or per-role via sales_goals (metric+period='week').
import { createServerSupabaseClient, getSupabase } from '../../../lib/supabase'
import { apiError, apiSuccess, validateMethod, logRequest } from '../../../lib/apiUtils'
import { rankAccounts } from '../../../lib/nba'
import { ACTIVE_STAGE_ORDER } from '../../../lib/constants'

// Pipeline order for detecting a FORWARD move (advance).
const STAGE_ORDER = { qualifying: 1, intro_scheduled: 2, active_pursuit: 3, demo: 4, solution_validation: 5, proposal: 6, legal: 7, closed_won: 8 }

function weekStartISO() {
  const d = new Date()
  const day = d.getDay()                // 0=Sun..6=Sat
  const diff = (day === 0 ? -6 : 1) - day // back to Monday
  const m = new Date(d); m.setDate(d.getDate() + diff); m.setHours(0, 0, 0, 0)
  return m.toISOString()
}

export default async function handler(req, res) {
  logRequest(req, 'rep/cadence')
  if (!validateMethod(req, res, 'GET')) return
  const auth = createServerSupabaseClient(req, res)
  const { data: { user } } = await auth.auth.getUser()
  if (!user) return apiError(res, 401, 'Unauthorized')

  const db = getSupabase()
  const { data: profile } = await db.from('profiles').select('role, rep_type, full_name').eq('id', user.id).maybeSingle()
  const ws = weekStartISO()
  const isSdr = (profile?.rep_type || '').toLowerCase() === 'sdr'

  const { data: goals } = await db.from('sales_goals').select('metric, target, owner_id, scope').eq('period', 'week')
  const goalFor = (metric, fallback) => {
    const mine = (goals || []).find(g => g.metric === metric && g.owner_id === user.id)
    const role = (goals || []).find(g => g.metric === metric && g.scope === 'role')
    return mine?.target ?? role?.target ?? fallback
  }

  if (isSdr) {
    const { count } = await db.from('sdr_touches').select('id', { count: 'exact', head: true })
      .eq('rep_id', user.id).eq('outcome', 'meeting_booked').gte('touched_at', ws)
    return apiSuccess(res, { role: 'sdr', week: ws, metric: 'meetings', label: 'Meetings booked this week', target: goalFor('meetings', 3), current: count || 0, picks: [] })
  }

  // AE: deals ADVANCED forward this week = distinct accounts owned by the AE that moved to a later
  // pipeline stage this week. NOTE: account_stage_history.owner_name is NULL for all rows since the
  // populating trigger was dropped (2026-05), so we resolve ownership from accounts, not the history row.
  const me = (profile?.full_name || '').toLowerCase()
  const { data: moves } = await db.from('account_stage_history')
    .select('account_id, from_stage, to_stage, changed_at')
    .gte('changed_at', ws).limit(5000)
  const forwardIds = [...new Set((moves || [])
    .filter(m => (STAGE_ORDER[m.to_stage] || 0) > (STAGE_ORDER[m.from_stage] || 0))
    .map(m => m.account_id))]
  let current = 0
  if (forwardIds.length) {
    const { data: cand } = await db.from('accounts').select('id, owner_name, user_id').in('id', forwardIds)
    current = (cand || []).filter(a => a.user_id === user.id || (a.owner_name || '').toLowerCase() === me).length
  }

  // "Deals to advance": the AE's active-pipeline accounts, ranked (stalled/at-risk first) — the ones to push.
  const { data: active } = await db.from('accounts')
    .select('id, name, stage, deal_value, updated_at, risk_score, owner_name')
    .in('stage', ACTIVE_STAGE_ORDER).limit(2000)
  const scope = (active || []).filter(a => (a.owner_name || '').toLowerCase() === me)
  const ids = scope.map(a => a.id)
  const signalsById = {}
  for (let i = 0; i < ids.length; i += 200) {
    const { data: sigs } = await db.from('account_signals').select('*').in('account_id', ids.slice(i, i + 200))
    for (const s of sigs || []) signalsById[s.account_id] = s
  }
  const picks = rankAccounts(scope, signalsById).slice(0, 8)

  return apiSuccess(res, { role: 'ae', week: ws, metric: 'advances', label: 'Deals advanced this week', target: goalFor('advances', 5), current, picks })
}
