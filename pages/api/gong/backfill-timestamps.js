// One-time backfill: re-fetch each analyzed call's Gong transcript and rebuild transcript_text WITH
// sentence timestamps ([REP] Name (mm:ss): text) so the proposal/eval-doc generator can attribute
// quotes with mm:ss. Idempotent + re-runnable: skips rows already timestamped unless force. Scope with
// {accountId} to do one deal first (e.g. PeakMade), or run unscoped to sweep. Gong access needed, so
// this runs on Vercel (keys live there), not locally. Auth: CRON_SECRET bearer OR a logged-in user.
import { createServerSupabaseClient, getSupabase } from '../../../lib/supabase';
import { validateGongCredentials, createGongHeaders, logRequest } from '../../../lib/apiUtils';

const GONG_API_BASE = 'https://api.gong.io';
const HAS_TS = /\(\d+:\d\d\)/; // detect an already-embedded (m:ss)

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function buildTimestamped(callDetails, callTranscript) {
  const speakerMap = {};
  (callDetails?.parties || []).forEach((p) => {
    speakerMap[p.speakerId] = { name: p.name || p.emailAddress || `Speaker ${p.speakerId}`, affiliation: p.affiliation };
  });
  let text = '';
  if (Array.isArray(callTranscript?.transcript)) {
    callTranscript.transcript.forEach((segment) => {
      const sp = speakerMap[segment.speakerId] || { name: `Speaker ${segment.speakerId}`, affiliation: 'unknown' };
      const label = sp.affiliation === 'internal' ? `[REP] ${sp.name}` : `[PROSPECT] ${sp.name}`;
      (segment.sentences || []).forEach((s) => {
        const t = Number(s.start);
        const ts = Number.isFinite(t) ? `${Math.floor(t / 60000)}:${String(Math.floor((t % 60000) / 1000)).padStart(2, '0')}` : '';
        text += `${label}${ts ? ` (${ts})` : ''}: ${s.text}\n`;
      });
    });
  }
  return text.trim();
}

export default async function handler(req, res) {
  logRequest(req, 'gong/backfill-timestamps');
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  const secret = process.env.CRON_SECRET;
  const isCron = secret && (req.headers.authorization === `Bearer ${secret}`);
  if (!isCron) {
    const auth = createServerSupabaseClient(req, res);
    const { data: { user } } = await auth.auth.getUser();
    if (!user) return res.status(401).json({ error: 'Unauthorized' });
  }

  const { accountId, callIds, limit = 25, force = false } = req.body || {};
  const credentials = validateGongCredentials(res);
  if (!credentials) return; // validateGongCredentials already responded
  const gongHeaders = createGongHeaders(credentials.accessKey, credentials.secretKey);
  const db = getSupabase();

  // Candidate rows: analyzed calls with a stored transcript, scoped if requested, newest first.
  let q = db.from('gong_call_analyses')
    .select('gong_call_id, transcript_text')
    .not('transcript_text', 'is', null)
    .order('call_date', { ascending: false })
    .limit(Math.min(Number(limit) || 25, 100));
  if (accountId) q = q.eq('account_id', accountId);
  if (Array.isArray(callIds) && callIds.length) q = q.in('gong_call_id', callIds);

  const { data: rows, error } = await q;
  if (error) return res.status(500).json({ error: error.message });

  let updated = 0, skipped = 0, failed = 0;
  for (const row of (rows || [])) {
    if (!force && row.transcript_text && HAS_TS.test(row.transcript_text)) { skipped++; continue; }
    try {
      const [detailsRes, transcriptRes] = await Promise.all([
        fetch(`${GONG_API_BASE}/v2/calls/extensive`, { method: 'POST', headers: gongHeaders, body: JSON.stringify({ filter: { callIds: [row.gong_call_id] }, contentSelector: { exposedFields: { parties: true } } }) }),
        fetch(`${GONG_API_BASE}/v2/calls/transcript`, { method: 'POST', headers: gongHeaders, body: JSON.stringify({ filter: { callIds: [row.gong_call_id] } }) }),
      ]);
      const details = await detailsRes.json().catch(() => ({}));
      const transcript = await transcriptRes.json().catch(() => ({}));
      const rebuilt = buildTimestamped(details.calls?.[0], transcript.callTranscripts?.[0]);
      if (rebuilt && rebuilt.length > 40) {
        await db.from('gong_call_analyses').update({ transcript_text: rebuilt }).eq('gong_call_id', row.gong_call_id);
        updated++;
      } else { skipped++; }
    } catch (e) { failed++; }
    await sleep(350); // stay under Gong rate limits
  }

  return res.status(200).json({ candidates: rows?.length || 0, updated, skipped, failed, scope: accountId || 'all' });
}
