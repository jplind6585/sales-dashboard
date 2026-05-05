import { useState, useEffect, useRef, useMemo } from 'react'
import { useRouter } from 'next/router'
import ReactMarkdown from 'react-markdown'
import {
  ArrowLeft, RefreshCw, Download, X, ExternalLink,
  Sparkles, Send, Phone, TrendingUp, TrendingDown, Minus,
  ChevronRight, AlertCircle, CheckCircle, Zap, Users,
  EyeOff, Eye, Info, Clock, Mail, Copy,
} from 'lucide-react'
import UserMenu from '../../../components/auth/UserMenu'
import { useAuthStore } from '../../../stores/useAuthStore'

// ─── Small helpers ────────────────────────────────────────────────────────────

function SentimentBadge({ sentiment }) {
  const cfg = {
    positive: { cls: 'bg-green-100 text-green-700', icon: <TrendingUp className="w-3 h-3" />, label: 'Positive' },
    neutral:  { cls: 'bg-gray-100 text-gray-600',   icon: <Minus className="w-3 h-3" />,       label: 'Neutral' },
    negative: { cls: 'bg-red-100 text-red-700',     icon: <TrendingDown className="w-3 h-3" />, label: 'Negative' },
  }[sentiment] || { cls: 'bg-gray-100 text-gray-500', icon: null, label: sentiment || '—' }
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${cfg.cls}`}>
      {cfg.icon}{cfg.label}
    </span>
  )
}

function TypeBadge({ type }) {
  const TYPES = {
    intro: { cls: 'bg-teal-100 text-teal-700', label: 'intro' },
    demo: { cls: 'bg-indigo-100 text-indigo-700', label: 'demo' },
    solution_validation: { cls: 'bg-orange-100 text-orange-700', label: 'follow-up' },
  }
  const cfg = TYPES[type] || { cls: 'bg-gray-100 text-gray-600', label: type || '—' }
  return <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${cfg.cls}`}>{cfg.label}</span>
}

function ScoreBadge({ score, type = 'icp' }) {
  if (score == null) return <span className="text-gray-300 text-xs">—</span>
  const color = score >= 8 ? 'bg-green-100 text-green-700'
    : score >= 5 ? 'bg-amber-100 text-amber-700'
    : 'bg-red-100 text-red-700'
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-bold ${color}`} title={type === 'icp' ? 'ICP fit score' : 'Discovery score'}>
      {score}
    </span>
  )
}

const CATEGORY_COLORS = {
  pricing: 'bg-red-100 text-red-700', timeline: 'bg-orange-100 text-orange-700',
  technical: 'bg-blue-100 text-blue-700', authority: 'bg-purple-100 text-purple-700',
  competition: 'bg-yellow-100 text-yellow-800', other: 'bg-gray-100 text-gray-600',
}

function CategoryBadge({ category }) {
  return <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${CATEGORY_COLORS[category] || CATEGORY_COLORS.other}`}>{category}</span>
}

