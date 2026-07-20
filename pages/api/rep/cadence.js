// GET /api/rep/cadence — this week's cadence target + progress + re-engage picks for the caller.
//   AE  → 10 re-engagements/week (completed tasks on dormant accounts) + ranked dormant picks to work.
//   SDR → 3 meetings booked/week (from sdr_touches).
// Targets default to 10 / 3; overridable per-user or per-role via sales_goals (metric+period='week').
import { createServerSupabaseClient, getSupabase } from '../../../lib/supabase'
import { apiError, apiSuccess, validateMethod, logRequest } from '../../../lib/apiUtils'
import { rankAccounts } from '../../../lib/nba'
import { INACTIVE_STAGE_IDS } from '../../../lib/constants'

const REENGAGE_STAGES = [...INACTIVE_STAGE_IDS, 'closed_lost']

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

  // AE re-engagements done this week = completed tasks on dormant accounts.
  const { data: doneTasks } = await db.from('tasks')
    .select('id, accounts ( stage )')
    .eq('owner_id', user.id).eq('status', 'complete').gte('completed_at', ws)
  const done = new Set(REENGAGE_STAGES)
  const current = (doneTasks || []).filter(t => done.has(t.accounts?.stage)).length

  // Ranked dormant accounts to re-engage (owned by the AE where resolvable).
  const { data: dormant } = await db.from('accounts')
    .select('id, name, stage, deal_value, updated_at, risk_score, owner_name')
    .in('stage', REENGAGE_STAGES).limit(600)
  let scope = dormant || []
  const me = (profile?.full_name || '').toLowerCase()
  const mine = scope.filter(a => (a.owner_name || '').toLowerCase() === me)
  if (mine.length) scope = mine

  const ids = scope.map(a => a.id)
  const signalsById = {}
  for (let i = 0; i < ids.length; i += 200) {
    const { data: sigs } = await db.from('account_signals').select('*').in('account_id', ids.slice(i, i + 200))
    for (const s of sigs || []) signalsById[s.account_id] = s
  }
  const picks = rankAccounts(scope, signalsById).slice(0, 8)

  return apiSuccess(res, { role: 'ae', week: ws, metric: 'reengagement', label: 'Re-engagements this week', target: goalFor('reengagement', 10), current, picks })
}
