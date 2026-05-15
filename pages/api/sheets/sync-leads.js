// POST /api/sheets/sync-leads
// Fetches the Google Sheet CSV and upserts all leads to lead_pipeline table.
// Requires the Google Sheet to be shared as "Anyone with link can view".
// Sheet: 2026 New Interest (gid=1977870589) inside the master leads tracker.

import { apiError, apiSuccess, logRequest } from '../../../lib/apiUtils';
import { createServerSupabaseClient, getSupabase } from '../../../lib/supabase';

const SHEET_ID = '1F6onXjGTKe10gBReKklDZLLR2wYioSXXWnibJFHWEp4';
// Tab names (not GIDs) — use the gviz ?sheet= parameter for reliable tab lookup
const SHEET_TABS = {
  2026: '2026- New Intros',
  2023: '2023 - New Intros',
  2022: '2022 - New Intros',
};

function parseCSV(text) {
  const rows = [];
  const lines = text.split('\n');
  for (const line of lines) {
    if (!line.trim()) { rows.push([]); continue; }
    const row = [];
    let inQuotes = false;
    let cell = '';
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') { cell += '"'; i++; }
        else inQuotes = !inQuotes;
      } else if (ch === ',' && !inQuotes) {
        row.push(cell.trim());
        cell = '';
      } else {
        cell += ch;
      }
    }
    row.push(cell.trim());
    rows.push(row);
  }
  return rows;
}

function parseDate(str, year = 2026) {
  if (!str) return null;
  str = str.trim().replace(/["""]/g, '');
  if (!str || str === '-' || str.toLowerCase() === 'tbd') return null;
  // Full date with year (M/D/YYYY or YYYY-MM-DD)
  if (str.match(/\d{4}/)) {
    const parts = str.split('/');
    if (parts.length === 3) {
      const [m, d, y] = parts;
      return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    }
    const d = new Date(str);
    return isNaN(d) ? null : d.toISOString().split('T')[0];
  }
  // M/D — assume the given year
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

function parseLead(row, headers, year) {
  const get = (key) => {
    const idx = headers.findIndex(h => h.trim() === key);
    return idx >= 0 ? (row[idx] || '').trim() : '';
  };
  const seq = parseInt(get('SEQ'));
  if (isNaN(seq) || seq <= 0) return null;
  const company = get('Company');
  if (!company) return null;

  return {
    year,
    seq,
    company,
    company_size:       get('Company Size') || null,
    vertical:           get('Vertical') || null,
    contact_dept:       get('Contact - Dept') || null,
    contact_seniority:  get('Contact - Seniority') || null,
    booked_via:         get('Booked Via') || null,
    sdr:                get('SDR') || null,
    ae:                 get('AE (Deal Owner)') || null,
    date_booked:        parseDate(get('Date Booked'), year),
    date_demo:          parseDate(get('Date Demo'), year),
    intro_status:       get('Intro') || null,
    qualify_status:     get('Qualify') || null,
    evaluation_status:  get('Present Evaluation') || null,
    proposal_status:    get('Sent Proposal / Contract') || null,
    closed_status:      get('Closed') || null,
    date_closed:        parseDate(get('Date Closed'), year),
    arr_value:          parseMoney(get('ARR Value')),
    reason_not_closed:  get('Reason Not Closed') || null,
    lost_tags:          get('Lost Tags') || null,
    lost_stage:         get('Lost Stage') || null,
    next_action:        get('Next Action') || null,
    next_action_date:   parseDate(get('Next Action Date'), year),
    arr_estimate_open:  parseMoney(get('ARR Estimate (Open)')),
    forecast_category:  get('Forecast Category') || null,
    days_since_booked:  parseInt(get('Days Since Booked')) || null,
    pipeline_age_flag:  get('Pipeline Age Flag') || null,
    synced_at:          new Date().toISOString(),
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

  const year = parseInt(req.body?.year || '2026');
  const tabName = SHEET_TABS[year];
  if (!tabName) return apiError(res, 400, `No sheet configured for year ${year}`);

  const csvUrl = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(tabName)}`;

  let csvText;
  try {
    const r = await fetch(csvUrl, { headers: { 'User-Agent': 'BannerSalesDashboard/1.0' } });
    if (r.status === 401 || r.status === 403) {
      return apiError(res, 403, 'Google Sheets access denied. Share the sheet as "Anyone with link can view" to enable sync.');
    }
    if (!r.ok) return apiError(res, 502, `Google Sheets returned ${r.status}`);
    csvText = await r.text();
  } catch (e) {
    return apiError(res, 502, `Failed to fetch sheet: ${e.message}`);
  }

  const rows = parseCSV(csvText);

  // Find the lead table — the row where col[0] === 'SEQ'
  let headerIdx = -1;
  for (let i = 0; i < rows.length; i++) {
    if (rows[i][0]?.trim() === 'SEQ') { headerIdx = i; break; }
  }
  if (headerIdx === -1) {
    return apiError(res, 422, 'Could not find lead table (SEQ header) in sheet CSV. Check that the sheet format has not changed.');
  }

  const headers = rows[headerIdx].map(h => h.trim());
  const leads = [];

  for (let i = headerIdx + 1; i < rows.length; i++) {
    const row = rows[i];
    // Stop at blank row (end of lead table)
    if (!row[0] && !row[1]) break;
    const lead = parseLead(row, headers, year);
    if (lead) leads.push(lead);
  }

  if (!leads.length) {
    return apiError(res, 422, `No valid leads parsed from sheet (found header at row ${headerIdx}, but no data rows)`);
  }

  const db = getSupabase();
  let synced = 0, errors = 0;

  for (let i = 0; i < leads.length; i += 50) {
    const batch = leads.slice(i, i + 50);
    const { error } = await db
      .from('lead_pipeline')
      .upsert(batch, { onConflict: 'year,seq' });
    if (error) {
      console.error('[sheets/sync-leads] upsert error:', error.message);
      errors++;
    } else {
      synced += batch.length;
    }
  }

  console.log(`[sheets/sync-leads] year=${year} synced=${synced} total=${leads.length} errors=${errors}`);
  return apiSuccess(res, { year, synced, total: leads.length, errors });
}
