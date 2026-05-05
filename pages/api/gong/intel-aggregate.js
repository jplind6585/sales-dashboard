import {
  apiError,
  apiSuccess,
  validateMethod,
  validateAnthropicKey,
  callAnthropic,
  parseClaudeJson,
  logRequest,
} from '../../../lib/apiUtils';
import { createServerSupabaseClient } from '../../../lib/supabase';

export default async function handler(req, res) {
  logRequest(req, 'gong/intel-aggregate');
  const db = createServerSupabaseClient(req, res);

  if (req.method === 'GET') {
    const { data, error } = await db
      .from('gong_aggregate_analysis')
      .select('*')
      .order('computed_at', { ascending: false })
      .limit(1)
      .single();

    if (error || !data) {
      return apiSuccess(res, { aggregate: null });
    }
    return apiSuccess(res, {
      aggregate: data.analysis,
      computedAt: data.computed_at,
      callCount: data.call_count,
    });

  } else if (req.method === 'POST') {
    const apiKey = validateAnthropicKey(res);
    if (!apiKey) return;

    const { data: rows, error } = await db
      .from('gong_call_analyses')
      .select('*')
      .or('ignored.is.null,ignored.eq.false')
      .order('call_date', { ascending: false });

    if (error || !rows || rows.length === 0) {
      return apiError(res, 400, 'No analyzed calls found — analyze some calls first.');
    }

    const callSummaries = rows.map(r => ({
      title: r.title,
      date: r.call_date ? new Date(r.call_date).toLocaleDateString() : null,
      rep: r.rep_name,
      type: r.call_type,
      duration_min: r.duration_seconds ? Math.round(r.duration_seconds / 60) : null,
      ...(r.analysis || {}),
    }));

    const aggregatePrompt = `You are analyzing ${rows.length} sales calls (Intro and Demo) for Banner, a CapEx management software company for commercial real estate. Your audience is the CEO.

Individual call analyses:
${JSON.stringify(callSummaries, null, 2)}

Return ONLY valid JSON with this aggregate analysis:
{
  "executive_summary": "One crisp sentence — the single most important thing the CEO should know. Frame as a finding with an implication. E.g. 'We're losing 40% of qualified deals to authority mismatches — reps are consistently demo-ing to the wrong person.'",
  "top_objections": [{"text": "summarized objection pattern", "count": 5, "category": "pricing|timeline|technical|authority|competition|other", "example": "verbatim example"}],
  "buyer_priorities": [{"priority": "what this buyer segment cares about, framed as their goal not our feature", "count": 14, "example": "verbatim quote or close paraphrase from a call"}],
  "loss_reasons": [{"reason": "specific, actionable reason deals go cold or are lost", "pct_of_negative_calls": 40, "example": "brief example from the calls"}],
  "competitor_mentions": [{"name": "competitor", "count": 3, "typical_context": "how they come up"}],
  "avg_rep_talk_ratio": 47,
  "avg_icp_score": 6.8,
  "avg_discovery_score": 5.4,
  "sentiment_breakdown": {"positive": 12, "neutral": 8, "negative": 5},
  "key_insights": ["specific data-backed insight 1", "insight 2", "insight 3", "insight 4", "insight 5"],
  "win_patterns": ["pattern consistently seen in positive-sentiment calls"],
  "loss_patterns": ["pattern consistently seen in negative-sentiment calls"],
  "rep_stats": [{"rep": "name", "call_count": 5, "avg_talk_ratio": 45, "positive_pct": 60, "avg_icp_score": 7.2, "avg_discovery_score": 5.8, "top_objection": "pricing"}],
  "investor_narrative": "3-4 sentences telling the story of Banner's sales process health and trajectory — suitable for an investor update"
}`;

    const rawAggregate = await callAnthropic(apiKey, {
      model: 'claude-sonnet-4-6',
      maxTokens: 4500,
      messages: [{ role: 'user', content: aggregatePrompt }],
    });

    const analysis = parseClaudeJson(rawAggregate, {});

    await db.from('gong_aggregate_analysis').insert({
      call_count: rows.length,
      date_range_start: rows[rows.length - 1]?.call_date || null,
      date_range_end: rows[0]?.call_date || null,
      analysis,
      computed_at: new Date().toISOString(),
    });

    return apiSuccess(res, { aggregate: analysis, callCount: rows.length });
  } else {
    return apiError(res, 405, 'Method not allowed');
  }
}
