import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/router'
import { ArrowLeft, RefreshCw, TrendingUp, Users, Target, AlertTriangle, Zap, BarChart2 } from 'lucide-react'
import UserMenu from '../../../components/auth/UserMenu'
import { useAuthStore } from '../../../stores/useAuthStore'
import ApiError from '../../../components/common/ApiError'
import { stageHex } from '../../../lib/constants'

function fmt$(n) { return n == null ? '—' : n >= 1000000 ? `$${(n / 1000000).toFixed(1)}M` : n >= 1000 ? `$${(n / 1000).toFixed(0)}K` : `$${n}` }
function fmtDate(d) { return d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—' }
function daysAgo(d) { return d ? Math.floor((Date.now() - new Date(d).getTime()) / 86400000) : null }

function ScoreGauge({ value, max = 10, label, size = 'md' }) {
  if (value == null) return <span className="text-gray-300 text-xs">—</span>
  const pct = Math.min(value / max, 1)
  const color = pct >= 0.7 ? 'text-emerald-600' : pct >= 0.5 ? 'text-amber-500' : 'text-red-500'
  const textSize = size === 'lg' ? 'text-3xl' : 'text-xl'
  return (
    <div className="flex flex-col items-center">
      <span className={`${textSize} font-bold ${color}`}>{value}</span>
      {label && <span className="text-xs text-gray-400 mt-0.5">{label}</span>}
    </div>
  )
}

function MiniBar({ value, max, color = 'bg-blue-500' }) {
  const pct = max ? Math.min((value / max) * 100, 100) : 0
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-gray-500 w-8 text-right">{value}</span>
    </div>
  )
}

