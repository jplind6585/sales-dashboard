import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import {
  ArrowLeft,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  Users,
  Building2,
  Clock,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  RefreshCw,
  DollarSign,
  Zap,
  BookOpen,
} from 'lucide-react'
import UserMenu from '../../components/auth/UserMenu'
import { STAGES } from '../../lib/constants'

function fmt$(n) {
  if (!n) return '—'
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`
  return `$${n.toLocaleString()}`
}

const STAGE_COLORS = {
  qualifying: 'bg-gray-100 text-gray-700 border-gray-300',
  active_pursuit: 'bg-blue-100 text-blue-700 border-blue-300',
  solution_validation: 'bg-purple-100 text-purple-700 border-purple-300',
  proposal: 'bg-orange-100 text-orange-700 border-orange-300',
  legal: 'bg-yellow-100 text-yellow-800 border-yellow-300',
  closed_won: 'bg-green-100 text-green-700 border-green-300',
  closed_lost: 'bg-red-100 text-red-700 border-red-300',
  intro_scheduled: 'bg-teal-100 text-teal-700 border-teal-300',
  demo: 'bg-indigo-100 text-indigo-700 border-indigo-300',
}

const STAGE_BAR_COLORS = {
  qualifying: 'bg-gray-400',
  active_pursuit: 'bg-blue-500',
  intro_scheduled: 'bg-teal-500',
  demo: 'bg-indigo-500',
  solution_validation: 'bg-purple-500',
  proposal: 'bg-orange-500',
  legal: 'bg-yellow-500',
  closed_won: 'bg-green-500',
  closed_lost: 'bg-red-400',
}

function StageLabel({ stage }) {
  const s = STAGES.find(s => s.id === stage)
  const label = s?.label || stage?.replace(/_/g, ' ') || '—'
  const colorClass = STAGE_COLORS[stage] || 'bg-gray-100 text-gray-600 border-gray-200'
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium border ${colorClass}`}>
      {label}
    </span>
  )
}

function HealthDot({ value, warn = 1, danger = 3 }) {
  if (value === 0) return <span className="text-green-500 font-bold">✓</span>
  if (value >= danger) return <span className="text-red-600 font-semibold">{value}</span>
  if (value >= warn) return <span className="text-yellow-600 font-semibold">{value}</span>
  return <span className="text-gray-700">{value}</span>
}

