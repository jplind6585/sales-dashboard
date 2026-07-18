// GET /api/integrations/status — powers the Settings → Integrations health monitor. Reports, per
// integration: configured (is the credential set), a live status where cheaply checkable, and the
// last activity timestamp. Live pings run in parallel with a short timeout and degrade gracefully.
import { createServerSupabaseClient, getSupabase } from '../../../lib/supabase';
import { apiError, apiSuccess, logRequest } from '../../../lib/apiUtils';

const has = (v) => !!(v && String(v).trim());

async function ping(url, opts = {}, timeoutMs = 2500) {
  try {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), timeoutMs);
    const r = await fetch(url, { ...opts, signal: ctl.signal });
    clearTimeout(t);
    return r;
  } catch { return null; }
}

export default async function handler(req, res) {
  logRequest(req, 'integrations/status');
  const auth = createServerSupabaseClient(req, res);
  const { data: { user } } = await auth.auth.getUser();
  if (!user) return apiError(res, 401, 'Unauthorized');
  const db = getSupabase();
  const env = process.env;

  const [gongRes, hubspotRes, touchRes] = await Promise.all([
    db.from('gong_call_analyses').select('analyzed_at').not('analyzed_at', 'is', null).order('analyzed_at', { ascending: false }).limit(1).maybeSingle(),
    db.from('accounts').select('hubspot_synced_at').not('hubspot_synced_at', 'is', null).order('hubspot_synced_at', { ascending: false }).limit(1).maybeSingle(),
    db.from('sdr_touches').select('touched_at').order('touched_at', { ascending: false }).limit(1).maybeSingle().then((r) => r, () => ({ data: null })),
  ]);

  const integrations = [];

  // Gong — live Basic-auth ping to /v2/workspaces
  const gongCfg = has(env.GONG_ACCESS_KEY) && has(env.GONG_SECRET_KEY);
  let gongStatus = gongCfg ? 'connected' : 'not_configured';
  let gongDetail = gongCfg ? (has(env.GONG_WEBHOOK_SECRET) ? 'API + real-time webhook' : 'API connected — webhook secret not set (polling only)') : 'Add GONG_ACCESS_KEY + GONG_SECRET_KEY in Vercel';
  if (gongCfg) {
    const basic = Buffer.from(`${env.GONG_ACCESS_KEY}:${env.GONG_SECRET_KEY}`).toString('base64');
    const r = await ping('https://api.gong.io/v2/workspaces', { headers: { Authorization: `Basic ${basic}` } });
    if (r && !r.ok) { gongStatus = 'error'; gongDetail = `Key rejected (HTTP ${r.status})`; }
    else if (!r) { gongStatus = 'unknown'; gongDetail = 'Could not reach Gong'; }
  }
  integrations.push({ key: 'gong', name: 'Gong', category: 'Calls', configured: gongCfg, status: gongStatus, detail: gongDetail, lastActivity: gongRes.data?.analyzed_at || null });

  // HubSpot — live ping
  const hsCfg = has(env.HUBSPOT_API_KEY);
  let hsStatus = hsCfg ? 'connected' : 'not_configured';
  let hsDetail = hsCfg ? 'Deals sync + note write-back' : 'Add HUBSPOT_API_KEY in Vercel';
  if (hsCfg) {
    const r = await ping('https://api.hubapi.com/account-info/v3/details', { headers: { Authorization: `Bearer ${env.HUBSPOT_API_KEY}` } });
    if (r && !r.ok) { hsStatus = 'error'; hsDetail = `Token rejected (HTTP ${r.status}) — check the private-app key`; }
    else if (!r) { hsStatus = 'unknown'; hsDetail = 'Could not reach HubSpot'; }
  }
  integrations.push({ key: 'hubspot', name: 'HubSpot', category: 'CRM', configured: hsCfg, status: hsStatus, detail: hsDetail, lastActivity: hubspotRes.data?.hubspot_synced_at || null });

  // Slack — auth.test
  const slackCfg = has(env.SLACK_BOT_TOKEN);
  let slackStatus = slackCfg ? 'connected' : 'not_configured';
  let slackDetail = slackCfg ? 'Notifications + daily digests' : 'Add SLACK_BOT_TOKEN in Vercel';
  if (slackCfg) {
    const r = await ping('https://slack.com/api/auth.test', { method: 'POST', headers: { Authorization: `Bearer ${env.SLACK_BOT_TOKEN}` } });
    const j = r ? await r.json().catch(() => ({})) : null;
    if (j && j.ok === false) { slackStatus = 'error'; slackDetail = `Token rejected (${j.error})`; }
    else if (!r) { slackStatus = 'unknown'; slackDetail = 'Could not reach Slack'; }
  }
  integrations.push({ key: 'slack', name: 'Slack', category: 'Notifications', configured: slackCfg, status: slackStatus, detail: slackDetail, lastActivity: null });

  // Gmail + Calendar — per-user Google OAuth (no server-side key to check)
  integrations.push({ key: 'gmail', name: 'Gmail', category: 'Email', configured: true, status: 'user_auth', detail: 'Per-user Google OAuth — read active; add the compose scope to enable draft/send', lastActivity: null });
  integrations.push({ key: 'calendar', name: 'Google Calendar', category: 'Calendar', configured: true, status: 'user_auth', detail: 'Per-user Google OAuth (read)', lastActivity: null });

  // Apollo — live health ping (X-Api-Key, 0 credits)
  const apolloCfg = has(env.APOLLO_API_KEY);
  let apolloStatus = apolloCfg ? 'connected' : 'not_configured';
  let apolloDetail = apolloCfg ? 'List building + contact enrichment' : 'Add APOLLO_API_KEY in Vercel to enable list building';
  if (apolloCfg) {
    const r = await ping('https://api.apollo.io/v1/auth/health', { headers: { 'X-Api-Key': env.APOLLO_API_KEY, 'Content-Type': 'application/json', 'Cache-Control': 'no-cache' } });
    const j = r ? await r.json().catch(() => ({})) : null;
    if (r && r.ok && j?.healthy === false) { apolloStatus = 'error'; apolloDetail = 'Key present but not valid'; }
    else if (r && !r.ok) { apolloStatus = 'error'; apolloDetail = `Key rejected (HTTP ${r.status})`; }
    else if (!r) { apolloStatus = 'unknown'; apolloDetail = 'Could not reach Apollo'; }
  }
  integrations.push({ key: 'apollo', name: 'Apollo', category: 'Prospecting', configured: apolloCfg, status: apolloStatus, detail: apolloDetail, lastActivity: null });

  // Clay
  const clayCfg = has(env.CLAY_API_KEY) || has(env.CLAY_WEBHOOK_URL);
  integrations.push({ key: 'clay', name: 'Clay', category: 'Enrichment', configured: clayCfg, status: clayCfg ? 'connected' : 'not_configured', detail: clayCfg ? 'Deep enrichment via Clay' : 'Add CLAY_WEBHOOK_URL in Vercel to enable enrichment', lastActivity: touchRes.data?.touched_at ? null : null });

  // Anthropic
  const aiCfg = has(env.ANTHROPIC_API_KEY);
  integrations.push({ key: 'anthropic', name: 'Claude (Anthropic)', category: 'AI', configured: aiCfg, status: aiCfg ? 'connected' : 'not_configured', detail: 'Powers all AI drafting + call analysis', lastActivity: null });

  const summary = {
    connected: integrations.filter((i) => i.status === 'connected' || i.status === 'user_auth').length,
    issues: integrations.filter((i) => i.status === 'error').length,
    notConfigured: integrations.filter((i) => i.status === 'not_configured').length,
    total: integrations.length,
  };

  return apiSuccess(res, { integrations, summary });
}