function HeroCard({ label, value, sub, icon: Icon, color }) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 p-5">
      <div className="flex items-start justify-between mb-2">
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${color}`}>
          <Icon size={16} className="text-white" />
        </div>
      </div>
      <div className="text-2xl font-bold text-gray-900">{value}</div>
      <div className="text-sm text-gray-600 mt-0.5">{label}</div>
      {sub && <div className="text-xs text-gray-400 mt-1">{sub}</div>}
    </div>
  )
}

function RepCard({ rep, maxCalls }) {
  const [open, setOpen] = useState(false)
  const healthColor = rep.healthScore >= 70 ? 'text-emerald-600 bg-emerald-50' : rep.healthScore >= 50 ? 'text-amber-600 bg-amber-50' : rep.healthScore != null ? 'text-red-500 bg-red-50' : 'text-gray-400 bg-gray-50'

  return (
    <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
      <button
        className="w-full flex items-center justify-between p-5 hover:bg-gray-50 transition-colors text-left"
        onClick={() => setOpen(!open)}
      >
        <div className="flex items-center gap-4">
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-sm font-bold">
            {rep.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
          </div>
          <div>
            <div className="font-semibold text-gray-900 text-sm">{rep.name}</div>
            <div className="text-xs text-gray-400 mt-0.5">
              {rep.calls} calls · last {fmtDate(rep.lastCall)}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <div className="text-xs text-gray-400 mb-1">Discovery</div>
            <div className={`text-sm font-bold ${rep.avgDiscovery >= 7 ? 'text-emerald-600' : rep.avgDiscovery >= 5 ? 'text-amber-600' : rep.avgDiscovery != null ? 'text-red-500' : 'text-gray-300'}`}>
              {rep.avgDiscovery ?? '—'}<span className="text-gray-300 font-normal">/10</span>
            </div>
          </div>
          <div className="text-right">
            <div className="text-xs text-gray-400 mb-1">Pain Depth</div>
            <div className={`text-sm font-bold ${rep.avgPainDepth >= 7 ? 'text-emerald-600' : rep.avgPainDepth >= 5 ? 'text-amber-600' : rep.avgPainDepth != null ? 'text-red-500' : 'text-gray-300'}`}>
              {rep.avgPainDepth ?? '—'}<span className="text-gray-300 font-normal">/10</span>
            </div>
          </div>
          {rep.healthScore != null && (
            <div className={`px-2.5 py-1 rounded-lg text-xs font-bold ${healthColor}`}>
              {rep.healthScore}
            </div>
          )}
          <span className="text-gray-300 text-xs ml-1">{open ? '▲' : '▼'}</span>
        </div>
      </button>

      {open && (
        <div className="border-t border-gray-100 px-5 py-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
            <div>
              <div className="text-xs text-gray-400 mb-1">Intros</div>
              <div className="text-lg font-semibold text-gray-800">{rep.intros}</div>
            </div>
            <div>
              <div className="text-xs text-gray-400 mb-1">Demos</div>
              <div className="text-lg font-semibold text-gray-800">{rep.demos}</div>
            </div>
            <div>
              <div className="text-xs text-gray-400 mb-1">Avg Call</div>
              <div className="text-lg font-semibold text-gray-800">{rep.avgCallMin ? `${rep.avgCallMin}m` : '—'}</div>
            </div>
            <div>
              <div className="text-xs text-gray-400 mb-1">Next Steps/Call</div>
              <div className={`text-lg font-semibold ${rep.avgNextSteps >= 3 ? 'text-emerald-600' : rep.avgNextSteps >= 1 ? 'text-amber-600' : 'text-red-500'}`}>
                {rep.avgNextSteps ?? '—'}
              </div>
            </div>
          </div>
          <div>
            <div className="text-xs text-gray-400 mb-1.5">Call volume breakdown</div>
            <MiniBar value={rep.intros} max={rep.calls} color="bg-blue-400" />
            <div className="text-xs text-gray-400 mt-1 mb-0.5">Demo/SV calls</div>
            <MiniBar value={rep.demos + (rep.calls - rep.intros - rep.demos)} max={rep.calls} color="bg-violet-400" />
          </div>
        </div>
      )}
    </div>
  )
}

function StageBar({ stage, label, count, value, maxCount }) {
  const pct = maxCount ? Math.max((count / maxCount) * 100, 4) : 0
  return (
    <div className="flex items-center gap-3">
      <div className="w-36 text-xs text-gray-500 text-right shrink-0">{label}</div>
      <div className="flex-1 relative h-7 bg-gray-50 rounded">
        <div className="h-full rounded transition-all duration-500" style={{ width: `${pct}%`, backgroundColor: stageHex(stage) }} />
        <span className="absolute inset-0 flex items-center pl-2 text-xs font-semibold text-white mix-blend-difference">
          {count} {value ? `· ${fmt$(value)}` : ''}
        </span>
      </div>
    </div>
  )
}

export default function TeamDashboard() {
  const router = useRouter()
  const { user } = useAuthStore()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(null)
  const [days, setDays] = useState(90)
  const [creatingTasks, setCreatingTasks] = useState(false)
  const [taskResult, setTaskResult] = useState(null)
  const [backfilling, setBackfilling] = useState(false)
  const [backfillingCalls, setBackfillingCalls] = useState(false)
  const [backfillCallsResult, setBackfillCallsResult] = useState(null)
  const [backfillingTasks, setBackfillingTasks] = useState(false)
  const [backfillTasksResult, setBackfillTasksResult] = useState(null)
  const [section, setSection] = useState('overview')

  const load = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    try {
      const r = await fetch(`/api/sales-reports/team-dashboard?days=${days}`)
      const j = await r.json()
      if (j.success) {
        setData(j.data)
      } else {
        setLoadError({ message: j.error || 'Failed to load dashboard', status: r.status, source: `GET /api/sales-reports/team-dashboard?days=${days}` })
      }
    } catch (e) {
      setLoadError({ message: e.message, source: `GET /api/sales-reports/team-dashboard?days=${days}` })
    } finally {
      setLoading(false) }
  }, [days])

  useEffect(() => { load() }, [load])

  const createTasksFromCalls = async () => {
    setCreatingTasks(true)
    setTaskResult(null)
    try {
      const r = await fetch('/api/tasks/bulk-from-calls', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ days: 28 }),
      })
      const j = await r.json()
      if (j.success) {
        const d = j.data
        setTaskResult({ ok: true, msg: `Created ${d.created} tasks from recent calls (${d.skipped} already tracked)` })
      } else {
        setTaskResult({ ok: false, msg: j.error || 'Failed to create tasks' })
      }
    } catch (e) {
      setTaskResult({ ok: false, msg: e.message })
    } finally {
      setCreatingTasks(false)
    }
  }

  const backfillTranscripts = async () => {
    setBackfilling(true)
    setTaskResult(null)
    try {
      const r = await fetch('/api/gong/backfill-transcripts', { method: 'POST' })
      const j = await r.json()
      if (j.success) {
        const d = j.data
        setTaskResult({ ok: true, msg: `Backfill done: ${d.inserted} transcripts added to Account Management (${d.skipped} already linked)` })
      } else {
        setTaskResult({ ok: false, msg: j.error || 'Backfill failed' })
      }
    } catch (e) {
      setTaskResult({ ok: false, msg: e.message })
    } finally {
      setBackfilling(false)
    }
  }

  const backfillHistoricalCalls = async () => {
    setBackfillingCalls(true)
    setBackfillCallsResult(null)
    let totalProcessed = 0
    try {
      while (true) {
        const r = await fetch('/api/gong/backfill-all-calls', { method: 'POST' })
        const j = await r.json()
        if (!r.ok) {
          setBackfillCallsResult({ ok: false, msg: j.error || 'Backfill failed' })
          break
        }
        totalProcessed += j.processed || 0
        if (j.done || j.remaining === 0) {
          setBackfillCallsResult({ ok: true, msg: `Backfill complete: ${totalProcessed} calls analyzed` })
          break
        }
        setBackfillCallsResult({ ok: true, msg: `Analyzed ${totalProcessed} calls, ${j.remaining} remaining…` })
        await new Promise(resolve => setTimeout(resolve, 2000))
      }
    } catch (e) {
      setBackfillCallsResult({ ok: false, msg: e.message })
    } finally {
      setBackfillingCalls(false)
    }
  }

  const backfillTasksFromCalls = async () => {
    setBackfillingTasks(true)
    setBackfillTasksResult(null)
    try {
      const r = await fetch('/api/gong/backfill-tasks', { method: 'POST' })
      const j = await r.json()
      if (j.success) {
        const d = j.data
        setBackfillTasksResult({ ok: true, msg: `Backfill done: ${d.tasksCreated} tasks created from ${d.processed} calls (${d.skipped} already had tasks)` })
      } else {
        setBackfillTasksResult({ ok: false, msg: j.error || 'Backfill failed' })
      }
    } catch (e) {
      setBackfillTasksResult({ ok: false, msg: e.message })
    } finally {
      setBackfillingTasks(false)
    }
  }

  const summary = data?.summary || {}
  const repCards = data?.repCards || []
  const pipelineByStage = data?.pipelineByStage || []
  const dealsByOwner = data?.dealsByOwner || []
  const atRisk = data?.atRisk || []
  const topObjections = data?.topObjections || []
  const topBuyingSignals = data?.topBuyingSignals || []
  const callCadence = data?.callCadence || []
  const multiYear = data?.multiYear || []
  const repCommitments = data?.repCommitments || []

  const maxPipelineCount = pipelineByStage.reduce((m, s) => Math.max(m, s.count), 0)

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push('/modules/sales-reports')}
              className="flex items-center gap-2 text-gray-500 hover:text-gray-700 text-sm"
            >
              <ArrowLeft size={16} />
              Reports
            </button>
            <div>
              <h1 className="text-xl font-bold text-gray-900">Team Dashboard</h1>
              <p className="text-xs text-gray-500 mt-0.5">Pipeline health · rep performance · call intelligence</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <select
              value={days}
              onChange={e => setDays(Number(e.target.value))}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 bg-white"
            >
              <option value={30}>Last 30 days</option>
              <option value={60}>Last 60 days</option>
              <option value={90}>Last 90 days</option>
            </select>
            <button
              onClick={backfillTranscripts}
              disabled={backfilling}
              className="flex items-center gap-2 px-3 py-2 border border-gray-200 bg-white text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 disabled:opacity-50 transition-colors"
            >
              <RefreshCw size={13} className={backfilling ? 'animate-spin text-blue-500' : 'text-blue-500'} />
              {backfilling ? 'Linking…' : 'Link Calls to Accounts'}
            </button>
            <button
              onClick={backfillHistoricalCalls}
              disabled={backfillingCalls}
              className="flex items-center gap-2 px-3 py-2 border border-gray-200 bg-white text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 disabled:opacity-50 transition-colors"
            >
              <RefreshCw size={13} className={backfillingCalls ? 'animate-spin text-violet-500' : 'text-violet-500'} />
              {backfillingCalls ? 'Backfilling…' : 'Backfill Calls (4 weeks)'}
            </button>
            <button
              onClick={backfillTasksFromCalls}
              disabled={backfillingTasks}
              className="flex items-center gap-2 px-3 py-2 border border-gray-200 bg-white text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 disabled:opacity-50 transition-colors"
            >
              <Zap size={13} className={backfillingTasks ? 'animate-pulse text-emerald-500' : 'text-emerald-500'} />
              {backfillingTasks ? 'Backfilling…' : 'Backfill Tasks from Calls'}
            </button>
            <button
              onClick={createTasksFromCalls}
              disabled={creatingTasks}
              className="flex items-center gap-2 px-3 py-2 border border-gray-200 bg-white text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 disabled:opacity-50 transition-colors"
            >
              <Zap size={13} className={creatingTasks ? 'animate-pulse text-amber-500' : 'text-amber-500'} />
              {creatingTasks ? 'Creating…' : 'Add Tasks from Calls'}
            </button>
            <button
              onClick={load}
              disabled={loading}
              className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
              Refresh
            </button>
            <UserMenu user={user} />
          </div>
        </div>
      </div>

      {/* Task result banner */}
      {taskResult && (
        <div className={`px-6 py-2 text-sm font-medium ${taskResult.ok ? 'bg-emerald-50 text-emerald-700 border-b border-emerald-100' : 'bg-red-50 text-red-700 border-b border-red-100'}`}>
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <span>{taskResult.ok ? '✓' : '✗'} {taskResult.msg}</span>
            {taskResult.ok && (
              <button
                onClick={() => router.push('/modules/tasks')}
                className="text-xs underline ml-4"
              >
                Go to Tasks →
              </button>
            )}
          </div>
        </div>
      )}

      {/* Backfill calls result banner */}
      {backfillCallsResult && (
        <div className={`px-6 py-2 text-sm font-medium ${backfillCallsResult.ok ? 'bg-violet-50 text-violet-700 border-b border-violet-100' : 'bg-red-50 text-red-700 border-b border-red-100'}`}>
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <span>{backfillCallsResult.ok ? '✓' : '✗'} {backfillCallsResult.msg}</span>
            <button onClick={() => setBackfillCallsResult(null)} className="text-xs underline ml-4">Dismiss</button>
          </div>
        </div>
      )}

      {/* Backfill tasks result banner */}
      {backfillTasksResult && (
        <div className={`px-6 py-2 text-sm font-medium ${backfillTasksResult.ok ? 'bg-emerald-50 text-emerald-700 border-b border-emerald-100' : 'bg-red-50 text-red-700 border-b border-red-100'}`}>
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <span>{backfillTasksResult.ok ? '✓' : '✗'} {backfillTasksResult.msg}</span>
            <div className="flex items-center gap-3">
              {backfillTasksResult.ok && (
                <button onClick={() => router.push('/modules/tasks')} className="text-xs underline">Go to Tasks →</button>
              )}
              <button onClick={() => setBackfillTasksResult(null)} className="text-xs underline">Dismiss</button>
            </div>
          </div>
        </div>
      )}

      {/* Section tabs */}
      <div className="bg-white border-b border-gray-200 px-6">
        <div className="max-w-7xl mx-auto flex gap-1">
          {[
            { id: 'overview', label: 'Overview' },
            { id: 'reps', label: 'Rep Performance' },
            { id: 'pipeline', label: 'Pipeline' },
            { id: 'intelligence', label: 'Call Intelligence' },
            { id: 'commitments', label: `Open Actions (${repCommitments.length})` },
          ].map(s => (
            <button
              key={s.id}
              onClick={() => setSection(s.id)}
              className={`px-4 py-3 text-sm font-medium transition-colors whitespace-nowrap ${
                section === s.id
                  ? 'text-blue-600 border-b-2 border-blue-600'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6">
        {loadError ? (
          <div className="py-12 max-w-lg mx-auto">
            <ApiError error={loadError} onRetry={load} />
          </div>
        ) : loading && !data ? (
          <div className="flex items-center justify-center py-24 text-gray-400">Loading…</div>
        ) : (
          <>
            {/* ── Overview ─────────────────────────────────────────────── */}
            {section === 'overview' && (
              <div className="space-y-6">
                {/* Hero strip */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <HeroCard
                    label="Active Pipeline"
                    value={fmt$(summary.totalPipelineValue)}
                    sub={`${summary.activeAccounts} accounts`}
                    icon={TrendingUp}
                    color="bg-blue-500"
                  />
                  <HeroCard
                    label="Calls This Month"
                    value={summary.callsLast30 ?? '—'}
                    sub={`${summary.totalCalls} in ${days} days`}
                    icon={BarChart2}
                    color="bg-violet-500"
                  />
                  <HeroCard
                    label="Team Avg Discovery"
                    value={summary.teamAvgDiscovery != null ? `${summary.teamAvgDiscovery}/10` : '—'}
                    sub={summary.teamAvgPainDepth != null ? `Pain depth ${summary.teamAvgPainDepth}/10` : null}
                    icon={Target}
                    color={summary.teamAvgDiscovery >= 6 ? 'bg-emerald-500' : 'bg-amber-500'}
                  />
                  <HeroCard
                    label="At-Risk Deals"
                    value={summary.atRiskCount}
                    sub="No call in 21+ days (late stage)"
                    icon={AlertTriangle}
                    color={summary.atRiskCount > 3 ? 'bg-red-500' : 'bg-amber-500'}
                  />
                </div>

                {/* Pipeline snapshot + rep breakdown */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Pipeline by stage */}
                  <div className="bg-white rounded-xl border border-gray-100 p-6">
                    <h2 className="text-sm font-semibold text-gray-700 mb-1">Active Pipeline by Stage</h2>
                    <p className="text-xs text-gray-400 mb-4">HubSpot deal distribution</p>
                    <div className="space-y-2">
                      {pipelineByStage.length === 0 ? (
                        <div className="text-sm text-gray-400 py-4 text-center">No active pipeline data.</div>
                      ) : pipelineByStage.map(s => (
                        <StageBar key={s.stage} {...s} maxCount={maxPipelineCount} />
                      ))}
                    </div>
                    {summary.totalPipelineValue > 0 && (
                      <div className="mt-4 pt-3 border-t border-gray-100 text-sm font-semibold text-gray-700">
                        Total: {fmt$(summary.totalPipelineValue)}
                      </div>
                    )}
                  </div>

                  {/* Rep deal ownership */}
                  <div className="bg-white rounded-xl border border-gray-100 p-6">
                    <h2 className="text-sm font-semibold text-gray-700 mb-1">Active Deals by Owner</h2>
                    <p className="text-xs text-gray-400 mb-4">Active stages only</p>
                    {dealsByOwner.length === 0 ? (
                      <div className="text-sm text-gray-400 py-4 text-center">No data.</div>
                    ) : (
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-gray-100">
                            <th className="text-left text-xs text-gray-400 font-medium pb-2">Owner</th>
                            <th className="text-right text-xs text-gray-400 font-medium pb-2">Deals</th>
                            <th className="text-right text-xs text-gray-400 font-medium pb-2">Late Stage</th>
                            <th className="text-right text-xs text-gray-400 font-medium pb-2">Pipeline</th>
                          </tr>
                        </thead>
                        <tbody>
                          {dealsByOwner.map(o => (
                            <tr key={o.owner} className="border-b border-gray-50 hover:bg-gray-50">
                              <td className="py-2 font-medium text-gray-800">{o.owner || 'Unassigned'}</td>
                              <td className="py-2 text-right text-gray-600">{o.count}</td>
                              <td className="py-2 text-right">
                                <span className={o.lateStage > 0 ? 'text-emerald-600 font-medium' : 'text-gray-400'}>{o.lateStage}</span>
                              </td>
                              <td className="py-2 text-right font-medium text-gray-700">{fmt$(o.value)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                </div>

                {/* Multi-year lead funnel */}
                <div className="bg-white rounded-xl border border-gray-100 p-6">
                  <h2 className="text-sm font-semibold text-gray-700 mb-1">Multi-Year Lead Funnel</h2>
                  {multiYear.length === 0 ? (
                    <div className="text-center py-8">
                      <p className="text-gray-400 text-sm mb-2">No lead data yet.</p>
                      <p className="text-xs text-gray-400">Go to Lead Intelligence → Sync All to populate 2024–2026.</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto mt-3">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-gray-100">
                            <th className="text-left text-xs text-gray-400 font-medium pb-2">Year</th>
                            <th className="text-right text-xs text-gray-400 font-medium pb-2">Booked</th>
                            <th className="text-right text-xs text-gray-400 font-medium pb-2">Showed</th>
                            <th className="text-right text-xs text-gray-400 font-medium pb-2">Show %</th>
                            <th className="text-right text-xs text-gray-400 font-medium pb-2">Qualified</th>
                            <th className="text-right text-xs text-gray-400 font-medium pb-2">Won</th>
                            <th className="text-right text-xs text-gray-400 font-medium pb-2">Close %</th>
                            <th className="text-right text-xs text-gray-400 font-medium pb-2">ARR Won</th>
                          </tr>
                        </thead>
                        <tbody>
                          {multiYear.map(y => (
                            <tr key={y.year} className="border-b border-gray-50 hover:bg-gray-50">
                              <td className="py-2 font-semibold text-gray-900">{y.year}</td>
                              <td className="py-2 text-right text-gray-600">{y.total}</td>
                              <td className="py-2 text-right text-gray-600">{y.showed}</td>
                              <td className="py-2 text-right">
                                <span className={y.showRate >= 0.66 ? 'text-emerald-600 font-medium' : y.showRate >= 0.5 ? 'text-amber-600' : 'text-red-500'}>
                                  {Math.round(y.showRate * 100)}%
                                </span>
                              </td>
                              <td className="py-2 text-right text-gray-600">{y.qualified}</td>
                              <td className="py-2 text-right font-semibold text-emerald-600">{y.won}</td>
                              <td className="py-2 text-right text-gray-600">{Math.round(y.closeRate * 100)}%</td>
                              <td className="py-2 text-right font-semibold text-emerald-700">{fmt$(y.arr)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ── Rep Performance ───────────────────────────────────────── */}
            {section === 'reps' && (
              <div className="space-y-3">
                <p className="text-sm text-gray-500 mb-4">
                  Composite scores based on AI analysis of {summary.totalCalls} calls in the last {days} days.
                  Discovery = how well reps uncover MEDDICC. Pain Depth = business impact articulation.
                </p>
                {repCards.length === 0 ? (
                  <div className="text-center py-16 text-gray-400">No call data in this window.</div>
                ) : (
                  repCards.map(rep => (
                    <RepCard key={rep.name} rep={rep} maxCalls={repCards[0]?.calls || 1} />
                  ))
                )}

                {/* Team benchmarks */}
                {repCards.length > 1 && (
                  <div className="bg-white rounded-xl border border-gray-100 p-6 mt-4">
                    <h2 className="text-sm font-semibold text-gray-700 mb-4">Team Benchmarks</h2>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-6">
                      <div className="text-center">
                        <div className="text-2xl font-bold text-gray-900">{summary.teamAvgDiscovery ?? '—'}</div>
                        <div className="text-xs text-gray-500 mt-1">Avg Discovery Score</div>
                        <div className="text-xs text-gray-400">(target: 7+)</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-gray-900">{summary.teamAvgPainDepth ?? '—'}</div>
                        <div className="text-xs text-gray-500 mt-1">Avg Pain Depth</div>
                        <div className="text-xs text-gray-400">(target: 6+)</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-gray-900">{summary.teamAvgTalkRatio ?? '—'}%</div>
                        <div className="text-xs text-gray-500 mt-1">Avg Rep Talk Ratio</div>
                        <div className="text-xs text-gray-400">(target: &lt;50%)</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-gray-900">{summary.callsLast30}</div>
                        <div className="text-xs text-gray-500 mt-1">Calls This Month</div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── Pipeline ─────────────────────────────────────────────── */}
            {section === 'pipeline' && (
              <div className="space-y-6">
                {/* At-risk deals */}
                <div className="bg-white rounded-xl border border-gray-100 p-6">
                  <div className="flex items-center gap-2 mb-1">
                    <AlertTriangle size={14} className="text-amber-500" />
                    <h2 className="text-sm font-semibold text-gray-700">At-Risk Deals</h2>
                  </div>
                  <p className="text-xs text-gray-400 mb-4">Late-stage accounts with no Gong call logged in 21+ days.</p>
                  {atRisk.length === 0 ? (
                    <div className="text-sm text-gray-400 py-4 text-center">No at-risk deals.</div>
                  ) : (
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-100">
                          <th className="text-left text-xs text-gray-400 font-medium pb-2">Account</th>
                          <th className="text-left text-xs text-gray-400 font-medium pb-2">Stage</th>
                          <th className="text-left text-xs text-gray-400 font-medium pb-2">Owner</th>
                          <th className="text-right text-xs text-gray-400 font-medium pb-2">Deal Value</th>
                          <th className="text-right text-xs text-gray-400 font-medium pb-2">Last Call</th>
                          <th className="text-right text-xs text-gray-400 font-medium pb-2">Days Silent</th>
                        </tr>
                      </thead>
                      <tbody>
                        {atRisk.map((a, i) => (
                          <tr key={i} className="border-b border-gray-50 hover:bg-gray-50">
                            <td className="py-2 font-medium text-gray-800 max-w-[200px] truncate">{a.name}</td>
                            <td className="py-2 text-xs text-gray-500 capitalize">{a.stage?.replace(/_/g, ' ')}</td>
                            <td className="py-2 text-xs text-gray-500">{a.owner || '—'}</td>
                            <td className="py-2 text-right text-xs font-medium text-gray-700">{fmt$(a.value)}</td>
                            <td className="py-2 text-right text-xs text-gray-400">{fmtDate(a.lastCall)}</td>
                            <td className="py-2 text-right">
                              <span className={`text-xs font-semibold ${(a.daysSinceCall || 999) > 30 ? 'text-red-500' : 'text-amber-500'}`}>
                                {a.daysSinceCall != null ? `${a.daysSinceCall}d` : 'Never'}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>

                {/* Full pipeline breakdown */}
                <div className="bg-white rounded-xl border border-gray-100 p-6">
                  <h2 className="text-sm font-semibold text-gray-700 mb-4">Full Pipeline by Stage</h2>
                  <div className="space-y-2.5">
                    {pipelineByStage.map(s => (
                      <StageBar key={s.stage} {...s} maxCount={maxPipelineCount} />
                    ))}
                  </div>
                  {summary.totalPipelineValue > 0 && (
                    <div className="mt-4 pt-3 border-t border-gray-100 flex justify-between items-center">
                      <span className="text-sm text-gray-500">Total active pipeline</span>
                      <span className="text-lg font-bold text-gray-900">{fmt$(summary.totalPipelineValue)}</span>
                    </div>
                  )}
                </div>

                {/* Call cadence */}
                {callCadence.length > 0 && (
                  <div className="bg-white rounded-xl border border-gray-100 p-6">
                    <h2 className="text-sm font-semibold text-gray-700 mb-4">Monthly Call Cadence</h2>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-gray-100">
                            <th className="text-left text-xs text-gray-400 font-medium pb-2">Month</th>
                            <th className="text-right text-xs text-gray-400 font-medium pb-2">Total Calls</th>
                            <th className="text-right text-xs text-gray-400 font-medium pb-2">Intros</th>
                            <th className="text-right text-xs text-gray-400 font-medium pb-2">Demos</th>
                            <th className="text-left text-xs text-gray-400 font-medium pb-2 pl-4">Volume</th>
                          </tr>
                        </thead>
                        <tbody>
                          {callCadence.map(m => {
                            const maxC = Math.max(...callCadence.map(x => x.calls))
                            return (
                              <tr key={m.month} className="border-b border-gray-50 hover:bg-gray-50">
                                <td className="py-2 text-gray-800 font-medium">{m.month}</td>
                                <td className="py-2 text-right text-gray-600">{m.calls}</td>
                                <td className="py-2 text-right text-blue-600">{m.intros}</td>
                                <td className="py-2 text-right text-violet-600">{m.demos}</td>
                                <td className="py-2 pl-4">
                                  <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden w-32">
                                    <div className="h-full bg-blue-400 rounded-full" style={{ width: `${(m.calls / maxC) * 100}%` }} />
                                  </div>
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── Call Intelligence ─────────────────────────────────────── */}
            {section === 'intelligence' && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Top objections */}
                  <div className="bg-white rounded-xl border border-gray-100 p-6">
                    <h2 className="text-sm font-semibold text-gray-700 mb-1">Top Objections Raised</h2>
                    <p className="text-xs text-gray-400 mb-4">Patterns across all analyzed calls. Fix these at the team level.</p>
                    {topObjections.length === 0 ? (
                      <div className="text-sm text-gray-400 py-4 text-center">No objection data yet.</div>
                    ) : (
                      <div className="space-y-3">
                        {topObjections.map((o, i) => (
                          <div key={i} className="flex items-start gap-3">
                            <span className="text-xs font-semibold text-gray-400 w-4 mt-0.5">{i + 1}</span>
                            <div className="flex-1">
                              <div className="text-sm text-gray-700 leading-snug">{o.text}</div>
                              <div className="text-xs text-gray-400 mt-0.5">in {o.count} call{o.count > 1 ? 's' : ''}</div>
                            </div>
                            <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden mt-1.5 shrink-0">
                              <div
                                className="h-full bg-red-300 rounded-full"
                                style={{ width: `${(o.count / (topObjections[0]?.count || 1)) * 100}%` }}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Top buying signals */}
                  <div className="bg-white rounded-xl border border-gray-100 p-6">
                    <h2 className="text-sm font-semibold text-gray-700 mb-1">Buying Signals Detected</h2>
                    <p className="text-xs text-gray-400 mb-4">What's pulling prospects forward. Use these in follow-ups.</p>
                    {topBuyingSignals.length === 0 ? (
                      <div className="text-sm text-gray-400 py-4 text-center">No buying signal data yet.</div>
                    ) : (
                      <div className="space-y-3">
                        {topBuyingSignals.map((b, i) => (
                          <div key={i} className="flex items-start gap-3">
                            <span className="text-xs font-semibold text-gray-400 w-4 mt-0.5">{i + 1}</span>
                            <div className="flex-1">
                              <div className="text-sm text-gray-700 leading-snug">{b.text}</div>
                              <div className="text-xs text-gray-400 mt-0.5">in {b.count} call{b.count > 1 ? 's' : ''}</div>
                            </div>
                            <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden mt-1.5 shrink-0">
                              <div
                                className="h-full bg-emerald-400 rounded-full"
                                style={{ width: `${(b.count / (topBuyingSignals[0]?.count || 1)) * 100}%` }}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Rep score comparison table */}
                <div className="bg-white rounded-xl border border-gray-100 p-6">
                  <h2 className="text-sm font-semibold text-gray-700 mb-4">Rep Quality Scores — Side by Side</h2>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-100">
                        <th className="text-left text-xs text-gray-400 font-medium pb-2">Rep</th>
                        <th className="text-right text-xs text-gray-400 font-medium pb-2">Calls</th>
                        <th className="text-right text-xs text-gray-400 font-medium pb-2">Discovery /10</th>
                        <th className="text-right text-xs text-gray-400 font-medium pb-2">Pain Depth /10</th>
                        <th className="text-right text-xs text-gray-400 font-medium pb-2">Talk Ratio</th>
                        <th className="text-right text-xs text-gray-400 font-medium pb-2">Next Steps/Call</th>
                        <th className="text-right text-xs text-gray-400 font-medium pb-2">Avg Call Len</th>
                      </tr>
                    </thead>
                    <tbody>
                      {repCards.map(r => (
                        <tr key={r.name} className="border-b border-gray-50 hover:bg-gray-50">
                          <td className="py-2.5 font-medium text-gray-800">{r.name}</td>
                          <td className="py-2.5 text-right text-gray-600">{r.calls}</td>
                          <td className="py-2.5 text-right">
                            <span className={r.avgDiscovery >= 7 ? 'text-emerald-600 font-semibold' : r.avgDiscovery >= 5 ? 'text-amber-600' : r.avgDiscovery != null ? 'text-red-500' : 'text-gray-300'}>
                              {r.avgDiscovery ?? '—'}
                            </span>
                          </td>
                          <td className="py-2.5 text-right">
                            <span className={r.avgPainDepth >= 7 ? 'text-emerald-600 font-semibold' : r.avgPainDepth >= 5 ? 'text-amber-600' : r.avgPainDepth != null ? 'text-red-500' : 'text-gray-300'}>
                              {r.avgPainDepth ?? '—'}
                            </span>
                          </td>
                          <td className="py-2.5 text-right text-gray-500">{r.avgTalkRatio != null ? `${r.avgTalkRatio}%` : '—'}</td>
                          <td className="py-2.5 text-right">
                            <span className={r.avgNextSteps >= 3 ? 'text-emerald-600' : r.avgNextSteps >= 1 ? 'text-amber-600' : 'text-red-500'}>
                              {r.avgNextSteps ?? '—'}
                            </span>
                          </td>
                          <td className="py-2.5 text-right text-gray-500">{r.avgCallMin ? `${r.avgCallMin}m` : '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* ── Open Actions ──────────────────────────────────────────── */}
            {section === 'commitments' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-gray-500">
                    Rep-owned next steps from calls in the last 28 days. Click "Add Tasks from Calls" in the header to push these to your task list.
                  </p>
                </div>
                {repCommitments.length === 0 ? (
                  <div className="text-center py-16 text-gray-400 text-sm">No open rep action items found in recent calls.</div>
                ) : (
                  <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 border-b border-gray-100">
                        <tr>
                          <th className="text-left text-xs text-gray-400 font-medium px-4 py-3">Action Item</th>
                          <th className="text-left text-xs text-gray-400 font-medium px-4 py-3">From Call</th>
                          <th className="text-left text-xs text-gray-400 font-medium px-4 py-3">Rep</th>
                          <th className="text-left text-xs text-gray-400 font-medium px-4 py-3">Date</th>
                        </tr>
                      </thead>
                      <tbody>
                        {repCommitments.map((c, i) => (
                          <tr key={i} className="border-b border-gray-50 hover:bg-gray-50">
                            <td className="px-4 py-2.5 text-gray-800 font-medium">{c.step}</td>
                            <td className="px-4 py-2.5 text-gray-500 text-xs max-w-[200px] truncate">{c.callTitle}</td>
                            <td className="px-4 py-2.5 text-gray-500 text-xs">{c.rep}</td>
                            <td className="px-4 py-2.5 text-gray-400 text-xs whitespace-nowrap">{fmtDate(c.callDate)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
