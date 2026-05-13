import { apiError, apiSuccess, validateAnthropicKey, callAnthropic, parseClaudeJson, logRequest } from '../../../lib/apiUtils';
import { getSupabase } from '../../../lib/supabase';

function avg(values) {
  const nums = values.filter(v => v !== null && v !== undefined && !isNaN(parseFloat(v)));
  if (!nums.length) return null;
  return nums.reduce((sum, v) => sum + parseFloat(v), 0) / nums.length;
}

function computeStats(rows) {
  if (!rows.length) return null;

  const icpScores = rows.map(r => r.analysis?.icp_score);
  const discoveryScores = rows.map(r => r.analysis?.discovery_score);
  const painDepthScores = rows.map(r => r.analysis?.pain_depth_score);
  const championHealthScores = rows.map(r => r.analysis?.champion_health_score);

  const sentimentCounts = { positive: 0, neutral: 0, negative: 0 };
  rows.forEach(r => {
    const s = r.analysis?.sentiment?.toLowerCase();
    if (s === 'positive') sentimentCounts.positive++;
    else if (s === 'negative') sentimentCounts.negative++;
    else sentimentCounts.neutral++;
  });
  const total = rows.length;
  const positivePct = total > 0 ? (sentimentCounts.positive / total) * 100 : 0;

  const objectionMap = {};
  rows.forEach(r => {
    const objections = r.analysis?.objections;
    if (Array.isArray(objections)) {
      objections.forEach(obj => {
        const text = obj?.text || obj;
        if (text) {
          objectionMap[text] = (objectionMap[text] || 0) + 1;
        }
      });
    }
  });
  const topObjections = Object.entries(objectionMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([text, count]) => ({ text, count }));

  const redFlagCount = rows.filter(r => {
    const flags = r.analysis?.red_flags;
    return Array.isArray(flags) && flags.length > 0;
  }).length;
  const redFlagRate = total > 0 ? (redFlagCount / total) * 100 : 0;

  const softCloseCount = rows.filter(r => {
    return r.analysis?.disqualification_signal === 'true' || r.analysis?.disqualification_signal === true;
  }).length;
  const softCloseRate = total > 0 ? (softCloseCount / total) * 100 : 0;

  return {
    callCount: total,
    avgIcp: avg(icpScores),
    avgDiscovery: avg(discoveryScores),
    avgPainDepth: avg(painDepthScores),
    avgChampionHealth: avg(championHealthScores),
    sentimentCounts,
    positivePct,
    topObjections,
    redFlagRate,
    softCloseRate,
  };
}

export default async function handler(req, res) {
  logRequest(req, 'gong/signal-brief');
  const db = getSupabase();

  if (req.method === 'GET') {
    const { data: rows, error } = await db
      .from('gong_aggregate_analysis')
      .select('analysis, computed_at, call_count')
      .order('computed_at', { ascending: false })
      .limit(20);

    if (error || !rows?.length) {
      return apiSuccess(res, { signalBrief: null });
    }

    const row = rows.find(r => r.analysis?.signal_brief);
    if (!row) {
      return apiSuccess(res, { signalBrief: null });
    }

    return apiSuccess(res, {
      signalBrief: row.analysis.signal_brief,
      computedAt: row.computed_at,
      callCount: row.call_count,
    });
  }

  if (req.method === 'POST') {
    const apiKey = validateAnthropicKey(res);
    if (!apiKey) return;

    const { data: rows, error } = await db
      .from('gong_call_analyses')
      .select('call_date, analysis, rep_name, hubspot_deal_stage')
      .not('analysis', 'is', null)
      .or('ignored.is.null,ignored.eq.false');

    if (error || !rows?.length) {
      return apiSuccess(res, { success: true, signalBrief: null, reason: 'No analyzed calls' });
    }

    const now = new Date();
    const thirtyDaysAgo = new Date(now);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const sixtyDaysAgo = new Date(now);
    sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);

    const currentRows = rows.filter(r => {
      if (!r.call_date) return false;
      const d = new Date(r.call_date);
      return d >= thirtyDaysAgo && d <= now;
    });

    const priorRows = rows.filter(r => {
      if (!r.call_date) return false;
      const d = new Date(r.call_date);
      return d >= sixtyDaysAgo && d < thirtyDaysAgo;
    });

    if (!currentRows.length && !priorRows.length) {
      return apiSuccess(res, { success: true, signalBrief: null, reason: 'No analyzed calls' });
    }

    const current = computeStats(currentRows);
    const prior = computeStats(priorRows);

    const prompt = `You are a sales intelligence analyst for Banner, a CapEx management software company. Analyze these call intelligence stats and write a Signal Brief for the sales leader.

Current period (last 30 days): ${JSON.stringify(current)}
Prior period (31-60 days ago): ${JSON.stringify(prior)}

Return ONLY valid JSON:
{
  "direction": [
    {
      "metric": "ICP Fit",
      "trend": "up|down|flat",
      "current_value": "6.8/10",
      "change": "+1.4 pts vs last month",
      "context": "one sentence explaining what this means for the business"
    }
  ],
  "warning_signals": [
    "specific, data-backed warning with numbers"
  ],
  "objection_themes": [
    {
      "theme": "Budget timing",
      "count": 14,
      "trend": "increasing|decreasing|stable",
      "note": "one sentence on what's driving this"
    }
  ],
  "what_working": [
    "specific correlation or pattern with numbers"
  ],
  "quick_hits": [
    {
      "type": "tactical",
      "action": "specific action to take this week",
      "impact": "expected outcome"
    },
    {
      "type": "tactical",
      "action": "specific action to take this week",
      "impact": "expected outcome"
    },
    {
      "type": "structural",
      "action": "process or playbook change",
      "impact": "expected outcome"
    }
  ]
}

Return exactly: 3-5 direction items (only for metrics with data), 2-3 warning signals, top 3 objection themes, 2-3 what's working items, exactly 3 quick_hits (2 tactical + 1 structural).
Be specific — use numbers from the data. Don't hedge. Frame problems with solutions.`;

    let rawText;
    try {
      rawText = await callAnthropic(apiKey, {
        model: 'claude-sonnet-4-6',
        maxTokens: 2000,
        messages: [{ role: 'user', content: prompt }],
      });
    } catch (claudeErr) {
      return res.status(500).json({ success: false, error: claudeErr.message });
    }

    const result = parseClaudeJson(rawText, null);

    await db.from('gong_aggregate_analysis').insert({
      analysis: { signal_brief: result },
      call_count: currentRows.length,
      computed_at: new Date().toISOString(),
    });

    return apiSuccess(res, {
      signalBrief: result,
      computedAt: new Date().toISOString(),
      currentCallCount: currentRows.length,
      priorCallCount: priorRows.length,
    });
  }

  return apiError(res, 405, 'Method not allowed');
}
