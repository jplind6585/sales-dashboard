// POST /api/gong/webhook  (Gong Automation Rule / webhook → real-time analysis)
// Replaces polling latency (T1): when Gong signals a call's transcript is ready, this
// imports + analyzes it within ~1 minute, so (via intel-analyze) the rep's tasks + coaching
// are created immediately instead of on the next hourly cron.
//
// SETUP (required to fire — inert until done):
//   1. Set env GONG_WEBHOOK_SECRET (Vercel) and CRON_SECRET (already set).
//   2. Configure the Gong webhook/Automation Rule to POST to
//        https://<host>/api/gong/webhook
//      with header  x-webhook-secret: <GONG_WEBHOOK_SECRET>   (preferred)
//      or           Authorization: Bearer <GONG_WEBHOOK_SECRET>
//      Do NOT put the secret in the query string (it leaks into logs).
//
// Idempotent + safe for Gong retries; governed by the excluded-rep list; fails closed.

import { createGongHeaders } from '../../../lib/apiUtils';
import { getSupabase } from '../../../lib/supabase';
import { isExcludedRep } from '../../../lib/repConfig';
import crypto from 'crypto';

const GONG_API_BASE = 'https://api.gong.io';
const MAX_CALLS_PER_REQUEST = 10;   // cap fan-in
const MAX_INLINE_ANALYZE = 4;       // analyze a few inline; overflow drains via process-backlog

function getCallType(title) {
  const t = (title || '').toLowerCase();
  if (t.includes('intro') || t.includes('introduction')) return 'intro';
  if (t.includes('demo')) return 'demo';
  return 'solution_validation';
}

