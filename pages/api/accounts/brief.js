// Mode-aware account brief (Account View §6). Assembles the account's real signals and produces a
// structured brief: mode + where-it-stands + watch risks + knowledge (know/missing) + prepared moves.
// Cached in account_briefs keyed by an input hash so it never regenerates in the page-load path unless
// the inputs changed. Mode: post_call (recent call), nurture (state), working (default). pre_call needs
// calendar wiring (TODO) so it is approximated as working for now.
import crypto from 'crypto';
import { createServerSupabaseClient, getSupabase } from '../../../lib/supabase';
import { callAnthropic } from '../../../lib/apiUtils';
import { CLAUDE_MODELS } from '../../../lib/constants';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  const auth = createServerSupabaseClient(req, res);
  const { data: { user } } = await auth.auth.getUser();
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  const { accountId } = req.body || {};
  if (!accountId) return res.status(400).json({ error: 'accountId required' });
  const db = getSupabase();

  const [{ data: account }, { data: rollup }, { data: transcripts }, { data: stakeholders }, { data: gaps }] = await Promise.all([
    db.from('accounts').select('id, name, stage, state, wake_date, deal_value, risk_score, momentum_broken_at').eq('id', accountId).maybeSingle(),
    db.from('account_rollups').select('*').eq('account_id', accountId).maybeSingle(),
    db.from('transcripts').select('date, call_type, summary').eq('account_id', accountId).order('date', { ascending: false }).limit(5),
    db.from('stakeholders').select('name, title, role, role_guess').eq('account_id', accountId).limit(20),
    db.from('information_gaps').select('question').eq('account_id', accountId).eq('status', 'open').limit(8),
  ]);
  if (!account) return res.status(404).json({ error: 'account not found' });

  const latest = (transcripts || [])[0];
  const daysSince = latest?.date ? (Date.now() - new Date(latest.date).getTime()) / 86400000 : 999;
  const mode = account.state === 'nurture' ? 'nurture' : (daysSince <= 2 ? 'post_call' : 'working');

  const inputHash = crypto.createHash('sha1').update(JSON.stringify({
    stage: account.stage, state: account.state, mode, risk: account.risk_score,
    r: rollup, g: (gaps || []).length, t: latest?.date || null,
  })).digest('hex');

  const { data: cached } = await db.from('account_briefs').select('content, input_hash').eq('account_id', accountId).eq('mode', mode).maybeSingle();
  if (cached?.input_hash === inputHash && !req.body.force) return res.status(200).json({ brief: cached.content, mode, cached: true });

  const context = [
    `ACCOUNT: ${account.name} | stage: ${account.stage} | state: ${account.state} | deal value: ${account.deal_value || 'unknown'}`,
    `COUNTS: ${rollup?.transcript_count || 0} calls, ${rollup?.stakeholder_count || 0} stakeholders, ${rollup?.open_gap_count || 0} open gaps`,
    `PEOPLE: ${(stakeholders || []).map((s) => `${s.name}${s.title ? ` (${s.title})` : ''}${s.role_guess ? ` [${s.role_guess}]` : ''}`).join('; ') || 'none mapped'}`,
    `OPEN GAPS: ${(gaps || []).map((g) => g.question).join(' | ') || 'none'}`,
    `RECENT CALLS:\n${(transcripts || []).map((t) => `- ${String(t.date).slice(0, 10)} ${t.call_type || ''}: ${(t.summary || '').slice(0, 300)}`).join('\n') || 'none'}`,
  ].join('\n');

  const system = `You write a tight, honest account brief for a sales rep who may have never seen this deal. Plain speech, no filler, no em dashes. Every factual claim must come from the context provided. Return ONLY JSON:
{"headline":"one line: company, state, where it is","whereItStands":"3-5 sentences, plain, only facts from context","watch":[{"risk":"a real risk (single-threading, missing economic buyer, momentum, disqualification)","move":"the specific next move"}],"knowledge":{"know":["short fact we have"],"missing":["the most important open question blocking the next step"]},"moves":[{"title":"imperative, under 90 chars","rationale":"one sentence, the so-what"}]}`;

  let brief;
  try {
    const raw = await callAnthropic(process.env.ANTHROPIC_API_KEY, {
      model: CLAUDE_MODELS.SONNET, maxTokens: 1200, system,
      messages: [{ role: 'user', content: context }],
    });
    brief = JSON.parse(raw.slice(raw.indexOf('{'), raw.lastIndexOf('}') + 1));
  } catch (e) {
    return res.status(502).json({ error: 'brief generation failed: ' + e.message });
  }

  db.from('account_briefs').upsert({ account_id: accountId, mode, content: brief, input_hash: inputHash, generated_at: new Date().toISOString() }, { onConflict: 'account_id,mode' }).then(() => {}, () => {});
  return res.status(200).json({ brief, mode, cached: false });
}
