import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/router'
import {
  RefreshCw,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  ChevronRight,
  ArrowRight,
  Activity,
} from 'lucide-react'
import AppShell from '../../components/layout/AppShell'
import { useAuthStore } from '../../stores/useAuthStore'
import StageBadge from '../../components/ui/StageBadge'
import { stageHex, stageLabel } from '../../lib/constants'

// ── Config ────────────────────────────────────────────────────────────────────

const STAGE_ORDER = [
  'qualifying', 'active_pursuit', 'intro_scheduled', 'demo',
  'solution_validation', 'proposal', 'legal',
]

const STALL_DAYS = {
  qualifying: 30,
  active_pursuit: 30,
  intro_scheduled: 21,
  demo: 21,
  solution_validation: 21,
  proposal: 14,
  legal: 14,
}

const DIRECTION_CONFIG = {
  forward: { label: 'Forward', color: 'text-green-600', bg: 'bg-green-50 border-green-200', icon: TrendingUp },
  backward: { label: 'Backward', color: 'text-red-600', bg: 'bg-red-50 border-red-200', icon: TrendingDown },
  won: { label: 'Won', color: 'text-amber-600', bg: 'bg-amber-50 border-amber-200', icon: TrendingUp },
  lost: { label: 'Lost', color: 'text-gray-700', bg: 'bg-gray-100 border-gray-300', icon: TrendingDown },
  inactive: { label: 'Inactive', color: 'text-gray-500', bg: 'bg-gray-50 border-gray-200', icon: ArrowRight },
  changed: { label: 'Changed', color: 'text-blue-600', bg: 'bg-blue-50 border-blue-200', icon: ArrowRight },
}

const TABS = ['Overview', 'Movement Feed', 'Stall Risk']

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtValue(n) {
  if (n == null || n === 0) return null
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}m`
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}k`
  return `$${n.toLocaleString()}`
}

function formatRelative(dateStr) {
  if (!dateStr) return ''
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60_000)
  const hours = Math.floor(diff / 3_600_000)
  const days = Math.floor(diff / 86_400_000)
  const weeks = Math.floor(days / 7)
  const months = Math.floor(days / 30)
  if (mins < 60) return `${mins}m ago`
  if (hours < 24) return `${hours}h ago`
  if (days === 1) return '1 day ago'
  if (days < 7) return `${days}d ago`
  if (weeks === 1) return '1 week ago'
  if (weeks < 5) return `${weeks} weeks ago`
  if (months === 1) return '1 month ago'
  return `${months} months ago`
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

function Sk({ className = '' }) {
  return <div className={`animate-pulse bg-gray-200 rounded ${className}`} />
}

function LoadingSkeleton() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <Sk className="w-9 h-9 rounded" />
            <div>
              <Sk className="w-48 h-7 mb-1" />
              <Sk className="w-56 h-4" />
            </div>
          </div>
          <Sk className="w-24 h-9 rounded-lg" />
        </div>
      </div>
      <div className="max-w-7xl mx-auto px-6 py-6 space-y-6">
        <div className="grid grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-white rounded-xl shadow-sm border p-5">
              <Sk className="w-24 h-4 mb-2" />
              <Sk className="w-16 h-9" />
            </div>
          ))}
        </div>
        <div className="flex gap-2">
          {TABS.map((_, i) => <Sk key={i} className="w-28 h-9 rounded-lg" />)}
        </div>
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => <Sk key={i} className="w-full h-20 rounded-xl" />)}
        </div>
      </div>
    </div>
  )
}

// ── Tab 1: Overview ───────────────────────────────────────────────────────────

