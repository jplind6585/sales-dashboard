// POST /api/sheets/match-leads
// Fuzzy-matches lead_pipeline companies against HubSpot accounts.
// Sets account_id + match_confidence on each lead row.
// Run after syncing — separate step since it's expensive.

import { apiError, apiSuccess, logRequest } from '../../../lib/apiUtils';
import { createServerSupabaseClient, getSupabase } from '../../../lib/supabase';

const STRIP_WORDS = /\b(inc|llc|corp|ltd|co|company|companies|group|capital|management|real estate|realty|properties|property|partners|holdings|associates|solutions|services|investments|investment|ventures|residential|development|living|senior|communities|community|trust|reit|advisors|advisory|consulting|global|national|international|enterprises|enterprise)\b\.?/gi;
const STRIP_PUNCT = /[^a-z0-9 ]/g;

function normalize(name) {
  return (name || '')
    .toLowerCase()
    .replace(STRIP_WORDS, ' ')
    .replace(STRIP_PUNCT, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function wordOverlap(a, b) {
  const wa = new Set(a.split(' ').filter(w => w.length > 1));
  const wb = new Set(b.split(' ').filter(w => w.length > 1));
  if (!wa.size || !wb.size) return 0;
  let overlap = 0;
  for (const w of wa) { if (wb.has(w)) overlap++; }
  const score = overlap / Math.max(wa.size, wb.size);
  // Bonus for exact normalized match
  return a === b ? 1.0 : score;
}

export default async function handler(req, res) {
  logRequest(req, 'sheets/match-leads');
  if (req.method !== 'POST') return apiError(res, 405, 'Method not allowed');

  const authClient = createServerSupabaseClient(req, res);
  const { data: { user } } = await authClient.auth.getUser();
  if (!user) return apiError(res, 401, 'Unauthorized');

  const db = getSupabase();
  const threshold = parseFloat(req.body?.threshold || '0.6');
  const yearFilter = req.body?.year ? parseInt(req.body.year) : null;

  // Load all accounts (name + id + stage + close_date + deal_value)
  const { data: accounts, error: acctErr } = await db
    .from('accounts')
    .select('id, name, stage, close_date, deal_value, hubspot_deal_id');
  if (acctErr) return apiError(res, 500, acctErr.message);

  // Build normalized account index
  const accountIndex = accounts.map(a => ({
    ...a,
    norm: normalize(a.name),
  }));

  // Load unmatched (or all if rematch=true) leads
  let query = db.from('lead_pipeline').select('id, company, year, seq');
  if (!req.body?.rematch) query = query.is('account_id', null);
  if (yearFilter) query = query.eq('year', yearFilter);
  const { data: leads, error: leadErr } = await query;
  if (leadErr) return apiError(res, 500, leadErr.message);

  let matched = 0, skipped = 0;
  const updates = [];

  for (const lead of leads) {
    const normLead = normalize(lead.company);
    if (!normLead) { skipped++; continue; }

    let best = null;
    let bestScore = 0;

    for (const acct of accountIndex) {
      if (!acct.norm) continue;
      const score = wordOverlap(normLead, acct.norm);
      if (score > bestScore) {
        bestScore = score;
        best = acct;
      }
    }

    if (best && bestScore >= threshold) {
      updates.push({
        id: lead.id,
        account_id: best.id,
        match_confidence: Math.round(bestScore * 100),
        match_method: bestScore === 1.0 ? 'exact' : 'fuzzy',
      });
      matched++;
    } else {
      skipped++;
    }
  }

  // Batch update matched leads
  let updateErrors = 0;
  for (let i = 0; i < updates.length; i += 50) {
    const batch = updates.slice(i, i + 50);
    for (const upd of batch) {
      const { error } = await db
        .from('lead_pipeline')
        .update({ account_id: upd.account_id, match_confidence: upd.match_confidence, match_method: upd.match_method })
        .eq('id', upd.id);
      if (error) updateErrors++;
    }
  }

  console.log(`[sheets/match-leads] matched=${matched} skipped=${skipped} errors=${updateErrors} threshold=${threshold}`);
  return apiSuccess(res, { matched, skipped, total: leads.length, updateErrors, threshold });
}
