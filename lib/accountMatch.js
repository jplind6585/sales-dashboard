// Unified call/lead → account fuzzy matcher. This logic was duplicated 4 ways (hubspot/match-calls,
// a byte-for-byte copy in gong/intel-analyze:47-130, and the calendar matchers) — PLATFORM_REVIEW §4.
// One implementation so lead→account and call→account matching stay consistent.

export const STAGE_PRIORITY = {
  legal: 10, proposal: 10, solution_validation: 9, demo: 9,
  active_pursuit: 8, intro_scheduled: 7, qualifying: 6,
  inactive_ae_follow_up: 3, inactive_sdr_follow_up: 3,
  closed_lost: 1, closed_won: 0,
};

export function extractCompanyFromTitle(title) {
  if (!title) return null;
  let m = title.match(/^Banner\s*[-|/]\s*(.+?)(?:\s*[:|]\s*\S.*|\s+-\s+\S.*)?$/i);
  if (m) return m[1].trim();
  m = title.match(/^(.+?)\s*[|]\s*Banner\b/i);
  if (m) return m[1].trim();
  m = title.match(/^(.+?)\s+-\s+Banner\b/i);
  if (m) return m[1].trim();
  m = title.match(/^(.+?)\s*\+\s*Banner\b/i);
  if (m) return m[1].trim();
  return null;
}

export function normalizeName(s) {
  return (s || '')
    .toLowerCase()
    .replace(/banner[\s\-–—|+]*/gi, '')
    .replace(/[\-–—:|+,]/g, ' ')
    .replace(/\b(intro|demo|presentation|follow\s*up|meeting|call|new deal|year \d+|weekly|monthly|check\s*in|training|implementation|onboarding|review|update|sync|status|overview|assoc\.?|associates|llc|inc\.?|corp\.?|ltd\.?)\b/gi, '')
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function scoreMatch(accountName, targetText, extracted) {
  const a = normalizeName(accountName);
  const d = normalizeName(targetText);
  if (!a || !d) return 0;
  if (a === d) return extracted ? 10 : 8;
  if (d.startsWith(a) || a.startsWith(d)) return extracted ? 9 : 7;
  if (d.includes(a) || a.includes(d)) return extracted ? 8 : 6;
  const aWords = new Set(a.split(' ').filter((w) => w.length > 3));
  const dWords = d.split(' ').filter((w) => w.length > 3);
  const overlap = dWords.filter((w) => aWords.has(w)).length;
  if (overlap >= 3) return 5;
  if (overlap >= 2) return extracted ? 5 : 3;
  if (overlap === 1) {
    const firstWord = a.split(' ')[0];
    if (firstWord.length >= 6 && dWords.includes(firstWord)) return extracted ? 3 : 2;
  }
  return 0;
}

export function matchScore(accountName, callTitle) {
  const extracted = extractCompanyFromTitle(callTitle);
  return extracted ? scoreMatch(accountName, extracted, true) : scoreMatch(accountName, callTitle, false);
}

// Score one account against a title using name + aliases + email-domain-in-title (strongest signal).
// Pass accounts with {id, name, stage, aliases?, email_domains?, is_master?, parent_account_id?}.
export function scoreAccount(account, title, extracted) {
  const nT = normalizeName(title);
  const toks = new Set(nT.split(' ').filter(Boolean));
  // Domain-in-title = strongest signal, but match a WHOLE normalized token (not a raw substring) and
  // require a distinctive root (>=4 chars) so a short domain root like "cap" can't hijack "capital".
  for (const domain of (account.email_domains || [])) {
    const co = (domain || '').split('.')[0];
    if (co && co.length >= 4 && toks.has(co)) return 10;
  }
  // Best of name + aliases.
  let best = 0;
  for (const nm of [account.name, ...(account.aliases || [])]) {
    if (!nm) continue;
    const s = extracted ? scoreMatch(nm, extracted, true) : scoreMatch(nm, title, false);
    if (s > best) best = s;
  }
  return best;
}

// Pick the best account for a title. Prefers, in order: higher match score, then the company MASTER
// (so a company's calls land on the master, not a dead sibling deal), then furthest pipeline stage.
export function bestAccountForTitle(title, accounts = []) {
  if (!title?.trim() || !accounts.length) return null;
  const extracted = extractCompanyFromTitle(title);
  const minScore = extracted ? 6 : 2;
  let best = null, bestScore = 0, bestMaster = false, bestStage = -1;
  for (const account of accounts) {
    const score = scoreAccount(account, title, extracted);
    if (score < minScore) continue;
    const isMaster = account.is_master === true || account.parent_account_id == null;
    const sp = STAGE_PRIORITY[account.stage] ?? 4;
    if (
      score > bestScore ||
      (score === bestScore && isMaster && !bestMaster) ||
      (score === bestScore && isMaster === bestMaster && sp > bestStage)
    ) {
      bestScore = score; bestMaster = isMaster; bestStage = sp; best = account;
    }
  }
  return best ? { id: best.id, name: best.name, score: bestScore } : null;
}