function OverviewTab({ data }) {
  const { stageDistribution = [], timeInCurrentStage = [], historyTableMissing } = data

  const distMap = useMemo(() => {
    const m = {}
    stageDistribution.forEach(s => { m[s.stage] = s })
    return m
  }, [stageDistribution])

  const avgDaysMap = useMemo(() => {
    const m = {}
    STAGE_ORDER.forEach(stage => {
      const items = timeInCurrentStage.filter(t => t.stage === stage)
      if (items.length > 0) {
        m[stage] = Math.round(items.reduce((sum, t) => sum + t.days_in_stage, 0) / items.length)
      } else {
        m[stage] = null
      }
    })
    return m
  }, [timeInCurrentStage])

  const activeStages = STAGE_ORDER.filter(s => (distMap[s]?.count || 0) > 0)
  const maxCount = Math.max(...activeStages.map(s => distMap[s]?.count || 0), 1)

  const inactiveSDR = distMap['inactive_sdr_follow_up']?.count || 0
  const inactiveAE = distMap['inactive_ae_follow_up']?.count || 0

  return (
    <div className="space-y-4">
      {historyTableMissing && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg px-4 py-3 text-sm text-yellow-800 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-yellow-500 shrink-0 mt-0.5" />
          Migration pending — movement history and velocity data will appear after running the DB migration.
        </div>
      )}

      {activeStages.length === 0 ? (
        <div className="bg-white rounded-xl border p-8 text-center text-gray-400 text-sm">
          No active deals in pipeline.
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border p-6">
          <h2 className="font-semibold text-gray-800 mb-5 flex items-center gap-2">
            <Activity className="w-4 h-4 text-blue-500" />
            Active Pipeline
          </h2>
          <div className="space-y-3">
            {activeStages.map(stage => {
              const dist = distMap[stage] || {}
              const count = dist.count || 0
              const totalVal = fmtValue(dist.total_value)
              const avgDays = avgDaysMap[stage]
              const threshold = STALL_DAYS[stage]
              const isStalling = avgDays != null && threshold != null && avgDays > threshold
              const barPct = Math.max((count / maxCount) * 100, 6)

              return (
                <div key={stage} className="flex items-start gap-4">
                  <div className="w-36 text-sm text-gray-600 text-right shrink-0 pt-2">
                    {stageLabel(stage)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="h-12 bg-gray-100 rounded-lg overflow-hidden relative">
                      <div
                        className="h-full rounded-lg flex items-center px-3 text-white text-sm font-bold transition-all"
                        style={{ width: `${barPct}%`, minWidth: '3rem', backgroundColor: stageHex(stage) }}
                      >
                        <span className="tabular-nums">{count}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                      {totalVal && (
                        <span className="text-xs text-gray-500">{totalVal} total</span>
                      )}
                      {avgDays != null && (
                        <span className="text-xs text-gray-400">{avgDays}d avg in stage</span>
                      )}
                      {isStalling && (
                        <span className="text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                          {avgDays}d avg · threshold {threshold}d
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {(inactiveSDR > 0 || inactiveAE > 0) && (
        <div className="bg-white rounded-xl shadow-sm border px-5 py-4">
          <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Inactive</h3>
          <div className="flex items-center gap-4">
            {inactiveSDR > 0 && (
              <div className="flex items-center gap-2">
                <StageBadge stage="inactive_sdr_follow_up" />
                <span className="text-sm font-semibold text-gray-700">{inactiveSDR}</span>
              </div>
            )}
            {inactiveAE > 0 && (
              <div className="flex items-center gap-2">
                <StageBadge stage="inactive_ae_follow_up" />
                <span className="text-sm font-semibold text-gray-700">{inactiveAE}</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Tab 2: Movement Feed ──────────────────────────────────────────────────────

const DIRECTION_FILTERS = ['All', 'Forward', 'Backward', 'Inactive', 'Won/Lost']
const DATE_RANGES = ['7d', '30d', '90d']

function MovementFeed({ data, router }) {
  const { recentMovements = [], historyTableMissing } = data
  const [dateRange, setDateRange] = useState('30d')
  const [dirFilter, setDirFilter] = useState('All')

  const filtered = useMemo(() => {
    const days = parseInt(dateRange)
    const cutoff = Date.now() - days * 86_400_000

    return recentMovements
      .filter(m => new Date(m.changed_at).getTime() >= cutoff)
      .filter(m => {
        if (dirFilter === 'All') return true
        if (dirFilter === 'Forward') return m.direction === 'forward'
        if (dirFilter === 'Backward') return m.direction === 'backward'
        if (dirFilter === 'Inactive') return m.direction === 'inactive'
        if (dirFilter === 'Won/Lost') return m.direction === 'won' || m.direction === 'lost'
        return true
      })
      .slice(0, 100)
  }, [recentMovements, dateRange, dirFilter])

  if (historyTableMissing) {
    return (
      <div className="bg-white rounded-xl border p-8 text-center">
        <AlertTriangle className="w-8 h-8 text-yellow-400 mx-auto mb-3" />
        <p className="text-gray-600 font-medium">Movement history not available</p>
        <p className="text-sm text-gray-400 mt-1">Run the DB migration to enable stage movement tracking.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-1 bg-white border rounded-lg p-1">
          {DATE_RANGES.map(r => (
            <button
              key={r}
              onClick={() => setDateRange(r)}
              className={`px-3 py-1 text-sm rounded-md transition-colors ${
                dateRange === r
                  ? 'bg-blue-600 text-white font-medium'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              {r}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          {DIRECTION_FILTERS.map(f => (
            <button
              key={f}
              onClick={() => setDirFilter(f)}
              className={`px-3 py-1 text-sm rounded-full border transition-colors ${
                dirFilter === f
                  ? 'bg-gray-800 text-white border-gray-800'
                  : 'text-gray-600 border-gray-200 bg-white hover:border-gray-400'
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="bg-white rounded-xl border p-8 text-center text-gray-400 text-sm">
          No movements match this filter.
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border divide-y">
          {filtered.map(m => {
            const dir = DIRECTION_CONFIG[m.direction] || DIRECTION_CONFIG.changed
            const DirIcon = dir.icon
            const val = fmtValue(m.deal_value_at_change)

            return (
              <div
                key={m.id}
                className="flex items-center gap-4 px-5 py-3.5 hover:bg-gray-50 cursor-pointer group"
                onClick={() => router.push(`/modules/account-pipeline?account=${m.account_id}`)}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-gray-800 group-hover:text-blue-600 truncate">
                      {m.account_name}
                    </span>
                    <ChevronRight className="w-3.5 h-3.5 text-gray-300 opacity-0 group-hover:opacity-100 shrink-0" />
                  </div>
                  <div className="text-xs text-gray-400 mt-0.5">{m.owner_name}</div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-sm text-gray-600">
                    {m.from_stage ? stageLabel(m.from_stage) : <span className="text-gray-400 italic">new</span>}
                  </span>
                  <DirIcon className={`w-4 h-4 shrink-0 ${dir.color}`} />
                  <span className="text-sm font-medium text-gray-800">
                    {stageLabel(m.to_stage)}
                  </span>
                </div>

                <div className="shrink-0 text-right">
                  <div className="text-xs text-gray-400">{formatRelative(m.changed_at)}</div>
                  {val && <div className="text-xs text-gray-500 mt-0.5">{val}</div>}
                </div>
              </div>
            )
          })}
          {filtered.length === 100 && (
            <div className="px-5 py-2 text-xs text-gray-400 bg-gray-50">Showing first 100 results</div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Tab 3: Stall Risk ─────────────────────────────────────────────────────────

const SORT_OPTIONS = ['days_in_stage', 'stall_score', 'days_since_call']
const SORT_LABELS = {
  days_in_stage: 'Days in Stage',
  stall_score: 'Stall Score',
  days_since_call: 'Days Since Call',
}

function StallScoreBar({ score }) {
  const pct = Math.min(Math.max(score, 0), 100)
  const color = pct > 70 ? 'bg-red-500' : pct > 40 ? 'bg-amber-400' : 'bg-green-500'
  return (
    <div className="flex items-center gap-2">
      <div className="w-16 h-1.5 bg-gray-200 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className={`text-xs font-medium tabular-nums ${pct > 70 ? 'text-red-600' : pct > 40 ? 'text-amber-600' : 'text-green-600'}`}>
        {Math.round(pct)}
      </span>
    </div>
  )
}

function StallRiskTab({ data, router }) {
  const { stallCandidates = [] } = data
  const [sortBy, setSortBy] = useState('stall_score')

  const sorted = useMemo(() => {
    return [...stallCandidates].sort((a, b) => {
      if (sortBy === 'days_since_call') {
        const aVal = a.days_since_call ?? 99999
        const bVal = b.days_since_call ?? 99999
        return bVal - aVal
      }
      return b[sortBy] - a[sortBy]
    })
  }, [stallCandidates, sortBy])

  if (stallCandidates.length === 0) {
    return (
      <div className="bg-white rounded-xl border p-8 text-center">
        <TrendingUp className="w-8 h-8 text-green-400 mx-auto mb-3" />
        <p className="text-gray-600 font-medium">No accounts at risk</p>
        <p className="text-sm text-gray-400 mt-1">All active deals are within their stage thresholds.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-500">Sort by:</span>
          {SORT_OPTIONS.map(opt => (
            <button
              key={opt}
              onClick={() => setSortBy(opt)}
              className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${
                sortBy === opt
                  ? 'bg-gray-800 text-white border-gray-800'
                  : 'text-gray-600 border-gray-200 bg-white hover:border-gray-400'
              }`}
            >
              {SORT_LABELS[opt]}
            </button>
          ))}
        </div>
        <span className="text-xs text-gray-400">Score = time over threshold + call gap</span>
      </div>

      <div className="bg-white rounded-xl shadow-sm border divide-y">
        {sorted.map(c => {
          const threshold = STALL_DAYS[c.stage]
          const ratio = threshold ? c.days_in_stage / threshold : 0
          const daysColor =
            ratio > 2 ? 'text-red-600 font-bold' :
            ratio > 1.5 ? 'text-amber-600 font-semibold' :
            'text-gray-700'
          const val = fmtValue(c.deal_value)

          return (
            <div
              key={c.account_id}
              className="flex items-center gap-4 px-5 py-4 hover:bg-gray-50 cursor-pointer group"
              onClick={() => router.push(`/modules/account-pipeline?account=${c.account_id}`)}
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-gray-800 group-hover:text-blue-600 truncate">
                    {c.account_name}
                  </span>
                  <ChevronRight className="w-3.5 h-3.5 text-gray-300 opacity-0 group-hover:opacity-100 shrink-0" />
                </div>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  <StageBadge stage={c.stage} />
                  <span className="text-xs text-gray-400">{c.owner_name}</span>
                  {val && <span className="text-xs text-gray-400">{val}</span>}
                </div>
              </div>

              <div className="shrink-0 text-right space-y-1">
                <div className={`text-sm tabular-nums ${daysColor}`}>
                  {c.days_in_stage}d in stage
                  {threshold && (
                    <span className="text-xs font-normal text-gray-400 ml-1">/ {threshold}d</span>
                  )}
                </div>
                <div className="text-xs text-gray-400">
                  {c.days_since_call != null
                    ? `${c.days_since_call}d since last call`
                    : <span className="italic">No calls on record</span>
                  }
                </div>
              </div>

              <div className="shrink-0 w-24">
                <div className="text-xs text-gray-400 mb-1">Stall score</div>
                <StallScoreBar score={c.stall_score} />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function StageAnalytics() {
  const router = useRouter()
  const { user } = useAuthStore()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [refreshing, setRefreshing] = useState(false)
  const [activeTab, setActiveTab] = useState(0)

  function loadData(isRefresh = false) {
    if (isRefresh) setRefreshing(true)
    else setLoading(true)
    fetch('/api/pipeline/stage-analytics')
      .then(r => r.json())
      .then(d => {
        if (d.error) throw new Error(d.error)
        setData(d)
        setError(null)
      })
      .catch(e => setError(e.message))
      .finally(() => {
        setLoading(false)
        setRefreshing(false)
      })
  }

  useEffect(() => { loadData() }, [])

  if (loading) return <LoadingSkeleton />

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <AlertTriangle className="w-10 h-10 text-red-500 mx-auto mb-3" />
          <p className="text-red-600 font-medium">{error}</p>
          <p className="text-sm text-gray-500 mt-1">You may not have permission to view this page.</p>
          <button
            onClick={() => loadData()}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  const { summary = {}, stageDistribution = [] } = data || {}
  const { activeDeals = 0, movedThisWeek = 0, stallCount = 0, totalPipelineValue = 0 } = summary

  const pipelineDisplay = fmtValue(totalPipelineValue) || '$0'

  return (
    <AppShell
      title="Stage Analytics"
      subtitle="How deals move through the pipeline"
      actions={
        <button
          onClick={() => loadData(true)}
          disabled={refreshing}
          className="flex items-center gap-1.5 px-3 py-2 text-sm text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          {refreshing ? 'Refreshing…' : 'Refresh'}
        </button>
      }
    >
      <div className="max-w-7xl mx-auto px-6 py-6 space-y-6">

        {/* ── Stats Bar ── */}
        <div className="grid grid-cols-4 gap-4">
          <div className="bg-white rounded-xl shadow-sm border p-5">
            <div className="text-sm text-gray-500 mb-1">Active Deals</div>
            <div className="text-4xl font-bold text-gray-800 tabular-nums">{activeDeals}</div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border p-5">
            <div className="text-sm text-gray-500 mb-1">Moved This Week</div>
            <div className="flex items-center gap-2">
              <span className="text-4xl font-bold text-gray-800 tabular-nums">{movedThisWeek}</span>
              {movedThisWeek > 0 && (
                <span className="w-2.5 h-2.5 rounded-full bg-green-500 shrink-0" />
              )}
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border p-5">
            <div className="text-sm text-gray-500 mb-1">At Risk</div>
            <div className={`text-4xl font-bold tabular-nums ${stallCount > 0 ? 'text-red-600' : 'text-gray-800'}`}>
              {stallCount}
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border p-5">
            <div className="text-sm text-gray-500 mb-1">Pipeline Value</div>
            <div className="text-4xl font-bold text-gray-800">{pipelineDisplay}</div>
          </div>
        </div>

        {/* ── Tab Bar ── */}
        <div className="flex gap-1 border-b border-gray-200">
          {TABS.map((tab, i) => (
            <button
              key={tab}
              onClick={() => setActiveTab(i)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                activeTab === i
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-800 hover:border-gray-300'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* ── Tab Content ── */}
        {activeTab === 0 && <OverviewTab data={data} />}
        {activeTab === 1 && <MovementFeed data={data} router={router} />}
        {activeTab === 2 && <StallRiskTab data={data} router={router} />}

      </div>
    </AppShell>
  )
}
