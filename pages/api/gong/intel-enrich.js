// Fetches HubSpot deal stages for Gong calls using Gong's CRM context.
// Called from the UI when user clicks "Check HubSpot Status". Results are cached
// in gong_call_analyses so subsequent loads are instant.

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

function extractHubSpotInfo(context) {
  const systems = Array.isArray(context) ? context : (context ? [context] : []);
  for (const sys of systems) {
    if (!sys || typeof sys !== 'object') continue;
    if (!(sys.system || '').toLowerCase().includes('hubspot')) continue;
    for (const obj of (sys.objects || [])) {
      const objType = (obj.objectType || '').toLowerCase();
      if (!objType.includes('deal')) continue;
      const dealId = String(obj.objectId || obj.id || '');
      if (!dealId) continue;
      let dealStage = null;
      for (const f of (obj.fields || [])) {
        if ((f.name || '').toLowerCase() === 'dealstage') {
          dealStage = f.value;
          break;
        }
      }
      return { dealId, dealStage };
    }
  }
  return { dealId: null, dealStage: null };
}

async function fetchGongContextBatch(callIds, headers) {
  try {
    const r = await fetch(`${GONG_API_BASE}/v2/calls/extensive`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        filter: { callIds },
        contentSelector: { exposedFields: { context: ['*'] } },
      }),
    });
    if (!r.ok) return {};
    const d = await r.json().catch(() => ({}));
    const out = {};
    for (const call of (d.calls || [])) {
      out[call.id] = extractHubSpotInfo(call.context || []);
    }
    return out;
  } catch { return {}; }
}

async function fetchHubSpotStages(dealIds) {
  const key = process.env.HUBSPOT_API_KEY;
  if (!key || !dealIds.length) return {};
  try {
    const r = await fetch('https://api.hubapi.com/crm/v3/objects/deals/batch/read', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        properties: ['dealstage'],
        inputs: dealIds.map(id => ({ id })),
      }),
    });
    if (!r.ok) return {};
    const d = await r.json().catch(() => ({}));
    const out = {};
    for (const deal of (d.results || [])) {
      out[deal.id] = deal.properties?.dealstage || null;
    }
    return out;
  } catch { return {}; }
}

export default async function handler(req, res) {
  logRequest(req, 'gong/intel-enrich');
  if (!validateMethod(req, res, 'POST')) return;

  const { callIds } = req.body || {};
  if (!callIds?.length) return apiError(res, 400, 'callIds array required');

  const credentials = validateGongCredentials(res);
  if (!credentials) return;
  const { accessKey, secretKey } = credentials;
  const gongHeaders = createGongHeaders(accessKey, secretKey);

  const db = createServerSupabaseClient(req, res);

  // Batch-fetch Gong extensive context (20 per request, 5 in parallel)
  const contextMap = {};
  const GONG_BATCH = 20;
  const PARALLEL = 5;
  const batches = [];
  for (let i = 0; i < callIds.length; i += GONG_BATCH) {
    batches.push(callIds.slice(i, i + GONG_BATCH));
  }

  for (let i = 0; i < batches.length; i += PARALLEL) {
    const chunk = batches.slice(i, i + PARALLEL);
    const results = await Promise.all(chunk.map(b => fetchGongContextBatch(b, gongHeaders)));
    results.forEach(r => Object.assign(contextMap, r));
  }

  // For deal IDs without a stage in Gong context, look up HubSpot directly
  const needHubSpot = [
    ...new Set(
      Object.values(contextMap)
        .filter(info => info.dealId && !info.dealStage)
        .map(info => info.dealId)
    ),
  ];

  let hsStages = {};
  for (let i = 0; i < needHubSpot.length; i += 100) {
    const stages = await fetchHubSpotStages(needHubSpot.slice(i, i + 100));
    Object.assign(hsStages, stages);
  }

  // Build upsert rows
  const now = new Date().toISOString();
  const upserts = callIds.map(gongCallId => {
    const info = contextMap[gongCallId] || { dealId: null, dealStage: null };
    const stage = info.dealStage || (info.dealId ? hsStages[info.dealId] : null) || null;
    return {
      gong_call_id: gongCallId,
      hubspot_deal_id: info.dealId || null,
      hubspot_deal_stage: stage,
      hubspot_checked_at: now,
    };
  });

  // Upsert in batches of 100 to stay within Supabase limits
  for (let i = 0; i < upserts.length; i += 100) {
    await db
      .from('gong_call_analyses')
      .upsert(upserts.slice(i, i + 100), { onConflict: 'gong_call_id' });
  }

  const withDeals = upserts.filter(u => u.hubspot_deal_id).length;
  const closedWon = upserts.filter(u => u.hubspot_deal_stage?.toLowerCase() === 'closedwon').length;

  return apiSuccess(res, { enriched: callIds.length, withDeals, closedWon });
}