function timingSafeEqual(a, b) {
  const ba = Buffer.from(String(a || '')), bb = Buffer.from(String(b || ''));
  if (ba.length !== bb.length) return false;
  return crypto.timingSafeEqual(ba, bb);
}

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
  if (!process.env.CRON_SECRET) return res.status(503).json({ error: 'CRON_SECRET not configured' });

  // Header-only auth (never the query string — it persists in access logs), timing-safe.
  const provided = req.headers['x-webhook-secret'] || (req.headers['authorization'] || '').replace(/^Bearer\s+/i, '');
  if (!timingSafeEqual(provided, secret)) return res.status(401).json({ error: 'Unauthorized' });

  const gongAccessKey = process.env.GONG_ACCESS_KEY, gongSecretKey = process.env.GONG_SECRET_KEY;
  if (!gongAccessKey || !gongSecretKey) return res.status(500).json({ error: 'Gong credentials not configured' });
  const gongHeaders = createGongHeaders(gongAccessKey, gongSecretKey);

  const callIds = extractCallIds(req.body, req.query);
  if (!callIds.length) return res.status(200).json({ processed: 0, message: 'No call id in payload' });
  if (callIds.length > MAX_CALLS_PER_REQUEST) return res.status(413).json({ error: `Too many call ids (${callIds.length} > ${MAX_CALLS_PER_REQUEST})` });

  const db = getSupabase();
  const cronSecret = process.env.CRON_SECRET;
  const baseUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000';

  // Rep resolution — track whether the lookup actually succeeded so we can fail CLOSED.
  let userMap = {}, usersOk = false;
  try {
    const r = await fetch(`${GONG_API_BASE}/v2/users`, { headers: gongHeaders });
    if (r.ok) { const d = await r.json(); (d.users || []).forEach(u => { userMap[u.id] = { name: `${u.firstName || ''} ${u.lastName || ''}`.trim(), email: u.emailAddress }; }); usersOk = true; }
  } catch { /* usersOk stays false */ }

  const results = [];
  const toAnalyze = [];

  for (const callId of callIds) {
    try {
      const metaRes = await fetch(`${GONG_API_BASE}/v2/calls/extensive`, {
        method: 'POST', headers: gongHeaders,
        body: JSON.stringify({ filter: { callIds: [callId] }, contentSelector: { exposedFields: { parties: true } } }),
      });
      const metaJson = await metaRes.json().catch(() => ({}));
      const call = metaJson.calls?.[0];
      if (!call) { results.push({ callId, skipped: 'not found in Gong' }); continue; } // Gong returns 200 + empty array for unknown ids
      const meta = call.metaData || call;
      const title = meta.title || 'Untitled';
      const started = meta.started || null;
      const duration = meta.duration || 0;
      const url = meta.url || null;
      const user = userMap[meta.primaryUserId] || null;
      const hasRep = !!(user && (user.name || user.email));

      // Governance: excluded reps never enter the system.
      if (hasRep && (isExcludedRep(user.name) || isExcludedRep(user.email))) { results.push({ callId, skipped: 'excluded rep' }); continue; }

      const isNoShow = duration && duration < 120;

      // Import WITHOUT clobbering an existing analyzed_at; repair metadata + rescue auto-no_show.
      const { data: existing } = await db.from('gong_call_analyses')
        .select('gong_call_id, analyzed_at, ignore_reason').eq('gong_call_id', callId).maybeSingle();
      if (!existing) {
        await db.from('gong_call_analyses').insert({
          gong_call_id: callId, title, call_date: started, duration_seconds: duration,
          rep_name: user?.name || null, rep_email: user?.email || null, gong_url: url,
          analyzed_at: null, ignored: !!isNoShow, ignore_reason: isNoShow ? 'no_show' : null,
        });
      } else if (!existing.analyzed_at) {
        const upd = { title, duration_seconds: duration, gong_url: url };
        if (user?.name) upd.rep_name = user.name;
        if (user?.email) upd.rep_email = user.email;
        if (!isNoShow && existing.ignore_reason === 'no_show') { upd.ignored = false; upd.ignore_reason = null; } // rescue
        await db.from('gong_call_analyses').update(upd).eq('gong_call_id', callId);
      } // else already analyzed → leave it

      if (isNoShow) { results.push({ callId, skipped: 'no_show (<2min)' }); continue; }
      if (existing?.analyzed_at) { results.push({ callId, skipped: 'already analyzed' }); continue; }

      // Fail CLOSED: only inline-analyze when we positively resolved a rep. If the /v2/users
      // lookup failed (or no rep mapping), leave it for a poller that can re-resolve — this
      // prevents an excluded CS call slipping through, and avoids locking a null-rep call.
      if (!hasRep) { results.push({ callId, queued: usersOk ? 'no rep mapping — poller will handle' : 'rep lookup failed — poller will handle' }); continue; }

      // Transcript ready?
      let transcriptReady = false;
      try {
        const tr = await fetch(`${GONG_API_BASE}/v2/calls/transcript`, { method: 'POST', headers: gongHeaders, body: JSON.stringify({ filter: { callIds: [callId] } }) });
        const td = await tr.json().catch(() => ({}));
        const segs = td.callTranscripts?.[0]?.transcript || [];
        transcriptReady = Array.isArray(segs) && segs.length > 0;
      } catch { /* not ready */ }

      if (!transcriptReady) { results.push({ callId, queued: 'transcript not ready — backlog will analyze' }); continue; }
      toAnalyze.push({ callId, title, started, duration, url, user });
    } catch (e) {
      results.push({ callId, error: e.message });
    }
  }

  // Analyze in parallel, capped — overflow drains via process-backlog. (await so it persists.)
  const batch = toAnalyze.slice(0, MAX_INLINE_ANALYZE);
  toAnalyze.slice(MAX_INLINE_ANALYZE).forEach(c => results.push({ callId: c.callId, queued: 'batch cap — backlog will analyze' }));
  await Promise.all(batch.map(async (c) => {
    try {
      const r = await fetch(`${baseUrl}/api/gong/intel-analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${cronSecret}` },
        body: JSON.stringify({ callId: c.callId, title: c.title, date: c.started, callType: getCallType(c.title), repName: c.user?.name || null, repEmail: c.user?.email || null, durationSeconds: c.duration, gongUrl: c.url }),
      });
      const d = await r.json().catch(() => ({}));
      results.push({ callId: c.callId, analyzed: !!d.analysis });
    } catch (e) {
      results.push({ callId: c.callId, error: e.message });
    }
  }));

  return res.status(200).json({ processed: results.length, results });
}
