import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/router'
import ReactMarkdown from 'react-markdown'
import {
  ArrowLeft, RefreshCw, Download, MessageCircle, X, ExternalLink,
  Sparkles, Send, Phone, TrendingUp, TrendingDown, Minus,
  ChevronRight, AlertCircle, CheckCircle, Zap, Users,
} from 'lucide-react'
import UserMenu from '../../../components/auth/UserMenu'
import { useAuthStore } from '../../../stores/useAuthStore'

// ─── Small helper components ──────────────────────────────────────────────────

function SentimentBadge({ sentiment }) {
  const cfg = {
    positive: { cls: 'bg-green-100 text-green-700', icon: <TrendingUp className="w-3 h-3" />, label: 'Positive' },
    neutral:  { cls: 'bg-gray-100 text-gray-600',   icon: <Minus className="w-3 h-3" />,        label: 'Neutral' },
    negative: { cls: 'bg-red-100 text-red-700',     icon: <TrendingDown className="w-3 h-3" />, label: 'Negative' },
  }[sentiment] || { cls: 'bg-gray-100 text-gray-500', icon: null, label: sentiment || '—' }
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${cfg.cls}`}>
      {cfg.icon}{cfg.label}
    </span>
  )
}

function TypeBadge({ type }) {
  const cfg = {
    intro: 'bg-teal-100 text-teal-700',
    demo:  'bg-indigo-100 text-indigo-700',
  }[type] || 'bg-gray-100 text-gray-600'
  return <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${cfg}`}>{type || '—'}</span>
}

const CATEGORY_COLORS = {
  pricing:     'bg-red-100 text-red-700',
  timeline:    'bg-orange-100 text-orange-700',
  technical:   'bg-blue-100 text-blue-700',
  authority:   'bg-purple-100 text-purple-700',
  competition: 'bg-yellow-100 text-yellow-800',
  other:       'bg-gray-100 text-gray-600',
}

