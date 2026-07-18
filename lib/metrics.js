// Canonical sales metrics — the ONE place these are defined. Before this, confidence had 3
// formulas, win-rate 3+ definitions, and "stale" 4+ definitions across the reporting surfaces
// (see PLATFORM_REVIEW §8). Every dashboard/endpoint should import from here so exec numbers
// stop contradicting each other. Operates on raw DB rows (snake_case: stage, deal_value, close_date).

import { STAGE_PROBABILITY, ACTIVE_STAGE_ORDER, CLOSED_STAGE_IDS } from './constants';

const ACTIVE = new Set(ACTIVE_STAGE_ORDER);
const num = (v) => (typeof v === 'number' ? v : parseFloat(v)) || 0;

export const isActiveStage = (stage) => ACTIVE.has(stage);
export const isClosedStage = (stage) => CLOSED_STAGE_IDS.includes(stage);

export const daysSince = (d) => (d ? Math.floor((Date.now() - new Date(d).getTime()) / 86400000) : null);

export const fmtUsd = (n) => {
  const v = num(n);
  if (Math.abs(v) >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (Math.abs(v) >= 1_000) return `$${Math.round(v / 1_000)}K`;
  return `$${Math.round(v)}`;
};

// Σ deal_value across active-stage accounts.
export function openPipeline(accounts = []) {
  return accounts.filter((a) => ACTIVE.has(a.stage)).reduce((s, a) => s + num(a.deal_value), 0);
}

// Σ deal_value × stage win-probability (the single weighted-pipeline definition).
export function weightedPipeline(accounts = [], weights = STAGE_PROBABILITY) {
  return accounts
    .filter((a) => ACTIVE.has(a.stage))
    .reduce((s, a) => s + num(a.deal_value) * ((weights[a.stage] ?? 0) / 100), 0);
}

// Count-weighted average stage probability across active accounts (the pipeline "confidence").
export function pipelineConfidence(accounts = [], weights = STAGE_PROBABILITY) {
  const active = accounts.filter((a) => ACTIVE.has(a.stage));
  if (!active.length) return 0;
  return Math.round(active.reduce((s, a) => s + (weights[a.stage] ?? 0), 0) / active.length);
}

// Per-account signal-based confidence (stage prob + call/stakeholder/champion bonuses, cap 95).
// Centralized from pipeline-overview so it can't drift.
export function accountConfidence(account, { callCount = 0, stakeholders = [] } = {}) {
  if (account?.stage === 'closed_won') return 100;
  if (account?.stage === 'closed_lost') return 0;
  let score = STAGE_PROBABILITY[account?.stage] ?? 5;
  score += Math.min(callCount * 3, 15);
  score += Math.min((stakeholders?.length || 0) * 2, 10);
  if ((stakeholders || []).some((s) => s.role === 'Champion')) score += 5;
  return Math.min(score, 95);
}

// Win rate = won / (won + lost), windowed by close_date (the single definition — NOT updated_at).
export function winRate(accounts = [], { windowDays = 90 } = {}) {
  const cutoff = windowDays ? Date.now() - windowDays * 86400000 : null;
  let won = 0, lost = 0;
  for (const a of accounts) {
    if (!CLOSED_STAGE_IDS.includes(a.stage)) continue;
    if (cutoff && a.close_date && new Date(a.close_date).getTime() < cutoff) continue;
    if (cutoff && !a.close_date) continue; // no close date → can't window → exclude
    if (a.stage === 'closed_won') won++;
    else lost++;
  }
  const total = won + lost;
  return { rate: total ? Math.round((won / total) * 100) : 0, won, lost };
}

// Stale = no activity in `days`. Pass a map of account_id → last activity timestamp (unified
// source — the caller decides gong call_date vs touch vs whatever, but ONE source per call).
export function staleAccounts(accounts = [], lastActivityByAccount = {}, { days = 21, lateStageOnly = false } = {}) {
  const LATE = new Set(['demo', 'solution_validation', 'proposal', 'legal']);
  return accounts.filter((a) => {
    if (!ACTIVE.has(a.stage)) return false;
    if (lateStageOnly && !LATE.has(a.stage)) return false;
    const last = lastActivityByAccount[a.id];
    const ds = daysSince(last);
    return ds == null || ds >= days;
  });
}
