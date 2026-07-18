// POST /api/gmail/create-draft { token, to, subject, body, threadId? } — creates a Gmail DRAFT in
// the signed-in user's mailbox (PLATFORM_REVIEW §2.7). `token` is the user's Google OAuth access
// token (from the client session's provider_token). Requires the gmail.compose scope; if it's not
// granted Google returns 403 and we surface that so the rep can re-auth or fall back to compose-URL.
import { createServerSupabaseClient } from '../../../lib/supabase';
import { apiError, apiSuccess, validateMethod, logRequest } from '../../../lib/apiUtils';

function toBase64Url(str) {
  return Buffer.from(str).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export default async function handler(req, res) {
  logRequest(req, 'gmail/create-draft');
  if (!validateMethod(req, res, 'POST')) return;
  const auth = createServerSupabaseClient(req, res);
  const { data: { user } } = await auth.auth.getUser();
  if (!user) return apiError(res, 401, 'Unauthorized');

  const { token, to = '', subject = '', body = '', threadId } = req.body || {};
  if (!token) return apiError(res, 428, 'No Google token — re-authenticate, or use Open in Gmail');
  if (!body) return apiError(res, 400, 'body required');

  const mime = [
    ...(to ? [`To: ${to}`] : []),
    `Subject: ${subject}`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset="UTF-8"',
    '',
    body,
  ].join('\r\n');

  const r = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/drafts', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: { raw: toBase64Url(mime), ...(threadId ? { threadId } : {}) } }),
  });
  if (r.status === 401 || r.status === 403) return apiError(res, 403, 'Gmail compose permission not granted — add the gmail.compose scope (re-auth once), then try again');
  if (!r.ok) return apiError(res, 502, `Gmail draft failed (HTTP ${r.status})`);
  const d = await r.json().catch(() => ({}));
  return apiSuccess(res, { draftId: d.id || null, url: 'https://mail.google.com/mail/u/0/#drafts' });
}
