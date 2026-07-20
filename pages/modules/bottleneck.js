import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import {
  ArrowLeft,
  AlertTriangle,
  RefreshCw,
  TrendingDown,
  CheckCircle2,
  Users,
  Clock,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  BarChart2,
} from 'lucide-react'
import UserMenu from '../../components/auth/UserMenu'
import ModulesNav from '../../components/layout/ModulesNav'
import StageBadge from '../../components/ui/StageBadge'
import { stageHex, stageLabel } from '../../lib/constants'

// ── Helpers ──────────────────────────────────────────────────────────────────

// Abbreviated stage labels for space-constrained table columns
const STAGE_ABBREV = {
  qualifying: 'Qual',
  intro_scheduled: 'Intro',
  active_pursuit: 'Pursuit',
  demo: 'Demo',
  solution_validation: 'Sol Val',
  proposal: 'Prop',
  legal: 'Legal',
}

function conversionRateColor(rate) {
  if (rate === null) return 'text-gray-400'
  if (rate >= 60) return 'text-green-600'
  if (rate >= 40) return 'text-yellow-600'
  return 'text-red-600'
}

function conversionRateBg(rate) {
  if (rate === null) return 'bg-gray-50 border-gray-200'
  if (rate >= 60) return 'bg-green-50 border-green-200'
  if (rate >= 40) return 'bg-yellow-50 border-yellow-200'
  return 'bg-red-50 border-red-200'
}

// ── Skeleton ─────────────────────────────────────────────────────────────────

function SkeletonBlock({ className = '' }) {
  return <div className={`animate-pulse bg-gray-200 rounded ${className}`} />
}

