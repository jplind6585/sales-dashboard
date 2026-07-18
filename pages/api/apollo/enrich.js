// POST /api/apollo/enrich — reveal a single person's email/title/linkedin (costs 1 Apollo credit;
// fired only when the SDR explicitly asks). Match by name+company, email, or linkedin_url.
import { createServerSupabaseClient } from '../../../lib/supabase';
import { apiError, apiSuccess, validateMethod, logRequest } from '../../../lib/apiUtils';

export default async function handler(req, res) {
  logRequest(req, 'apollo/enrich');
  if (!validateMethod(req, res, 'POST')) return;
  const auth = createServerSupabaseClient(req, res);
  const { data: { user } } = await auth.auth.getUser();
  if (!user) return apiError(res, 401, 'Unauthorized');
  const key = process.env.APOLLO_API_KEY;
  if (!key) return apiError(res, 503, 'APOLLO_API_KEY not configured');

  const b = req.body || {};
  if (!b.firstName && !b.email && !b.linkedinUrl) return apiError(res, 400, 'Provide a name, email, or linkedin_url');
  const body = {
    first_name: b.firstName, last_name: b.lastName, organization_name: b.organizationName,
    domain: b.domain, email: b.email, linkedin_url: b.linkedinUrl, reveal_personal_emails: true,
  };
  const r = await fetch('https://api.apollo.io/api/v1/people/match', {
    method: 'POST', headers: { 'X-Api-Key': key, 'Content-Type': 'application/json', 'Cache-Control': 'no-cache' }, body: JSON.stringify(body),
  });
  if (!r.ok) return apiError(res, 502, `Apollo enrich failed (HTTP ${r.status})`);
  const d = await r.json().catch(() => ({}));
  const p = d.person;
  if (!p) return apiSuccess(res, { matched: false }); // no-match returns 200 with person:null
  return apiSuccess(res, {
    matched: true,
    person: { name: [p.first_name, p.last_name].filter(Boolean).join(' '), title: p.title, email: p.email || null, linkedin: p.linkedin_url || null, org: p.organization?.name || null, phone: (p.phone_numbers || [])[0]?.sanitized_number || null },
  });
}
