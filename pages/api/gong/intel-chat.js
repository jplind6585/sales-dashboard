import {
  apiError,
  apiSuccess,
  validateMethod,
  validateAnthropicKey,
  logRequest,
} from '../../../lib/apiUtils';
import { createServerSupabaseClient } from '../../../lib/supabase';

export default async function handler(req, res) {
  logRequest(req, 'gong/intel-chat');
  if (!validateMethod(req, res, 'POST')) return;

  const apiKey = validateAnthropicKey(res);
  if (!apiKey) return;

  const { message, messages = [] } = req.body;
  if (!message?.trim()) return apiError(res, 400, 'Message is required');

  const db = createServerSupabaseClient(req, res);

  const [{ data: analyses }, { data: aggregateRow }] = await Promise.all([
    db.from('gong_call_analyses').select('*').or('ignored.is.null,ignored.eq.false').order('call_date', { ascending: false }),
    db.from('gong_aggregate_analysis').select('*').order('computed_at', { ascending: false }).limit(1).single(),
  ]);

  const callCount = (analyses || []).length;
  const aggregate = aggregateRow?.analysis || null;

  const callSummaries = (analyses || []).map(r => ({
    title: r.title,
    date: r.call_date ? new Date(r.call_date).toLocaleDateString() : null,
    rep: r.rep_name,
    type: r.call_type,
    sentiment: r.analysis?.sentiment,
    themes: r.analysis?.themes,
    objections: (r.analysis?.objections || []).map(o => o.text),
    buying_signals: r.analysis?.buying_signals,
    red_flags: r.analysis?.red_flags,
    summary: r.analysis?.summary,
    gong_url: r.gong_url,
  }));

  const systemPrompt = `You are a sales intelligence analyst for Banner, a CapEx management software company for commercial real estate (~6-person sales team).

You have analyzed ${callCount} sales calls (Intro and Demo calls) from the last 6 months.

## Aggregate Analysis
${aggregate ? JSON.stringify(aggregate, null, 2) : 'Not yet computed — tell the user to click "Refresh Insights" first.'}

## Individual Call Summaries
${JSON.stringify(callSummaries, null, 2)}

Guidelines:
- Answer specifically with data from the calls — no generic advice
- Cite calls by rep name and date when relevant
- For investor-ready insights, be crisp and data-backed
- When asked for tables or exports, format as clean markdown tables
- If asked about a specific company or rep, refer to their calls directly
- Keep answers concise unless the user asks for detail`;

  const conversationMessages = [
    ...messages.slice(-10),
    { role: 'user', content: message },
  ];

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 2000,
        system: systemPrompt,
        messages: conversationMessages,
      }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      return apiError(res, 500, err.error?.message || 'Claude API error');
    }

    const data = await response.json();
    const reply = data.content?.[0]?.text || '';

    return apiSuccess(res, { reply });
  } catch (error) {
    console.error('intel-chat error:', error);
    return apiError(res, 500, error.message);
  }
}
