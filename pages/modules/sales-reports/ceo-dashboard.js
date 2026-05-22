import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import { ArrowLeft, RefreshCw, TrendingUp, Target, AlertTriangle, Award } from 'lucide-react'
import UserMenu from '../../../components/auth/UserMenu'
import { useAuthStore } from '../../../stores/useAuthStore'
import ModulesNav from '../../../components/layout/ModulesNav'

const STAGE_COLORS = {
  qualifying: 'bg-gray-300',
  intro_scheduled: 'bg-blue-300',
  active_pursuit: 'bg-blue-500',
  demo: 'bg-violet-500',
  solution_validation: 'bg-amber-400',
  proposal: 'bg-orange-500',
  legal: 'bg-emerald-500',
}

function fmtDate(d) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function StatCard({ label, value, sub, color = 'text-gray-900', icon: Icon }) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</p>
          <p className={`text-3xl font-bold mt-1 ${color}`}>{value ?? '—'}</p>
          {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
        </div>
        {Icon && <Icon className="w-5 h-5 text-gray-300" />}
      </div>
    </div>
  )
}

export default function CEODashboard() {
  const router = useRouter()
  const profile = useAuthStore(s => s.profile)
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/ceo-dashboard')
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Failed to load')
      setData(json)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const { summary, byStage, topDeals, recentCloses, repBreakdown, winLossInsights } = data || {}

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => router.back()} className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-500">
              <ArrowLeft className="w-4 h-4" />
            </button>
            <ModulesNav router={router} />
            <div>
              <h1 className="text-base font-semibold text-gray-900">CEO Dashboard</h1>
              <p className="text-xs text-gray-400">Pipeline health, win/loss, and rep performance</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={load} disabled={loading} className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400 disabled:opacity-50">
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <UserMenu profile={profile} />
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8 space-y-8">
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">{error}</div>
        )}

        {loading && !data && (
          <div className="text-center py-24 text-sm text-gray-400">Loading dashboard…</div>
        )}

        {data && (
          <>
            {/* Hero stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatCard
                label="Active deals"
                value={summary.activeDeals}
                sub={`${summary.lateStageDeals} in late stage`}
                icon={TrendingUp}
              />
              <StatCard
                label="Pipeline confidence"
                value={`${summary.confidenceScore}%`}
                sub="Weighted win probability"
                color={summary.confidenceScore >= 50 ? 'text-green-600' : summary.confidenceScore >= 30 ? 'text-amber-600' : 'text-red-600'}
                icon={Target}
              />
              <StatCard
                label="Win rate (90 days)"
                value={summary.winRate != null ? `${summary.winRate}%` : '—'}
                sub={`${summary.wonLast90}W / ${summary.lostLast90}L`}
                color={summary.winRate >= 50 ? 'text-green-600' : summary.winRate >= 30 ? 'text-amber-600' : 'text-red-600'}
                icon={Award}
              />
              <StatCard
                label="Stale deals"
                value={summary.staleDeals}
                sub="No activity in 14+ days"
                color={summary.staleDeals > 5 ? 'text-red-600' : summary.staleDeals > 2 ? 'text-amber-600' : 'text-gray-900'}
                icon={AlertTriangle}
              />
            </div>

            {/* Pipeline by stage */}
            <div className="bg-white rounded-xl border p-6">
              <h2 className="text-sm font-semibold text-gray-900 mb-4">Pipeline by stage</h2>
              <div className="flex items-end gap-3 h-28">
                {(byStage || []).map(s => {
                  const maxCount = Math.max(...(byStage || []).map(x => x.count), 1)
                  const heightPct = s.count > 0 ? Math.max((s.count / maxCount) * 100, 8) : 0
                  return (
                    <div key={s.label} className="flex-1 flex flex-col items-center gap-1">
                      <span className="text-xs font-medium text-gray-600">{s.count}</span>
                      <div
                        className={`w-full rounded-t-md ${STAGE_COLORS[Object.keys(STAGE_COLORS).find(k => s.label.toLowerCase().includes(k.replace(/_/g, ' ').toLowerCase().slice(0, 4))) || ''] || 'bg-gray-300'}`}
                        style={{ height: `${heightPct}%`, minHeight: s.count > 0 ? '8px' : '0px' }}
                      />
                      <span className="text-xs text-gray-400 text-center leading-tight" style={{ fontSize: '10px' }}>{s.label}</span>
                    </div>
                  )
                })}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Top deals to watch */}
              <div className="bg-white rounded-xl border p-6">
                <h2 className="text-sm font-semibold text-gray-900 mb-4">Late-stage deals to watch</h2>
                {topDeals?.length === 0 ? (
                  <p className="text-sm text-gray-400">No late-stage active deals.</p>
                ) : (
                  <div className="space-y-3">
                    {(topDeals || []).map(d => (
                      <div key={d.id} className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-gray-900 truncate">{d.name}</span>
                            {d.riskScore >= 60 && (
                              <span className="text-xs bg-red-100 text-red-600 px-1.5 py-0.5 rounded-full shrink-0">at risk</span>
                            )}
                          </div>
                          <div className="text-xs text-gray-400 mt-0.5">
                            {d.stageLabel}
                            {d.ownerName && ` · ${d.ownerName}`}
                            {d.daysSinceLastCall != null && ` · ${d.daysSinceLastCall}d no call`}
                            {d.closeDate && ` · closes ${fmtDate(d.closeDate)}`}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Rep breakdown */}
              <div className="bg-white rounded-xl border p-6">
                <h2 className="text-sm font-semibold text-gray-900 mb-4">Rep pipeline</h2>
                <div className="space-y-2">
                  {(repBreakdown || []).map(r => (
                    <div key={r.name} className="flex items-center gap-3">
                      <span className="text-sm text-gray-700 w-28 truncate shrink-0">{r.name}</span>
                      <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-blue-500 rounded-full"
                          style={{ width: `${Math.min((r.activeDeals / Math.max(...(repBreakdown || []).map(x => x.activeDeals), 1)) * 100, 100)}%` }}
                        />
                      </div>
                      <span className="text-xs text-gray-500 w-16 text-right shrink-0">{r.activeDeals} deals · {r.lateStage} late</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Win/loss debrief insights */}
              {winLossInsights && (winLossInsights.topLostReasons.length > 0 || winLossInsights.topWonFactors.length > 0) && (
                <div className="bg-white rounded-xl border p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-sm font-semibold text-gray-900">Win/Loss insights</h2>
                    <span className="text-xs text-gray-400">{winLossInsights.totalDebriefed} deals debriefed</span>
                  </div>
                  {winLossInsights.topWonFactors.length > 0 && (
                    <div className="mb-4">
                      <p className="text-xs font-medium text-green-700 uppercase tracking-wide mb-2">Why we win</p>
                      <div className="space-y-2">
                        {winLossInsights.topWonFactors.map((f, i) => (
                          <div key={i}>
                            <p className="text-xs text-gray-500 font-medium">{f.account}</p>
                            <p className="text-xs text-gray-600 mt-0.5 line-clamp-2">{f.reason}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {winLossInsights.topLostReasons.length > 0 && (
                    <div>
                      <p className="text-xs font-medium text-red-600 uppercase tracking-wide mb-2">Why we lose</p>
                      <div className="space-y-2">
                        {winLossInsights.topLostReasons.map((r, i) => (
                          <div key={i}>
                            <p className="text-xs text-gray-500 font-medium">{r.account}</p>
                            <p className="text-xs text-gray-600 mt-0.5 line-clamp-2">{r.reason}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {winLossInsights.topCompetitorLosses?.length > 0 && (
                    <div className="mt-4 pt-4 border-t">
                      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Competitors in lost deals</p>
                      <div className="flex flex-wrap gap-2">
                        {winLossInsights.topCompetitorLosses.map(c => (
                          <span key={c.competitor} className="text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded-full">{c.competitor} ({c.count})</span>
                        ))}
                      </div>
                    </div>
                  )}
                  {winLossInsights.totalDebriefed === 0 && (
                    <p className="text-sm text-gray-400">No deals have been debriefed yet. Win/loss insights will appear here as reps complete debriefs.</p>
                  )}
                </div>
              )}

              {/* Recent closes */}
              <div className="bg-white rounded-xl border p-6">
                <h2 className="text-sm font-semibold text-gray-900 mb-4">Recent closes (90 days)</h2>
                {!recentCloses?.length ? (
                  <p className="text-sm text-gray-400">No closes in the last 90 days.</p>
                ) : (
                  <div className="space-y-2.5">
                    {(recentCloses || []).map(c => (
                      <div key={c.id} className="flex items-start gap-2.5">
                        <span className={`mt-0.5 w-2 h-2 rounded-full shrink-0 ${c.stage === 'closed_won' ? 'bg-green-500' : 'bg-red-400'}`} />
                        <div className="flex-1 min-w-0">
                          <span className="text-sm font-medium text-gray-900">{c.name}</span>
                          {c.hasDebrief && (c.wonOn || c.lostOn) && (
                            <p className="text-xs text-gray-400 mt-0.5 line-clamp-1">{c.wonOn || c.lostOn}</p>
                          )}
                          {!c.hasDebrief && (
                            <p className="text-xs text-amber-500 mt-0.5">No debrief captured</p>
                          )}
                        </div>
                        <span className="text-xs text-gray-400 shrink-0">{fmtDate(c.updatedAt)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  )
}
