import {
  apiError,
  apiSuccess,
  validateMethod,
  validateRequired,
  validateGongCredentials,
  validateAnthropicKey,
  createGongHeaders,
  callAnthropic,
  parseClaudeJson,
  logRequest,
} from '../../../lib/apiUtils';
import { getSupabase } from '../../../lib/supabase';

const GONG_API_BASE = 'https://api.gong.io';

export default async function handler(req, res) {
  logRequest(req, 'gong/intel-analyze');
  if (!validateMethod(req, res, 'POST')) return;
  if (!validateRequired(req, res, ['callId'])) return;

  const { callId, title, date, callType, repName, repEmail, durationSeconds, gongUrl } = req.body;

  const credentials = validateGongCredentials(res);
  if (!credentials) return;
  const apiKey = validateAnthropicKey(res);
  if (!apiKey) return;

  const { accessKey, secretKey } = credentials;
  const gongHeaders = createGongHeaders(accessKey, secretKey);

  try {
    // Fetch call details + transcript in parallel
    const [detailsRes, transcriptRes] = await Promise.all([
      fetch(`${GONG_API_BASE}/v2/calls/extensive`, {
        method: 'POST',
        headers: gongHeaders,
        body: JSON.stringify({
          filter: { callIds: [callId] },
          contentSelector: { exposedFields: { parties: true } },
        }),
      }),
      fetch(`${GONG_API_BASE}/v2/calls/transcript`, {
        method: 'POST',
        headers: gongHeaders,
        body: JSON.stringify({ filter: { callIds: [callId] } }),
      }),
    ]);

    const detailsData = await detailsRes.json().catch(() => ({}));
    const transcriptData = await transcriptRes.json().catch(() => ({}));

    const callDetails = detailsData.calls?.[0];
    const callTranscript = transcriptData.callTranscripts?.[0];

    // Build speaker map
    const speakerMap = {};
    (callDetails?.parties || []).forEach(p => {
      speakerMap[p.speakerId] = {
        name: p.name || p.emailAddress || `Speaker ${p.speakerId}`,
        affiliation: p.affiliation,
      };
    });

    // Format transcript text
    let transcriptText = '';
    if (callTranscript?.transcript && Array.isArray(callTranscript.transcript)) {
      callTranscript.transcript.forEach(segment => {
        const speaker = speakerMap[segment.speakerId] || { name: `Speaker ${segment.speakerId}`, affiliation: 'unknown' };
        const label = speaker.affiliation === 'internal' ? `[REP] ${speaker.name}` : `[PROSPECT] ${speaker.name}`;
        (segment.sentences || []).forEach(s => {
          transcriptText += `${label}: ${s.text}\n`;
        });
      });
    }

    if (!transcriptText.trim()) {
      transcriptText = '[No transcript available for this call]';
    }

    const durationMin = Math.round((durationSeconds || 0) / 60);

    const analysisPrompt = `Analyze this sales call transcript for Banner (CapEx management software). Extract structured insights.

Call: "${title || 'Untitled'}" | Type: ${callType || 'unknown'} | Duration: ${durationMin} min | Rep: ${repName || 'Unknown'}

TRANSCRIPT:
${transcriptText.slice(0, 28000)}

Return ONLY valid JSON:
{
  "summary": "2-3 sentence summary of what happened and the outcome signal",
  "themes": ["theme1", "theme2", "theme3"],
  "objections": [{"text": "exact or paraphrased objection", "category": "pricing|timeline|technical|authority|competition|other", "rep_response": "brief description of how rep responded"}],
  "competitor_mentions": [{"name": "competitor name", "context": "brief context", "sentiment": "positive|neutral|negative"}],
  "rep_talk_ratio": 47,
  "sentiment": "positive|neutral|negative",
  "buying_signals": ["specific buying signal from the call"],
  "red_flags": ["specific concern or red flag"],
  "next_steps_mentioned": ["next step discussed in the call"]
}`;

    const rawAnalysis = await callAnthropic(apiKey, {
      model: 'claude-haiku-4-5-20251001',
      maxTokens: 1500,
      messages: [{ role: 'user', content: analysisPrompt }],
    });

    const analysis = parseClaudeJson(rawAnalysis, {
      summary: 'Analysis unavailable',
      themes: [],
      objections: [],
      competitor_mentions: [],
      rep_talk_ratio: 50,
      sentiment: 'neutral',
      buying_signals: [],
      red_flags: [],
      next_steps_mentioned: [],
    });

    // Persist to Supabase — this is the source of truth across sessions
    const db = getSupabase();
    const { error: upsertError } = await db.from('gong_call_analyses').upsert(
      {
        gong_call_id: callId,
        title: title || 'Untitled',
        call_date: date || null,
        call_type: callType || 'other',
        rep_name: repName || null,
        rep_email: repEmail || null,
        duration_seconds: durationSeconds || 0,
        gong_url: gongUrl || null,
        analysis,
        analyzed_at: new Date().toISOString(),
      },
      { onConflict: 'gong_call_id' }
    );

    if (upsertError) {
      console.error('intel-analyze: Supabase write failed for', callId, upsertError.message, upsertError.code, upsertError.details);
    }

    // Always return the analysis even if the DB write failed —
    // the UI will update in-memory and show a persistence warning if needed
    return apiSuccess(res, {
      callId,
      analysis,
      persisted: !upsertError,
      persistError: upsertError ? upsertError.message : null,
    });
  } catch (error) {
    console.error('intel-analyze error:', error);
    return apiError(res, 500, error.message);
  }
}
