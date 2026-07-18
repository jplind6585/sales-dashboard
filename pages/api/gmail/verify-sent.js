// POST /api/gmail/verify-sent { token, to, since? } — checks the user's Sent folder for an email to
// `to` (optionally after `since` = YYYY/MM/DD). Powers commitment/follow-through verification
// (PLATFORM_REVIEW §2.6) using the existing gmail.readonly scope.
import { createServerSupabaseClient } from '../../../lib/supabase';
import { apiError, apiSuccess, validateMethod, logRequest } from '../../../lib/apiUtils';

export default async function handler(req, res) {
  logRequest(req, 'gmail/verify-sent');
  if (!validateMethod(req, res, 'POST')) return;
  const auth = createServerSupabaseClient(req, res);
  const { data: { user } } = await auth.auth.getUser();
  if (!user) return apiError(res, 401, 'Unauthorized');

  const { token, to, since } = req.body || {};
  if (!token) return apiError(res, 428, 'No Google token');
  if (!to) return apiError(res, 400, 'to required');

  const q = `in:sent to:${to}${since ? ` after:${since}` : ''}`;
  const r = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(q)}&maxResults=5`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!r.ok) return apiError(res, 502, `Gmail search failed (HTTP ${r.status})`);
  const d = await r.json().catch(() => ({}));
  const count = (d.messages || []).length;
  return apiSuccess(res, { sent: count > 0, count });
}