export default function PipelineOverview() {
  const router = useRouter()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [expandedReps, setExpandedReps] = useState({})
  const [syncing, setSyncing] = useState(false)
  const [syncResult, setSyncResult] = useState(null)
  const [briefLoading, setBriefLoading] = useState(false)
  const [brief, setBrief] = useState(null)

  function loadData() {
    fetch('/api/pipeline-overview')
      .then(r => r.json())
      .then(d => {
        if (d.error) throw new Error(d.error)
        setData(d)
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }

  useEffect(() => { loadData() }, [])

  async function generateBrief() {
    setBriefLoading(true)
    setBrief(null)
    try {
      const r = await fetch('/api/manager/weekly-brief')
      const d = await r.json()
      if (d.success) setBrief(d.brief)
      else alert(`Brief failed: ${d.error}`)
    } catch (e) { alert(e.message) }
    finally { setBriefLoading(false) }
  }

  async function syncHubSpot() {
    setSyncing(true); setSyncResult(null)
    try {
      const r = await fetch('/api/hubspot/sync-deals', { method: 'POST' })
      const d = await r.json()
      if (d.success) {
        setSyncResult(`Synced: ${d.matched} of ${d.total} accounts matched to HubSpot deals`)
        loadData()
      } else {
        setSyncResult(`Sync failed: ${d.error}`)
      }
    } catch (e) { setSyncResult(`Error: ${e.message}`) }
    finally { setSyncing(false) }
  }

  const toggleRep = (repId) => {
    setExpandedReps(prev => ({ ...prev, [repId]: !prev[repId] }))
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mx-auto mb-3" />
          <p className="text-gray-500">Loading pipeline data...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <AlertTriangle className="w-10 h-10 text-red-500 mx-auto mb-3" />
          <p className="text-red-600 font-medium">{error}</p>
          <p className="text-sm text-gray-500 mt-1">You may not have permission to view this page.</p>
        </div>
      </div>
    )
  }

  const { repSummaries = [], stageCounts = {}, totalAccounts, totalOpenTasks, totalOverdue, pipelineConfidence, activeAccounts, totalPipeline, weightedPipeline, accountsWithValue, hubspotSynced } = data || {}

  // Pipeline funnel — ordered by stage
  const orderedStages = [
    'intro_scheduled', 'qualifying', 'active_pursuit', 'demo',
    'solution_validation', 'proposal', 'legal', 'closed_won', 'closed_lost',
  ]
  const funnelStages = orderedStages
    .filter(s => stageCounts[s] > 0)
    .map(s => ({
      id: s,
      label: STAGES.find(st => st.id === s)?.label || s.replace(/_/g, ' '),
      count: stageCounts[s],
    }))
  const maxCount = Math.max(...funnelStages.map(s => s.count), 1)

  // All stale accounts across reps (sorted by days)
  const allStale = repSummaries
    .flatMap(r => r.staleAccounts.map(a => ({ ...a, repName: r.name })))
    .sort((a, b) => (b.daysSinceActivity ?? 9999) - (a.daysSinceActivity ?? 9999))
    .slice(0, 10)

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push('/modules/tasks')}
              className="p-2 text-gray-500 hover:text-gray-800 hover:bg-gray-100 rounded"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <TrendingUp className="w-6 h-6 text-blue-600" />
                Pipeline Overview
              </h1>
              <p className="text-sm text-gray-500">{totalAccounts} accounts · {totalOpenTasks} open tasks · {totalOverdue} overdue</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push('/modules/coaching')}
              className="flex items-center gap-1.5 px-3 py-2 text-sm text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-lg"
            >
              <Users className="w-4 h-4" />Rep Coaching
            </button>
            <button
              onClick={generateBrief}
              disabled={briefLoading}
              className="flex items-center gap-1.5 px-3 py-2 text-sm text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg disabled:opacity-50"
            >
              <Zap className={`w-4 h-4 ${briefLoading ? 'animate-pulse' : ''}`} />
              {briefLoading ? 'Generating…' : 'Weekly Brief'}
            </button>
            <button
              onClick={syncHubSpot}
              disabled={syncing}
              className="flex items-center gap-1.5 px-3 py-2 text-sm text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg disabled:opacity-50"
              title="Pull deal value, stage, and close date from HubSpot"
            >
              <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
              {syncing ? 'Syncing…' : 'Sync HubSpot'}
            </button>
            <UserMenu />
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6 space-y-6">
        {/* Sync result banner */}
        {syncResult && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-2 text-sm text-blue-800 flex items-center justify-between">
            <span>{syncResult}</span>
            <button onClick={() => setSyncResult(null)} className="text-blue-400 hover:text-blue-600 ml-4">✕</button>
          </div>
        )}

        {/* Weekly brief panel */}
        {brief && (
          <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b bg-gray-50">
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-indigo-500" />
                <h2 className="font-semibold text-gray-900">Weekly Pipeline Brief</h2>
                <span className="text-xs text-gray-400 italic ml-1">"{brief.headline}"</span>
              </div>
              <button onClick={() => setBrief(null)} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>
            <div className="p-6 grid grid-cols-2 gap-6">
              {/* Pipeline pulse */}
              {brief.pipeline_pulse?.length > 0 && (
                <div>
                  <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Pipeline Pulse</h3>
                  <ul className="space-y-1">
                    {brief.pipeline_pulse.map((b, i) => <li key={i} className="text-sm text-gray-700 flex items-start gap-1.5"><span className="text-gray-400 shrink-0 mt-1">•</span>{b}</li>)}
                  </ul>
                </div>
              )}
              {/* Your priorities */}
              {brief.your_3_priorities?.length > 0 && (
                <div>
                  <h3 className="text-xs font-semibold text-indigo-600 uppercase tracking-wide mb-2">Your 3 Priorities This Week</h3>
                  <ol className="space-y-1">
                    {brief.your_3_priorities.map((p, i) => <li key={i} className="text-sm text-gray-700 flex items-start gap-1.5"><span className="font-bold text-indigo-400 shrink-0">{i + 1}.</span>{p}</li>)}
                  </ol>
                </div>
              )}
              {/* Watch list */}
              {brief.watch_list?.length > 0 && (
                <div>
                  <h3 className="text-xs font-semibold text-amber-600 uppercase tracking-wide mb-2">Watch List</h3>
                  <div className="space-y-2">
                    {brief.watch_list.map((w, i) => (
                      <div key={i} className="bg-amber-50 rounded-lg p-3">
                        <p className="text-sm font-medium text-gray-800">{w.account} <span className="text-xs text-gray-500 font-normal">({w.owner})</span></p>
                        <p className="text-xs text-gray-600 mt-0.5">{w.reason}</p>
                        <p className="text-xs text-amber-700 mt-1 font-medium">→ {w.suggested_action}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {/* Rep coaching signals */}
              {brief.rep_coaching?.length > 0 && (
                <div>
                  <h3 className="text-xs font-semibold text-indigo-600 uppercase tracking-wide mb-2">Rep Coaching Signals</h3>
                  <div className="space-y-2">
                    {brief.rep_coaching.map((r, i) => (
                      <div key={i} className="bg-indigo-50 rounded-lg p-3">
                        <p className="text-sm font-medium text-gray-800">{r.rep} <span className="text-xs text-gray-400 font-normal">({r.calls_reviewed} calls)</span></p>
                        <p className="text-xs text-gray-600 mt-0.5">{r.observation}</p>
                        <p className="text-xs text-indigo-700 mt-1 italic">1:1: "{r.one_on_one_script}"</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            {brief.wins?.length > 0 && (
              <div className="px-6 pb-5">
                <h3 className="text-xs font-semibold text-green-600 uppercase tracking-wide mb-2">Wins</h3>
                <ul className="flex flex-wrap gap-2">
                  {brief.wins.map((w, i) => <li key={i} className="text-xs bg-green-50 text-green-700 px-3 py-1.5 rounded-full">{w}</li>)}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* Top stat cards */}
        <div className="grid grid-cols-7 gap-4">
          {/* Pipeline Confidence — hero card */}
          <div className="col-span-1 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-lg shadow p-4 text-white">
            <div className="text-xs text-blue-200 mb-1 uppercase tracking-wide font-semibold">Confidence</div>
            <div className="text-4xl font-bold">
              {pipelineConfidence != null ? `${pipelineConfidence}%` : '—'}
            </div>
            <div className="text-xs text-blue-200 mt-1">{activeAccounts ?? 0} active accounts</div>
            <div className="mt-3 h-1.5 bg-blue-800 rounded-full overflow-hidden">
              <div className="h-full bg-white rounded-full transition-all" style={{ width: `${pipelineConfidence ?? 0}%` }} />
            </div>
          </div>
          {/* Total Pipeline */}
          <div className="col-span-2 bg-gradient-to-br from-emerald-600 to-green-700 rounded-lg shadow p-4 text-white">
            <div className="text-xs text-emerald-200 mb-1 uppercase tracking-wide font-semibold flex items-center gap-1">
              <DollarSign className="w-3 h-3" /> Total Pipeline
            </div>
            <div className="text-4xl font-bold">{fmt$(totalPipeline)}</div>
            <div className="text-xs text-emerald-200 mt-1">
              {accountsWithValue ? `${accountsWithValue} of ${activeAccounts} accounts have deal value` : 'Sync HubSpot to populate'}
            </div>
            <div className="mt-2 text-xs text-emerald-100">
              <span className="font-semibold">{fmt$(weightedPipeline)}</span> weighted by confidence
            </div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-sm text-gray-500 mb-1">Total Accounts</div>
            <div className="text-3xl font-bold text-gray-800">{totalAccounts}</div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-sm text-gray-500 mb-1">Open Tasks</div>
            <div className="text-3xl font-bold text-blue-600">{totalOpenTasks}</div>
          </div>
          <div className={`bg-white rounded-lg shadow p-4 ${totalOverdue > 0 ? 'border-l-4 border-red-500' : ''}`}>
            <div className="text-sm text-gray-500 mb-1">Overdue Tasks</div>
            <div className={`text-3xl font-bold ${totalOverdue > 0 ? 'text-red-600' : 'text-green-600'}`}>
              {totalOverdue > 0 ? totalOverdue : '✓ 0'}
            </div>
          </div>
          <div className={`bg-white rounded-lg shadow p-4 ${allStale.length > 0 ? 'border-l-4 border-yellow-400' : ''}`}>
            <div className="text-sm text-gray-500 mb-1">Stale Accounts</div>
            <div className={`text-3xl font-bold ${allStale.length > 0 ? 'text-yellow-600' : 'text-green-600'}`}>
              {allStale.length > 0 ? allStale.length : '✓ 0'}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-6">
          {/* Pipeline funnel */}
          <div className="col-span-2 bg-white rounded-lg shadow p-5">
            <h2 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <Building2 className="w-4 h-4 text-blue-500" />
              Pipeline Funnel
            </h2>
            {funnelStages.length === 0 ? (
              <p className="text-gray-400 text-sm">No account data yet.</p>
            ) : (
              <div className="space-y-2">
                {funnelStages.map(s => (
                  <div key={s.id} className="flex items-center gap-3">
                    <div className="w-36 text-sm text-gray-600 text-right shrink-0">{s.label}</div>
                    <div className="flex-1 h-7 bg-gray-100 rounded overflow-hidden">
                      <div
                        className={`h-full rounded flex items-center px-2 text-white text-xs font-semibold transition-all ${STAGE_BAR_COLORS[s.id] || 'bg-blue-500'}`}
                        style={{ width: `${Math.max((s.count / maxCount) * 100, 8)}%` }}
                      >
                        {s.count}
                      </div>
                    </div>
                    <div className="w-8 text-sm font-semibold text-gray-700 shrink-0">{s.count}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Stale accounts */}
          <div className="bg-white rounded-lg shadow p-5">
            <h2 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <Clock className="w-4 h-4 text-yellow-500" />
              Stale Accounts
              <span className="text-xs font-normal text-gray-400">(14+ days no activity)</span>
            </h2>
            {allStale.length === 0 ? (
              <div className="flex items-center gap-2 text-green-600 text-sm">
                <CheckCircle2 className="w-4 h-4" />
                All accounts active
              </div>
            ) : (
              <div className="space-y-2">
                {allStale.map(a => (
                  <div
                    key={a.id}
                    className="flex items-start justify-between gap-2 p-2 rounded hover:bg-gray-50 cursor-pointer"
                    onClick={() => router.push(`/modules/account-pipeline?account=${a.id}`)}
                  >
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-gray-800 truncate">{a.name}</div>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <StageLabel stage={a.stage} />
                        <span className="text-xs text-gray-400">{a.repName}</span>
                      </div>
                    </div>
                    <div className="text-xs text-yellow-600 font-medium shrink-0 mt-0.5">
                      {a.daysSinceActivity != null ? `${a.daysSinceActivity}d` : 'No calls'}
                    </div>
                  </div>
                ))}
                {allStale.length >= 10 && (
                  <p className="text-xs text-gray-400 pt-1">Showing top 10</p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Rep breakdown */}
        <div className="bg-white rounded-lg shadow">
          <div className="p-5 border-b">
            <h2 className="font-semibold text-gray-800 flex items-center gap-2">
              <Users className="w-4 h-4 text-blue-500" />
              Team Breakdown
            </h2>
          </div>

          {repSummaries.length === 0 ? (
            <div className="p-8 text-center text-gray-400">No reps found.</div>
          ) : (
            <div className="divide-y">
              {repSummaries.map(rep => {
                const isExpanded = expandedReps[rep.id]
                const hasIssues = rep.overdueTasks > 0 || rep.staleAccounts.length > 0
                return (
                  <div key={rep.id}>
                    <button
                      onClick={() => toggleRep(rep.id)}
                      className="w-full px-5 py-4 flex items-center gap-4 hover:bg-gray-50 text-left"
                    >
                      <div className="w-5 text-gray-400">
                        {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                      </div>
                      <div className="flex-1 font-medium text-gray-800">{rep.name}</div>
                      <div className="grid grid-cols-7 gap-6 text-sm text-center">
                        <div>
                          <div className="text-xs text-gray-400 mb-0.5">Pipeline</div>
                          <div className="font-semibold text-emerald-700">{fmt$(rep.totalPipeline)}</div>
                        </div>
                        <div>
                          <div className="text-xs text-gray-400 mb-0.5">Weighted</div>
                          <div className="font-semibold text-emerald-600">{fmt$(rep.weightedPipeline)}</div>
                        </div>
                        <div>
                          <div className="text-xs text-gray-400 mb-0.5">Confidence</div>
                          <div className={`font-semibold ${rep.pipelineConfidence >= 50 ? 'text-green-600' : rep.pipelineConfidence >= 25 ? 'text-yellow-600' : 'text-gray-700'}`}>
                            {rep.pipelineConfidence != null ? `${rep.pipelineConfidence}%` : '—'}
                          </div>
                        </div>
                        <div>
                          <div className="text-xs text-gray-400 mb-0.5">Accounts</div>
                          <div className="font-semibold">{rep.totalAccounts}</div>
                        </div>
                        <div>
                          <div className="text-xs text-gray-400 mb-0.5">Open Tasks</div>
                          <div className="font-semibold"><HealthDot value={rep.openTasks} warn={5} danger={10} /></div>
                        </div>
                        <div>
                          <div className="text-xs text-gray-400 mb-0.5">Overdue</div>
                          <div className="font-semibold"><HealthDot value={rep.overdueTasks} warn={1} danger={3} /></div>
                        </div>
                        <div>
                          <div className="text-xs text-gray-400 mb-0.5">Done/wk</div>
                          <div className="font-semibold text-green-600">{rep.doneThisWeek}</div>
                        </div>
                      </div>
                      {hasIssues && (
                        <AlertTriangle className="w-4 h-4 text-yellow-500 shrink-0" />
                      )}
                    </button>

                    {isExpanded && (
                      <div className="px-14 pb-4 bg-gray-50">
                        {/* Stage breakdown mini-bars */}
                        <div className="mb-3">
                          <div className="text-xs font-medium text-gray-500 mb-2">Stage Distribution</div>
                          <div className="flex flex-wrap gap-2">
                            {Object.entries(rep.stageCounts).map(([stage, count]) => (
                              <span key={stage} className={`px-2 py-1 rounded text-xs font-medium border ${STAGE_COLORS[stage] || 'bg-gray-100 text-gray-600 border-gray-200'}`}>
                                {STAGES.find(s => s.id === stage)?.label || stage.replace(/_/g, ' ')}: {count}
                              </span>
                            ))}
                            {Object.keys(rep.stageCounts).length === 0 && (
                              <span className="text-xs text-gray-400">No accounts</span>
                            )}
                          </div>
                        </div>

                        {/* Stale accounts for this rep */}
                        {rep.staleAccounts.length > 0 && (
                          <div>
                            <div className="text-xs font-medium text-gray-500 mb-2 flex items-center gap-1">
                              <Clock className="w-3 h-3 text-yellow-500" />
                              Stale Accounts
                            </div>
                            <div className="flex flex-wrap gap-2">
                              {rep.staleAccounts.map(a => (
                                <button
                                  key={a.id}
                                  onClick={() => router.push(`/modules/account-pipeline?account=${a.id}`)}
                                  className="flex items-center gap-1.5 px-2.5 py-1 bg-white border border-yellow-200 rounded text-xs text-yellow-800 hover:bg-yellow-50"
                                >
                                  <ExternalLink className="w-3 h-3" />
                                  {a.name}
                                  <span className="text-yellow-500">
                                    {a.daysSinceActivity != null ? `${a.daysSinceActivity}d` : 'no calls'}
                                  </span>
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                        {rep.staleAccounts.length === 0 && (
                          <div className="flex items-center gap-1.5 text-xs text-green-600">
                            <CheckCircle2 className="w-3 h-3" />
                            All accounts active
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
