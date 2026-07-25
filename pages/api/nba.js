// GET /api/nba  — ranked next-best-actions for the signed-in user's deals.
//   ?scope=me|all       me = the caller's owned accounts (default; managers/admins see all)
//   ?accountId=<id>      score a single account (By-Account "next action" chip)
//   ?includeInactive=1   include inactive/closed-lost (re-engage candidates)
//   ?limit=<n>
import { createServerSupabaseClient, getSupabase } from '../../lib/supabase'
import { apiError, apiSuccess, validateMethod, logRequest } from '../../lib/apiUtils'
import { rankAccounts } from '../../lib/nba'
import { isManager } from '../../lib/roles'
import { ACTIVE_STAGE_ORDER } from '../../lib/constants'

export default async function handler(req, res) {
  logRequest(req, 'nba')
  if (!validateMethod(req, res, 'GET')) return
  const auth = createServerSupabaseClient(req, res)
  const { data: { user } } = await auth.auth.getUser()
  if (!user) return apiError(res, 401, 'Unauthorized')

  const db = getSupabase()
  const { data: profile } = await db.from('profiles').select('role, full_name').eq('id', user.id).maybeSingle()

  const accountId = typeof req.query.accountId === 'string' ? req.query.accountId : null
  const includeInactive = req.query.includeInactive === '1'
  const limit = Math.min(parseInt(req.query.limit, 10) || 8, 50)

  let q = db.from('accounts').select('id, name, stage, deal_value, updated_at, risk_score, owner_name')
  if (accountId) {
    q = q.eq('id', accountId)
  } else if (includeInactive) {
    q = q.not('stage', 'in', '(closed_won)')
  } else {
    q = q.in('stage', ACTIVE_STAGE_ORDER)
  }
  const { data: accounts, error } = await q.limit(5000)
  if (error) return apiError(res, 500, error.message)

  let scope = accounts || []
  if (!accountId && req.query.scope !== 'all' && !isManager(profile)) {
    const me = (profile?.full_name || '').toLowerCase()
    const mine = scope.filter((a) => (a.owner_name || '').toLowerCase() === me)
    if (mine.length) scope = mine // fall back to all if we can't match the rep by name
  }

  const ids = scope.map((a) => a.id)
  const signalsById = {}
  if (ids.length) {
    for (let i = 0; i < ids.length; i += 200) {
      const { data: sigs } = await db.from('account_signals').select('*').in('account_id', ids.slice(i, i + 200))
      for (const s of sigs || []) signalsById[s.account_id] = s
    }
  }

  const ranked = rankAccounts(scope, signalsById)
  return apiSuccess(res, { actions: accountId ? ranked : ranked.slice(0, limit) })
}
