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

    const sysName = (sys.system || sys.systemType || sys.crm || '').toLowerCase();
    // Accept HubSpot regardless of case, or no system name (check objects directly)
    const isHubSpot = !sysName || sysName.includes('hubspot') || sysName.includes('hub');
    if (!isHubSpot) continue;

    const objects = sys.objects || sys.records || sys.entities || [];
    for (const obj of objects) {
      const objType = (obj.objectType || obj.type || obj.entityType || '').toLowerCase();
      // Include if it looks like a deal, or if there's no type (try it anyway)
      const isDeal = !objType || objType.includes('deal') || objType.includes('opportunity');
      if (!isDeal) continue;

      const dealId = String(obj.objectId || obj.id || obj.entityId || obj.recordId || '');
      if (!dealId || dealId === 'undefined' || dealId === 'null') continue;

      let dealStage = null;
      const fields = obj.fields || obj.properties || obj.attributes || [];
      for (const f of fields) {
        const name = (f.name || f.key || f.fieldName || '').toLowerCase();
        if (name === 'dealstage' || name === 'deal_stage' || name === 'hs_deal_stage_probability') {
          dealStage = f.value || f.stringValue || f.displayValue;
          break;
        }
      }
      return { dealId, dealStage };
    }
  }
  return { dealId: null, dealStage: null };
}

async function fetchGongContextBatch(callIds, headers, logSample = false) {
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
      // Log the raw context for the first call so we can debug the structure
      if (logSample && call.context) {
        console.log('[intel-enrich] sample context for call', call.id, JSON.stringify(call.context).slice(0, 500));
      }
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
    // Log context structure from first batch only (for debugging)
    const results = await Promise.all(chunk.map((b, idx) => fetchGongContextBatch(b, gongHeaders, i === 0 && idx === 0)));
    results.forEach(r => Object.assign(contextMap, r));
  }

  const withDealsFound = Object.values(contextMap).filter(v => v.dealId).length;
  console.log(`[intel-enrich] processed ${callIds.length} calls, found ${withDealsFound} with HubSpot deal IDs`);

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

  // If no deals found, return a sample of the raw context for debugging
  let debugContext = null;
  if (withDeals === 0 && callIds.length > 0) {
    try {
      const sampleRes = await fetch(`${GONG_API_BASE}/v2/calls/extensive`, {
        method: 'POST',
        headers: gongHeaders,
        body: JSON.stringify({
          filter: { callIds: callIds.slice(0, 1) },
          contentSelector: { exposedFields: { context: ['*'] } },
        }),
      });
      const sampleData = await sampleRes.json().catch(() => ({}));
      debugContext = sampleData.calls?.[0]?.context ?? null;
    } catch { /* ignore */ }
  }

  return apiSuccess(res, { enriched: callIds.length, withDeals, closedWon, debugContext });
}
