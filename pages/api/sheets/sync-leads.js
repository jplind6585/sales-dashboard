// POST /api/sheets/sync-leads
// Syncs lead tracking data from Google Sheets into lead_pipeline table.
// Supports 2024, 2025, 2026. Each year lives in a different spreadsheet.
// Requires sheets shared as "Anyone with link can view".
// Column schemas differ by year — normalized to 2026 canonical names.

import { apiError, apiSuccess, logRequest } from '../../../lib/apiUtils';
import { createServerSupabaseClient, getSupabase } from '../../../lib/supabase';

// Per-year sheet config. Tab names used (more robust than GIDs).
// Note: 2024 tab is in the sheet that appears to say "2025" externally — confirmed by tab inspection.
const SHEET_CONFIGS = {
  2026: { sheetId: '1F6onXjGTKe10gBReKklDZLLR2wYioSXXWnibJFHWEp4', tab: '2026- New Intros' },
  2025: { sheetId: '1XmerLdO1DZZ-v4kJrchiFgQUwGxrVqbj1SrvLJJSa50', tab: '2025- New Intros' },
  2024: { sheetId: '1ylzPFUGUrK1qvOhIAwpK9NAG8q7j4cmtTnukb-63FuQ', tab: '2024 - New Intros' },
};

// Map older column names → canonical 2026 names so parseLead stays uniform
const COLUMN_REMAP = {
  'AE':                    'AE (Deal Owner)',
  'Demo':                  'Qualify',
  'Present Business Case': 'Present Evaluation',
  'Sent Contract':         'Sent Proposal / Contract',
  'Value':                 'ARR Value',
};

// 2024/2025 use X = Showed, O = No Show; 2026 uses full words
function normalizeStatus(val, year) {
  if (!val) return null;
  const v = val.trim();
  if (year < 2026) {
    if (v === 'X') return 'Showed';
    if (v === 'O') return 'No Show';
  }
  return v || null;
}

// Proper RFC-4180 CSV parser — handles multi-line quoted fields (transcript columns)
function parseCSV(text) {
  const rows = [];
  let row = [];
  let cell = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];

    if (ch === '"') {
      if (inQuotes && next === '"') { cell += '"'; i++; }
      else inQuotes = !inQuotes;
    } else if (ch === ',' && !inQuotes) {
      row.push(cell.trim());
      cell = '';
    } else if (ch === '\n' && !inQuotes) {
      row.push(cell.trim());
      if (row.some(c => c)) rows.push(row);
      row = [];
      cell = '';
    } else if (ch === '\r') {
      // skip
    } else {
      cell += ch;
    }
  }
  if (cell || row.length) {
    row.push(cell.trim());
    if (row.some(c => c)) rows.push(row);
  }
  return rows;
}

