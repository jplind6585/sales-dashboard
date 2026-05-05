import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import { TrendingUp, TrendingDown, Minus, Users, BarChart2, Shield } from 'lucide-react'

const CATEGORY_COLORS = {
  pricing: 'bg-red-100 text-red-700', timeline: 'bg-orange-100 text-orange-700',
  technical: 'bg-blue-100 text-blue-700', authority: 'bg-purple-100 text-purple-700',
  competition: 'bg-yellow-100 text-yellow-800', other: 'bg-gray-100 text-gray-600',
}

function BarRow({ label, count, maxCount, colorClass = 'bg-blue-500', sub }) {
  const pct = maxCount > 0 ? Math.max(4, (count / maxCount) * 100) : 4
  return (
    <div className="flex items-center gap-3 py-1.5">
      <div className="w-48 shrink-0">
        <div className="text-sm text-gray-700 truncate">{label}</div>
        {sub && <div className="text-xs text-gray-400 truncate">{sub}</div>}
      </div>
      <div className="flex-1 bg-gray-100 rounded-full h-2">
        <div className={`${colorClass} h-2 rounded-full`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-sm text-gray-500 w-8 text-right shrink-0">{count}</span>
    </div>
  )
}

function KPICard({ label, value, sub, valueColor = 'text-gray-900' }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 flex flex-col gap-1">
      <p className="text-xs text-gray-400 uppercase tracking-wide font-semibold">{label}</p>
      <p className={`text-2xl font-bold leading-tight ${valueColor}`}>{value}</p>
      {sub && <p className="text-xs text-gray-400 leading-tight">{sub}</p>}
    </div>
  )
}

