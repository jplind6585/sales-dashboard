// POST /api/tasks/bulk-from-calls
// Creates tasks from rep-owned next steps in the last 28 days of Gong calls.
// Skips steps that already have a matching task (title overlap check).

import { apiError, apiSuccess, logRequest } from '../../../lib/apiUtils';
import { createServerSupabaseClient, getSupabase } from '../../../lib/supabase';

export default async function handler(req, res) {
  logRequest(req, 'tasks/bulk-from-calls');
  if (req.method !== 'POST') return apiError(res, 405, 'Method not allowed');

  const authClient = createServerSupabaseClient(req, res);
  const { data: { user } } = await authClient.auth.getUser();
  if (!user) return apiError(res, 401, 'Unauthorized');

  const db = getSupabase();
  const days = parseInt(req.body?.days || '28');
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  // Fetch recent calls for this rep (match by email)
  const { data: profile } = await db.from('profiles').select('full_name, email').eq('id', user.id).single();
  const repName = profile?.full_name || '';
  const repEmail = profile?.email || user.email;

  const { data: calls, error: callErr } = await db
    .from('gong_call_analyses')
    .select('gong_call_id, title, call_date, analysis, account_id')
    .gte('call_date', since)
    .or(`rep_email.eq.${repEmail},rep_name.ilike.%${repName.split(' ')[0] || 'James'}%`)
    .not('analyzed_at', 'is', null)
    .order('call_date', { ascending: false });

  if (callErr) return apiError(res, 500, callErr.message);

  // Extract rep-owned next steps
  const candidates = [];
  for (const call of (calls || [])) {
    const a = call.analysis || {};
    const steps = Array.isArray(a.next_steps_mentioned) ? a.next_steps_mentioned : [];
    for (const step of steps) {
      if (typeof step !== 'string') continue;
      if (!/\brep\b/i.test(step)) continue;
      const title = step.replace(/^rep (to |will |should )?/i, '').replace(/^to /, '').trim();
      if (title.length < 5 || title.length > 200) continue;
      candidates.push({
        title: title.charAt(0).toUpperCase() + title.slice(1),
        callTitle: call.title,
        callDate: call.call_date,
        gongCallId: call.gong_call_id,
        accountId: call.account_id || null,
      });
    }
  }

  if (!candidates.length) {
    return apiSuccess(res, { data: { created: 0, skipped: 0, message: 'No rep action items found in recent calls' } });
  }

  // Fetch existing tasks to de-duplicate
  const { data: existingTasks } = await db
    .from('tasks')
    .select('title')
    .eq('owner_id', user.id)
    .in('status', ['open', 'in_progress'])
    .gte('created_at', since);

  const existingTitles = new Set((existingTasks || []).map(t => t.title.toLowerCase().trim()));

  // Create new tasks
  let created = 0;
  let skipped = 0;
  const now = new Date().toISOString();

  for (const c of candidates) {
    const titleLower = c.title.toLowerCase();
    // Skip if very similar to an existing task
    const isDuplicate = [...existingTitles].some(existing => {
      const words = titleLower.split(' ').filter(w => w.length > 3);
      const matches = words.filter(w => existing.includes(w));
      return matches.length >= 2;
    });

    if (isDuplicate) { skipped++; continue; }

    const dueDate = new Date(new Date(c.callDate).getTime() + 3 * 86400000).toISOString().split('T')[0];

    const { error } = await db.from('tasks').insert({
      title: c.title,
      description: `From call: ${c.callTitle} (${new Date(c.callDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })})`,
      status: 'open',
      priority: 2,
      type: 'triggered',
      owner_id: user.id,
      account_id: c.accountId,
      source: 'gong',
      source_id: c.gongCallId,
      due_date: dueDate,
      created_at: now,
    });

    if (!error) {
      created++;
      existingTitles.add(titleLower);
    }
  }

  return apiSuccess(res, { data: { created, skipped, total: candidates.length } });
}
