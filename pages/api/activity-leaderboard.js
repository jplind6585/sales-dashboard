// GET /api/activity-leaderboard — returns Gong call activity + uploaded Orem data per rep
// POST /api/activity-leaderboard — uploads Orem CSV data (admin only)
// Orem CSV format: columns include rep name, total calls, connected calls, date

import { createServerSupabaseClient, getSupabase } from '../../lib/supabase';
import { apiError, apiSuccess, logRequest } from '../../lib/apiUtils';

export default async function handler(req, res) {
  logRequest(req, 'activity-leaderboard');

  const auth = createServerSupabaseClient(req, res);
  const { data: { user } } = await auth.auth.getUser();
  if (!user) return apiError(res, 401, 'Unauthorized');

  const db = getSupabase();

  if (req.method === 'GET') {
    const { days = '30' } = req.query;
    const lookback = new Date(Date.now() - parseInt(days, 10) * 86400000).toISOString();

    // Gong calls per rep from gong_call_analyses
    const { data: calls } = await db
      .from('gong_call_analyses')
      .select('rep_email, rep_name, call_date, duration_seconds, analysis')
      .gte('call_date', lookback)
      .not('ignored', 'is', true)
      .not('analyzed_at', 'is', null);

    // Profiles
    const { data: profiles } = await db
      .from('profiles')
      .select('id, full_name, email, rep_type')
      .not('full_name', 'is', null);

    // Orem upload data from DB
    const { data: oremRows } = await db
      .from('orem_activity_uploads')
      .select('*')
      .gte('week_of', new Date(Date.now() - parseInt(days, 10) * 86400000).toISOString().split('T')[0])
      .order('week_of', { ascending: false });

    // Build rep activity map from Gong
    const gongByRep = {};
    for (const call of (calls || [])) {
      const email = call.rep_email?.toLowerCase();
      if (!email) continue;
      if (!gongByRep[email]) gongByRep[email] = { calls: 0, durationSecs: 0, withNextStep: 0, discoveryScores: [], repName: call.rep_name || null };
      gongByRep[email].calls++;
      gongByRep[email].durationSecs += call.duration_seconds || 0;
      if (call.analysis?.next_steps_mentioned?.length > 0) gongByRep[email].withNextStep++;
      if (call.analysis?.discovery_score != null) gongByRep[email].discoveryScores.push(call.analysis.discovery_score);
    }

    // Aggregate Orem data per rep name
    const oremByRep = {};
    for (const row of (oremRows || [])) {
      const name = (row.rep_name || '').toLowerCase();
      if (!oremByRep[name]) oremByRep[name] = { totalCalls: 0, connected: 0, uploads: [] };
      oremByRep[name].totalCalls += row.total_calls || 0;
      oremByRep[name].connected += row.connected_calls || 0;
      oremByRep[name].uploads.push({ weekOf: row.week_of, totalCalls: row.total_calls, connected: row.connected_calls });
    }

    // Build profile lookup (email → profile) for enrichment
    const profileByEmail = {};
    for (const p of (profiles || [])) {
      if (p.email) profileByEmail[p.email.toLowerCase()] = p;
    }

    // Build unified rep leaderboard — start from Gong data so all reps appear
    // even if they haven't logged into the dashboard and created a profile yet
    const repMap = {};
    for (const [email, gong] of Object.entries(gongByRep)) {
      const profile = profileByEmail[email];
      const displayName = profile?.full_name || gong.repName || email;
      const nameLower = displayName.toLowerCase();
      const orem = oremByRep[nameLower] || oremByRep[nameLower.split(' ')[0]] || { totalCalls: 0, connected: 0 };

      const avgDiscovery = gong.discoveryScores.length
        ? Math.round((gong.discoveryScores.reduce((a, b) => a + b, 0) / gong.discoveryScores.length) * 10) / 10
        : null;

      repMap[email] = {
        name: displayName,
        email,
        repType: profile?.rep_type || null,
        gongCalls: gong.calls,
        avgCallMinutes: gong.calls > 0 ? Math.round((gong.durationSecs / gong.calls) / 60) : 0,
        nextStepRate: gong.calls > 0 ? Math.round((gong.withNextStep / gong.calls) * 100) : 0,
        avgDiscoveryScore: avgDiscovery,
        oremTotalCalls: orem.totalCalls,
        oremConnected: orem.connected,
        oremConnectRate: orem.totalCalls > 0 ? Math.round((orem.connected / orem.totalCalls) * 100) : null,
        score: gong.calls * 10 + orem.totalCalls,
      };
    }

    // Also include reps who have Orem data but no Gong calls in this period
    for (const [nameLower, orem] of Object.entries(oremByRep)) {
      const emailMatch = Object.keys(repMap).find(e => {
        const n = (repMap[e].name || '').toLowerCase();
        return n === nameLower || n.startsWith(nameLower.split(' ')[0]);
      });
      if (!emailMatch) {
        const profile = Object.values(profileByEmail).find(p => (p.full_name || '').toLowerCase().includes(nameLower.split(' ')[0]));
        const key = `orem:${nameLower}`;
        repMap[key] = {
          name: profile?.full_name || nameLower,
          email: profile?.email || null,
          repType: profile?.rep_type || null,
          gongCalls: 0, avgCallMinutes: 0, nextStepRate: 0, avgDiscoveryScore: null,
          oremTotalCalls: orem.totalCalls, oremConnected: orem.connected,
          oremConnectRate: orem.totalCalls > 0 ? Math.round((orem.connected / orem.totalCalls) * 100) : null,
          score: orem.totalCalls,
        };
      }
    }

    const leaderboard = Object.values(repMap)
      .filter(r => r.gongCalls > 0 || r.oremTotalCalls > 0)
      .sort((a, b) => b.score - a.score);

    return apiSuccess(res, {
      leaderboard,
      period: `${days} days`,
      hasOremData: (oremRows || []).length > 0,
      latestOremUpload: (oremRows || [])[0]?.created_at || null,
    });
  }

  if (req.method === 'POST') {
    // Admin-only: upload Orem CSV rows
    // Body: { rows: [{ rep_name, total_calls, connected_calls, week_of }] }
    const { rows, weekOf } = req.body;
    if (!rows?.length) return apiError(res, 400, 'rows required');

    const inserts = rows.map(r => ({
      rep_name: r.rep_name || r.name || r.Rep || r.Name,
      total_calls: parseInt(r.total_calls || r['Total Calls'] || 0, 10),
      connected_calls: parseInt(r.connected_calls || r['Connected'] || r['Connects'] || 0, 10),
      week_of: weekOf || r.week_of || new Date().toISOString().split('T')[0],
      uploaded_by: user.id,
      created_at: new Date().toISOString(),
    })).filter(r => r.rep_name);

    const { data: inserted, error } = await db
      .from('orem_activity_uploads')
      .insert(inserts)
      .select();

    if (error) return apiError(res, 500, error.message);
    return apiSuccess(res, { inserted: inserted?.length || 0 });
  }

  return apiError(res, 405, 'Method not allowed');
}
