// Matches Gong call participants to HubSpot contacts, tags each call with its
// deal + close date. Replaces the Gong CRM context approach which wasn't returning data.
//
// Logic: include a call if the deal has no close date (still open) OR the call
// happened before the deal closed. This filters out post-sale CS calls automatically.

import {
  apiError,
  apiSuccess,
  validateMethod,
  validateGongCredentials,
  createGongHeaders,
  logRequest,
} from '../../../lib/apiUtils';
import { createServerSupabaseClient } from '../../../lib/supabase';

const GONG_API_BASE = 'https://api.gong.io';
const HS_API_BASE = 'https://api.hubapi.com';

async function fetchHubSpotEmailDealMap(key) {
  const deals = [];
  let after = null;
  let pages = 0;

  do {
    const url = `${HS_API_BASE}/crm/v3/objects/deals?properties=dealname,dealstage,closedate&associations=contacts&limit=100${after ? `&after=${encodeURIComponent(after)}` : ''}`;
    const r = await fetch(url, { headers: { Authorization: `Bearer ${key}` } });
    if (!r.ok) break;
    const d = await r.json().catch(() => ({}));
    deals.push(...(d.results || []));
    after = d.paging?.next?.after || null;
    pages++;
  } while (after && pages < 50);

  console.log(`[intel-enrich] HubSpot: fetched ${deals.length} deals across ${pages} pages`);
  if (!deals.length) return {};

  // Build contactId → dealInfo map
  const contactToDeal = {};
  for (const deal of deals) {
    const isClosed = ['closedwon', 'closedlost'].includes(deal.properties?.dealstage);
    // Only store closeDate for actually-closed deals — open deals have a target date
    // which is not useful for filtering
    const closeDate = isClosed ? (deal.properties?.closedate || null) : null;
    for (const assoc of (deal.associations?.contacts?.results || [])) {
      const cid = assoc.id;
      if (!contactToDeal[cid]) contactToDeal[cid] = [];
      contactToDeal[cid].push({
        dealId: deal.id,
        dealName: deal.properties?.dealname || null,
        dealStage: deal.properties?.dealstage || null,
        dealCloseDate: closeDate,
      });
    }
  }

  const contactIds = Object.keys(contactToDeal);
  if (!contactIds.length) return {};

  // Fetch emails for all contact IDs in batches of 100
  const emailToDeal = {};
  for (let i = 0; i < contactIds.length; i += 100) {
    const batch = contactIds.slice(i, i + 100);
    try {
      const r = await fetch(`${HS_API_BASE}/crm/v3/objects/contacts/batch/read`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ properties: ['email'], inputs: batch.map(id => ({ id })) }),
      });
      if (!r.ok) continue;
      const d = await r.json().catch(() => ({}));
      for (const contact of (d.results || [])) {
        const email = contact.properties?.email?.toLowerCase();
        if (!email) continue;
        emailToDeal[email] = contactToDeal[contact.id] || [];
      }
    } catch { /* continue */ }
  }

  return emailToDeal;
}

async function fetchGongParticipants(callIds, headers) {
  const out = {};
  const BATCH = 20;
  const PARALLEL = 5;
  const batches = [];
  for (let i = 0; i < callIds.length; i += BATCH) batches.push(callIds.slice(i, i + BATCH));

  for (let i = 0; i < batches.length; i += PARALLEL) {
    const chunk = batches.slice(i, i + PARALLEL);
    const results = await Promise.all(chunk.map(async batch => {
      try {
        const r = await fetch(`${GONG_API_BASE}/v2/calls/extensive`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            filter: { callIds: batch },
            contentSelector: { exposedFields: { parties: true } },
          }),
        });
        if (!r.ok) return {};
        const d = await r.json().catch(() => ({}));
        const result = {};
        for (const call of (d.calls || [])) {
          const externalEmails = (call.parties || [])
            .filter(p => p.affiliation === 'external' && p.emailAddress)
            .map(p => p.emailAddress.toLowerCase());
          if (externalEmails.length) result[call.id] = externalEmails;
        }
        return result;
      } catch { return {}; }
    }));
    results.forEach(r => Object.assign(out, r));
  }
  return out;
}

export default async function handler(req, res) {
  logRequest(req, 'gong/intel-enrich');
  if (!validateMethod(req, res, 'POST')) return;

  const { callIds } = req.body || {};
  if (!callIds?.length) return apiError(res, 400, 'callIds array required');

  const hsKey = process.env.HUBSPOT_API_KEY;
  if (!hsKey) return apiError(res, 500, 'HUBSPOT_API_KEY not configured');

  const credentials = validateGongCredentials(res);
  if (!credentials) return;
  const { accessKey, secretKey } = credentials;
  const gongHeaders = createGongHeaders(accessKey, secretKey);

  const db = createServerSupabaseClient(req, res);

  // Fetch HubSpot email→deal map and Gong participants in parallel
  const [emailDealMap, participantMap] = await Promise.all([
    fetchHubSpotEmailDealMap(hsKey),
    fetchGongParticipants(callIds, gongHeaders),
  ]);

  const emailCount = Object.keys(emailDealMap).length;
  const now = new Date().toISOString();
  let matched = 0;

  const upserts = callIds.map(gongCallId => {
    const emails = participantMap[gongCallId] || [];
    let bestDeal = null;

    for (const email of emails) {
      const deals = emailDealMap[email];
      if (!deals?.length) continue;
      // Prefer open deals (no close date) over closed ones
      const openDeal = deals.find(d => !d.dealCloseDate);
      bestDeal = openDeal || deals[0];
      break;
    }

    if (bestDeal) matched++;

    return {
      gong_call_id: gongCallId,
      hubspot_deal_id: bestDeal?.dealId || null,
      hubspot_deal_stage: bestDeal?.dealStage || null,
      deal_stage_at_call: bestDeal?.dealStage || null,
      deal_name: bestDeal?.dealName || null,
      deal_close_date: bestDeal?.dealCloseDate || null,
      hubspot_checked_at: now,
    };
  });

  for (let i = 0; i < upserts.length; i += 100) {
    await db
      .from('gong_call_analyses')
      .upsert(upserts.slice(i, i + 100), { onConflict: 'gong_call_id' });
  }

  console.log(`[intel-enrich] matched ${matched} of ${callIds.length} calls to HubSpot deals`);
  return apiSuccess(res, { enriched: callIds.length, withDeals: matched, hsContactsIndexed: emailCount });
}
