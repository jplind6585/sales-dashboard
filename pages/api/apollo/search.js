// POST /api/apollo/search — search Apollo for people by title/company/keywords (free, no contact
// info revealed). Human-in-the-loop prospecting: the SDR reviews results, then enriches the ones
// worth pursuing. Needs a MASTER Apollo key (regular keys 403 on search). Auth: X-Api-Key header.
import { createServerSupabaseClient } from '../../../lib/supabase';
import { apiError, apiSuccess, validateMethod, logRequest } from '../../../lib/apiUtils';

export default async function handler(req, res) {
  logRequest(req, 'apollo/search');
  if (!validateMethod(req, res, 'POST')) return;
  const auth = createServerSupabaseClient(req, res);
  const { data: { user } } = await auth.auth.getUser();
  if (!user) return apiError(res, 401, 'Unauthorized');
  const key = process.env.APOLLO_API_KEY;
  if (!key) return apiError(res, 503, 'APOLLO_API_KEY not configured — add it in Vercel (a MASTER key is required for search)');

  const b = req.body || {};
  const body = {
    person_titles: b.titles?.length ? b.titles : undefined,
    include_similar_titles: true,
    person_seniorities: b.seniorities?.length ? b.seniorities : undefined,
    person_locations: b.locations?.length ? b.locations : undefined,
    q_organization_domains_list: b.domains?.length ? b.domains : undefined,
    organization_num_employees_ranges: b.employeeRanges?.length ? b.employeeRanges : undefined,
    q_keywords: b.keywords || undefined,
    page: b.page || 1,
    per_page: 25,
  };
  const r = await fetch('https://api.apollo.io/api/v1/mixed_people/api_search', {
    method: 'POST', headers: { 'X-Api-Key': key, 'Content-Type': 'application/json', 'Cache-Control': 'no-cache' }, body: JSON.stringify(body),
  });
  if (r.status === 403) return apiError(res, 403, 'Apollo search needs a MASTER API key (regular keys 403 on search)');
  if (!r.ok) return apiError(res, 502, `Apollo search failed (HTTP ${r.status})`);
  const d = await r.json().catch(() => ({}));
  const people = (d.people || []).map((p) => ({
    id: p.id, name: [p.first_name, p.last_name].filter(Boolean).join(' '), firstName: p.first_name, lastName: p.last_name,
    title: p.title, linkedin: p.linkedin_url, org: p.organization?.name || null,
    domain: p.organization?.primary_domain || p.organization?.website_url || null, emailStatus: p.email_status || null,
  }));
  return apiSuccess(res, { people, pagination: d.pagination || null });
}
