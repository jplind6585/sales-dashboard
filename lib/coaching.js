import { callAnthropic } from './apiUtils';
import { getSupabase } from './supabase';
import { sendSlackMessage } from './slack';

export async function sendCallCoachingDM({ analysis, callTitle, callDate, accountName, repEmail, gongCallId }) {
  const db = getSupabase();

  // Idempotency: never re-card or re-DM a call we've already coached (re-analysis, backlog reruns).
  if (gongCallId) {
    const { data: existing } = await db
      .from('call_coaching_cards')
      .select('id')
      .eq('gong_call_id', gongCallId)
      .maybeSingle();
    if (existing) return;
  }

  const { data: profile } = await db
    .from('profiles')
    .select('slack_user_id')
    .eq('email', repEmail)
    .maybeSingle();

  if (!profile?.slack_user_id) return;

  const callDateStr = callDate
    ? new Date(callDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    : null;

  const talkRatio = analysis.rep_talk_ratio ?? null;
  const discoveryScore = analysis.discovery_score ?? null;
  const fillerPerMin = analysis.filler_words?.per_minute ?? null;

  const promptText = `You are a sales coach. A rep just finished a call and you need to give them a tight, direct coaching card — not a report. Three points, each 1-2 sentences max.

Call details:
- Account: ${accountName || 'Unknown'}
- Call title: ${callTitle || 'Untitled'}
- Summary: ${analysis.summary || 'No summary available'}
- Rep talk ratio: ${talkRatio != null ? `${talkRatio}%` : 'unknown'} (target: 30-45%)
- Discovery score: ${discoveryScore != null ? `${discoveryScore}/10` : 'unknown'}
- Filler words/min: ${fillerPerMin != null ? fillerPerMin : 'unknown'}
- Next steps mentioned: ${(analysis.next_steps_mentioned || []).join('; ') || 'none'}
- Buying signals: ${(analysis.buying_signals || []).join('; ') || 'none'}
- Red flags: ${(analysis.red_flags || []).join('; ') || 'none'}
- Pain points: ${(analysis.pain_depth_notes || 'not captured')}
- Stage context: Discovery score ${discoveryScore}/10 — ${(analysis.discovery_gaps || []).join(', ') || 'no gaps noted'}

Return ONLY valid JSON in this exact shape:
{
  "strength": "One specific strength from this call — backed by something they said or did. 1-2 sentences.",
  "fix": "One concrete thing to do differently next call. If there's a transcript quote that illustrates the gap, embed it in the text with italics markers like _quote here_. 1-2 sentences.",
  "next_focus": "One thing to prioritize on the next call with this account, based on where the deal is. 1-2 sentences."
}

Be specific and direct. No generic advice. No fluff. If talk ratio was above 50%, that's worth calling out. If a discovery gap exists, name it. Ground strength in something concrete from this specific call.`;

  const raw = await callAnthropic(process.env.ANTHROPIC_API_KEY, {
    model: 'claude-haiku-4-5-20251001',
    maxTokens: 400,
    messages: [{ role: 'user', content: promptText }],
  });

  let parsed;
  try {
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    parsed = JSON.parse(jsonMatch ? jsonMatch[0] : raw);
  } catch {
    console.error('[coaching] Failed to parse Claude JSON:', raw);
    return;
  }

  const { strength, fix, next_focus } = parsed;
  if (!strength || !fix || !next_focus) return;

  const header = [accountName, callTitle || callDateStr].filter(Boolean).join(' · ');

  const fullMessage = `*${header}*

✅ *What worked:* ${strength}

🔧 *One fix:* ${fix}

📌 *Next call focus:* ${next_focus}`;

  // Race-safe: two concurrent analyses of the same call can both pass the maybeSingle check
  // above, but the UNIQUE(gong_call_id) index lets only one INSERT win. The loser gets 23505
  // and must NOT re-send the DM. (The index is partial, so a PostgREST upsert onConflict is
  // not inferable — insert-and-catch is the correct primitive here.)
  const { error: cardErr } = await db.from('call_coaching_cards').insert({
    rep_email: repEmail,
    gong_call_id: gongCallId || null,
    account_name: accountName || null,
    call_date: callDate || null,
    strength,
    fix,
    next_focus,
    full_message: fullMessage,
    sent_at: new Date().toISOString(),
  });
  if (cardErr) {
    if (cardErr.code !== '23505') console.error('[coaching] card insert failed:', cardErr.message);
    return; // lost the race (or could not record) — do not send a duplicate/un-deduped DM
  }

  await sendSlackMessage({ text: fullMessage }, profile.slack_user_id);
}