function parseDate(str, year = 2026) {
  if (!str) return null;
  str = String(str).trim().replace(/["""]/g, '');
  if (!str || str === '-' || str.toLowerCase() === 'tbd') return null;
  if (str.match(/\d{4}/)) {
    const parts = str.split('/');
    if (parts.length === 3) {
      const [m, d, y] = parts;
      return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    }
    const d = new Date(str);
    return isNaN(d) ? null : d.toISOString().split('T')[0];
  }
  const parts = str.split('/');
  if (parts.length === 2) {
    const m = parseInt(parts[0]);
    const d = parseInt(parts[1]);
    if (!isNaN(m) && !isNaN(d) && m >= 1 && m <= 12 && d >= 1 && d <= 31) {
      return `${year}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    }
  }
  return null;
}

function parseMoney(str) {
  if (!str) return null;
  const clean = String(str).replace(/[$,\s]/g, '');
  const val = parseFloat(clean);
  return isNaN(val) || val === 0 ? null : val;
}

function parseLead(row, headers, year, rowIdx) {
  const get = (key) => {
    const idx = headers.findIndex(h => h === key);
    return idx >= 0 ? (row[idx] || '').trim() : '';
  };

  // 2026 has explicit SEQ; 2024/2025 use 1-based row index
  const seqRaw = year === 2026 ? parseInt(get('SEQ')) : rowIdx;
  if (!seqRaw || isNaN(seqRaw) || seqRaw <= 0) return null;

  const company = get('Company');
  if (!company || company.length < 2) return null;

  return {
    year,
    seq:               seqRaw,
    company,
    company_size:      get('Company Size') || null,
    vertical:          get('Vertical') || null,
    contact_dept:      get('Contact - Dept') || null,
    contact_seniority: get('Contact - Seniority') || null,
    booked_via:        get('Booked Via') || null,
    sdr:               get('SDR') || null,
    ae:                get('AE (Deal Owner)') || null,
    grade:             get('Grade') || null,
    date_booked:       parseDate(get('Date Booked'), year),
    date_demo:         parseDate(year === 2026 ? get('Date Demo') : get('Qualify'), year),
    intro_status:      normalizeStatus(get('Intro'), year),
    qualify_status:    normalizeStatus(get('Qualify'), year),
    evaluation_status: get('Present Evaluation') || null,
    proposal_status:   get('Sent Proposal / Contract') || null,
    closed_status:     get('Closed') || null,
    date_closed:       parseDate(get('Date Closed'), year),
    arr_value:         parseMoney(get('ARR Value')),
    reason_not_closed: get('Reason Not Closed') || null,
    lost_tags:         get('Lost Tags') || null,
    lost_stage:        get('Lost Stage') || null,
    next_action:       get('Next Action') || null,
    next_action_date:  parseDate(get('Next Action Date'), year),
    arr_estimate_open: parseMoney(get('ARR Estimate (Open)')),
    forecast_category: get('Forecast Category') || null,
    days_since_booked: parseInt(get('Days Since Booked')) || null,
    pipeline_age_flag: get('Pipeline Age Flag') || null,
    source_sheet:      SHEET_CONFIGS[year]?.sheetId || null,
    synced_at:         new Date().toISOString(),
  };
}

export default async function handler(req, res) {
  logRequest(req, 'sheets/sync-leads');
  if (req.method !== 'POST') return apiError(res, 405, 'Method not allowed');

  const isCron = process.env.CRON_SECRET && req.headers['authorization'] === `Bearer ${process.env.CRON_SECRET}`;
  if (!isCron) {
    const authClient = createServerSupabaseClient(req, res);
    const { data: { user } } = await authClient.auth.getUser();
    if (!user) return apiError(res, 401, 'Unauthorized');
  }

  // Allow syncing a specific year, or all years at once
  const yearParam = req.body?.year;
  const years = yearParam ? [parseInt(yearParam)] : [2024, 2025, 2026];

  const results = [];

  for (const year of years) {
    const config = SHEET_CONFIGS[year];
    if (!config) { results.push({ year, error: 'No config' }); continue; }

    const csvUrl = `https://docs.google.com/spreadsheets/d/${config.sheetId}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(config.tab)}`;

    let csvText;
    try {
      const r = await fetch(csvUrl, { headers: { 'User-Agent': 'BannerSalesDashboard/1.0' } });
      if (r.status === 401 || r.status === 403) {
        results.push({ year, error: 'Access denied — share sheet as "Anyone with link can view"' });
        continue;
      }
      if (!r.ok) { results.push({ year, error: `HTTP ${r.status}` }); continue; }
      csvText = await r.text();
    } catch (e) {
      results.push({ year, error: e.message });
      continue;
    }

    const rows = parseCSV(csvText);
    if (!rows.length) { results.push({ year, error: 'Empty CSV' }); continue; }

    // Normalize headers — remap older column names to 2026 canonical names
    const rawHeaders = rows[0];
    const headers = rawHeaders.map(h => COLUMN_REMAP[h] || h);

    const leads = [];
    for (let i = 1; i < rows.length; i++) {
      const lead = parseLead(rows[i], headers, year, i);
      if (lead) leads.push(lead);
    }

    if (!leads.length) { results.push({ year, error: 'No valid leads parsed' }); continue; }

    const db = getSupabase();
    let synced = 0, errors = 0;

    for (let i = 0; i < leads.length; i += 50) {
      const batch = leads.slice(i, i + 50);
      const { error } = await db
        .from('lead_pipeline')
        .upsert(batch, { onConflict: 'year,seq' });
      if (error) {
        console.error(`[sheets/sync-leads] year=${year} upsert error:`, error.message);
        errors++;
      } else {
        synced += batch.length;
      }
    }

    console.log(`[sheets/sync-leads] year=${year} synced=${synced} total=${leads.length} errors=${errors}`);
    results.push({ year, synced, total: leads.length, errors });
  }

  return apiSuccess(res, { results });
}
