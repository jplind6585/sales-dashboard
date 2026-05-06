import {
  apiError,
  apiSuccess,
  validateMethod,
  validateRequired,
  validateAnthropicKey,
  callAnthropic,
  logRequest,
} from '../../../lib/apiUtils';
import { getSalesProcessConfig } from '../../../lib/salesProcess';

export default async function handler(req, res) {
  logRequest(req, 'gong/intel-coaching');
  if (!validateMethod(req, res, 'POST')) return;
  if (!validateRequired(req, res, ['analysis'])) return;

  const { analysis, callTitle, callType, repName, durationSeconds } = req.body;
  const apiKey = validateAnthropicKey(res);
  if (!apiKey) return;

  const durationMin = Math.round((durationSeconds || 0) / 60);

  const config = await getSalesProcessConfig();
  const coachingPriorities = config?.coaching_priorities || '';
  const discoveryFramework = config?.discovery_framework || '';

  const prompt = `You are a senior sales coach reviewing a sales call for Banner (CapEx management software for commercial real estate). Give EXACTLY 3 coaching bullets — specific, actionable, direct. No intro, no conclusion.

Call: "${callTitle || 'Untitled'}" | Type: ${callType || 'unknown'} | Duration: ${durationMin} min | Rep: ${repName || 'Unknown'}

CALL ANALYSIS:
- Summary: ${analysis.summary || 'No summary'}
- ICP Fit: ${analysis.icp_score ?? '—'}/10 — ${analysis.icp_rationale || ''}
- Discovery Score: ${analysis.discovery_score ?? '—'}/10
- Discovery Gaps: ${(analysis.discovery_gaps || []).join('; ') || 'None identified'}
- Rep Talk Ratio: ${analysis.rep_talk_ratio ?? '—'}%
- Sentiment: ${analysis.sentiment || 'unknown'}
- Buying Signals: ${(analysis.buying_signals || []).join('; ') || 'None'}
- Red Flags: ${(analysis.red_flags || []).join('; ') || 'None'}
- Objections: ${(analysis.objections || []).map(o => `${o.text} (rep response: ${o.rep_response || 'none recorded'})`).join(' | ') || 'None'}
- Next Steps Mentioned: ${(analysis.next_steps_mentioned || []).join('; ') || 'None — call ended without clear next steps'}
- Disqualification Signal: ${analysis.disqualification_signal ? `YES — ${analysis.disqualification_notes}` : 'No'}

${coachingPriorities ? `CURRENT COACHING PRIORITIES (use these to decide what to focus on):\n${coachingPriorities}\n` : ''}
${discoveryFramework ? `DISCOVERY FRAMEWORK (use this to assess discovery quality):\n${discoveryFramework}\n` : ''}

Format each bullet EXACTLY like this:
**[Specific issue headline]**
- Why it matters: [business impact or risk in 1 sentence]
- What to do: [specific, actionable change for the next call]

Focus only on the most impactful coaching areas. Do NOT comment on basic communication or things that went well. Be direct — this rep can handle honest feedback.`;

  try {
    const content = await callAnthropic(apiKey, {
      model: 'claude-sonnet-4-6',
      maxTokens: 1200,
      messages: [{ role: 'user', content: prompt }],
    });

    return apiSuccess(res, { coaching: content });
  } catch (error) {
    console.error('intel-coaching error:', error);
    return apiError(res, 500, error.message || 'Failed to generate coaching');
  }
}
