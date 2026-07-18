// POST /api/apollo/import { company, vertical?, contactName?, title?, email?, linkedin? } — the
// SDR-reviewed "add to pipeline" step. Creates a Supabase account (stage qualifying) + the contact
// as a stakeholder. No outreach is sent — this only stages the prospect for the rep to work.
import { createServerSupabaseClient, getSupabase } from '../../../lib/supabase';
import { apiError, apiSuccess, validateMethod, logRequest } from '../../../lib/apiUtils';

export default async function handler(req, res) {
  logRequest(req, 'apollo/import');
  if (!validateMethod(req, res, 'POST')) return;
  const auth = createServerSupabaseClient(req, res);
  const { data: { user } } = await auth.auth.getUser();
  if (!user) return apiError(res, 401, 'Unauthorized');
  const b = req.body || {};
  if (!b.company) return apiError(res, 400, 'company required');

  const db = getSupabase();
  // Avoid dupes: reuse an existing account by name if present.
  const { data: existing } = await db.from('accounts').select('id').ilike('name', b.company).maybeSingle();
  let accountId = existing?.id;
  if (!accountId) {
    const { data: acct, error } = await db.from('accounts').insert({ name: b.company, stage: 'qualifying', vertical: b.vertical || null, user_id: user.id }).select('id').single();
    if (error) return apiError(res, 500, error.message);
    accountId = acct.id;
  }
  if (b.contactName) {
    const { data: exSh } = await db.from('stakeholders').select('id').eq('account_id', accountId).ilike('name', b.contactName).maybeSingle();
    if (!exSh) await db.from('stakeholders').insert({ account_id: accountId, name: b.contactName, title: b.title || null, email: b.email || null, role: 'Unknown' }).then(() => {}, () => {});
  }
  return apiSuccess(res, { accountId, reused: !!existing });
}
