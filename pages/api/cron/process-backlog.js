// POST /api/cron/process-backlog
// Processes calls in gong_call_analyses that have metadata but no analysis yet.
// Runs every 30 min via GitHub Actions until the backlog is clear.
// Protected by CRON_SECRET.

import { getSupabase } from '../../../lib/supabase'

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') return res.status(405).end()
  const secret = process.env.CRON_SECRET
  if (secret && req.headers['authorization'] !== `Bearer ${secret}`) return res.status(401).end()

  const db = getSupabase()
  const baseUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : 'http://localhost:3000'

  // Grab next batch of unanalyzed calls that have Gong metadata
  const { data: backlog } = await db
    .from('gong_call_analyses')
    .select('gong_call_id, title, call_date, call_type, rep_name, rep_email, duration_seconds, gong_url')
    .is('analyzed_at', null)
    .eq('ignored', false)
    .not('gong_call_id', 'is', null)
    .order('call_date', { ascending: false })
    .limit(10)

  if (!backlog?.length) {
    const { count } = await db
      .from('gong_call_analyses')
      .select('id', { count: 'exact', head: true })
      .is('analyzed_at', null)
      .eq('ignored', false)
    return res.status(200).json({ processed: 0, remaining: count || 0, message: 'Nothing to process' })
  }

  let processed = 0
  let failed = 0

  for (const call of backlog) {
    try {
      const r = await fetch(`${baseUrl}/api/gong/intel-analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${secret}` },
        body: JSON.stringify({
          callId: call.gong_call_id,
          title: call.title,
          date: call.call_date,
          callType: call.call_type,
          repName: call.rep_name,
          repEmail: call.rep_email,
          durationSeconds: call.duration_seconds,
          gongUrl: call.gong_url,
        }),
      })
      const d = await r.json().catch(() => ({}))
      if (d.analysis) {
        processed++
        console.log(`[process-backlog] analyzed: ${call.title}`)
      } else {
        failed++
        console.error(`[process-backlog] failed: ${call.title}`, d.error)
      }
    } catch (e) {
      failed++
      console.error(`[process-backlog] error on ${call.gong_call_id}:`, e.message)
    }
    await new Promise(r => setTimeout(r, 400))
  }

  const { count: remaining } = await db
    .from('gong_call_analyses')
    .select('id', { count: 'exact', head: true })
    .is('analyzed_at', null)
    .eq('ignored', false)

  console.log(`[process-backlog] done: ${processed} analyzed, ${failed} failed, ${remaining || 0} remaining`)
  return res.status(200).json({ processed, failed, remaining: remaining || 0 })
}