export default function ShareCallIntelligence() {
  const router = useRouter()
  const { t: token } = router.query

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [aggregate, setAggregate] = useState(null)
  const [callCount, setCallCount] = useState(null)
  const [computedAt, setComputedAt] = useState(null)

  useEffect(() => {
    if (!token) return
    fetch(`/api/gong/intel-share?t=${token}`)
      .then(r => r.json())
      .then(d => {
        if (!d.success) throw new Error(d.error || 'Could not load report')
        setAggregate(d.aggregate)
        setCallCount(d.callCount)
        setComputedAt(d.computedAt)
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [token])

  if (!token && !loading) return null

  if (loading) return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-green-50 flex items-center justify-center">
      <div className="text-gray-400 text-sm">Loading report…</div>
    </div>
  )

  if (error) return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-green-50 flex items-center justify-center">
      <div className="text-center">
        <p className="text-gray-600 font-medium mb-2">This link is invalid or has expired.</p>
        <p className="text-gray-400 text-sm">{error}</p>
      </div>
    </div>
  )

  const a = aggregate || {}
  const sentBreakdown = a.sentiment_breakdown || {}
  const totalSent = (sentBreakdown.positive || 0) + (sentBreakdown.neutral || 0) + (sentBreakdown.negative || 0)
  const positivePct = totalSent > 0 ? Math.round((sentBreakdown.positive || 0) / totalSent * 100) : null
  const topCompetitor = a.competitor_mentions?.[0]
  const computedDate = computedAt ? new Date(computedAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : null

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-green-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-5xl mx-auto px-6 py-5 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <div className="w-7 h-7 bg-gradient-to-br from-green-500 to-emerald-600 rounded-lg flex items-center justify-center">
                <BarChart2 className="w-4 h-4 text-white" />
              </div>
              <span className="font-bold text-gray-900 text-lg">Banner</span>
            </div>
            <p className="text-sm text-gray-500">Call Intelligence Report · {callCount ? `${callCount} calls` : ''}{computedDate ? ` · As of ${computedDate}` : ''}</p>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-gray-400 bg-gray-50 px-3 py-1.5 rounded-full border">
            <Shield className="w-3 h-3" /> Confidential — internal use only
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-8 space-y-6">

        {/* Executive summary */}
        {a.executive_summary && (
          <div className="bg-gradient-to-r from-gray-900 to-gray-700 rounded-xl p-6 text-white">
            <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-2">Key Finding</p>
            <p className="text-lg font-medium leading-snug">{a.executive_summary}</p>
          </div>
        )}

        {/* Investor narrative */}
        {a.investor_narrative && (
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-3">Pipeline Health Summary</p>
            <p className="text-gray-700 leading-relaxed">{a.investor_narrative}</p>
          </div>
        )}

        {/* KPI row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <KPICard label="Calls Analyzed" value={callCount || '—'} />
          <KPICard label="Positive Sentiment"
            value={positivePct !== null ? `${positivePct}%` : '—'}
            sub={`${sentBreakdown.neutral || 0} neutral · ${sentBreakdown.negative || 0} negative`}
            valueColor={positivePct >= 60 ? 'text-green-600' : positivePct >= 40 ? 'text-amber-600' : 'text-red-600'} />
          <KPICard label="Avg ICP Fit"
            value={a.avg_icp_score ? `${a.avg_icp_score}/10` : '—'}
            sub={a.avg_icp_score >= 7 ? 'Strong pipeline fit' : a.avg_icp_score >= 5 ? 'Mixed fit' : null}
            valueColor={a.avg_icp_score >= 7 ? 'text-green-600' : a.avg_icp_score >= 5 ? 'text-amber-600' : 'text-gray-900'} />
          <KPICard label="Top Competitor" value={topCompetitor?.name || 'None'}
            sub={topCompetitor ? `${topCompetitor.count} mentions` : 'No competitors mentioned'} />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* What buyers care about */}
          {a.buyer_priorities?.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-4 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-green-500" /> What Buyers Care About
              </h3>
              <div className="space-y-0.5">
                {a.buyer_priorities.slice(0, 6).map((bp, i) => (
                  <BarRow key={i}
                    label={typeof bp === 'string' ? bp : (bp.priority || bp.theme || bp)}
                    count={bp.count || (6 - i)}
                    maxCount={a.buyer_priorities[0].count || 6}
                    colorClass="bg-green-500"
                    sub={typeof bp === 'object' && bp.example ? `"${bp.example.slice(0, 50)}…"` : null}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Top objections */}
          {a.top_objections?.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-4 flex items-center gap-2">
                <Minus className="w-4 h-4 text-amber-500" /> Top Objections
              </h3>
              <div className="space-y-0.5">
                {a.top_objections.slice(0, 6).map((obj, i) => (
                  <BarRow key={i}
                    label={obj.text}
                    count={obj.count}
                    maxCount={a.top_objections[0].count}
                    colorClass="bg-amber-400"
                    sub={obj.category ? (
                      <span className={`inline-flex px-1.5 py-0.5 rounded text-xs font-medium ${CATEGORY_COLORS[obj.category] || CATEGORY_COLORS.other}`}>{obj.category}</span>
                    ) : null}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Loss reasons */}
          {a.loss_reasons?.length > 0 && (
            <div className="bg-white rounded-xl border border-red-100 p-6">
              <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-4 flex items-center gap-2">
                <TrendingDown className="w-4 h-4 text-red-500" /> Why Deals Go Cold
              </h3>
              <div className="space-y-0.5">
                {a.loss_reasons.slice(0, 5).map((lr, i) => (
                  <BarRow key={i}
                    label={lr.reason}
                    count={`${lr.pct_of_negative_calls || 0}%`}
                    maxCount={a.loss_reasons[0].pct_of_negative_calls || 100}
                    colorClass="bg-red-400"
                    sub={lr.example}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Rep performance */}
          {a.rep_stats?.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-4 flex items-center gap-2">
                <Users className="w-4 h-4 text-blue-500" /> Rep Performance
              </h3>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    {['Rep', 'Calls', 'ICP', 'Discovery', 'Positive %'].map(h => (
                      <th key={h} className="text-left pb-2 text-xs text-gray-400 font-semibold uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {a.rep_stats.map((rep, i) => (
                    <tr key={i} className="border-b border-gray-50">
                      <td className="py-2 font-medium text-gray-800">{rep.rep}</td>
                      <td className="py-2 text-gray-600">{rep.call_count}</td>
                      <td className="py-2 text-gray-600">{rep.avg_icp_score ? `${rep.avg_icp_score}/10` : '—'}</td>
                      <td className="py-2 text-gray-600">{rep.avg_discovery_score ? `${rep.avg_discovery_score}/10` : '—'}</td>
                      <td className={`py-2 font-medium ${rep.positive_pct >= 60 ? 'text-green-600' : 'text-amber-600'}`}>
                        {rep.positive_pct != null ? `${rep.positive_pct}%` : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Key insights */}
        {a.key_insights?.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-4">Key Insights</h3>
            <div className="space-y-3">
              {a.key_insights.map((insight, i) => (
                <div key={i} className="flex gap-3">
                  <span className="w-6 h-6 rounded-full bg-green-100 text-green-700 text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">{i + 1}</span>
                  <p className="text-sm text-gray-700 leading-relaxed">{insight}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        <p className="text-center text-xs text-gray-300 pb-4">Powered by Banner · Call Intelligence</p>
      </div>
    </div>
  )
}