function CategoryBadge({ category }) {
  const cls = CATEGORY_COLORS[category] || CATEGORY_COLORS.other
  return <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${cls}`}>{category}</span>
}

function BarRow({ label, count, maxCount, colorClass = 'bg-blue-500', badge }) {
  const pct = maxCount > 0 ? Math.max(4, (count / maxCount) * 100) : 4
  return (
    <div className="flex items-center gap-3 py-1.5">
      <div className="w-40 text-sm text-gray-700 truncate shrink-0">{label}</div>
      <div className="flex-1 bg-gray-100 rounded-full h-2">
        <div className={`${colorClass} h-2 rounded-full`} style={{ width: `${pct}%` }} />
      </div>
      {badge && <div className="shrink-0">{badge}</div>}
      <span className="text-sm text-gray-500 w-5 text-right shrink-0">{count}</span>
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

function TalkRatioBar({ ratio }) {
  const rep = Math.round(ratio || 50)
  const prospect = 100 - rep
  const repColor = rep < 40 ? 'bg-blue-400' : rep <= 55 ? 'bg-green-500' : 'bg-amber-500'
  return (
    <div>
      <div className="flex text-xs text-gray-500 mb-1 justify-between">
        <span>Rep {rep}%</span><span>Prospect {prospect}%</span>
      </div>
      <div className="flex h-2 rounded-full overflow-hidden bg-gray-100">
        <div className={`${repColor} transition-all`} style={{ width: `${rep}%` }} />
        <div className="bg-gray-300 flex-1" />
      </div>
    </div>
  )
}

// ─── Main page ─────────────────────────────────────────────────────────────────

export default function CallIntelligence() {
  const router = useRouter()
  const { user } = useAuthStore()

  const [calls, setCalls] = useState([])
  const [aggregate, setAggregate] = useState(null)
  const [loadingCalls, setLoadingCalls] = useState(true)
  const [loadError, setLoadError] = useState(null)

  const [analyzing, setAnalyzing] = useState(false)
  const [analyzeProgress, setAnalyzeProgress] = useState({ done: 0, total: 0, currentTitle: '' })
  const [refreshingAggregate, setRefreshingAggregate] = useState(false)

  const [activeTab, setActiveTab] = useState('overview')
  const [selectedCall, setSelectedCall] = useState(null)
  const [showChat, setShowChat] = useState(false)
  const [chatMessages, setChatMessages] = useState([])
  const [chatInput, setChatInput] = useState('')
  const [chatLoading, setChatLoading] = useState(false)

  const [typeFilter, setTypeFilter] = useState('all')
  const [sortField, setSortField] = useState('date')
  const [sortDir, setSortDir] = useState('desc')

  const chatEndRef = useRef(null)

  useEffect(() => {
    fetchCalls()
    fetchAggregate()
  }, [])

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chatMessages])

  async function fetchCalls() {
    setLoadingCalls(true)
    setLoadError(null)
    try {
      const res = await fetch('/api/gong/intel-calls')
      const data = await res.json()
      if (!data.success) throw new Error(data.error || 'Failed to load calls')
      setCalls(data.calls || [])
    } catch (e) {
      setLoadError(e.message)
    } finally {
      setLoadingCalls(false)
    }
  }

  async function fetchAggregate() {
    try {
      const res = await fetch('/api/gong/intel-aggregate')
      const data = await res.json()
      if (data.success && data.aggregate) setAggregate(data.aggregate)
    } catch { /* silent — aggregate is optional */ }
  }

  async function runAnalysis(limit = null) {
    let unanalyzed = calls.filter(c => !c.analysis)
    if (limit) unanalyzed = unanalyzed.slice(0, limit)
    if (unanalyzed.length === 0 || analyzing) return

    setAnalyzing(true)
    setAnalyzeProgress({ done: 0, total: unanalyzed.length, currentTitle: '' })

    for (const call of unanalyzed) {
      setAnalyzeProgress(p => ({ ...p, currentTitle: call.title }))
      try {
        const res = await fetch('/api/gong/intel-analyze', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            callId: call.gongCallId,
            title: call.title,
            date: call.date,
            callType: call.callType,
            repName: call.repName,
            repEmail: call.repEmail,
            durationSeconds: call.durationSeconds,
            gongUrl: call.gongUrl,
          }),
        })
        const data = await res.json()
        if (data.success) {
          setCalls(prev => prev.map(c =>
            c.gongCallId === call.gongCallId
              ? { ...c, analysis: data.analysis, analyzedAt: new Date().toISOString() }
              : c
          ))
        }
      } catch (e) {
        console.error('Analysis failed for:', call.title, e)
      }
      setAnalyzeProgress(p => ({ ...p, done: p.done + 1 }))
    }

    // Compute aggregate after all calls analyzed
    await refreshAggregate()
    setAnalyzing(false)
  }

  async function refreshAggregate() {
    setRefreshingAggregate(true)
    try {
      const res = await fetch('/api/gong/intel-aggregate', { method: 'POST' })
      const data = await res.json()
      if (data.success && data.aggregate) setAggregate(data.aggregate)
    } catch (e) {
      console.error('Aggregate refresh failed:', e)
    } finally {
      setRefreshingAggregate(false)
    }
  }

  async function sendChat() {
    const msg = chatInput.trim()
    if (!msg || chatLoading) return
    setChatInput('')
    const newMessages = [...chatMessages, { role: 'user', content: msg }]
    setChatMessages(newMessages)
    setChatLoading(true)

    try {
      const res = await fetch('/api/gong/intel-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: msg, messages: chatMessages }),
      })
      const data = await res.json()
      setChatMessages([...newMessages, { role: 'assistant', content: data.reply || 'No response.' }])
    } catch (e) {
      setChatMessages([...newMessages, { role: 'error', content: e.message }])
    } finally {
      setChatLoading(false)
    }
  }

  function exportCSV() {
    const headers = ['Date', 'Rep', 'Type', 'Duration (min)', 'Talk Ratio (%)', 'Sentiment', 'Top Theme', 'Summary', 'Gong URL']
    const rows = filteredCalls.map(c => [
      c.date ? new Date(c.date).toLocaleDateString() : '',
      c.repName || '',
      c.callType || '',
      c.durationSeconds ? Math.round(c.durationSeconds / 60) : '',
      c.analysis?.rep_talk_ratio ?? '',
      c.analysis?.sentiment || '',
      (c.analysis?.themes || [])[0] || '',
      c.analysis?.summary || '',
      c.gongUrl || '',
    ])
    const csv = [headers, ...rows]
      .map(row => row.map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))
      .join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `call-intelligence-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  function toggleSort(field) {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortField(field); setSortDir('desc') }
  }

  // ── Computed values ──────────────────────────────────────────────────────────
  const analyzedCalls = calls.filter(c => c.analysis)
  const unanalyzedCount = calls.filter(c => !c.analysis).length

  const filteredCalls = calls
    .filter(c => typeFilter === 'all' || c.callType === typeFilter)
    .sort((a, b) => {
      let av, bv
      if (sortField === 'date') { av = new Date(a.date || 0); bv = new Date(b.date || 0) }
      else if (sortField === 'rep') { av = (a.repName || '').toLowerCase(); bv = (b.repName || '').toLowerCase() }
      else if (sortField === 'duration') { av = a.durationSeconds || 0; bv = b.durationSeconds || 0 }
      else if (sortField === 'ratio') { av = a.analysis?.rep_talk_ratio || 0; bv = b.analysis?.rep_talk_ratio || 0 }
      else if (sortField === 'sentiment') { av = a.analysis?.sentiment || ''; bv = b.analysis?.sentiment || '' }
      else { av = a[sortField] || ''; bv = b[sortField] || '' }
      return sortDir === 'asc' ? (av > bv ? 1 : -1) : (av < bv ? 1 : -1)
    })

  // KPI values from aggregate
  const topObjection = aggregate?.top_objections?.[0]
  const topCompetitor = aggregate?.competitor_mentions?.[0]
  const sentBreakdown = aggregate?.sentiment_breakdown || {}
  const totalSentiment = (sentBreakdown.positive || 0) + (sentBreakdown.neutral || 0) + (sentBreakdown.negative || 0)
  const positivePct = totalSentiment > 0 ? Math.round((sentBreakdown.positive || 0) / totalSentiment * 100) : null

  const SortArrow = ({ field }) => (
    <span className="ml-1 text-gray-400">
      {sortField === field ? (sortDir === 'asc' ? '↑' : '↓') : '↕'}
    </span>
  )

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-green-50 flex flex-col">

      {/* Header */}
      <div className="bg-white border-b border-gray-200 shadow-sm shrink-0">
        <div className="max-w-[1400px] mx-auto px-6 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-3">
              <button onClick={() => router.push('/modules/sales-reports')} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                <ArrowLeft className="w-5 h-5 text-gray-600" />
              </button>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-400 cursor-pointer hover:text-gray-600" onClick={() => router.push('/modules/sales-reports')}>Sales Reports</span>
                  <ChevronRight className="w-3 h-3 text-gray-300" />
                  <h1 className="text-xl font-bold text-gray-900">Call Intelligence</h1>
                </div>
                <p className="text-xs text-gray-400 mt-0.5">
                  {loadingCalls ? 'Loading…' : `${calls.length} calls · ${analyzedCalls.length} analyzed · Intro & Demo · Last 6 months`}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {analyzedCalls.length > 0 && (
                <button
                  onClick={refreshAggregate}
                  disabled={refreshingAggregate}
                  className="flex items-center gap-1.5 px-3 py-2 text-sm text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors disabled:opacity-50"
                >
                  <RefreshCw className={`w-4 h-4 ${refreshingAggregate ? 'animate-spin' : ''}`} />
                  Refresh Insights
                </button>
              )}
              {analyzedCalls.length > 0 && (
                <button
                  onClick={exportCSV}
                  className="flex items-center gap-1.5 px-3 py-2 text-sm text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                >
                  <Download className="w-4 h-4" />
                  Export CSV
                </button>
              )}
              <button
                onClick={() => setShowChat(c => !c)}
                className={`flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg transition-colors ${
                  showChat
                    ? 'bg-green-600 text-white hover:bg-green-700'
                    : 'bg-gradient-to-r from-green-600 to-emerald-600 text-white hover:from-green-700 hover:to-emerald-700'
                }`}
              >
                <Sparkles className="w-4 h-4" />
                {showChat ? 'Close Chat' : 'AI Chat'}
              </button>
              {user && <UserMenu />}
            </div>
          </div>
        </div>
      </div>

      {/* Analysis progress banner */}
      {analyzing && (
        <div className="bg-amber-50 border-b border-amber-200 px-6 py-3 shrink-0">
          <div className="max-w-[1400px] mx-auto">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2 text-sm text-amber-800">
                <Zap className="w-4 h-4 animate-pulse" />
                <span>Analyzing calls… {analyzeProgress.done}/{analyzeProgress.total}</span>
                {analyzeProgress.currentTitle && (
                  <span className="text-amber-600 truncate max-w-xs">— {analyzeProgress.currentTitle}</span>
                )}
              </div>
              <span className="text-xs text-amber-600">{Math.round((analyzeProgress.done / analyzeProgress.total) * 100)}%</span>
            </div>
            <div className="h-1.5 bg-amber-200 rounded-full">
              <div
                className="h-1.5 bg-amber-500 rounded-full transition-all duration-300"
                style={{ width: `${(analyzeProgress.done / analyzeProgress.total) * 100}%` }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Unanalyzed calls prompt */}
      {!analyzing && !loadingCalls && unanalyzedCount > 0 && (
        <div className="bg-amber-50 border-b border-amber-200 px-6 py-3 shrink-0">
          <div className="max-w-[1400px] mx-auto flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-amber-800">
              <AlertCircle className="w-4 h-4" />
              <span>{unanalyzedCount} call{unanalyzedCount > 1 ? 's' : ''} haven't been analyzed yet</span>
            </div>
            <div className="flex items-center gap-2">
              {unanalyzedCount > 20 && (
                <button
                  onClick={() => runAnalysis(20)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-amber-400 text-amber-700 text-sm font-medium rounded-lg hover:bg-amber-50 transition-colors"
                >
                  <Zap className="w-3.5 h-3.5" />
                  Analyze 20 Most Recent
                </button>
              )}
              <button
                onClick={() => runAnalysis()}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 text-white text-sm font-medium rounded-lg hover:bg-amber-600 transition-colors"
              >
                <Zap className="w-3.5 h-3.5" />
                Analyze All ({unanalyzedCount})
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Error banner */}
      {loadError && (
        <div className="bg-red-50 border-b border-red-200 px-6 py-3 shrink-0">
          <div className="max-w-[1400px] mx-auto flex items-center justify-between">
            <span className="text-sm text-red-700">{loadError}</span>
            <button onClick={fetchCalls} className="text-sm text-red-600 underline">Retry</button>
          </div>
        </div>
      )}

      {/* Main content */}
      <div className="max-w-[1400px] mx-auto px-6 py-6 flex-1 w-full">

        {/* Loading skeleton */}
        {loadingCalls && (
          <div className="space-y-6 animate-pulse">
            <div className="grid grid-cols-5 gap-4">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="bg-white rounded-xl border border-gray-200 h-24" />
              ))}
            </div>
            <div className="bg-white rounded-xl border border-gray-200 h-64" />
          </div>
        )}

        {!loadingCalls && (
          <>
            {/* KPI row */}
            {aggregate && (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-6">
                <KPICard
                  label="Calls Analyzed"
                  value={analyzedCalls.length}
                  sub={`${calls.filter(c => c.callType === 'intro').length} intro · ${calls.filter(c => c.callType === 'demo').length} demo`}
                />
                <KPICard
                  label="Positive Sentiment"
                  value={positivePct !== null ? `${positivePct}%` : '—'}
                  sub={`${sentBreakdown.neutral || 0} neutral · ${sentBreakdown.negative || 0} negative`}
                  valueColor={positivePct >= 60 ? 'text-green-600' : positivePct >= 40 ? 'text-amber-600' : 'text-red-600'}
                />
                <KPICard
                  label="Top Objection"
                  value={topObjection?.text ? topObjection.text.split(' ').slice(0, 4).join(' ') + '…' : '—'}
                  sub={topObjection ? `${topObjection.count}x · ${topObjection.category}` : null}
                  valueColor="text-gray-800"
                />
                <KPICard
                  label="Avg Talk Ratio"
                  value={aggregate.avg_rep_talk_ratio ? `${aggregate.avg_rep_talk_ratio}% rep` : '—'}
                  sub={aggregate.avg_rep_talk_ratio
                    ? (aggregate.avg_rep_talk_ratio <= 55 ? 'Good range' : 'Rep talking too much')
                    : null}
                  valueColor={aggregate.avg_rep_talk_ratio <= 55 ? 'text-green-600' : 'text-amber-600'}
                />
                <KPICard
                  label="Top Competitor"
                  value={topCompetitor?.name || 'None'}
                  sub={topCompetitor ? `${topCompetitor.count} mention${topCompetitor.count > 1 ? 's' : ''}` : 'No competitors mentioned'}
                />
              </div>
            )}

            {/* Empty state — no aggregate yet */}
            {!aggregate && analyzedCalls.length === 0 && calls.length > 0 && (
              <div className="bg-white rounded-xl border border-gray-200 p-12 text-center mb-6">
                <Phone className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-700 mb-2">
                  {calls.length} calls found, none analyzed yet
                </h3>
                <p className="text-gray-500 text-sm mb-6">
                  Click "Analyze {unanalyzedCount} Calls" above to run AI analysis on each call.
                  This takes 1–3 minutes depending on call count.
                </p>
              </div>
            )}

            {calls.length === 0 && (
              <div className="bg-white rounded-xl border border-gray-200 p-12 text-center mb-6">
                <Phone className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-700 mb-2">No Intro or Demo calls found</h3>
                <p className="text-gray-500 text-sm">
                  No calls with "Intro" or "Demo" in the title were found in Gong in the last 6 months.
                </p>
              </div>
            )}

            {/* Content area */}
            {calls.length > 0 && (
              <div className="flex gap-6">

                {/* Left — tabs */}
                <div className="flex-1 min-w-0">

                  {/* Tab bar */}
                  <div className="flex gap-0 border-b border-gray-200 mb-6">
                    {[
                      { id: 'overview', label: 'Overview', disabled: !aggregate },
                      { id: 'calls', label: `All Calls (${calls.length})`, disabled: false },
                    ].map(tab => (
                      <button
                        key={tab.id}
                        onClick={() => !tab.disabled && setActiveTab(tab.id)}
                        disabled={tab.disabled}
                        className={`px-5 py-3 text-sm font-medium border-b-2 transition-colors ${
                          activeTab === tab.id
                            ? 'border-green-600 text-green-600'
                            : tab.disabled
                            ? 'border-transparent text-gray-300 cursor-not-allowed'
                            : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                        }`}
                      >
                        {tab.label}
                        {tab.disabled && <span className="ml-1.5 text-xs">(analyze first)</span>}
                      </button>
                    ))}
                  </div>

                  {/* Overview tab */}
                  {activeTab === 'overview' && aggregate && (
                    <div className="space-y-6">

                      {/* Investor narrative */}
                      {aggregate.investor_narrative && (
                        <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-xl p-6">
                          <h3 className="text-sm font-semibold text-green-800 uppercase tracking-wide mb-3 flex items-center gap-2">
                            <TrendingUp className="w-4 h-4" /> Summary Narrative
                          </h3>
                          <p className="text-gray-700 leading-relaxed">{aggregate.investor_narrative}</p>
                        </div>
                      )}

                      {/* Key insights */}
                      {aggregate.key_insights?.length > 0 && (
                        <div className="bg-white rounded-xl border border-gray-200 p-6">
                          <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-4">Key Insights</h3>
                          <ul className="space-y-3">
                            {aggregate.key_insights.map((insight, i) => (
                              <li key={i} className="flex items-start gap-3">
                                <span className="w-5 h-5 rounded-full bg-green-100 text-green-700 text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">{i + 1}</span>
                                <span className="text-sm text-gray-700">{insight}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Objections + Themes side by side */}
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

                        {/* Top Objections */}
                        {aggregate.top_objections?.length > 0 && (
                          <div className="bg-white rounded-xl border border-gray-200 p-6">
                            <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-4">Top Objections</h3>
                            <div className="space-y-1">
                              {aggregate.top_objections.map((obj, i) => (
                                <BarRow
                                  key={i}
                                  label={obj.text}
                                  count={obj.count}
                                  maxCount={aggregate.top_objections[0].count}
                                  colorClass={CATEGORY_COLORS[obj.category]?.split(' ')[0]?.replace('bg-', 'bg-') || 'bg-red-400'}
                                  badge={<CategoryBadge category={obj.category} />}
                                />
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Top Themes */}
                        {aggregate.top_themes?.length > 0 && (
                          <div className="bg-white rounded-xl border border-gray-200 p-6">
                            <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-4">Top Themes</h3>
                            <div className="space-y-1">
                              {aggregate.top_themes.slice(0, 8).map((t, i) => (
                                <BarRow
                                  key={i}
                                  label={t.theme}
                                  count={t.count}
                                  maxCount={aggregate.top_themes[0].count}
                                  colorClass="bg-blue-500"
                                />
                              ))}
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Win / Loss patterns + Competitors */}
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

                        {/* Win / Loss */}
                        {(aggregate.win_patterns?.length > 0 || aggregate.loss_patterns?.length > 0) && (
                          <div className="bg-white rounded-xl border border-gray-200 p-6">
                            <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-4">Win / Loss Patterns</h3>
                            {aggregate.win_patterns?.length > 0 && (
                              <div className="mb-4">
                                <p className="text-xs font-semibold text-green-700 uppercase tracking-wide mb-2 flex items-center gap-1">
                                  <CheckCircle className="w-3.5 h-3.5" /> Positive calls
                                </p>
                                <ul className="space-y-1.5">
                                  {aggregate.win_patterns.map((p, i) => (
                                    <li key={i} className="text-sm text-gray-600 flex items-start gap-2">
                                      <span className="text-green-500 mt-0.5">•</span>{p}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}
                            {aggregate.loss_patterns?.length > 0 && (
                              <div>
                                <p className="text-xs font-semibold text-red-600 uppercase tracking-wide mb-2 flex items-center gap-1">
                                  <AlertCircle className="w-3.5 h-3.5" /> Negative calls
                                </p>
                                <ul className="space-y-1.5">
                                  {aggregate.loss_patterns.map((p, i) => (
                                    <li key={i} className="text-sm text-gray-600 flex items-start gap-2">
                                      <span className="text-red-400 mt-0.5">•</span>{p}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Competitors */}
                        {aggregate.competitor_mentions?.length > 0 && (
                          <div className="bg-white rounded-xl border border-gray-200 p-6">
                            <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-4">Competitor Mentions</h3>
                            <div className="space-y-3">
                              {aggregate.competitor_mentions.map((c, i) => (
                                <div key={i} className="flex items-start gap-3">
                                  <div className="w-7 h-7 rounded-full bg-yellow-100 text-yellow-800 text-xs font-bold flex items-center justify-center shrink-0">{c.count}</div>
                                  <div>
                                    <p className="text-sm font-semibold text-gray-800">{c.name}</p>
                                    {c.typical_context && <p className="text-xs text-gray-500 mt-0.5">{c.typical_context}</p>}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Rep performance */}
                      {aggregate.rep_stats?.length > 0 && (
                        <div className="bg-white rounded-xl border border-gray-200 p-6">
                          <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-4 flex items-center gap-2">
                            <Users className="w-4 h-4" /> Rep Performance
                          </h3>
                          <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                              <thead>
                                <tr className="border-b border-gray-100">
                                  <th className="text-left py-2 text-xs text-gray-400 font-semibold uppercase tracking-wide">Rep</th>
                                  <th className="text-right py-2 text-xs text-gray-400 font-semibold uppercase tracking-wide">Calls</th>
                                  <th className="text-right py-2 text-xs text-gray-400 font-semibold uppercase tracking-wide">Talk Ratio</th>
                                  <th className="text-right py-2 text-xs text-gray-400 font-semibold uppercase tracking-wide">Positive %</th>
                                  <th className="text-left py-2 text-xs text-gray-400 font-semibold uppercase tracking-wide pl-4">Top Objection</th>
                                </tr>
                              </thead>
                              <tbody>
                                {aggregate.rep_stats.map((rep, i) => (
                                  <tr key={i} className="border-b border-gray-50 hover:bg-gray-50">
                                    <td className="py-3 font-medium text-gray-800">{rep.rep}</td>
                                    <td className="py-3 text-right text-gray-600">{rep.call_count}</td>
                                    <td className={`py-3 text-right font-medium ${(rep.avg_talk_ratio || 50) <= 55 ? 'text-green-600' : 'text-amber-600'}`}>
                                      {rep.avg_talk_ratio ? `${rep.avg_talk_ratio}%` : '—'}
                                    </td>
                                    <td className={`py-3 text-right font-medium ${(rep.positive_pct || 0) >= 60 ? 'text-green-600' : (rep.positive_pct || 0) >= 40 ? 'text-amber-600' : 'text-red-600'}`}>
                                      {rep.positive_pct !== undefined ? `${rep.positive_pct}%` : '—'}
                                    </td>
                                    <td className="py-3 text-gray-500 text-xs pl-4">{rep.top_objection || '—'}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Calls tab */}
                  {activeTab === 'calls' && (
                    <div className="bg-white rounded-xl border border-gray-200">
                      {/* Filter + export bar */}
                      <div className="flex items-center justify-between p-4 border-b border-gray-100">
                        <div className="flex items-center gap-2">
                          {['all', 'intro', 'demo'].map(t => (
                            <button
                              key={t}
                              onClick={() => setTypeFilter(t)}
                              className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                                typeFilter === t
                                  ? 'bg-green-600 text-white'
                                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                              }`}
                            >
                              {t === 'all' ? 'All Calls' : t.charAt(0).toUpperCase() + t.slice(1)}
                            </button>
                          ))}
                        </div>
                        <button onClick={exportCSV} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 transition-colors">
                          <Download className="w-4 h-4" /> Export CSV
                        </button>
                      </div>

                      {/* Table */}
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-gray-100 bg-gray-50">
                              {[
                                { label: 'Date', field: 'date' },
                                { label: 'Title', field: null },
                                { label: 'Rep', field: 'rep' },
                                { label: 'Type', field: null },
                                { label: 'Duration', field: 'duration' },
                                { label: 'Talk Ratio', field: 'ratio' },
                                { label: 'Sentiment', field: 'sentiment' },
                                { label: 'Top Theme', field: null },
                              ].map(col => (
                                <th
                                  key={col.label}
                                  onClick={() => col.field && toggleSort(col.field)}
                                  className={`text-left px-4 py-3 text-xs text-gray-400 font-semibold uppercase tracking-wide whitespace-nowrap ${col.field ? 'cursor-pointer hover:text-gray-600' : ''}`}
                                >
                                  {col.label}{col.field && <SortArrow field={col.field} />}
                                </th>
                              ))}
                              <th className="px-4 py-3 text-xs text-gray-400 font-semibold uppercase tracking-wide text-right">Gong</th>
                            </tr>
                          </thead>
                          <tbody>
                            {filteredCalls.map(call => (
                              <tr
                                key={call.gongCallId}
                                onClick={() => setSelectedCall(call)}
                                className="border-b border-gray-50 hover:bg-green-50 cursor-pointer transition-colors"
                              >
                                <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                                  {call.date ? new Date(call.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—'}
                                </td>
                                <td className="px-4 py-3 font-medium text-gray-800 max-w-[220px] truncate">{call.title}</td>
                                <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{call.repName || '—'}</td>
                                <td className="px-4 py-3"><TypeBadge type={call.callType} /></td>
                                <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                                  {call.durationSeconds ? `${Math.round(call.durationSeconds / 60)}m` : '—'}
                                </td>
                                <td className="px-4 py-3 whitespace-nowrap">
                                  {call.analysis?.rep_talk_ratio != null
                                    ? <span className={`font-medium ${call.analysis.rep_talk_ratio <= 55 ? 'text-green-600' : 'text-amber-600'}`}>{call.analysis.rep_talk_ratio}%</span>
                                    : <span className="text-gray-300">—</span>}
                                </td>
                                <td className="px-4 py-3">
                                  {call.analysis?.sentiment
                                    ? <SentimentBadge sentiment={call.analysis.sentiment} />
                                    : <span className="text-gray-300 text-xs">Unanalyzed</span>}
                                </td>
                                <td className="px-4 py-3 text-gray-500 text-xs max-w-[140px] truncate">
                                  {call.analysis?.themes?.[0] || '—'}
                                </td>
                                <td className="px-4 py-3 text-right">
                                  {call.gongUrl && (
                                    <a
                                      href={call.gongUrl}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      onClick={e => e.stopPropagation()}
                                      className="text-gray-400 hover:text-green-600 transition-colors"
                                    >
                                      <ExternalLink className="w-4 h-4" />
                                    </a>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>

                        {filteredCalls.length === 0 && (
                          <div className="text-center py-12 text-gray-400 text-sm">No calls match the current filter.</div>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Chat panel */}
                {showChat && (
                  <div className="w-96 shrink-0 flex flex-col bg-white rounded-xl border border-gray-200 overflow-hidden" style={{ maxHeight: 'calc(100vh - 200px)', position: 'sticky', top: '24px' }}>
                    <div className="flex items-center justify-between p-4 border-b bg-gradient-to-r from-green-600 to-emerald-600 text-white">
                      <div className="flex items-center gap-2">
                        <Sparkles className="w-4 h-4" />
                        <div>
                          <p className="text-sm font-semibold">Ask the Data</p>
                          <p className="text-xs text-green-100">{analyzedCalls.length} calls in context</p>
                        </div>
                      </div>
                      <button onClick={() => setShowChat(false)} className="p-1 hover:bg-green-500 rounded transition-colors">
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0">
                      {chatMessages.length === 0 && (
                        <div className="text-center py-4">
                          <Sparkles className="w-10 h-10 text-green-200 mx-auto mb-3" />
                          <p className="text-sm text-gray-500 mb-4">Ask anything about the calls</p>
                          <div className="space-y-2">
                            {[
                              'Where are we losing deals?',
                              'What objections come up most in demos?',
                              'Which rep handles objections best?',
                              'Write an investor update on our sales process',
                            ].map((q, i) => (
                              <button
                                key={i}
                                onClick={() => setChatInput(q)}
                                className="block w-full text-left text-sm px-3 py-2 bg-gray-50 hover:bg-green-50 rounded-lg text-gray-600 hover:text-green-700 transition-colors border border-transparent hover:border-green-200"
                              >
                                {q}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {chatMessages.map((msg, i) => (
                        <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                          <div className={`max-w-[90%] rounded-xl px-4 py-3 text-sm ${
                            msg.role === 'user'
                              ? 'bg-green-600 text-white'
                              : msg.role === 'error'
                              ? 'bg-red-50 text-red-700 border border-red-200'
                              : 'bg-gray-100 text-gray-800'
                          }`}>
                            {msg.role === 'assistant'
                              ? <div className="prose prose-sm max-w-none text-gray-800 prose-p:my-1 prose-ul:my-1 prose-li:my-0.5">
                                  <ReactMarkdown>{msg.content}</ReactMarkdown>
                                </div>
                              : <p className="whitespace-pre-wrap">{msg.content}</p>
                            }
                          </div>
                        </div>
                      ))}

                      {chatLoading && (
                        <div className="flex justify-start">
                          <div className="bg-gray-100 rounded-xl px-4 py-3">
                            <div className="flex gap-1">
                              {[0, 1, 2].map(i => (
                                <div key={i} className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
                              ))}
                            </div>
                          </div>
                        </div>
                      )}
                      <div ref={chatEndRef} />
                    </div>

                    <div className="p-3 border-t">
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={chatInput}
                          onChange={e => setChatInput(e.target.value)}
                          onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendChat()}
                          placeholder="Ask about the calls…"
                          className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                          disabled={chatLoading}
                        />
                        <button
                          onClick={sendChat}
                          disabled={chatLoading || !chatInput.trim()}
                          className="p-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-40 transition-colors"
                        >
                          <Send className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* Call detail drawer */}
      {selectedCall && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-black/30" onClick={() => setSelectedCall(null)} />
          <div className="relative bg-white w-full max-w-xl h-full overflow-y-auto shadow-2xl">
            {/* Drawer header */}
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-start justify-between z-10">
              <div className="flex-1 min-w-0 pr-4">
                <div className="flex items-center gap-2 mb-1">
                  <TypeBadge type={selectedCall.callType} />
                  {selectedCall.analysis?.sentiment && <SentimentBadge sentiment={selectedCall.analysis.sentiment} />}
                </div>
                <h2 className="font-bold text-gray-900 leading-tight">{selectedCall.title}</h2>
                <p className="text-xs text-gray-400 mt-1">
                  {selectedCall.repName} · {selectedCall.date ? new Date(selectedCall.date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : '—'}
                  {selectedCall.durationSeconds ? ` · ${Math.round(selectedCall.durationSeconds / 60)} min` : ''}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {selectedCall.gongUrl && (
                  <a href={selectedCall.gongUrl} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1 px-3 py-1.5 text-sm text-green-600 border border-green-200 rounded-lg hover:bg-green-50 transition-colors">
                    <ExternalLink className="w-3.5 h-3.5" /> View in Gong
                  </a>
                )}
                <button onClick={() => setSelectedCall(null)} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>
            </div>

            {/* No analysis */}
            {!selectedCall.analysis && (
              <div className="px-6 py-12 text-center">
                <AlertCircle className="w-10 h-10 text-amber-400 mx-auto mb-3" />
                <p className="text-gray-600 text-sm">This call hasn't been analyzed yet.</p>
              </div>
            )}

            {/* Analysis content */}
            {selectedCall.analysis && (
              <div className="px-6 py-6 space-y-6">

                {/* Summary */}
                {selectedCall.analysis.summary && (
                  <div>
                    <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Summary</h3>
                    <p className="text-sm text-gray-700 leading-relaxed">{selectedCall.analysis.summary}</p>
                  </div>
                )}

                {/* Talk ratio */}
                <div>
                  <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Talk Ratio</h3>
                  <TalkRatioBar ratio={selectedCall.analysis.rep_talk_ratio} />
                </div>

                {/* Themes */}
                {selectedCall.analysis.themes?.length > 0 && (
                  <div>
                    <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Themes</h3>
                    <div className="flex flex-wrap gap-2">
                      {selectedCall.analysis.themes.map((t, i) => (
                        <span key={i} className="px-2.5 py-1 bg-blue-50 text-blue-700 text-xs rounded-full font-medium">{t}</span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Objections */}
                {selectedCall.analysis.objections?.length > 0 && (
                  <div>
                    <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Objections</h3>
                    <div className="space-y-3">
                      {selectedCall.analysis.objections.map((obj, i) => (
                        <div key={i} className="border border-gray-100 rounded-lg p-3 bg-gray-50">
                          <div className="flex items-center gap-2 mb-1.5">
                            <CategoryBadge category={obj.category} />
                            <p className="text-sm font-medium text-gray-800">{obj.text}</p>
                          </div>
                          {obj.rep_response && (
                            <p className="text-xs text-gray-500">
                              <span className="font-medium text-gray-600">Rep responded: </span>{obj.rep_response}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Buying signals + Red flags */}
                {(selectedCall.analysis.buying_signals?.length > 0 || selectedCall.analysis.red_flags?.length > 0) && (
                  <div className="grid grid-cols-2 gap-4">
                    {selectedCall.analysis.buying_signals?.length > 0 && (
                      <div>
                        <h3 className="text-xs font-semibold text-green-600 uppercase tracking-wide mb-2 flex items-center gap-1">
                          <CheckCircle className="w-3.5 h-3.5" /> Buying Signals
                        </h3>
                        <ul className="space-y-1.5">
                          {selectedCall.analysis.buying_signals.map((s, i) => (
                            <li key={i} className="text-xs text-gray-600 flex items-start gap-1.5">
                              <span className="text-green-500 mt-0.5">•</span>{s}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {selectedCall.analysis.red_flags?.length > 0 && (
                      <div>
                        <h3 className="text-xs font-semibold text-red-600 uppercase tracking-wide mb-2 flex items-center gap-1">
                          <AlertCircle className="w-3.5 h-3.5" /> Red Flags
                        </h3>
                        <ul className="space-y-1.5">
                          {selectedCall.analysis.red_flags.map((f, i) => (
                            <li key={i} className="text-xs text-gray-600 flex items-start gap-1.5">
                              <span className="text-red-400 mt-0.5">•</span>{f}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}

                {/* Next steps */}
                {selectedCall.analysis.next_steps_mentioned?.length > 0 && (
                  <div>
                    <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Next Steps Mentioned</h3>
                    <ul className="space-y-1.5">
                      {selectedCall.analysis.next_steps_mentioned.map((s, i) => (
                        <li key={i} className="text-sm text-gray-600 flex items-start gap-2">
                          <ChevronRight className="w-4 h-4 text-green-500 shrink-0 mt-0.5" />{s}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Competitor mentions */}
                {selectedCall.analysis.competitor_mentions?.length > 0 && (
                  <div>
                    <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Competitor Mentions</h3>
                    <div className="space-y-2">
                      {selectedCall.analysis.competitor_mentions.map((c, i) => (
                        <div key={i} className="flex items-start gap-2 text-sm">
                          <span className="font-medium text-yellow-700">{c.name}</span>
                          <span className="text-gray-500">— {c.context}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
