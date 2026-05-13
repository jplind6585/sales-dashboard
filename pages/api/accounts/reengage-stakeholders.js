import { getSupabase } from '../../../lib/supabase'
import { apiError, apiSuccess } from '../../../lib/apiUtils'

function inferRole(stakeholder, allCallAnalyses) {
  const title = (stakeholder.title || '').toLowerCase()
  const name = (stakeholder.name || '').toLowerCase()

  const execTitles = ['svp', 'evp', 'ceo', 'cfo', 'coo', 'cto', 'president', 'managing director', 'managing partner', 'principal', 'owner', 'partner', 'chief']
  if (execTitles.some(t => title.includes(t))) {
    return { role: 'exec_sponsor', confidence: 'high', rationale: `Title "${stakeholder.title}" indicates executive authority` }
  }

  if (title.includes('vice president') || title.startsWith('vp ') || title.includes(' vp ') || title.endsWith(' vp')) {
    return { role: 'exec_sponsor', confidence: 'medium', rationale: `VP-level title suggests executive sponsor` }
  }

  if (stakeholder.champion) {
    return { role: 'champion', confidence: 'high', rationale: 'Flagged as champion in stakeholder record' }
  }

  const champSignals = ['champion', 'navigate', 'advocate', 'internal', 'sponsor', 'helped us', 'set up', 'introduced', 'facilitated']
  const firstName = name.split(' ')[0]
  for (const analysis of allCallAnalyses) {
    const blob = JSON.stringify(analysis.analysis || '').toLowerCase()
    const matchCount = champSignals.filter(s => blob.includes(s)).length
    if (matchCount >= 2 && blob.includes(firstName)) {
      return { role: 'champion', confidence: 'medium', rationale: 'Behavioral signals in call analyses suggest champion behavior' }
    }
  }

  for (const analysis of allCallAnalyses) {
    const objections = analysis.analysis?.objections || []
    const redFlags = analysis.analysis?.red_flags || []
    const allText = JSON.stringify([...objections, ...redFlags]).toLowerCase()
    if (allText.includes(firstName) && redFlags.length >= 2) {
      return { role: 'detractor', confidence: 'low', rationale: 'Red flags in call analyses may indicate resistance' }
    }
  }

  const positiveCount = allCallAnalyses.filter(a => a.analysis?.sentiment === 'positive').length
  if (allCallAnalyses.length > 0 && positiveCount > allCallAnalyses.length / 2) {
    return { role: 'promoter', confidence: 'low', rationale: 'Account has mostly positive call sentiment' }
  }

  return { role: 'unknown', confidence: 'low', rationale: 'Insufficient data — confirm role before generating plan' }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return apiError(res, 405, 'Method not allowed')
  }

  const { accountId } = req.body
  if (!accountId) {
    return apiError(res, 400, 'Missing required field: accountId')
  }

  const db = getSupabase()

  const { data: account, error: accountError } = await db
    .from('accounts')
    .select('id, name, vertical, ownership_type, stage')
    .eq('id', accountId)
    .single()

  if (accountError || !account) {
    return apiError(res, 404, 'Account not found')
  }

  const { data: stakeholders, error: stakeholdersError } = await db
    .from('stakeholders')
    .select('id, name, title, email, role, champion')
    .eq('account_id', accountId)

  if (stakeholdersError) {
    return apiError(res, 500, 'Failed to fetch stakeholders', stakeholdersError.message)
  }

  const { data: callAnalyses, error: callsError } = await db
    .from('gong_call_analyses')
    .select('analysis, call_date, title')
    .eq('account_id', accountId)
    .not('analysis', 'is', null)
    .order('call_date', { ascending: false })
    .limit(5)

  if (callsError) {
    return apiError(res, 500, 'Failed to fetch call analyses', callsError.message)
  }

  const calls = callAnalyses || []
  const stks = stakeholders || []

  const enrichedStakeholders = stks.map(s => {
    const suggested = inferRole(s, calls)
    return {
      id: s.id,
      name: s.name,
      title: s.title,
      email: s.email,
      currentRole: s.role,
      suggestedRole: suggested.role,
      confidence: suggested.confidence,
      rationale: suggested.rationale,
    }
  })

  let gongSummary = {
    callCount: calls.length,
    lastCallDate: null,
    daysSinceLastCall: null,
    topPainPoints: [],
    topObjections: [],
    lastCallSummary: null,
    championName: null,
  }

  if (calls.length > 0) {
    const lastCall = calls[0]
    gongSummary.lastCallDate = lastCall.call_date
    gongSummary.lastCallSummary = lastCall.analysis?.summary || null

    if (lastCall.call_date) {
      const lastDate = new Date(lastCall.call_date)
      const now = new Date()
      gongSummary.daysSinceLastCall = Math.floor((now - lastDate) / (1000 * 60 * 60 * 24))
    }

    const allPainPoints = []
    for (const c of calls) {
      const pts = c.analysis?.pain_points_identified || []
      allPainPoints.push(...pts)
    }
    const painCounts = {}
    for (const p of allPainPoints) {
      const key = (p || '').trim().toLowerCase()
      if (key) painCounts[key] = (painCounts[key] || 0) + 1
    }
    const uniquePains = [...new Set(allPainPoints.map(p => (p || '').trim()).filter(Boolean))]
    gongSummary.topPainPoints = uniquePains.slice(0, 5)

    const objectionTexts = []
    for (const c of calls) {
      const objs = c.analysis?.objections || []
      for (const o of objs) {
        const text = typeof o === 'string' ? o : (o.text || '')
        if (text.trim()) objectionTexts.push(text.trim())
      }
    }
    const objCounts = {}
    for (const o of objectionTexts) {
      objCounts[o] = (objCounts[o] || 0) + 1
    }
    gongSummary.topObjections = Object.entries(objCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([text]) => text)
  }

  const champion = stks.find(s => s.champion)
  if (champion) {
    gongSummary.championName = champion.name
  }

  return apiSuccess(res, {
    accountName: account.name,
    stakeholders: enrichedStakeholders,
    gongSummary,
  })
}
