// POST /api/gong/webhook  (Gong Automation Rule / webhook → real-time analysis)
// Replaces polling latency (T1): when Gong signals a call's transcript is ready, this
// imports + analyzes it within ~1 minute, which (via intel-analyze) creates the rep's
// tasks + coaching for auto-process reps immediately instead of on the next hourly cron.
//
// Auth: shared secret. Configure the Gong webhook to call
//   https://<host>/api/gong/webhook?secret=<GONG_WEBHOOK_SECRET>
// (or send it as an x-webhook-secret / Authorization: Bearer header). Closed if the env var is unset.
//
// Idempotent: safe for Gong retries (import upsert + intel-analyze upsert by gong_call_id;
// coaching/tasks already dedupe).

import { createGongHeaders } from '../../../lib/apiUtils';
import { getSupabase } from '../../../lib/supabase';
import { isExcludedRep } from '../../../lib/repConfig';

const GONG_API_BASE = 'https://api.gong.io';

function getCallType(title) {
  const t = (title || '').toLowerCase();
  if (t.includes('intro') || t.includes('introduction')) return 'intro';
  if (t.includes('demo')) return 'demo';
  return 'solution_validation';
}

// Gong webhook payloads vary by rule config — pull a call id out of the common shapes.
function extractCallIds(body = {}, query = {}) {
  const ids = new Set();
  const add = (v) => { if (v != null && String(v).trim()) ids.add(String(v).trim()); };
  add(body.callId); add(body.call_id); add(body.objectId); add(body.id);
  if (body.call?.id) add(body.call.id);
  if (Array.isArray(body.callIds)) body.callIds.forEach(add);
  if (Array.isArray(body.calls)) body.calls.forEach(c => add(c?.id ?? c));
  add(query.callId);
  return [...ids];
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  const secret = process.env.GONG_WEBHOOK_SECRET;
  if (!secret) return res.status(503).json({ error: 'GONG_WEBHOOK_SECRET not configured' });
  const provided = req.query.secret || req.headers['x-webhook-secret'] || (req.headers['authorization'] || '').replace(/^Bearer\s+/i, '');
  if (provided !== secret) return res.status(401).json({ error: 'Unauthorized' });

  const gongAccessKey = process.env.GONG_ACCESS_KEY, gongSecretKey = process.env.GONG_SECRET_KEY;
  if (!gongAccessKey || !gongSecretKey) return res.status(500).json({ error: 'Gong credentials not configured' });
  const gongHeaders = createGongHeaders(gongAccessKey, gongSecretKey);

  const callIds = extractCallIds(req.body, req.query);
  if (!callIds.length) return res.status(200).json({ processed: 0, message: 'No call id in payload' });

  const db = getSupabase();
  const cronSecret = process.env.CRON_SECRET;
  const baseUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000';

  // Rep resolution
  let userMap = {};
  try {
    const r = await fetch(`${GONG_API_BASE}/v2/users`, { headers: gongHeaders });
    if (r.ok) { const d = await r.json(); (d.users || []).forEach(u => { userMap[u.id] = { name: `${u.firstName || ''} ${u.lastName || ''}`.trim(), email: u.emailAddress }; }); }
  } catch { /* continue */ }

  const results = [];
  for (const callId of callIds) {
    try {
      // Fetch call metadata
      const metaRes = await fetch(`${GONG_API_BASE}/v2/calls/extensive`, {
        method: 'POST', headers: gongHeaders,
        body: JSON.stringify({ filter: { callIds: [callId] }, contentSelector: { exposedFields: { parties: true } } }),
      });
      const metaJson = await metaRes.json().catch(() => ({}));
      const call = metaJson.calls?.[0];
      const meta = call?.metaData || call || {};
      const title = meta.title || 'Untitled';
      const started = meta.started || null;
      const duration = meta.duration || 0;
      const url = meta.url || null;
      const user = userMap[meta.primaryUserId] || null;

      // Governance: excluded (CS/non-sales) reps never enter the system.
      if (isExcludedRep(user?.name) || isExcludedRep(user?.email)) { results.push({ callId, skipped: 'excluded rep' }); continue; }

      const isNoShow = duration && duration < 120;
      // Import (idempotent) so the call is captured even if we can't analyze yet.
      await db.from('gong_call_analyses').upsert({
        gong_call_id: callId, title, call_date: started, duration_seconds: duration,
        rep_name: user?.name || null, rep_email: user?.email || null, gong_url: url,
        analyzed_at: null, ignored: !!isNoShow, ignore_reason: isNoShow ? 'no_show' : null,
      }, { onConflict: 'gong_call_id', ignoreDuplicates: true });

      if (isNoShow) { results.push({ callId, skipped: 'no_show (<2min)' }); continue; }

      // Is the transcript ready yet? (Gong "transcript ready" can race the call-end event.)
      let transcriptReady = false;
      try {
        const tr = await fetch(`${GONG_API_BASE}/v2/calls/transcript`, {
          method: 'POST', headers: gongHeaders, body: JSON.stringify({ filter: { callIds: [callId] } }),
        });
        const td = await tr.json().catch(() => ({}));
        const segs = td.callTranscripts?.[0]?.transcript || [];
        transcriptReady = Array.isArray(segs) && segs.length > 0;
      } catch { /* treat as not ready */ }

      if (!transcriptReady) {
        // Leave analyzed_at=null — process-backlog / nightly-intel will pick it up shortly.
        results.push({ callId, queued: 'transcript not ready — backlog will analyze' });
        continue;
      }

      // Fast path: analyze now (awaited so it persists; idempotent on Gong retry).
      const r = await fetch(`${baseUrl}/api/gong/intel-analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${cronSecret}` },
        body: JSON.stringify({ callId, title, date: started, callType: getCallType(title), repName: user?.name || null, repEmail: user?.email || null, durationSeconds: duration, gongUrl: url }),
      });
      const d = await r.json().catch(() => ({}));
      results.push({ callId, analyzed: !!d.analysis });
    } catch (e) {
      results.push({ callId, error: e.message });
    }
  }

  return res.status(200).json({ processed: results.length, results });
}
