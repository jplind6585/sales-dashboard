// Next-best-action scorer — one ranked signal per account from the full picture: stage proximity to
// money + deal value + recency (cold) + sentiment + champion engagement + MEDDICC gaps + risk score.
// Pure functions (no DB) so it's reusable by Today's Focus, re-engage picks, and the at-risk radar.
import { STAGE_PROBABILITY, ACTIVE_STAGE_ORDER, INACTIVE_STAGE_IDS, stageLabel } from './constants'

const ACTIVE = new Set(ACTIVE_STAGE_ORDER)
const INACTIVE = new Set(INACTIVE_STAGE_IDS)

function suggestAction({ stage, daysCold, sentiment, meddicc }) {
  if (INACTIVE.has(stage) || stage === 'closed_lost') return 'Re-engage with a fresh angle'
  if (sentiment != null && sentiment < 0) return 'Address the concern from the last call'
  if (meddicc != null && meddicc < 0.5) return 'Close the open MEDDICC gaps'
  if (daysCold != null && daysCold >= 14) return 'Reach out — deal has gone quiet'
  if (['proposal', 'legal'].includes(stage)) return 'Push for the close / next signature step'
  if (['demo', 'solution_validation'].includes(stage)) return 'Confirm fit + advance to proposal'
  return 'Advance the next step'
}

// account: { id, name, stage, deal_value, updated_at, risk_score }
// signals: account_signals row or null
export function scoreAccount(account, signals, opts = {}) {
  const now = opts.now || Date.now()
  const stage = account.stage
  const prob = STAGE_PROBABILITY[stage] ?? 5
  const value = Number(account.deal_value) || 0
  const lastMs = signals?.last_call_at ? new Date(signals.last_call_at).getTime()
    : account.updated_at ? new Date(account.updated_at).getTime() : null
  const daysCold = lastMs != null ? Math.floor((now - lastMs) / 86400000) : null
  const sentiment = signals?.sentiment ?? null
  const engagement = signals?.engagement ?? null
  const meddicc = signals?.meddicc_completeness ?? null
  const risk = Number(account.risk_score)

  let score = prob * 0.6
  const reasons = []
  if (value) score += Math.min(value / 10000, 30)
  if (ACTIVE.has(stage) && daysCold != null) {
    if (daysCold >= 21) { score += 25; reasons.push(`${daysCold}d no contact`) }
    else if (daysCold >= 14) { score += 15; reasons.push(`${daysCold}d quiet`) }
    else if (daysCold >= 7) score += 6
  }
  if (sentiment != null && sentiment < 0) { score += 15; reasons.push('negative sentiment last call') }
  if (engagement != null && engagement <= 4) { score += 10; reasons.push('weak champion engagement') }
  if (meddicc != null && meddicc < 0.6 && prob >= 35) { score += 10; reasons.push('MEDDICC gaps for the stage') }
  if (Number.isFinite(risk) && risk >= 60) { score += 12; reasons.push('flagged at-risk') }

  const reason = reasons[0] || `${stageLabel(stage)} deal to advance`
  return {
    accountId: account.id, name: account.name, stage, value, daysCold,
    score: Math.round(score), reason, reasons,
    action: suggestAction({ stage, daysCold, sentiment, meddicc }),
  }
}

// Rank a set of accounts (each optionally carrying its account_signals as `._signals`).
export function rankAccounts(accounts, signalsById = {}, opts = {}) {
  return (accounts || [])
    .map((a) => scoreAccount(a, signalsById[a.id] || a._signals || null, opts))
    .sort((x, y) => y.score - x.score)
}
