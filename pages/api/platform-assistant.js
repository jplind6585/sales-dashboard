import {
  apiError,
  apiSuccess,
  validateMethod,
  validateRequired,
  validateAnthropicKey,
  callAnthropic,
  parseClaudeJson,
  logRequest,
} from '../../lib/apiUtils';

export default async function handler(req, res) {
  logRequest(req, 'platform-assistant');

  if (!validateMethod(req, res, 'POST')) return;
  if (!validateRequired(req, res, ['message'])) return;

  const { message, modules } = req.body;

  const apiKey = validateAnthropicKey(res);
  if (!apiKey) return;

  const modulesList = modules.map(m =>
    `- ${m.name} (${m.id}): ${m.description} [${m.available ? 'Available' : 'Coming Soon'}]`
  ).join('\n');

  const systemPrompt = `You are a helpful AI assistant for the Banner Sales Platform. Your job is to help sales reps navigate the platform, find the right tools, and answer questions about their workflow.

AVAILABLE MODULES:
${modulesList}

Your responsibilities:
1. **Navigation Help**: Guide users to the right module based on their needs
2. **Content Creation**: Help with call scripts, battle cards, emails, proposals, etc.
3. **Coaching**: Provide sales coaching and best practices
4. **Troubleshooting**: Help diagnose what might be going wrong in their sales process
5. **General Questions**: Answer questions about sales methodology, tools, and processes

When responding:
- Be conversational and helpful
- If a specific module would help them, suggest it
- For content requests (scripts, battle cards, etc.), provide the content inline if the module isn't available yet
- For coaching questions, give specific, actionable advice
- Keep responses concise but thorough

Respond in JSON format:
{
  "response": "Your helpful message to the user",
  "suggestedModule": "module-id or null"
}

If you suggest a module, only use module IDs from the list above.`;

  try {
    const rawText = await callAnthropic(apiKey, {
      maxTokens: 2000,
      system: systemPrompt,
      messages: [{ role: 'user', content: message }],
    });

    const result = parseClaudeJson(rawText, {
      response: rawText,
      suggestedModule: null,
    });

    return apiSuccess(res, result);
  } catch (error) {
    console.error('Error in platform-assistant:', error);
    return apiError(res, 500, error.message || 'Failed to process request');
  }
}
