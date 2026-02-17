import {
  apiError,
  apiSuccess,
  validateMethod,
  validateRequired,
  validateAnthropicKey,
  callAnthropic,
  logRequest,
} from '../../lib/apiUtils';

export default async function handler(req, res) {
  logRequest(req, 'generate-coaching-feedback');

  if (!validateMethod(req, res, 'POST')) return;
  if (!validateRequired(req, res, ['transcript', 'account'])) return;

  const { transcript, account } = req.body;

  const apiKey = validateAnthropicKey(res);
  if (!apiKey) return;

  // Build context about the account and call
  const callContext = `
Call Type: ${transcript.callType || 'unknown'}
Date: ${transcript.date || 'unknown'}
Attendees: ${transcript.attendees?.join(', ') || 'unknown'}
Summary: ${transcript.summary || 'No summary available'}

Account Context:
- Company: ${account.name}
- Stage: ${account.stage || 'Not set'}
- Vertical: ${account.vertical || 'Not set'}
`;

  const systemPrompt = `You are a senior sales training consultant coaching experienced Account Executives at a Fortune 500 enterprise software company. You are reviewing a sales call transcript for Banner, a CapEx management software company selling to multifamily real estate companies.

Your role is to provide CONSTRUCTIVE, ACTIONABLE feedback that helps the rep improve their enterprise selling skills. Focus on strategic selling, discovery, relationship building, and deal progression - not basic sales tactics.

IMPORTANT: Provide EXACTLY 3 bullet points of feedback. Each bullet should follow this structure:

**[Clear, specific issue]**
- Why this matters: [Explain the business impact or risk]
- How to improve: [Specific, actionable guidance for next calls]

Focus on:
- Enterprise selling methodology (MEDDICC, multi-threading, value selling)
- Discovery depth and quality of questions
- Stakeholder engagement and relationship building
- Positioning and differentiation
- Deal control and qualification rigor
- Business case development
- Next steps clarity and momentum

Do NOT comment on:
- Basic communication skills unless truly problematic
- Minor formatting or trivial issues
- Things that were done well (this is coaching, not praise)

Be direct but supportive. This is for an experienced AE who can handle honest feedback.

Return ONLY the 3 bullet points in plain text, formatted exactly as shown above. No introduction, no conclusion, just the 3 bullets.`;

  const userPrompt = `Review this sales call and provide 3 specific areas for coaching improvement:

${callContext}

TRANSCRIPT:
${transcript.text}

Provide exactly 3 bullet points following the format specified.`;

  try {
    const content = await callAnthropic(apiKey, {
      maxTokens: 1500,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    });

    return apiSuccess(res, { content });
  } catch (error) {
    console.error('Error generating coaching feedback:', error);
    return apiError(res, 500, error.message || 'Failed to generate feedback');
  }
}
