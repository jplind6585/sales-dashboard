/**
 * API utility functions for consistent request/response handling
 */

/**
 * Standard error response format
 */
export const apiError = (res, statusCode, message, details = null) => {
  const response = {
    success: false,
    error: message,
  };

  if (details && process.env.NODE_ENV === 'development') {
    response.details = details;
  }

  return res.status(statusCode).json(response);
};

/**
 * Standard success response format
 */
export const apiSuccess = (res, data, statusCode = 200) => {
  return res.status(statusCode).json({
    success: true,
    ...data,
  });
};

/**
 * Validate request method
 */
export const validateMethod = (req, res, allowedMethods) => {
  const methods = Array.isArray(allowedMethods) ? allowedMethods : [allowedMethods];
  if (!methods.includes(req.method)) {
    apiError(res, 405, `Method ${req.method} not allowed. Use: ${methods.join(', ')}`);
    return false;
  }
  return true;
};

/**
 * Validate required fields in request body
 */
export const validateRequired = (req, res, fields) => {
  const missing = fields.filter(field => {
    const value = req.body[field];
    return value === undefined || value === null || value === '';
  });

  if (missing.length > 0) {
    apiError(res, 400, `Missing required fields: ${missing.join(', ')}`);
    return false;
  }
  return true;
};

/**
 * Validate Anthropic API key is configured
 */
export const validateAnthropicKey = (res) => {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    apiError(res, 500, 'Anthropic API key not configured', 'Set ANTHROPIC_API_KEY environment variable');
    return null;
  }
  return apiKey;
};

/**
 * Validate Gong API credentials are configured
 */
export const validateGongCredentials = (res) => {
  const accessKey = process.env.GONG_ACCESS_KEY;
  const secretKey = process.env.GONG_SECRET_KEY;

  if (!accessKey || !secretKey) {
    apiError(res, 500, 'Gong API credentials not configured', 'Set GONG_ACCESS_KEY and GONG_SECRET_KEY environment variables');
    return null;
  }

  return { accessKey, secretKey };
};

/**
 * Call Anthropic API with standard error handling
 */
export const callAnthropic = async (apiKey, options) => {
  const {
    model = 'claude-sonnet-4-20250514',
    maxTokens = 4000,
    system,
    messages,
  } = options;

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      temperature: 0,
      system,
      messages,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const errorMessage = errorData.error?.message || `Anthropic API error: ${response.status}`;
    throw new Error(errorMessage);
  }

  const data = await response.json();
  return data.content?.[0]?.text || '';
};

/**
 * Parse JSON from Claude response (handles markdown code blocks)
 */
export const parseClaudeJson = (rawText, fallbackResponse = null) => {
  try {
    let jsonText = rawText;

    // Extract JSON from markdown code blocks if present
    if (rawText.includes('```json')) {
      jsonText = rawText.split('```json')[1].split('```')[0].trim();
    } else if (rawText.includes('```')) {
      jsonText = rawText.split('```')[1].split('```')[0].trim();
    }

    return JSON.parse(jsonText);
  } catch (parseError) {
    // Return fallback or wrap raw text
    if (fallbackResponse !== null) {
      return fallbackResponse;
    }
    return { rawText, parseError: parseError.message };
  }
};

/**
 * Wrap async handler with try-catch for consistent error handling
 */
export const withErrorHandling = (handler) => {
  return async (req, res) => {
    try {
      await handler(req, res);
    } catch (error) {
      console.error(`API Error [${req.url}]:`, error);
      apiError(res, 500, error.message || 'Internal server error');
    }
  };
};

/**
 * Create Gong API headers
 */
export const createGongHeaders = (accessKey, secretKey) => {
  const auth = Buffer.from(`${accessKey}:${secretKey}`).toString('base64');
  return {
    'Authorization': `Basic ${auth}`,
    'Content-Type': 'application/json',
  };
};

/**
 * Validate and sanitize string input
 */
export const sanitizeString = (value, maxLength = 10000) => {
  if (typeof value !== 'string') return '';
  return value.trim().slice(0, maxLength);
};

/**
 * Log API request (development only)
 */
export const logRequest = (req, label = '') => {
  if (process.env.NODE_ENV === 'development') {
    console.log(`[API ${label}] ${req.method} ${req.url}`);
  }
};