function LoadingSkeleton() {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header skeleton */}
      <div className="bg-white border-b shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <SkeletonBlock className="w-9 h-9 rounded" />
            <div>
              <SkeletonBlock className="w-48 h-7 mb-1" />
              <SkeletonBlock className="w-64 h-4" />
            </div>
          </div>
          <SkeletonBlock className="w-24 h-9 rounded-lg" />
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6 space-y-6">
        {/* Stats bar */}
        <div className="grid grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-white rounded-xl shadow-sm border p-5">
              <SkeletonBlock className="w-24 h-4 mb-2" />
              <SkeletonBlock className="w-16 h-9" />
            </div>
          ))}
        </div>

        {/* Funnel */}
        <div className="bg-white rounded-xl shadow-sm border p-6">
          <SkeletonBlock className="w-48 h-6 mb-5" />
          <div className="space-y-3">
            {[...Array(7)].map((_, i) => (
              <div key={i} className="flex items-center gap-4">
                <SkeletonBlock className="w-32 h-4" />
                <SkeletonBlock className="flex-1 h-10 rounded" />
                <SkeletonBlock className="w-10 h-4" />
              </div>
            ))}
          </div>
        </div>

        {/* Bottom panels */}
        <div className="grid grid-cols-2 gap-6">
          <div className="bg-white rounded-xl shadow-sm border p-5">
            <SkeletonBlock className="w-40 h-5 mb-4" />
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => <SkeletonBlock key={i} className="w-full h-12 rounded" />)}
            </div>
          </div>
          <div className="bg-white rounded-xl shadow-sm border p-5">
            <SkeletonBlock className="w-40 h-5 mb-4" />
            <div className="space-y-2">
              {[...Array(5)].map((_, i) => <SkeletonBlock key={i} className="w-full h-8 rounded" />)}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function BottleneckTracker() {
  const router = useRouter()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [refreshing, setRefreshing] = useState(false)
  const [conversionsExpanded, setConversionsExpanded] = useState(false)

  function loadData(isRefresh = false) {
    if (isRefresh) setRefreshing(true)
    fetch('/api/bottleneck')
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

  const {
    stageCounts = {},
    activeStages = [],
    conversions = [],
    bottleneckStage,
    winRate,
    wonCount,
    lostCount,
    repBreakdown = [],
    stalls = [],
    totalAccounts,
    activeCount,
  } = data || {}

  // Max count across active stages for bar scaling
  const maxCount = Math.max(...activeStages.map(s => stageCounts[s] || 0), 1)

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ── Header ── */}
      <div className="bg-white border-b shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push('/modules')}
              className="p-2 text-gray-500 hover:text-gray-800 hover:bg-gray-100 rounded"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <TrendingDown className="w-6 h-6 text-blue-600" />
                Bottleneck Tracker
              </h1>
              <p className="text-sm text-gray-500">Where deals stall in your pipeline</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push('/modules/pipeline-overview')}
              className="flex items-center gap-1.5 px-3 py-2 text-sm text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg"
            >
              <BarChart2 className="w-4 h-4" />
              Pipeline Overview
            </button>
            <button
              onClick={() => loadData(true)}
              disabled={refreshing}
              className="flex items-center gap-1.5 px-3 py-2 text-sm text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
              {refreshing ? 'Refreshing…' : 'Refresh'}
            </button>
            <ModulesNav router={router} />
            <UserMenu />
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6 space-y-6">

        {/* ── Top Stats Bar ── */}
        <div className="grid grid-cols-4 gap-4">
          {/* Active deals */}
          <div className="bg-white rounded-xl shadow-sm border p-5">
            <div className="text-sm text-gray-500 mb-1">Active Deals</div>
            <div className="text-4xl font-bold text-gray-800">{activeCount ?? 0}</div>
            <div className="text-xs text-gray-400 mt-1">{totalAccounts} total accounts</div>
          </div>

          {/* Win rate */}
          <div className="bg-white rounded-xl shadow-sm border p-5">
            <div className="text-sm text-gray-500 mb-1">Win Rate</div>
            <div className={`text-4xl font-bold ${winRate !== null ? (winRate >= 50 ? 'text-green-600' : winRate >= 30 ? 'text-yellow-600' : 'text-red-600') : 'text-gray-400'}`}>
              {winRate !== null ? `${winRate}%` : '—'}
            </div>
            <div className="text-xs text-gray-400 mt-1">
              {wonCount + lostCount > 0 ? `${wonCount} won · ${lostCount} lost` : 'No closed deals yet'}
            </div>
          </div>

          {/* Bottleneck stage */}
          <div className={`bg-white rounded-xl shadow-sm border p-5 ${bottleneckStage ? 'border-orange-300' : ''}`}>
            <div className="text-sm text-gray-500 mb-1 flex items-center gap-1.5">
              {bottleneckStage && <AlertTriangle className="w-3.5 h-3.5 text-orange-500" />}
              Biggest Bottleneck
            </div>
            <div className={`text-2xl font-bold mt-1 ${bottleneckStage ? 'text-orange-600' : 'text-gray-400'}`}>
              {bottleneckStage ? stageLabel(bottleneckStage) : '—'}
            </div>
            <div className="text-xs text-gray-400 mt-1">
              {bottleneckStage
                ? `${stageCounts[bottleneckStage] || 0} deals · highest drop-off`
                : 'No bottleneck detected'}
            </div>
          </div>

          {/* Stalled deals */}
          <div className={`bg-white rounded-xl shadow-sm border p-5 ${stalls.length > 0 ? 'border-red-300' : ''}`}>
            <div className="text-sm text-gray-500 mb-1 flex items-center gap-1.5">
              {stalls.length > 0 && <Clock className="w-3.5 h-3.5 text-red-500" />}
              Stalled Deals
            </div>
            <div className={`text-4xl font-bold ${stalls.length > 0 ? 'text-red-600' : 'text-green-600'}`}>
              {stalls.length > 0 ? stalls.length : '✓ 0'}
            </div>
            <div className="text-xs text-gray-400 mt-1">Late-stage, 21+ days no update</div>
          </div>
        </div>

        {/* ── Funnel Visualization ── */}
        <div className="bg-white rounded-xl shadow-sm border p-6">
          <h2 className="font-semibold text-gray-800 mb-5 flex items-center gap-2">
            <TrendingDown className="w-4 h-4 text-blue-500" />
            Pipeline Funnel
            <span className="text-xs font-normal text-gray-400 ml-1">Deal counts by stage with conversion rates</span>
          </h2>

          <div className="space-y-1">
            {activeStages.map((stage, idx) => {
              const count = stageCounts[stage] || 0
              const barPct = Math.max((count / maxCount) * 100, count > 0 ? 6 : 0)
              const isBottleneck = stage === bottleneckStage
              const conv = conversions[idx] // conversion FROM this stage to next

              return (
                <div key={stage}>
                  <div
                    className={`flex items-center gap-4 p-2 rounded-lg transition-colors ${isBottleneck ? 'bg-orange-50 border border-orange-200' : 'hover:bg-gray-50'}`}
                  >
                    {/* Stage label */}
                    <div className="w-36 text-sm text-gray-600 text-right shrink-0 flex items-center justify-end gap-1.5">
                      {isBottleneck && (
                        <span className="text-orange-500 text-xs font-semibold">Bottleneck</span>
                      )}
                      <span className={isBottleneck ? 'font-semibold text-orange-700' : ''}>
                        {stageLabel(stage)}
                      </span>
                    </div>

                    {/* Bar */}
                    <div className="flex-1 h-10 bg-gray-100 rounded-lg overflow-hidden relative">
                      <div
                        className={`h-full rounded-lg flex items-center px-3 text-white text-sm font-bold transition-all ${isBottleneck ? 'bg-orange-500' : ''}`}
                        style={{
                          width: `${barPct}%`,
                          minWidth: count > 0 ? '2.5rem' : '0',
                          ...(isBottleneck ? {} : { backgroundColor: stageHex(stage) }),
                        }}
                      >
                        {count > 0 && count}
                      </div>
                      {count === 0 && (
                        <span className="absolute inset-0 flex items-center px-3 text-xs text-gray-400">0</span>
                      )}
                    </div>

                    {/* Count */}
                    <div className="w-10 text-sm font-bold text-gray-700 shrink-0 text-center">{count}</div>
                  </div>

                  {/* Conversion arrow between stages */}
                  {conv && (
                    <div className="flex items-center gap-4 py-0.5 ml-40 pl-4">
                      <div className="flex-1 flex items-center gap-2">
                        <div className="h-px flex-1 border-t border-dashed border-gray-200" />
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${conversionRateBg(conv.rate)} ${conversionRateColor(conv.rate)}`}>
                          {conv.rate !== null ? `${conv.rate}% continue` : 'no data'} →
                        </span>
                        <div className="h-px flex-1 border-t border-dashed border-gray-200" />
                      </div>
                      <div className="w-10" />
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* Legend */}
          <div className="mt-5 pt-4 border-t flex items-center gap-6 text-xs text-gray-500">
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded bg-orange-500" />
              <span>Bottleneck stage</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-green-600 font-medium">Green rate</span>
              <span>= &gt;60% continue</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-yellow-600 font-medium">Yellow rate</span>
              <span>= 40-60% continue</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-red-600 font-medium">Red rate</span>
              <span>= &lt;40% continue</span>
            </div>
          </div>
        </div>

        {/* ── Stalled Deals + Conversion Details ── */}
        <div className="grid grid-cols-2 gap-6">
          {/* Stalled deals alert panel */}
          <div className="bg-white rounded-xl shadow-sm border">
            <div className="flex items-center justify-between px-5 py-4 border-b">
              <h2 className="font-semibold text-gray-800 flex items-center gap-2">
                <Clock className="w-4 h-4 text-red-500" />
                Stalled in Late Stages
              </h2>
              {stalls.length > 0 && (
                <span className="text-xs font-semibold text-white bg-red-500 rounded-full px-2.5 py-0.5">
                  {stalls.length}
                </span>
              )}
            </div>

            {stalls.length === 0 ? (
              <div className="p-5 flex items-center gap-2 text-green-600 text-sm">
                <CheckCircle2 className="w-4 h-4" />
                No stalled deals — all late-stage accounts updated within 21 days.
              </div>
            ) : (
              <div className="divide-y">
                {stalls.map(stall => (
                  <div
                    key={stall.id}
                    className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-gray-50 cursor-pointer group"
                    onClick={() => router.push(`/modules/account-pipeline?account=${stall.id}`)}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-gray-800 truncate group-hover:text-blue-600">
                          {stall.name}
                        </span>
                        <ExternalLink className="w-3 h-3 text-gray-400 shrink-0 opacity-0 group-hover:opacity-100" />
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <StageBadge stage={stall.stage} />
                        {stall.owner_name && (
                          <span className="text-xs text-gray-400">{stall.owner_name}</span>
                        )}
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <div className={`text-sm font-bold ${stall.daysSinceUpdate >= 60 ? 'text-red-600' : stall.daysSinceUpdate >= 30 ? 'text-orange-600' : 'text-yellow-600'}`}>
                        {stall.daysSinceUpdate}d stale
                      </div>
                    </div>
                  </div>
                ))}
                <div className="px-5 py-2 text-xs text-gray-400 bg-gray-50">
                  Showing top {stalls.length} — accounts in Demo, Solution Validation, Proposal, Legal
                </div>
              </div>
            )}
          </div>

          {/* Conversion Details — expandable */}
          <div className="bg-white rounded-xl shadow-sm border">
            <button
              onClick={() => setConversionsExpanded(prev => !prev)}
              className="w-full flex items-center justify-between px-5 py-4 border-b hover:bg-gray-50 text-left"
            >
              <h2 className="font-semibold text-gray-800 flex items-center gap-2">
                <BarChart2 className="w-4 h-4 text-blue-500" />
                Stage-to-Stage Conversion
              </h2>
              {conversionsExpanded
                ? <ChevronDown className="w-4 h-4 text-gray-400" />
                : <ChevronRight className="w-4 h-4 text-gray-400" />
              }
            </button>

            {conversionsExpanded ? (
              <div className="divide-y">
                {conversions.map((conv, idx) => (
                  <div key={idx} className="px-5 py-3 flex items-center gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-gray-700">
                        <span className="font-medium">{stageLabel(conv.from)}</span>
                        <span className="text-gray-400 mx-1.5">→</span>
                        <span className="font-medium">{stageLabel(conv.to)}</span>
                      </div>
                      <div className="text-xs text-gray-400 mt-0.5">
                        {conv.fromCount} → {conv.toCount} deals
                      </div>
                    </div>
                    <div className={`text-sm font-bold px-3 py-1 rounded-full border ${conversionRateBg(conv.rate)} ${conversionRateColor(conv.rate)}`}>
                      {conv.rate !== null ? `${conv.rate}%` : '—'}
                    </div>
                  </div>
                ))}
                {conversions.length === 0 && (
                  <div className="p-5 text-sm text-gray-400">No conversion data available.</div>
                )}
              </div>
            ) : (
              <div className="p-5 text-sm text-gray-500">
                Click to expand conversion rates for each stage transition.
              </div>
            )}
          </div>
        </div>

        {/* ── Per-Rep Breakdown Table ── */}
        {repBreakdown.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
            <div className="px-5 py-4 border-b flex items-center gap-2">
              <Users className="w-4 h-4 text-blue-500" />
              <h2 className="font-semibold text-gray-800">Rep Breakdown by Stage</h2>
              <span className="text-xs text-gray-400 ml-1">Cells highlighted in blue have 5+ deals</span>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b">
                    <th className="px-5 py-3 text-left font-semibold text-gray-600 text-xs uppercase tracking-wide w-40">
                      Rep
                    </th>
                    {activeStages.map(s => (
                      <th
                        key={s}
                        className={`px-3 py-3 text-center font-semibold text-xs uppercase tracking-wide ${s === bottleneckStage ? 'text-orange-600 bg-orange-50' : 'text-gray-600'}`}
                      >
                        {STAGE_ABBREV[s] || stageLabel(s)}
                      </th>
                    ))}
                    <th className="px-5 py-3 text-center font-semibold text-gray-700 text-xs uppercase tracking-wide">
                      Total
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {repBreakdown
                    .sort((a, b) => b.total - a.total)
                    .map(rep => (
                      <tr key={rep.name} className="hover:bg-gray-50">
                        <td className="px-5 py-3 font-medium text-gray-800 whitespace-nowrap">
                          {rep.name}
                        </td>
                        {activeStages.map(s => {
                          const count = rep.stages[s] || 0
                          const isBottleneckCol = s === bottleneckStage
                          const isHighlighted = count >= 5
                          return (
                            <td
                              key={s}
                              className={`px-3 py-3 text-center font-medium tabular-nums
                                ${isHighlighted ? 'bg-blue-50 text-blue-700 font-bold' : 'text-gray-600'}
                                ${isBottleneckCol && count > 0 ? 'ring-inset ring-1 ring-orange-200' : ''}
                              `}
                            >
                              {count > 0 ? count : <span className="text-gray-300">—</span>}
                            </td>
                          )
                        })}
                        <td className="px-5 py-3 text-center font-bold text-gray-800">
                          {rep.total}
                        </td>
                      </tr>
                    ))
                  }
                </tbody>
                {/* Totals row */}
                <tfoot>
                  <tr className="bg-gray-50 border-t-2 border-gray-200">
                    <td className="px-5 py-3 font-bold text-gray-700 text-xs uppercase tracking-wide">
                      Team Total
                    </td>
                    {activeStages.map(s => (
                      <td key={s} className={`px-3 py-3 text-center font-bold text-gray-800 ${s === bottleneckStage ? 'bg-orange-50 text-orange-700' : ''}`}>
                        {stageCounts[s] || 0}
                      </td>
                    ))}
                    <td className="px-5 py-3 text-center font-bold text-blue-700">
                      {activeCount}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        )}

        {repBreakdown.length === 0 && (
          <div className="bg-white rounded-xl shadow-sm border p-6 text-center text-gray-400 text-sm">
            No rep data available. Accounts may not have owner names assigned.
          </div>
        )}
      </div>
    </div>
  )
}