function BarRow({ label, count, maxCount, colorClass = 'bg-blue-500', badge, sub }) {
  const pct = maxCount > 0 ? Math.max(4, (count / maxCount) * 100) : 4
  return (
    <div className="flex items-center gap-3 py-1.5">
      <div className="w-44 shrink-0">
        <div className="text-sm text-gray-700 truncate">{label}</div>
        {sub && <div className="text-xs text-gray-400">{sub}</div>}
      </div>
      <div className="flex-1 bg-gray-100 rounded-full h-2">
        <div className={`${colorClass} h-2 rounded-full`} style={{ width: `${pct}%` }} />
      </div>
      {badge && <div className="shrink-0">{badge}</div>}
      <span className="text-sm text-gray-500 w-8 text-right shrink-0">{typeof count === 'number' ? count : count}</span>
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
  const repColor = rep < 40 ? 'bg-blue-400' : rep <= 55 ? 'bg-green-500' : 'bg-amber-500'
  return (
    <div>
      <div className="flex text-xs text-gray-500 mb-1 justify-between">
        <span>Rep {rep}%</span><span>Prospect {100 - rep}%</span>
      </div>
      <div className="flex h-2 rounded-full overflow-hidden bg-gray-100">
        <div className={`${repColor} transition-all`} style={{ width: `${rep}%` }} />
        <div className="bg-gray-300 flex-1" />
      </div>
    </div>
  )
}

function CopyButton({ text }) {
  const [copied, setCopied] = useState(false)
  function copy() {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  return (
    <button onClick={copy} className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-700 transition-colors">
      <Copy className="w-3.5 h-3.5" />
      {copied ? 'Copied!' : 'Copy'}
    </button>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function CallIntelligence() {
  const router = useRouter()
  const { user } = useAuthStore()

  const [calls, setCalls] = useState([])
  const [allUsers, setAllUsers] = useState([])
  const [salesReps, setSalesReps] = useState(null) // null = all; Set of names = filtered
  const [showRepFilter, setShowRepFilter] = useState(false)
  const [aggregate, setAggregate] = useState(null)
  const [loadingCalls, setLoadingCalls] = useState(true)
  const [loadError, setLoadError] = useState(null)
  const [persistWarning, setPersistWarning] = useState(null)

  const [analyzing, setAnalyzing] = useState(false)
  const [analyzeProgress, setAnalyzeProgress] = useState({ done: 0, total: 0, currentTitle: '' })
  const [refreshingAggregate, setRefreshingAggregate] = useState(false)

  const [enriching, setEnriching] = useState(false)
  const [enrichStats, setEnrichStats] = useState(null)
  const [shareUrl, setShareUrl] = useState(null)
  const [sharing, setSharing] = useState(false)

  const [activeTab, setActiveTab] = useState('overview')
  const [selectedCall, setSelectedCall] = useState(null)
  const [showChat, setShowChat] = useState(false)
  const [chatMessages, setChatMessages] = useState([])
  const [chatInput, setChatInput] = useState('')
  const [chatLoading, setChatLoading] = useState(false)

  const [typeFilter, setTypeFilter] = useState('all')
  const [sortField, setSortField] = useState('date')
  const [sortDir, setSortDir] = useState('desc')
  const [showIgnored, setShowIgnored] = useState(false)
  const [showClosedWon, setShowClosedWon] = useState(false)

  const [reengagingId, setReengagingId] = useState(null)
  const [reengagementEmails, setReengagementEmails] = useState({})
  const [selectedCallIds, setSelectedCallIds] = useState(new Set())

  const chatEndRef = useRef(null)
  const repFilterRef = useRef(null)

  useEffect(() => {
    function handleClickOutside(e) {
      if (repFilterRef.current && !repFilterRef.current.contains(e.target)) {
        setShowRepFilter(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  useEffect(() => {
    const saved = localStorage.getItem('banner_intel_sales_reps')
    if (saved) {
      try { setSalesReps(new Set(JSON.parse(saved))) } catch { /* ignore */ }
    }
    fetchCalls(); fetchAggregate()
  }, [])
  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [chatMessages])

  async function fetchCalls() {
    setLoadingCalls(true); setLoadError(null)
    try {
      const res = await fetch('/api/gong/intel-calls')
      const data = await res.json()
      if (!data.success) throw new Error(data.error || 'Failed to load calls')
      setCalls(data.calls || [])
      if (data.allUsers?.length) setAllUsers(data.allUsers)
    } catch (e) { setLoadError(e.message) }
    finally { setLoadingCalls(false) }
  }

  function toggleRep(name) {
    setSalesReps(prev => {
      const current = prev ?? new Set(allUsers.map(u => u.name))
      const next = new Set(current)
      if (next.has(name)) next.delete(name); else next.add(name)
      localStorage.setItem('banner_intel_sales_reps', JSON.stringify([...next]))
      return next
    })
  }

  function selectAllReps() {
    setSalesReps(null)
    localStorage.removeItem('banner_intel_sales_reps')
  }

  async function fetchAggregate() {
    try {
      const res = await fetch('/api/gong/intel-aggregate')
      const data = await res.json()
      if (data.success && data.aggregate) setAggregate(data.aggregate)
    } catch { /* silent */ }
  }

  async function runAnalysis(limit = null, forceReanalyze = false, explicitCalls = null) {
    // explicitCalls = specific call list (batch selection); otherwise use activeCalls filtered by rep
    const pool = explicitCalls ?? activeCalls
    let unanalyzed = forceReanalyze
      ? pool.filter(c => !c.ignored && c.dealStage?.toLowerCase() !== 'closedwon' && c.analysis?.icp_score == null)
      : pool.filter(c => !c.analysis && !c.ignored && c.dealStage?.toLowerCase() !== 'closedwon')
    if (limit) unanalyzed = unanalyzed.slice(0, limit)
    if (!unanalyzed.length || analyzing) return
    setAnalyzing(true)
    setAnalyzeProgress({ done: 0, total: unanalyzed.length, currentTitle: '' })
    const persistFailures = []
    for (const call of unanalyzed) {
      setAnalyzeProgress(p => ({ ...p, currentTitle: call.title }))
      try {
        const res = await fetch('/api/gong/intel-analyze', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ callId: call.gongCallId, title: call.title, date: call.date, callType: call.callType, repName: call.repName, repEmail: call.repEmail, durationSeconds: call.durationSeconds, gongUrl: call.gongUrl }),
        })
        const data = await res.json()
        if (data.analysis) setCalls(prev => prev.map(c => c.gongCallId === call.gongCallId ? { ...c, analysis: data.analysis, analyzedAt: new Date().toISOString() } : c))
        if (data.persisted === false) persistFailures.push(data.persistError || 'unknown')
      } catch (e) { console.error('Analysis failed:', call.title, e) }
      setAnalyzeProgress(p => ({ ...p, done: p.done + 1 }))
    }
    if (persistFailures.length) setPersistWarning(`Analysis shown but not saved for ${persistFailures.length} calls. DB error: ${persistFailures[0]}`)
    await refreshAggregate()
    setAnalyzing(false)
  }

  async function refreshAggregate() {
    setRefreshingAggregate(true)
    try {
      const repNames = salesReps ? [...salesReps] : null
      const res = await fetch('/api/gong/intel-aggregate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ repNames }),
      })
      const data = await res.json()
      if (data.success && data.aggregate) setAggregate(data.aggregate)
      else if (!data.success && data.error) console.error('Aggregate failed:', data.error)
    } catch (e) { console.error('Aggregate refresh failed:', e) }
    finally { setRefreshingAggregate(false) }
  }

  async function createShareLink() {
    setSharing(true)
    try {
      const res = await fetch('/api/gong/intel-share', { method: 'POST' })
      const data = await res.json()
      if (data.success && data.url) {
        setShareUrl(data.url)
        await navigator.clipboard.writeText(data.url)
      }
    } catch (e) { console.error('Share failed:', e) }
    finally { setSharing(false) }
  }

  async function runEnrichment() {
    const callIds = activeCalls.map(c => c.gongCallId)
    if (!callIds.length || enriching) return
    setEnriching(true); setEnrichStats(null)
    try {
      const res = await fetch('/api/gong/intel-enrich', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ callIds }),
      })
      const data = await res.json()
      if (data.success) { setEnrichStats(data); await fetchCalls() }
    } catch (e) { console.error('Enrichment failed:', e) }
    finally { setEnriching(false) }
  }

  async function generateReengagement(call, e) {
    e?.stopPropagation()
    if (reengagingId === call.gongCallId) return
    setReengagingId(call.gongCallId)
    try {
      const res = await fetch('/api/gong/intel-reengagement', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ callId: call.gongCallId }),
      })
      const data = await res.json()
      if (data.success) setReengagementEmails(prev => ({ ...prev, [call.gongCallId]: data.email }))
    } catch (e) { console.error('Reengagement failed:', e) }
    finally { setReengagingId(null) }
  }

  async function toggleIgnore(call, e) {
    e?.stopPropagation()
    const newIgnored = !call.ignored
    setCalls(prev => prev.map(c => c.gongCallId === call.gongCallId ? { ...c, ignored: newIgnored } : c))
    if (selectedCall?.gongCallId === call.gongCallId) setSelectedCall(prev => ({ ...prev, ignored: newIgnored }))
    try {
      await fetch('/api/gong/intel-ignore', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ callId: call.gongCallId, ignored: newIgnored }),
      })
    } catch { setCalls(prev => prev.map(c => c.gongCallId === call.gongCallId ? { ...c, ignored: call.ignored } : c)) }
  }

  async function sendChat() {
    const msg = chatInput.trim()
    if (!msg || chatLoading) return
    setChatInput('')
    const newMessages = [...chatMessages, { role: 'user', content: msg }]
    setChatMessages(newMessages); setChatLoading(true)
    try {
      const res = await fetch('/api/gong/intel-chat', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: msg, messages: chatMessages }),
      })
      const data = await res.json()
      setChatMessages([...newMessages, { role: 'assistant', content: data.reply || 'No response.' }])
    } catch (e) { setChatMessages([...newMessages, { role: 'error', content: e.message }]) }
    finally { setChatLoading(false) }
  }

  function exportCSV() {
    const headers = ['Date', 'Rep', 'Type', 'Duration (min)', 'Talk Ratio (%)', 'Sentiment', 'ICP Score', 'Discovery Score', 'Top Theme', 'Summary', 'Gong URL']
    const rows = filteredCalls.map(c => [
      c.date ? new Date(c.date).toLocaleDateString() : '',
      c.repName || '', c.callType || '',
      c.durationSeconds ? Math.round(c.durationSeconds / 60) : '',
      c.analysis?.rep_talk_ratio ?? '', c.analysis?.sentiment || '',
      c.analysis?.icp_score ?? '', c.analysis?.discovery_score ?? '',
      (c.analysis?.themes || [])[0] || '', c.analysis?.summary || '', c.gongUrl || '',
    ])
    const csv = [headers, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `call-intelligence-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
  }

  function toggleSort(field) {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortField(field); setSortDir('desc') }
  }

  // ── Computed ──────────────────────────────────────────────────────────────────
  const ignoredCount = calls.filter(c => c.ignored).length
  const closedWonCount = calls.filter(c => c.dealStage?.toLowerCase() === 'closedwon').length
  const uncheckedCount = calls.filter(c => !c.hubspotCheckedAt).length
  const activeCalls = calls.filter(c =>
    !c.ignored &&
    c.dealStage?.toLowerCase() !== 'closedwon' &&
    (salesReps == null || (c.repName && salesReps.has(c.repName)))
  )
  const analyzedCalls = activeCalls.filter(c => c.analysis)
  const unanalyzedCount = activeCalls.filter(c => !c.analysis).length
  const missingScoresCount = analyzedCalls.filter(c => c.analysis?.icp_score == null).length

  const goneColdDeals = useMemo(() => {
    if (!calls.some(c => c.hubspotDealId)) return []
    const byDeal = {}
    calls.forEach(call => {
      if (!call.hubspotDealId || call.ignored) return
      const stage = call.dealStage?.toLowerCase()
      if (stage === 'closedwon' || stage === 'closedlost') return
      if (!byDeal[call.hubspotDealId] || new Date(call.date) > new Date(byDeal[call.hubspotDealId].date)) {
        byDeal[call.hubspotDealId] = call
      }
    })
    return Object.values(byDeal)
      .filter(call => (Date.now() - new Date(call.date)) / (1000 * 60 * 60 * 24) >= 21)
      .sort((a, b) => new Date(a.date) - new Date(b.date))
  }, [calls])

  const filteredCalls = calls
    .filter(c => salesReps == null || (c.repName && salesReps.has(c.repName)))
    .filter(c => showIgnored || !c.ignored)
    .filter(c => showClosedWon || c.dealStage?.toLowerCase() !== 'closedwon')
    .filter(c => typeFilter === 'all' || c.callType === typeFilter)
    .sort((a, b) => {
      let av, bv
      if (sortField === 'date') { av = new Date(a.date || 0); bv = new Date(b.date || 0) }
      else if (sortField === 'rep') { av = (a.repName || '').toLowerCase(); bv = (b.repName || '').toLowerCase() }
      else if (sortField === 'duration') { av = a.durationSeconds || 0; bv = b.durationSeconds || 0 }
      else if (sortField === 'ratio') { av = a.analysis?.rep_talk_ratio || 0; bv = b.analysis?.rep_talk_ratio || 0 }
      else if (sortField === 'sentiment') { av = a.analysis?.sentiment || ''; bv = b.analysis?.sentiment || '' }
      else if (sortField === 'icp') { av = a.analysis?.icp_score || 0; bv = b.analysis?.icp_score || 0 }
      else { av = a[sortField] || ''; bv = b[sortField] || '' }
      return sortDir === 'asc' ? (av > bv ? 1 : -1) : (av < bv ? 1 : -1)
    })

  const topObjection = aggregate?.top_objections?.[0]
  const topCompetitor = aggregate?.competitor_mentions?.[0]
  const sentBreakdown = aggregate?.sentiment_breakdown || {}
  const totalSent = (sentBreakdown.positive || 0) + (sentBreakdown.neutral || 0) + (sentBreakdown.negative || 0)
  const positivePct = totalSent > 0 ? Math.round((sentBreakdown.positive || 0) / totalSent * 100) : null

  const SortArrow = ({ field }) => (
    <span className="ml-1 text-gray-400">{sortField === field ? (sortDir === 'asc' ? '↑' : '↓') : '↕'}</span>
  )

  const tabs = [
    { id: 'overview', label: 'Overview', disabled: !aggregate },
    ...(goneColdDeals.length > 0 ? [{ id: 'cold', label: `Gone Cold (${goneColdDeals.length})`, disabled: false }] : []),
    { id: 'calls', label: `All Calls (${filteredCalls.length})`, disabled: false },
  ]

  const headerSubtitle = loadingCalls ? 'Loading…' : [
    `${activeCalls.length} active calls`,
    `${analyzedCalls.length} analyzed`,
    closedWonCount > 0 ? `${closedWonCount} closed won hidden` : null,
    ignoredCount > 0 ? `${ignoredCount} ignored` : null,
    'Last 6 months',
  ].filter(Boolean).join(' · ')

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-green-50 flex flex-col">

      {/* Header */}
      <div className="bg-white border-b border-gray-200 shadow-sm shrink-0">
        <div className="max-w-[1400px] mx-auto px-6 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-3">
              <button onClick={() => router.push('/modules/sales-reports')} className="p-2 hover:bg-gray-100 rounded-lg">
                <ArrowLeft className="w-5 h-5 text-gray-600" />
              </button>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-400 cursor-pointer hover:text-gray-600" onClick={() => router.push('/modules/sales-reports')}>Sales Reports</span>
                  <ChevronRight className="w-3 h-3 text-gray-300" />
                  <h1 className="text-xl font-bold text-gray-900">Call Intelligence</h1>
                </div>
                <p className="text-xs text-gray-400 mt-0.5">{headerSubtitle}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {analyzedCalls.length > 0 && (
                <button onClick={refreshAggregate} disabled={refreshingAggregate} className="flex items-center gap-1.5 px-3 py-2 text-sm text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg disabled:opacity-50">
                  <RefreshCw className={`w-4 h-4 ${refreshingAggregate ? 'animate-spin' : ''}`} /> Refresh Insights
                </button>
              )}
              <button onClick={runEnrichment} disabled={enriching} className="flex items-center gap-1.5 px-3 py-2 text-sm text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg disabled:opacity-50" title="Match calls to HubSpot deals — filters out post-sale CS calls">
                <RefreshCw className={`w-4 h-4 ${enriching ? 'animate-spin' : ''}`} /> Sync HubSpot
              </button>
              {analyzedCalls.length > 0 && (
                <button onClick={exportCSV} className="flex items-center gap-1.5 px-3 py-2 text-sm text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg">
                  <Download className="w-4 h-4" /> Export CSV
                </button>
              )}
              {aggregate && (
                <button onClick={createShareLink} disabled={sharing}
                  className={`flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg transition-colors ${shareUrl ? 'bg-green-100 text-green-700' : 'text-gray-600 bg-gray-100 hover:bg-gray-200'} disabled:opacity-50`}
                  title={shareUrl ? 'Link copied!' : 'Generate shareable link (no login required)'}>
                  <ExternalLink className="w-4 h-4" />
                  {sharing ? 'Generating…' : shareUrl ? 'Link Copied!' : 'Share'}
                </button>
              )}
              <button onClick={() => setShowChat(c => !c)} className={`flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg transition-colors ${showChat ? 'bg-green-600 text-white' : 'bg-gradient-to-r from-green-600 to-emerald-600 text-white hover:from-green-700 hover:to-emerald-700'}`}>
                <Sparkles className="w-4 h-4" /> {showChat ? 'Close Chat' : 'AI Chat'}
              </button>
              {user && <UserMenu />}
            </div>
          </div>
        </div>
      </div>

      {/* Rep filter — compact dropdown */}
      {allUsers.length > 0 && (
        <div ref={repFilterRef} className="bg-white border-b border-gray-200 px-6 py-2 shrink-0 relative z-20">
          <div className="max-w-[1400px] mx-auto flex items-center gap-3">
            <button
              onClick={() => setShowRepFilter(s => !s)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${salesReps != null ? 'border-green-400 bg-green-50 text-green-800' : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'}`}
            >
              <Users className="w-3.5 h-3.5" />
              {salesReps != null ? `${salesReps.size} rep${salesReps.size !== 1 ? 's' : ''} selected` : 'All reps'}
              <ChevronRight className={`w-3.5 h-3.5 transition-transform ${showRepFilter ? 'rotate-90' : ''}`} />
            </button>
            {salesReps != null && (
              <div className="flex items-center gap-1.5 flex-wrap">
                {[...salesReps].map(name => (
                  <span key={name} className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-100 text-green-800 text-xs rounded-full">
                    {name}
                    <button onClick={() => toggleRep(name)} className="hover:text-green-600">×</button>
                  </span>
                ))}
                <button onClick={selectAllReps} className="text-xs text-gray-400 hover:text-gray-600 underline">Clear</button>
              </div>
            )}
          </div>
          {showRepFilter && (
            <div className="absolute left-6 top-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg p-3 w-72 max-h-72 overflow-y-auto">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Select sales reps</span>
                <button onClick={selectAllReps} className="text-xs text-gray-400 hover:text-gray-600">Reset</button>
              </div>
              {allUsers.map(u => {
                const active = salesReps == null || salesReps.has(u.name)
                return (
                  <label key={u.name} className="flex items-center gap-2 py-1.5 cursor-pointer hover:bg-gray-50 rounded px-1">
                    <input type="checkbox" checked={active} onChange={() => toggleRep(u.name)} className="accent-green-600" />
                    <span className="text-sm text-gray-700 flex-1">{u.name}</span>
                    <span className="text-xs text-gray-400">{u.callCount}</span>
                  </label>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* Banners */}
      {enriching && (
        <div className="bg-blue-50 border-b border-blue-200 px-6 py-3 shrink-0">
          <div className="max-w-[1400px] mx-auto flex items-center gap-2 text-sm text-blue-800">
            <RefreshCw className="w-4 h-4 animate-spin shrink-0" />
            <span>Syncing HubSpot deals… matching call participants to contacts</span>
          </div>
        </div>
      )}
      {enrichStats && !enriching && (
        <div className={`border-b px-6 py-3 shrink-0 ${enrichStats.withDeals > 0 ? 'bg-green-50 border-green-200' : 'bg-amber-50 border-amber-200'}`}>
          <div className="max-w-[1400px] mx-auto flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm">
              {enrichStats.withDeals > 0
                ? <span className="text-green-800"><CheckCircle className="w-4 h-4 inline mr-1" />Synced — {enrichStats.withDeals} calls linked to HubSpot deals ({enrichStats.hsContactsIndexed} contacts indexed)</span>
                : <span className="text-amber-800"><AlertCircle className="w-4 h-4 inline mr-1" />Sync complete but no deals matched. Check that HUBSPOT_API_KEY has access to Contacts and Deals.</span>
              }
            </div>
            <button onClick={() => setEnrichStats(null)} className="text-gray-400 text-sm ml-4">✕</button>
          </div>
        </div>
      )}
      {analyzing && (
        <div className="bg-amber-50 border-b border-amber-200 px-6 py-3 shrink-0">
          <div className="max-w-[1400px] mx-auto">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2 text-sm text-amber-800">
                <Zap className="w-4 h-4 animate-pulse" />
                <span>Analyzing… {analyzeProgress.done}/{analyzeProgress.total}</span>
                {analyzeProgress.currentTitle && <span className="text-amber-600 truncate max-w-xs">— {analyzeProgress.currentTitle}</span>}
              </div>
              <span className="text-xs text-amber-600">{Math.round((analyzeProgress.done / analyzeProgress.total) * 100)}%</span>
            </div>
            <div className="h-1.5 bg-amber-200 rounded-full">
              <div className="h-1.5 bg-amber-500 rounded-full transition-all duration-300" style={{ width: `${(analyzeProgress.done / analyzeProgress.total) * 100}%` }} />
            </div>
          </div>
        </div>
      )}
      {!analyzing && !loadingCalls && unanalyzedCount > 0 && (
        <div className="bg-amber-50 border-b border-amber-200 px-6 py-3 shrink-0">
          <div className="max-w-[1400px] mx-auto flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-amber-800">
              <AlertCircle className="w-4 h-4" /><span>{unanalyzedCount} active call{unanalyzedCount > 1 ? 's' : ''} not yet analyzed</span>
            </div>
            <div className="flex gap-2">
              {unanalyzedCount > 20 && (
                <button onClick={() => runAnalysis(20)} className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-amber-400 text-amber-700 text-sm font-medium rounded-lg hover:bg-amber-50">
                  <Zap className="w-3.5 h-3.5" /> Analyze 20 Most Recent
                </button>
              )}
              <button onClick={() => runAnalysis()} className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 text-white text-sm font-medium rounded-lg hover:bg-amber-600">
                <Zap className="w-3.5 h-3.5" /> Analyze All ({unanalyzedCount})
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Stale analysis — missing ICP/discovery scores */}
      {!analyzing && !loadingCalls && missingScoresCount > 0 && (
        <div className="bg-violet-50 border-b border-violet-200 px-6 py-3 shrink-0">
          <div className="max-w-[1400px] mx-auto flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-violet-800">
              <RefreshCw className="w-4 h-4 shrink-0" />
              <span>{missingScoresCount} calls need re-analysis to add ICP fit + discovery scores</span>
            </div>
            <div className="flex items-center gap-2">
              {missingScoresCount > 20 && (
                <button
                  onClick={() => runAnalysis(20, true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-violet-400 text-violet-700 text-sm font-medium rounded-lg hover:bg-violet-50"
                >
                  <Zap className="w-3.5 h-3.5" /> Update 20
                </button>
              )}
              <button
                onClick={() => runAnalysis(null, true)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-violet-600 text-white text-sm font-medium rounded-lg hover:bg-violet-700"
              >
                <Zap className="w-3.5 h-3.5" /> Update All ({missingScoresCount})
              </button>
            </div>
          </div>
        </div>
      )}

      {loadError && (
        <div className="bg-red-50 border-b border-red-200 px-6 py-3 shrink-0">
          <div className="max-w-[1400px] mx-auto flex items-center justify-between">
            <span className="text-sm text-red-700">{loadError}</span>
            <button onClick={fetchCalls} className="text-sm text-red-600 underline">Retry</button>
          </div>
        </div>
      )}
      {persistWarning && (
        <div className="bg-red-50 border-b border-red-200 px-6 py-3 shrink-0">
          <div className="max-w-[1400px] mx-auto flex items-center justify-between">
            <span className="text-sm text-red-700">{persistWarning}</span>
            <button onClick={() => setPersistWarning(null)} className="text-sm text-red-500 ml-4">✕</button>
          </div>
        </div>
      )}

      {/* Main content */}
      <div className="max-w-[1400px] mx-auto px-6 py-6 flex-1 w-full">
        {loadingCalls && (
          <div className="space-y-6 animate-pulse">
            <div className="bg-white rounded-xl border border-gray-200 h-16" />
            <div className="grid grid-cols-5 gap-4">{[...Array(5)].map((_, i) => <div key={i} className="bg-white rounded-xl border border-gray-200 h-24" />)}</div>
          </div>
        )}

        {!loadingCalls && (
          <>
            {/* Executive summary hero */}
            {aggregate?.executive_summary && (
              <div className="bg-gradient-to-r from-gray-900 to-gray-700 rounded-xl p-5 mb-5 text-white">
                <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-2">Key Finding</p>
                <p className="text-lg font-medium leading-snug">{aggregate.executive_summary}</p>
              </div>
            )}

            {/* KPI row */}
            {aggregate && (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-6">
                <KPICard label="Calls Analyzed" value={analyzedCalls.length}
                  sub={`${activeCalls.filter(c => c.callType === 'intro').length} intro · ${activeCalls.filter(c => c.callType === 'demo').length} demo · ${activeCalls.filter(c => c.callType === 'solution_validation').length} follow-up`} />
                <KPICard label="Positive Sentiment"
                  value={positivePct !== null ? `${positivePct}%` : '—'}
                  sub={`${sentBreakdown.neutral || 0} neutral · ${sentBreakdown.negative || 0} negative`}
                  valueColor={positivePct >= 60 ? 'text-green-600' : positivePct >= 40 ? 'text-amber-600' : 'text-red-600'} />
                <KPICard label="Avg ICP Fit"
                  value={aggregate.avg_icp_score ? `${aggregate.avg_icp_score}/10` : '—'}
                  sub={aggregate.avg_icp_score ? (aggregate.avg_icp_score >= 7 ? 'Strong pipeline fit' : aggregate.avg_icp_score >= 5 ? 'Mixed fit — review ICP' : 'Weak fit — off-ICP volume') : null}
                  valueColor={aggregate.avg_icp_score >= 7 ? 'text-green-600' : aggregate.avg_icp_score >= 5 ? 'text-amber-600' : 'text-red-600'} />
                <KPICard label="Avg Discovery"
                  value={aggregate.avg_discovery_score ? `${aggregate.avg_discovery_score}/10` : '—'}
                  sub={aggregate.avg_discovery_score ? (aggregate.avg_discovery_score >= 7 ? 'Solid MEDDICC coverage' : 'Discovery gaps present') : null}
                  valueColor={aggregate.avg_discovery_score >= 7 ? 'text-green-600' : aggregate.avg_discovery_score >= 5 ? 'text-amber-600' : 'text-red-600'} />
                <KPICard label="Top Competitor" value={topCompetitor?.name || 'None'}
                  sub={topCompetitor ? `${topCompetitor.count} mention${topCompetitor.count > 1 ? 's' : ''}` : 'No competitors mentioned'} />
              </div>
            )}

            {/* Empty states */}
            {!aggregate && analyzedCalls.length === 0 && activeCalls.length > 0 && (
              <div className="bg-white rounded-xl border border-gray-200 p-12 text-center mb-6">
                <Phone className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-700 mb-2">{activeCalls.length} active calls, none analyzed yet</h3>
                <p className="text-gray-500 text-sm">Click "Analyze All" above to run AI analysis.</p>
              </div>
            )}
            {calls.length === 0 && (
              <div className="bg-white rounded-xl border border-gray-200 p-12 text-center mb-6">
                <Phone className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-700 mb-2">No calls found</h3>
                <p className="text-gray-500 text-sm">No calls found in the last 6 months.</p>
              </div>
            )}

            {calls.length > 0 && (
              <div className="flex gap-6">
                <div className="flex-1 min-w-0">

                  {/* Tab bar */}
                  <div className="flex gap-0 border-b border-gray-200 mb-6">
                    {tabs.map(tab => (
                      <button key={tab.id} onClick={() => !tab.disabled && setActiveTab(tab.id)} disabled={tab.disabled}
                        className={`px-5 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === tab.id ? 'border-green-600 text-green-600' : tab.disabled ? 'border-transparent text-gray-300 cursor-not-allowed' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}>
                        {tab.label}{tab.disabled && <span className="ml-1.5 text-xs">(analyze first)</span>}
                      </button>
                    ))}
                  </div>

                  {/* ── Overview tab ── */}
                  {activeTab === 'overview' && aggregate && (
                    <div className="space-y-6">

                      {/* Loss reasons — primary section */}
                      {aggregate.loss_reasons?.length > 0 && (
                        <div className="bg-white rounded-xl border border-red-100 p-6">
                          <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-4 flex items-center gap-2">
                            <TrendingDown className="w-4 h-4 text-red-500" /> Why Deals Go Cold
                          </h3>
                          <div className="space-y-1">
                            {aggregate.loss_reasons.map((lr, i) => (
                              <BarRow key={i} label={lr.reason}
                                count={`${lr.pct_of_negative_calls}%`}
                                maxCount={aggregate.loss_reasons[0].pct_of_negative_calls}
                                colorClass="bg-red-400"
                                sub={lr.example || null} />
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Buyer priorities */}
                      {(aggregate.buyer_priorities?.length > 0 || aggregate.top_themes?.length > 0) && (
                        <div className="bg-white rounded-xl border border-gray-200 p-6">
                          <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-4">What Buyers Care About</h3>
                          <div className="space-y-1">
                            {(aggregate.buyer_priorities || aggregate.top_themes).slice(0, 8).map((item, i) => (
                              <BarRow key={i}
                                label={typeof item === 'string' ? item : (item.priority || item.theme)}
                                count={item.count || 0}
                                maxCount={(aggregate.buyer_priorities || aggregate.top_themes)[0]?.count || 1}
                                colorClass="bg-blue-500"
                                sub={item.example || null} />
                            ))}
                          </div>
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

                      {/* Objections + Win/Loss */}
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {aggregate.top_objections?.length > 0 && (
                          <div className="bg-white rounded-xl border border-gray-200 p-6">
                            <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-4">Top Objections</h3>
                            <div className="space-y-1">
                              {aggregate.top_objections.map((obj, i) => (
                                <BarRow key={i} label={obj.text} count={obj.count}
                                  maxCount={aggregate.top_objections[0].count}
                                  colorClass={CATEGORY_COLORS[obj.category]?.split(' ')[0] || 'bg-red-400'}
                                  badge={<CategoryBadge category={obj.category} />} />
                              ))}
                            </div>
                          </div>
                        )}
                        {(aggregate.win_patterns?.length > 0 || aggregate.loss_patterns?.length > 0) && (
                          <div className="bg-white rounded-xl border border-gray-200 p-6">
                            <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-4">Win / Loss Patterns</h3>
                            {aggregate.win_patterns?.length > 0 && (
                              <div className="mb-4">
                                <p className="text-xs font-semibold text-green-700 uppercase tracking-wide mb-2 flex items-center gap-1"><CheckCircle className="w-3.5 h-3.5" /> Positive calls</p>
                                <ul className="space-y-1.5">{aggregate.win_patterns.map((p, i) => <li key={i} className="text-sm text-gray-600 flex items-start gap-2"><span className="text-green-500 mt-0.5">•</span>{p}</li>)}</ul>
                              </div>
                            )}
                            {aggregate.loss_patterns?.length > 0 && (
                              <div>
                                <p className="text-xs font-semibold text-red-600 uppercase tracking-wide mb-2 flex items-center gap-1"><AlertCircle className="w-3.5 h-3.5" /> Negative calls</p>
                                <ul className="space-y-1.5">{aggregate.loss_patterns.map((p, i) => <li key={i} className="text-sm text-gray-600 flex items-start gap-2"><span className="text-red-400 mt-0.5">•</span>{p}</li>)}</ul>
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Competitors + Rep performance */}
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {aggregate.competitor_mentions?.length > 0 && (
                          <div className="bg-white rounded-xl border border-gray-200 p-6">
                            <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-4">Competitor Mentions</h3>
                            <div className="space-y-3">
                              {aggregate.competitor_mentions.map((c, i) => (
                                <div key={i} className="flex items-start gap-3">
                                  <div className="w-7 h-7 rounded-full bg-yellow-100 text-yellow-800 text-xs font-bold flex items-center justify-center shrink-0">{c.count}</div>
                                  <div><p className="text-sm font-semibold text-gray-800">{c.name}</p>{c.typical_context && <p className="text-xs text-gray-500 mt-0.5">{c.typical_context}</p>}</div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        {aggregate.rep_stats?.length > 0 && (
                          <div className="bg-white rounded-xl border border-gray-200 p-6">
                            <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-4 flex items-center gap-2"><Users className="w-4 h-4" /> Rep Performance</h3>
                            <div className="overflow-x-auto">
                              <table className="w-full text-sm">
                                <thead>
                                  <tr className="border-b border-gray-100">
                                    {['Rep', 'Calls', 'ICP', 'Discovery', 'Positive %'].map(h => (
                                      <th key={h} className="text-left py-2 text-xs text-gray-400 font-semibold uppercase tracking-wide pr-3">{h}</th>
                                    ))}
                                  </tr>
                                </thead>
                                <tbody>
                                  {aggregate.rep_stats.map((rep, i) => (
                                    <tr key={i} className="border-b border-gray-50 hover:bg-gray-50">
                                      <td className="py-3 font-medium text-gray-800 pr-3">{rep.rep}</td>
                                      <td className="py-3 text-gray-600 pr-3">{rep.call_count}</td>
                                      <td className="py-3 pr-3"><ScoreBadge score={rep.avg_icp_score} type="icp" /></td>
                                      <td className="py-3 pr-3"><ScoreBadge score={rep.avg_discovery_score} type="discovery" /></td>
                                      <td className={`py-3 font-medium ${(rep.positive_pct || 0) >= 60 ? 'text-green-600' : (rep.positive_pct || 0) >= 40 ? 'text-amber-600' : 'text-red-600'}`}>
                                        {rep.positive_pct !== undefined ? `${rep.positive_pct}%` : '—'}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Investor narrative */}
                      {aggregate.investor_narrative && (
                        <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-xl p-6">
                          <h3 className="text-sm font-semibold text-green-800 uppercase tracking-wide mb-3 flex items-center gap-2"><TrendingUp className="w-4 h-4" /> Investor Narrative</h3>
                          <p className="text-gray-700 leading-relaxed">{aggregate.investor_narrative}</p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* ── Gone Cold tab ── */}
                  {activeTab === 'cold' && (
                    <div className="space-y-4">
                      <p className="text-sm text-gray-500">
                        {goneColdDeals.length} deal{goneColdDeals.length > 1 ? 's' : ''} where the last intro or demo call was 21+ days ago and the HubSpot deal is still active. Oldest first.
                      </p>
                      {goneColdDeals.map(call => {
                        const daysSince = Math.round((Date.now() - new Date(call.date)) / (1000 * 60 * 60 * 24))
                        const email = reengagementEmails[call.gongCallId]
                        const isGenerating = reengagingId === call.gongCallId
                        return (
                          <div key={call.gongCallId} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                            <div className="p-5">
                              <div className="flex items-start justify-between gap-4">
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 mb-1">
                                    <TypeBadge type={call.callType} />
                                    <span className="flex items-center gap-1 text-xs text-gray-400">
                                      <Clock className="w-3 h-3" /> {daysSince} days ago
                                    </span>
                                    {call.analysis?.icp_score && <ScoreBadge score={call.analysis.icp_score} type="icp" />}
                                  </div>
                                  <p className="font-semibold text-gray-900 truncate">{call.title}</p>
                                  <p className="text-sm text-gray-500">{call.repName} · {call.date ? new Date(call.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}</p>
                                  {call.analysis?.summary && (
                                    <p className="text-xs text-gray-500 mt-2 line-clamp-2">{call.analysis.summary}</p>
                                  )}
                                  {call.analysis?.buying_signals?.length > 0 && (
                                    <p className="text-xs text-green-600 mt-1 flex items-center gap-1">
                                      <CheckCircle className="w-3 h-3" /> {call.analysis.buying_signals[0]}
                                    </p>
                                  )}
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                  {call.gongUrl && (
                                    <a href={call.gongUrl} target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-green-600">
                                      <ExternalLink className="w-4 h-4" />
                                    </a>
                                  )}
                                  {!email && (
                                    <button
                                      onClick={e => generateReengagement(call, e)}
                                      disabled={isGenerating}
                                      className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 disabled:opacity-50"
                                    >
                                      <Mail className="w-3.5 h-3.5" />
                                      {isGenerating ? 'Writing…' : 'Draft Follow-up'}
                                    </button>
                                  )}
                                </div>
                              </div>
                            </div>
                            {email && (
                              <div className="border-t border-gray-100 bg-gray-50 p-5">
                                <div className="flex items-center justify-between mb-3">
                                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Generated Follow-up</p>
                                  <div className="flex items-center gap-3">
                                    {email.suggested_content && (
                                      <p className="text-xs text-blue-600 italic max-w-xs truncate" title={email.suggested_content}>💡 {email.suggested_content}</p>
                                    )}
                                    <button
                                      onClick={() => generateReengagement(call)}
                                      disabled={reengagingId === call.gongCallId}
                                      className="text-xs text-gray-400 hover:text-gray-600"
                                    >
                                      Regenerate
                                    </button>
                                  </div>
                                </div>
                                <div className="space-y-2">
                                  <div className="flex items-center justify-between bg-white rounded-lg border border-gray-200 px-3 py-2">
                                    <div>
                                      <p className="text-xs text-gray-400 mb-0.5">Subject</p>
                                      <p className="text-sm font-medium text-gray-800">{email.subject}</p>
                                    </div>
                                    <CopyButton text={email.subject} />
                                  </div>
                                  <div className="bg-white rounded-lg border border-gray-200 px-3 py-2">
                                    <div className="flex items-center justify-between mb-1">
                                      <p className="text-xs text-gray-400">Body</p>
                                      <CopyButton text={email.body} />
                                    </div>
                                    <p className="text-sm text-gray-700 whitespace-pre-wrap">{email.body}</p>
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}

                  {/* ── All Calls tab ── */}
                  {activeTab === 'calls' && (
                    <div className="bg-white rounded-xl border border-gray-200">
                      <div className="flex items-center justify-between p-4 border-b border-gray-100 flex-wrap gap-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          {[
                            { id: 'all', label: 'All' },
                            { id: 'intro', label: 'Intro' },
                            { id: 'demo', label: 'Demo' },
                            { id: 'solution_validation', label: 'Follow-up' },
                          ].map(t => (
                            <button key={t.id} onClick={() => setTypeFilter(t.id)}
                              className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${typeFilter === t.id ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                              {t.label}
                            </button>
                          ))}
                          {ignoredCount > 0 && (
                            <button onClick={() => setShowIgnored(s => !s)}
                              className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg ${showIgnored ? 'bg-gray-600 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
                              <Eye className="w-3.5 h-3.5" /> {showIgnored ? 'Hide Ignored' : `Ignored (${ignoredCount})`}
                            </button>
                          )}
                          {closedWonCount > 0 && (
                            <button onClick={() => setShowClosedWon(s => !s)}
                              className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg ${showClosedWon ? 'bg-gray-600 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
                              <CheckCircle className="w-3.5 h-3.5" /> {showClosedWon ? 'Hide Closed Won' : `Closed Won (${closedWonCount})`}
                            </button>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          {selectedCallIds.size > 0 && (
                            <>
                              <span className="text-xs text-gray-500">{selectedCallIds.size} selected</span>
                              <button
                                onClick={() => {
                                  const selected = filteredCalls.filter(c => selectedCallIds.has(c.gongCallId))
                                  runAnalysis(null, false, selected)
                                  setSelectedCallIds(new Set())
                                }}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700"
                              >
                                <Zap className="w-3.5 h-3.5" /> Analyze Selected ({selectedCallIds.size})
                              </button>
                              <button onClick={() => setSelectedCallIds(new Set())} className="text-xs text-gray-400 hover:text-gray-600">Clear</button>
                            </>
                          )}
                          <button onClick={exportCSV} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700">
                            <Download className="w-4 h-4" /> Export CSV
                          </button>
                        </div>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-gray-100 bg-gray-50">
                              <th className="pl-4 py-3 w-8">
                                <input type="checkbox"
                                  className="accent-green-600"
                                  checked={filteredCalls.length > 0 && filteredCalls.every(c => selectedCallIds.has(c.gongCallId))}
                                  onChange={e => {
                                    if (e.target.checked) setSelectedCallIds(new Set(filteredCalls.map(c => c.gongCallId)))
                                    else setSelectedCallIds(new Set())
                                  }}
                                />
                              </th>
                              {[
                                { label: 'Date', field: 'date' },
                                { label: 'Title', field: null },
                                { label: 'Rep', field: 'rep' },
                                { label: 'Type', field: null },
                                { label: 'ICP', field: 'icp' },
                                { label: 'Duration', field: 'duration' },
                                { label: 'Talk Ratio', field: 'ratio' },
                                { label: 'Sentiment', field: 'sentiment' },
                              ].map(col => (
                                <th key={col.label} onClick={() => col.field && toggleSort(col.field)}
                                  className={`text-left px-4 py-3 text-xs text-gray-400 font-semibold uppercase tracking-wide whitespace-nowrap ${col.field ? 'cursor-pointer hover:text-gray-600' : ''}`}>
                                  {col.label}{col.field && <SortArrow field={col.field} />}
                                </th>
                              ))}
                              <th className="px-4 py-3 text-xs text-gray-400 font-semibold uppercase tracking-wide text-right">Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {filteredCalls.map(call => (
                              <tr key={call.gongCallId}
                                className={`border-b border-gray-50 transition-colors ${call.ignored ? 'opacity-40 bg-gray-50' : selectedCallIds.has(call.gongCallId) ? 'bg-green-50' : 'hover:bg-green-50'}`}>
                                <td className="pl-4 py-3 w-8" onClick={e => e.stopPropagation()}>
                                  <input type="checkbox"
                                    className="accent-green-600"
                                    checked={selectedCallIds.has(call.gongCallId)}
                                    onChange={e => {
                                      setSelectedCallIds(prev => {
                                        const next = new Set(prev)
                                        if (e.target.checked) next.add(call.gongCallId); else next.delete(call.gongCallId)
                                        return next
                                      })
                                    }}
                                  />
                                </td>
                                <td className="px-4 py-3 text-gray-500 whitespace-nowrap" onClick={() => !call.ignored && setSelectedCall(call)} style={{cursor: call.ignored ? 'default' : 'pointer'}}>
                                  {call.date ? new Date(call.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—'}
                                </td>
                                <td className="px-4 py-3 font-medium text-gray-800 max-w-[200px] truncate" onClick={() => !call.ignored && setSelectedCall(call)} style={{cursor: call.ignored ? 'default' : 'pointer'}}>{call.title}</td>
                                <td className="px-4 py-3 text-gray-600 whitespace-nowrap" onClick={() => !call.ignored && setSelectedCall(call)} style={{cursor: call.ignored ? 'default' : 'pointer'}}>{call.repName || '—'}</td>
                                <td className="px-4 py-3" onClick={() => !call.ignored && setSelectedCall(call)} style={{cursor: call.ignored ? 'default' : 'pointer'}}><TypeBadge type={call.callType} /></td>
                                <td className="px-4 py-3" onClick={() => !call.ignored && setSelectedCall(call)} style={{cursor: call.ignored ? 'default' : 'pointer'}}><ScoreBadge score={call.analysis?.icp_score} type="icp" /></td>
                                <td className="px-4 py-3 text-gray-500 whitespace-nowrap" onClick={() => !call.ignored && setSelectedCall(call)} style={{cursor: call.ignored ? 'default' : 'pointer'}}>
                                  {call.durationSeconds ? `${Math.round(call.durationSeconds / 60)}m` : '—'}
                                </td>
                                <td className="px-4 py-3 whitespace-nowrap" onClick={() => !call.ignored && setSelectedCall(call)} style={{cursor: call.ignored ? 'default' : 'pointer'}}>
                                  {call.analysis?.rep_talk_ratio != null
                                    ? <span className={`font-medium ${call.analysis.rep_talk_ratio <= 55 ? 'text-green-600' : 'text-amber-600'}`}>{call.analysis.rep_talk_ratio}%</span>
                                    : <span className="text-gray-300">—</span>}
                                </td>
                                <td className="px-4 py-3" onClick={() => !call.ignored && setSelectedCall(call)} style={{cursor: call.ignored ? 'default' : 'pointer'}}>
                                  {call.analysis?.sentiment ? <SentimentBadge sentiment={call.analysis.sentiment} /> : <span className="text-gray-300 text-xs">Unanalyzed</span>}
                                </td>
                                <td className="px-4 py-3 text-right">
                                  <div className="flex items-center justify-end gap-2">
                                    <button onClick={e => toggleIgnore(call, e)} title={call.ignored ? 'Unignore' : 'Ignore'} className="text-gray-300 hover:text-gray-500">
                                      {call.ignored ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                                    </button>
                                    {call.gongUrl && (
                                      <a href={call.gongUrl} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} className="text-gray-400 hover:text-green-600">
                                        <ExternalLink className="w-4 h-4" />
                                      </a>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        {filteredCalls.length === 0 && <div className="text-center py-12 text-gray-400 text-sm">No calls match the current filter.</div>}
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
                        <div><p className="text-sm font-semibold">Ask the Data</p><p className="text-xs text-green-100">{analyzedCalls.length} calls in context</p></div>
                      </div>
                      <button onClick={() => setShowChat(false)} className="p-1 hover:bg-green-500 rounded"><X className="w-4 h-4" /></button>
                    </div>
                    <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0">
                      {chatMessages.length === 0 && (
                        <div className="text-center py-4">
                          <Sparkles className="w-10 h-10 text-green-200 mx-auto mb-3" />
                          <p className="text-sm text-gray-500 mb-4">Ask anything about the calls</p>
                          <div className="space-y-2">
                            {['Where are we losing deals?', 'What objections come up most in demos?', 'Which rep has the best discovery scores?', 'Write an investor update on our sales process'].map((q, i) => (
                              <button key={i} onClick={() => setChatInput(q)} className="block w-full text-left text-sm px-3 py-2 bg-gray-50 hover:bg-green-50 rounded-lg text-gray-600 hover:text-green-700 border border-transparent hover:border-green-200">{q}</button>
                            ))}
                          </div>
                        </div>
                      )}
                      {chatMessages.map((msg, i) => (
                        <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                          <div className={`max-w-[90%] rounded-xl px-4 py-3 text-sm ${msg.role === 'user' ? 'bg-green-600 text-white' : msg.role === 'error' ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-gray-100 text-gray-800'}`}>
                            {msg.role === 'assistant'
                              ? <div className="prose prose-sm max-w-none text-gray-800 prose-p:my-1 prose-ul:my-1 prose-li:my-0.5"><ReactMarkdown>{msg.content}</ReactMarkdown></div>
                              : <p className="whitespace-pre-wrap">{msg.content}</p>}
                          </div>
                        </div>
                      ))}
                      {chatLoading && <div className="flex justify-start"><div className="bg-gray-100 rounded-xl px-4 py-3"><div className="flex gap-1">{[0,1,2].map(i => <div key={i} className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{animationDelay:`${i*0.15}s`}}/>)}</div></div></div>}
                      <div ref={chatEndRef} />
                    </div>
                    <div className="p-3 border-t">
                      <div className="flex gap-2">
                        <input type="text" value={chatInput} onChange={e => setChatInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendChat()}
                          placeholder="Ask about the calls…" disabled={chatLoading}
                          className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500" />
                        <button onClick={sendChat} disabled={chatLoading || !chatInput.trim()} className="p-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-40">
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
                <button onClick={() => toggleIgnore(selectedCall)} className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50">
                  {selectedCall.ignored ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                  {selectedCall.ignored ? 'Unignore' : 'Ignore'}
                </button>
                {selectedCall.gongUrl && (
                  <a href={selectedCall.gongUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 px-3 py-1.5 text-sm text-green-600 border border-green-200 rounded-lg hover:bg-green-50">
                    <ExternalLink className="w-3.5 h-3.5" /> Gong
                  </a>
                )}
                <button onClick={() => setSelectedCall(null)} className="p-2 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5 text-gray-500" /></button>
              </div>
            </div>

            {!selectedCall.analysis && (
              <div className="px-6 py-12 text-center">
                <AlertCircle className="w-10 h-10 text-amber-400 mx-auto mb-3" />
                <p className="text-gray-600 text-sm">This call hasn't been analyzed yet.</p>
              </div>
            )}

            {selectedCall.analysis && (
              <div className="px-6 py-6 space-y-6">

                {selectedCall.analysis.summary && (
                  <div>
                    <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Summary</h3>
                    <p className="text-sm text-gray-700 leading-relaxed">{selectedCall.analysis.summary}</p>
                  </div>
                )}

                {/* ICP + Discovery scores */}
                {(selectedCall.analysis.icp_score != null || selectedCall.analysis.discovery_score != null) && (
                  <div className="grid grid-cols-2 gap-4">
                    {selectedCall.analysis.icp_score != null && (
                      <div className="bg-gray-50 rounded-lg p-3">
                        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">ICP Fit</p>
                        <p className="text-2xl font-bold text-gray-800">{selectedCall.analysis.icp_score}<span className="text-sm text-gray-400 font-normal">/10</span></p>
                        {selectedCall.analysis.icp_rationale && <p className="text-xs text-gray-500 mt-1">{selectedCall.analysis.icp_rationale}</p>}
                      </div>
                    )}
                    {selectedCall.analysis.discovery_score != null && (
                      <div className="bg-gray-50 rounded-lg p-3">
                        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Discovery</p>
                        <p className="text-2xl font-bold text-gray-800">{selectedCall.analysis.discovery_score}<span className="text-sm text-gray-400 font-normal">/10</span></p>
                        {selectedCall.analysis.discovery_gaps?.length > 0 && (
                          <p className="text-xs text-amber-600 mt-1">{selectedCall.analysis.discovery_gaps.slice(0, 2).join(' · ')}</p>
                        )}
                      </div>
                    )}
                  </div>
                )}

                <div>
                  <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Talk Ratio</h3>
                  <TalkRatioBar ratio={selectedCall.analysis.rep_talk_ratio} />
                </div>

                {selectedCall.analysis.themes?.length > 0 && (
                  <div>
                    <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Themes</h3>
                    <div className="flex flex-wrap gap-2">
                      {selectedCall.analysis.themes.map((t, i) => <span key={i} className="px-2.5 py-1 bg-blue-50 text-blue-700 text-xs rounded-full font-medium">{t}</span>)}
                    </div>
                  </div>
                )}

                {selectedCall.analysis.objections?.length > 0 && (
                  <div>
                    <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Objections</h3>
                    <div className="space-y-3">
                      {selectedCall.analysis.objections.map((obj, i) => (
                        <div key={i} className="border border-gray-100 rounded-lg p-3 bg-gray-50">
                          <div className="flex items-center gap-2 mb-1.5"><CategoryBadge category={obj.category} /><p className="text-sm font-medium text-gray-800">{obj.text}</p></div>
                          {obj.rep_response && <p className="text-xs text-gray-500"><span className="font-medium text-gray-600">Rep responded: </span>{obj.rep_response}</p>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {(selectedCall.analysis.buying_signals?.length > 0 || selectedCall.analysis.red_flags?.length > 0) && (
                  <div className="grid grid-cols-2 gap-4">
                    {selectedCall.analysis.buying_signals?.length > 0 && (
                      <div>
                        <h3 className="text-xs font-semibold text-green-600 uppercase tracking-wide mb-2 flex items-center gap-1"><CheckCircle className="w-3.5 h-3.5" /> Buying Signals</h3>
                        <ul className="space-y-1.5">{selectedCall.analysis.buying_signals.map((s, i) => <li key={i} className="text-xs text-gray-600 flex items-start gap-1.5"><span className="text-green-500 mt-0.5">•</span>{s}</li>)}</ul>
                      </div>
                    )}
                    {selectedCall.analysis.red_flags?.length > 0 && (
                      <div>
                        <h3 className="text-xs font-semibold text-red-600 uppercase tracking-wide mb-2 flex items-center gap-1"><AlertCircle className="w-3.5 h-3.5" /> Red Flags</h3>
                        <ul className="space-y-1.5">{selectedCall.analysis.red_flags.map((f, i) => <li key={i} className="text-xs text-gray-600 flex items-start gap-1.5"><span className="text-red-400 mt-0.5">•</span>{f}</li>)}</ul>
                      </div>
                    )}
                  </div>
                )}

                {selectedCall.analysis.next_steps_mentioned?.length > 0 && (
                  <div>
                    <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Next Steps Mentioned</h3>
                    <ul className="space-y-1.5">
                      {selectedCall.analysis.next_steps_mentioned.map((s, i) => (
                        <li key={i} className="text-sm text-gray-600 flex items-start gap-2"><ChevronRight className="w-4 h-4 text-green-500 shrink-0 mt-0.5" />{s}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {selectedCall.analysis.competitor_mentions?.length > 0 && (
                  <div>
                    <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Competitor Mentions</h3>
                    <div className="space-y-2">
                      {selectedCall.analysis.competitor_mentions.map((c, i) => (
                        <div key={i} className="flex items-start gap-2 text-sm"><span className="font-medium text-yellow-700">{c.name}</span><span className="text-gray-500">— {c.context}</span></div>
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
