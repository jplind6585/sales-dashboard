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
import { createServerSupabaseClient, getSupabase } from '../../../lib/supabase';
import { getSalesProcessConfig, buildSalesProcessContext } from '../../../lib/salesProcess';

const GONG_API_BASE = 'https://api.gong.io';

function normalizeName(s) {
  return (s || '')
    .toLowerCase()
    .replace(/banner[\s\-–—]*/gi, '')
    .replace(/[\-–—:|]/g, ' ')
    .replace(/\b(intro|demo|discovery|presentation|follow\s*up|meeting|call|new deal|year \d+)\b/gi, '')
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function matchScore(accountName, callTitle) {
  const a = normalizeName(accountName);
  const d = normalizeName(callTitle);
  if (!a || !d) return 0;
  if (a === d) return 10;
  if (d.startsWith(a) || a.startsWith(d)) return 8;
  if (d.includes(a) || a.includes(d)) return 6;
  const aWords = new Set(a.split(' ').filter(w => w.length > 2));
  const dWords = d.split(' ').filter(w => w.length > 2);
  const overlap = dWords.filter(w => aWords.has(w)).length;
  if (overlap >= 3) return 5;
  if (overlap >= 2) return 3;
  if (overlap === 1 && aWords.size === 1) return 2;
  return 0;
}

async function tryMatchCallToAccount(callId, callTitle, db) {
  if (!callTitle?.trim()) return;
  try {
    const { data: accounts } = await db.from('accounts').select('id, name').limit(500);
    if (!accounts?.length) return;
    let best = null, bestScore = 0;
    for (const account of accounts) {
      const score = matchScore(account.name, callTitle);
      if (score > bestScore) { bestScore = score; best = account; }
    }
    if (best && bestScore >= 6) {
      await db.from('gong_call_analyses').update({
        account_id: best.id,
        match_confidence: bestScore / 10,
        match_method: 'title_fuzzy_inline',
      }).eq('gong_call_id', callId);
      console.log(`[intel-analyze] matched "${callTitle}" → "${best.name}" (score ${bestScore})`);
    }
  } catch (e) {
    console.error('[intel-analyze] tryMatchCallToAccount error:', e.message);
  }
}

// Rep email → user UUID mapping. Only auto-analyze reps get tasks created.
const AUTO_TASK_REP_USER_IDS = {
  'james@withbanner.com': '8c969178-4d4e-494f-a8d7-752276fb683c',
};

const REP_STEP_PREFIXES = [
  'rep to ', 'rep will ', 'schedule ', 'follow up', 'send ', 'demo ',
  'obtain ', 'collect ', 'loop ', 'contact ', 'book ', 'prepare ', 'reach out',
];

function isRepOwnedStep(step) {
  const lower = step.toLowerCase().trim();
  return REP_STEP_PREFIXES.some(p => lower.startsWith(p));
}

async function autoCreateTasksFromAnalysis({ callId, title, date, repEmail, analysis, db }) {
  if (!repEmail) return;
  const userId = AUTO_TASK_REP_USER_IDS[repEmail.toLowerCase()];
  if (!userId) return;

  const repSteps = (analysis.next_steps_mentioned || []).filter(isRepOwnedStep);
  if (!repSteps.length) return;

  // Dedup: skip if tasks already exist for this gong call id
  const { count } = await db
    .from('tasks')
    .select('id', { count: 'exact', head: true })
    .eq('source', 'gong')
    .ilike('description', `%${callId}%`);
  if (count > 0) return;

  const callDateStr = date
    ? new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    : 'unknown date';

  // Rep-owned next steps (priority 2)
  const nextStepRows = repSteps.slice(0, 4).map(step => ({
    owner_id:          userId,
    created_by:        userId,
    type:              'triggered',
    priority:          2,
    title:             step.length > 120 ? step.slice(0, 117) + '...' : step,
    description:       `Auto-extracted from Gong call: "${title || 'Untitled'}" on ${callDateStr} (call ID: ${callId})`,
    status:            'open',
    source:            'gong',
    source_type:       'gong_next_step',
    rationale:         analysis.summary ? analysis.summary.slice(0, 200) : null,
    visible_to_manager: true,
  }));

  // Commitments — explicit first-person promises (priority 1, higher urgency)
  const commitments = (analysis.commitments || []).filter(c => c && c.length > 5);
  const commitmentRows = commitments.slice(0, 2).map(c => ({
    owner_id:          userId,
    created_by:        userId,
    type:              'triggered',
    priority:          1,
    title:             c.length > 120 ? c.slice(0, 117) + '...' : c,
    description:       `Rep commitment from Gong call: "${title || 'Untitled'}" on ${callDateStr} (call ID: ${callId})`,
    status:            'open',
    source:            'gong',
    source_type:       'gong_commitment',
    rationale:         `Explicit promise made on the call — highest urgency to follow through.`,
    visible_to_manager: true,
  }));

  const rows = [...commitmentRows, ...nextStepRows];
  if (!rows.length) return;

  const { error } = await db.from('tasks').insert(rows);
  if (error) {
    console.error('[intel-analyze] Auto-task creation failed:', error.message);
  } else {
    console.log(`[intel-analyze] Created ${rows.length} tasks (${commitmentRows.length} commitments, ${nextStepRows.length} next steps) from "${title}"`);
  }
}

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

    const salesProcessConfig = await getSalesProcessConfig();
    const salesProcessContext = buildSalesProcessContext(salesProcessConfig);

    const analysisPrompt = `Analyze this sales call transcript for Banner (CapEx management software for commercial real estate). Extract structured insights.

${salesProcessContext}



Call: "${title || 'Untitled'}" | Type: ${callType || 'unknown'} | Duration: ${durationMin} min | Rep: ${repName || 'Unknown'}

TRANSCRIPT:
${transcriptText.slice(0, 28000)}

ICP scoring guide (Banner's ideal customer):
  9-10: CRE company managing large portfolios, CapEx-heavy, currently on spreadsheets/manual processes
  7-8: Right industry, most criteria met, minor gaps
  5-6: Partial fit — right industry but smaller or unclear CapEx focus
  3-4: Wrong vertical or not CapEx-heavy
  1-2: Clearly outside ICP

Discovery score guide (MEDDICC coverage):
  Score based on how well rep uncovered: economic buyer (who controls budget), decision process (how they evaluate and decide), timeline, quantified pain (specific $ or operational impact), champion (internal advocate identified). 10 = all five uncovered.

Disqualification signal: Set to true if the call ended with a soft, non-committal close — phrases like "we'll send over some info", "let's circle back", "I'll think about it", "reach back out in a few weeks", or "let's keep in touch" — WITHOUT a specific next step (date, meeting, or clear action committed to by both sides). This is a flag for "we're limping along rather than qualifying or disqualifying." Set to false if a clear mutual next step was established.

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
  "next_steps_mentioned": ["next step discussed in the call"],
  "icp_score": 7,
  "icp_rationale": "one sentence on why this score — what fit or mismatch was present",
  "discovery_score": 6,
  "discovery_gaps": ["economic buyer not identified", "no timeline established"],
  "disqualification_signal": false,
  "disqualification_notes": "null if no signal, otherwise brief explanation — e.g. 'Call ended with prospect saying they'd think about it and rep agreed to follow up later with no date set'",
  "commitments": ["Verbatim or near-verbatim rep statement where they promised to do something. Only include first-person promises starting with I'll, I will, I can, I'm going to, etc. Example: 'I'll send the deck over today'"]
}`;

    const rawAnalysis = await callAnthropic(apiKey, {
      model: 'claude-haiku-4-5-20251001',
      maxTokens: 2000,
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
      icp_score: null,
      icp_rationale: null,
      discovery_score: null,
      discovery_gaps: [],
      disqualification_signal: false,
      disqualification_notes: null,
      commitments: [],
    });

    // Persist to Supabase — this is the source of truth across sessions
    // When called from a cron (CRON_SECRET auth), use service role client instead of user session
    const isCron = process.env.CRON_SECRET && req.headers['authorization'] === `Bearer ${process.env.CRON_SECRET}`;
    const db = isCron ? getSupabase() : createServerSupabaseClient(req, res);
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
    } else {
      // Auto-create tasks and match to account — both non-blocking
      autoCreateTasksFromAnalysis({ callId, title, date, repEmail, analysis, db }).catch(e =>
        console.error('[intel-analyze] autoCreateTasksFromAnalysis error:', e.message)
      );
      tryMatchCallToAccount(callId, title, db).catch(e =>
        console.error('[intel-analyze] tryMatchCallToAccount error:', e.message)
      );
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
