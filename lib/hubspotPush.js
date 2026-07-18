// HubSpot two-way write-back (PLATFORM_REVIEW §2.9). Pushes an account's current stage back to its
// HubSpot deal. Internal→HubSpot dealstage IDs are inverted from sync-deals' STAGE_MAP; intro_scheduled
// and demo have no ID in that map, so they're supplied via env (HUBSPOT_STAGE_INTRO_SCHEDULED /
// HUBSPOT_STAGE_DEMO) — any stage can be overridden with HUBSPOT_STAGE_<INTERNAL_UPPER>.
const REVERSE_STAGE_MAP = {
  qualifying: '973866337',
  active_pursuit: '973866336',
  solution_validation: '973866339',
  proposal: '973818959',
  legal: '973818960',
  closed_won: '973818961',
  closed_lost: '973818962',
  inactive_sdr_follow_up: '973866334',
  inactive_ae_follow_up: '973866335',
};

export function hubspotStageId(internal) {
  if (!internal) return null;
  const override = process.env['HUBSPOT_STAGE_' + internal.toUpperCase()];
  return override || REVERSE_STAGE_MAP[internal] || null;
}

// db = service-role client. Best-effort; returns a result object, never throws.
export async function pushStageToHubspot(db, accountId) {
  const key = process.env.HUBSPOT_API_KEY;
  if (!key) return { pushed: false, reason: 'no_key' };
  try {
    const { data: a } = await db.from('accounts').select('stage, hubspot_deal_id, name').eq('id', accountId).maybeSingle();
    if (!a?.hubspot_deal_id) return { pushed: false, reason: 'no_deal' };
    const stageId = hubspotStageId(a.stage);
    if (!stageId) return { pushed: false, reason: 'no_mapping', stage: a.stage };
    const r = await fetch(`https://api.hubapi.com/crm/v3/objects/deals/${a.hubspot_deal_id}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ properties: { dealstage: stageId } }),
    });
    if (!r.ok) return { pushed: false, reason: `http_${r.status}` };
    db.from('hubspot_sync_log').insert({ action: 'stage_push', hubspot_deal_id: a.hubspot_deal_id }).then(() => {}, () => {});
    return { pushed: true, stage: a.stage };
  } catch (e) {
    return { pushed: false, reason: e.message };
  }
}
