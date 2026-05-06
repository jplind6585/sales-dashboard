// POST /api/hubspot/sync-deals
// Creates/upserts Supabase accounts from HubSpot deals (Sales Opportunities pipeline).
// HubSpot is source of truth for deal metadata — runs nightly and on-demand from Settings.
// Owner mapping: James's HubSpot owner ID → his Supabase UUID. Others stored by name only.

import { apiError, apiSuccess, logRequest } from '../../../lib/apiUtils';
import { createServerSupabaseClient, getSupabase } from '../../../lib/supabase';

const HS_API_BASE = 'https://api.hubapi.com';
const SALES_PIPELINE_ID = '663206213';

const STAGE_MAP = {
  '973866334':  'qualifying',           // Pre Pursuit
  '1268649029': 'qualifying',           // Inactive Pursuit - SDR Follow Up
  '973866335':  'qualifying',           // Inactive Pursuit - AE Follow Up
  '973866336':  'qualifying',           // Active Pursuit
  '973866337':  'qualifying',           // Qualify
  '973866339':  'solution_validation',  // Solution Validation
  '973818959':  'proposal',             // Proposal
  '973818960':  'legal',               // Legal
  '973818961':  'won',                  // Close Won
  '973818962':  'lost',                 // Closed Lost - DQ
  '974622038':  'lost',                 // Churned
  'closedlost': 'lost',                 // Closed Lost - Remarketing
  '159786509':  'lost',                 // Closed Lost - AE Follow Up
  '133539465':  'lost',                 // Disqualified - Will Never Be a Deal
  '147472456':  'qualifying',           // Intro Call - No Show/Rescheduling
  '1176174939': 'qualifying',           // Connected - Re-engage
  '1176174940': 'lost',                 // Connected - DQ
};

// Add entries here as reps sign up to the platform
const OWNER_USER_MAP = {
  '355982922': '8c969178-4d4e-494f-a8d7-752276fb683c', // James Lindberg
};

const OWNER_NAMES = {
  '355982922': 'James Lindberg',
  '587669685': 'Logan King',
  '402320791': 'Mark Murphy',
  '83834887':  'Tony Alic',
  '40554838':  'Justin Goodkind',
  '75421653':  'Jovan Arsovski',
};

function cleanDealName(raw) {
  return (raw || '').replace(/\s*-\s*New Deal\s*$/i, '').trim()
}

async function fetchAllDeals(key) {
  const deals = [];
  let after = null;
  let pages = 0;

  do {
    const body = {
      filterGroups: [{
        filters: [{ propertyName: 'pipeline', operator: 'EQ', value: SALES_PIPELINE_ID }],
      }],
      properties: ['dealname', 'amount', 'dealstage', 'closedate', 'hubspot_owner_id'],
      limit: 100,
      ...(after ? { after } : {}),
    };
    const r = await fetch(`${HS_API_BASE}/crm/v3/objects/deals/search`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!r.ok) break;
    const d = await r.json().catch(() => ({}));
    deals.push(...(d.results || []));
    after = d.paging?.next?.after || null;
    pages++;
  } while (after && pages < 100);

  console.log(`[hubspot/sync-deals] fetched ${deals.length} deals across ${pages} pages`);
  return deals;
}

export default async function handler(req, res) {
  logRequest(req, 'hubspot/sync-deals');
  if (req.method !== 'POST') return apiError(res, 405, 'Method not allowed');

  const isCron = process.env.CRON_SECRET && req.headers['authorization'] === `Bearer ${process.env.CRON_SECRET}`;
  if (!isCron) {
    const authClient = createServerSupabaseClient(req, res);
    const { data: { user } } = await authClient.auth.getUser();
    if (!user) return apiError(res, 401, 'Unauthorized');
  }

  const hsKey = process.env.HUBSPOT_API_KEY;
  if (!hsKey) return apiError(res, 500, 'HUBSPOT_API_KEY not configured');

  const db = getSupabase();
  const deals = await fetchAllDeals(hsKey);
  if (!deals.length) return apiError(res, 502, 'No deals returned from HubSpot');

  const now = new Date().toISOString();
  const rows = deals.map(deal => {
    const ownerId = deal.properties?.hubspot_owner_id || null;
    const stageId  = deal.properties?.dealstage || null;
    const rawAmount = deal.properties?.amount;
    const rawClose  = deal.properties?.closedate;

    return {
      name:              cleanDealName(deal.properties?.dealname || '') || `Deal ${deal.id}`,
      hubspot_deal_id:   deal.id,
      hubspot_stage:     stageId,
      hubspot_owner_id:  ownerId,
      owner_name:        ownerId ? (OWNER_NAMES[ownerId] || null) : null,
      user_id:           ownerId ? (OWNER_USER_MAP[ownerId] || null) : null,
      stage:             stageId ? (STAGE_MAP[stageId] || 'qualifying') : 'qualifying',
      deal_value:        rawAmount ? parseFloat(rawAmount) : null,
      close_date:        rawClose ? rawClose.split('T')[0] : null,
      hubspot_synced_at: now,
    };
  });

  let synced = 0;
  let errors = 0;
  for (let i = 0; i < rows.length; i += 100) {
    const { error } = await db
      .from('accounts')
      .upsert(rows.slice(i, i + 100), { onConflict: 'hubspot_deal_id' });
    if (error) {
      console.error('[hubspot/sync-deals] upsert error:', error.message);
      errors++;
    } else {
      synced += rows.slice(i, i + 100).length;
    }
  }

  console.log(`[hubspot/sync-deals] synced ${synced} accounts (${errors} batch errors)`);
  return apiSuccess(res, { synced, total: deals.length, errors });
}
