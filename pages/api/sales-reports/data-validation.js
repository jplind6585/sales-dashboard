// GET /api/sales-reports/data-validation
// Powers the admin data validation queue.
// Returns: unmatched leads, duplicate accounts, multi-year companies, data gaps.

import { apiError, apiSuccess, logRequest } from '../../../lib/apiUtils';
import { getSupabase } from '../../../lib/supabase';

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

export default async function handler(req, res) {
  logRequest(req, 'sales-reports/data-validation');
  if (req.method !== 'GET') return apiError(res, 405, 'Method not allowed');

  const db = getSupabase();

  const [leadsRes, accountsRes] = await Promise.all([
    db.from('lead_pipeline').select('id, year, seq, company, vertical, sdr, ae, date_booked, intro_status, qualify_status, closed_status, account_id, match_confidence, match_method, arr_value, grade').order('year', { ascending: false }).order('date_booked', { ascending: false }),
    db.from('accounts').select('id, name, stage, owner_name, vertical, hubspot_deal_id, deal_value, close_date, hubspot_stage').limit(5000),
  ]);

  if (leadsRes.error) return apiError(res, 500, leadsRes.error.message);
  if (accountsRes.error) return apiError(res, 500, accountsRes.error.message);

  const leads = leadsRes.data || [];
  const accounts = accountsRes.data || [];

  // ── 1. Unmatched leads (no HubSpot account linked) ────────────────────────
  const unmatchedLeads = leads
    .filter(l => !l.account_id)
    .map(l => ({
      id: l.id,
      year: l.year,
      seq: l.seq,
      company: l.company,
      vertical: l.vertical,
      sdr: l.sdr,
      ae: l.ae,
      date_booked: l.date_booked,
      intro_status: l.intro_status,
      closed_status: l.closed_status,
      issue: 'No HubSpot account match found',
    }))
    .slice(0, 200);

  // ── 2. Duplicate accounts (same normalized name, multiple rows) ───────────
  const normMap = {};
  for (const acct of accounts) {
    const key = normalize(acct.name);
    if (!key) continue;
    if (!normMap[key]) normMap[key] = [];
    normMap[key].push(acct);
  }
  const duplicateAccounts = Object.entries(normMap)
    .filter(([, group]) => group.length > 1)
    .map(([normName, group]) => ({
      normalizedName: normName,
      count: group.length,
      accounts: group.map(a => ({
        id: a.id,
        name: a.name,
        stage: a.stage,
        owner: a.owner_name,
        dealValue: a.deal_value,
        hubspotId: a.hubspot_deal_id,
      })),
    }))
    .sort((a, b) => b.count - a.count);

  // ── 3. Multi-year companies (appeared in intros across 2+ years) ──────────
  const companyYears = {};
  for (const l of leads) {
    const key = normalize(l.company);
    if (!key) continue;
    if (!companyYears[key]) companyYears[key] = { company: l.company, years: new Set(), leads: [] };
    companyYears[key].years.add(l.year);
    companyYears[key].leads.push({ year: l.year, seq: l.seq, sdr: l.sdr, ae: l.ae, date_booked: l.date_booked, intro_status: l.intro_status, closed_status: l.closed_status });
  }
  const multiYearCompanies = Object.values(companyYears)
    .filter(c => c.years.size > 1)
    .map(c => ({
      company: c.company,
      years: [...c.years].sort(),
      touchCount: c.leads.length,
      leads: c.leads.sort((a, b) => a.year - b.year),
    }))
    .sort((a, b) => b.touchCount - a.touchCount)
    .slice(0, 100);

  // ── 4. Data gaps (open leads with missing key fields) ─────────────────────
  const openLeads = leads.filter(l => !['Won', 'Lost'].includes(l.closed_status || ''));
  const dataGaps = openLeads
    .filter(l =>
      !l.intro_status ||
      !l.qualify_status ||
      !l.ae ||
      !l.vertical
    )
    .map(l => {
      const gaps = [];
      if (!l.intro_status) gaps.push('Missing intro status');
      if (!l.qualify_status) gaps.push('Missing qualify status');
      if (!l.ae) gaps.push('Missing AE');
      if (!l.vertical) gaps.push('Missing vertical');
      return { ...l, gaps };
    })
    .slice(0, 150);

  // ── 5. Low-confidence matches (linked but uncertain) ─────────────────────
  const lowConfidence = leads
    .filter(l => l.account_id && l.match_confidence != null && l.match_confidence < 75)
    .map(l => ({
      id: l.id,
      year: l.year,
      company: l.company,
      ae: l.ae,
      date_booked: l.date_booked,
      closed_status: l.closed_status,
      match_confidence: l.match_confidence,
      match_method: l.match_method,
    }))
    .sort((a, b) => a.match_confidence - b.match_confidence)
    .slice(0, 100);

  // ── Summary counts ────────────────────────────────────────────────────────
  const summary = {
    totalLeads: leads.length,
    unmatchedCount: leads.filter(l => !l.account_id).length,
    duplicateAccountGroups: duplicateAccounts.length,
    multiYearCount: multiYearCompanies.length,
    dataGapCount: dataGaps.length,
    lowConfidenceCount: lowConfidence.length,
    matchedCount: leads.filter(l => l.account_id).length,
  };

  return apiSuccess(res, {
    data: {
      summary,
      unmatchedLeads,
      duplicateAccounts,
      multiYearCompanies,
      dataGaps,
      lowConfidence,
    }
  });
}
