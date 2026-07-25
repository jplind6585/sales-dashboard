import { createServerSupabaseClient, getSupabase } from '../../../lib/supabase';

const AUTO_TASK_REP_USER_IDS = {
  'james@withbanner.com': '8c969178-4d4e-494f-a8d7-752276fb683c',
};

const PROSPECT_STEP_PREFIXES = [
  'prospect to ', 'customer to ', 'client to ', 'they will ', 'they to ',
  'implied:', 'implicit:', 'no explicit', 'conditional on', 'if ',
];

function isProspectStep(step) {
  const lower = step.toLowerCase().trim();
  if (PROSPECT_STEP_PREFIXES.some(p => lower.startsWith(p))) return true;
  if (/^[a-z]+ (to |will )/.test(lower) && !lower.startsWith('rep ')) return true;
  return false;
}

function isRepOwnedStep(step) {
  if (!step || step.trim().length < 10) return false;
  return !isProspectStep(step);
}

async function createTasksForCall({ callId, title, date, repEmail, analysis, db }) {
  const userId = AUTO_TASK_REP_USER_IDS[repEmail?.toLowerCase()];
  if (!userId) return 0;

  const repSteps = (analysis.next_steps_mentioned || []).filter(isRepOwnedStep);
  const commitments = (analysis.commitments || []).filter(c => c && c.length > 5);

  if (!repSteps.length && !commitments.length) return 0;

  const callDateStr = date
    ? new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    : 'unknown date';

  const nextStepRows = repSteps.slice(0, 4).map(step => ({
    owner_id:           userId,
    created_by:         userId,
    type:               'triggered',
    priority:           2,
    title:              step.length > 120 ? step.slice(0, 117) + '...' : step,
    description:        `Auto-extracted from Gong call: "${title || 'Untitled'}" on ${callDateStr} (call ID: ${callId})`,
    status:             'open',
    source:             'gong',
    source_type:        'gong_next_step',
    rationale:          analysis.summary ? analysis.summary.slice(0, 200) : null,
    visible_to_manager: true,
  }));

  const commitmentRows = commitments.slice(0, 2).map(c => ({
    owner_id:           userId,
    created_by:         userId,
    type:               'triggered',
    priority:           1,
    title:              c.length > 120 ? c.slice(0, 117) + '...' : c,
    description:        `Rep commitment from Gong call: "${title || 'Untitled'}" on ${callDateStr} (call ID: ${callId})`,
    status:             'open',
    source:             'gong',
    source_type:        'gong_commitment',
    rationale:          `Explicit promise made on the call — highest urgency to follow through.`,
    visible_to_manager: true,
  }));

  const rows = [...commitmentRows, ...nextStepRows];
  if (!rows.length) return 0;

  const { error } = await db.from('tasks').insert(rows);
  if (error) {
    console.error(`[backfill-tasks] insert failed for call ${callId}:`, error.message);
    return 0;
  }

  return rows.length;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const isCron = process.env.CRON_SECRET && req.headers['authorization'] === `Bearer ${process.env.CRON_SECRET}`;

  if (!isCron) {
    const auth = createServerSupabaseClient(req, res);
    const { data: { user } } = await auth.auth.getUser();
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    const db = getSupabase();
    const { data: profile } = await db.from('profiles').select('role').eq('id', user.id).single();
    if (!['manager','admin'].includes(profile?.role)) return res.status(403).json({ error: 'Manager role required' });
  }

  // DISABLED (Phase 1). This endpoint created ~1,624 account-less, raw-titled, unfiltered tasks
  // (hardcoded to James, no freshness gate, never set account_id). The live path (intel-analyze
  // autoCreateTasksFromAnalysis) creates account-linked, noise-filtered tasks properly. Kept as a
  // no-op so the drain-backlog GitHub Action doesn't 404.
  return res.status(200).json({ success: true, disabled: true, data: { processed: 0, tasksCreated: 0, skipped: 0 } });
}
