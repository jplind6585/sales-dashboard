import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { useRouter } from 'next/router'
import ReactMarkdown from 'react-markdown'
import {
  ArrowLeft, RefreshCw, Download, X, ExternalLink,
  Sparkles, Send, Phone, TrendingUp, TrendingDown, Minus,
  ChevronRight, AlertCircle, CheckCircle, Zap, Users,
  EyeOff, Eye, Info, Clock, Mail, Copy, BookOpen,
  PlayCircle, Flag, FileText, Building2,
} from 'lucide-react'
import UserMenu from '../../../components/auth/UserMenu'
import { useAuthStore } from '../../../stores/useAuthStore'
import PeriodDelta from '../../../components/common/PeriodDelta'

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

function BarRow({ label, count, maxCount, colorClass = 'bg-blue-500', badge, onClick, healthBadge }) {
  const numeric = typeof count === 'number' ? count : parseFloat(String(count))
  const pct = maxCount > 0 && !isNaN(numeric) ? Math.max(4, (numeric / maxCount) * 100) : 4
  const dashIdx = label.indexOf(' — ')
  const displayLabel = dashIdx !== -1 ? label.slice(0, dashIdx) : label
  return (
    <div
      className={`flex items-center gap-3 py-1.5 rounded-lg px-2 -mx-2 ${onClick ? 'cursor-pointer hover:bg-gray-50 group' : ''}`}
      onClick={onClick}
    >
      <div className="w-52 shrink-0">
        <div className={`text-sm text-gray-700 truncate ${onClick ? 'group-hover:text-gray-900' : ''}`} title={label}>{displayLabel}</div>
      </div>
      <div className="flex-1 bg-gray-100 rounded-full h-2">
        <div className={`${colorClass} h-2 rounded-full`} style={{ width: `${pct}%` }} />
      </div>
      {badge && <div className="shrink-0">{badge}</div>}
      {healthBadge && <div className="shrink-0">{healthBadge}</div>}
      <span className="text-sm text-gray-500 w-8 text-right shrink-0">{count}</span>
    </div>
  )
}

function sortDesc(arr, key) {
  if (!arr?.length) return []
  return [...arr].sort((a, b) => (b[key] ?? 0) - (a[key] ?? 0))
}

function formatStageName(stage) {
  if (!stage) return 'Unlinked'
  const map = {
    closedwon: 'Closed Won', closedlost: 'Closed Lost',
    introscheduled: 'Intro Scheduled', intro_scheduled: 'Intro Scheduled',
    activepursuit: 'Active Pursuit', active_pursuit: 'Active Pursuit',
    demo: 'Demo', solution_validation: 'Solution Validation',
    solutionvalidation: 'Solution Validation', proposal: 'Proposal',
    legal: 'Legal', qualifying: 'Qualifying',
  }
  return map[stage.toLowerCase()] || stage.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

const ACTION_TYPE_META = {
  coaching_task_create: { label: 'Coaching', icon: <Users className="w-3 h-3" />, cls: 'bg-purple-100 text-purple-700' },
  outreach_batch_create: { label: 'Outreach', icon: <Mail className="w-3 h-3" />, cls: 'bg-blue-100 text-blue-700' },
  flag_counter_for_review: { label: 'Flag Counter', icon: <Flag className="w-3 h-3" />, cls: 'bg-red-100 text-red-700' },
  process_doc_update: { label: 'Process', icon: <FileText className="w-3 h-3" />, cls: 'bg-amber-100 text-amber-700' },
  assign_review_task: { label: 'Review Task', icon: <CheckCircle className="w-3 h-3" />, cls: 'bg-gray-100 text-gray-600' },
}

function ActionTypeChip({ type }) {
  const meta = ACTION_TYPE_META[type] || { label: type || 'Action', icon: <Zap className="w-3 h-3" />, cls: 'bg-gray-100 text-gray-600' }
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${meta.cls}`}>
      {meta.icon}{meta.label}
    </span>
  )
}

function KPICard({ label, value, sub, valueColor = 'text-gray-900', delta }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 flex flex-col gap-1">
      <p className="text-xs text-gray-400 uppercase tracking-wide font-semibold">{label}</p>
      <div className="flex items-baseline gap-2">
        <p className={`text-2xl font-bold leading-tight ${valueColor}`}>{value}</p>
        {delta}
      </div>
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
  const [stageFilter, setStageFilter] = useState(null) // null = all; Set of stage strings = filtered
  const [showStageFilter, setShowStageFilter] = useState(false)
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

  const [timePeriod, setTimePeriod] = useState('6mo')
  const [coachingMap, setCoachingMap] = useState({})
  const [loadingCoaching, setLoadingCoaching] = useState(false)
  const [insightPanel, setInsightPanel] = useState(null) // { title, text, count, colorClass, calls, linkedAccounts, counter }
  const [priorAggregate, setPriorAggregate] = useState(null)
  const [aggregateComputedAt, setAggregateComputedAt] = useState(null)
  const [salesProcess, setSalesProcess] = useState(null)
  const [narrativeCopied, setNarrativeCopied] = useState(false)
  const [narrativeVersions, setNarrativeVersions] = useState([])
  const [showNarrativeHistory, setShowNarrativeHistory] = useState(false)
  const [confirmAction, setConfirmAction] = useState(null) // { action, idx }
  const [executingIdx, setExecutingIdx] = useState(null)
  const [executedMap, setExecutedMap] = useState({}) // idx → { taskId, url }
  const [dealRisks, setDealRisks] = useState([])
  const [loadingRisks, setLoadingRisks] = useState(false)

  const chatEndRef = useRef(null)
  const repFilterRef = useRef(null)
  const stageFilterRef = useRef(null)

  useEffect(() => {
    function handleClickOutside(e) {
      if (repFilterRef.current && !repFilterRef.current.contains(e.target)) setShowRepFilter(false)
      if (stageFilterRef.current && !stageFilterRef.current.contains(e.target)) setShowStageFilter(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  useEffect(() => {
    const saved = localStorage.getItem('banner_intel_sales_reps')
    if (saved) {
      try { setSalesReps(new Set(JSON.parse(saved))) } catch { /* ignore */ }
    } else {
      const defaults = ['James Lindberg', 'Logan King', 'Jovan Arsovski', 'Mark Murphy']
      setSalesReps(new Set(defaults))
      localStorage.setItem('banner_intel_sales_reps', JSON.stringify(defaults))
    }
    fetchCalls(); fetchAggregate(); fetchSalesProcess(); fetchNarrativeHistory(); fetchRisks()
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
      if (data.success && data.aggregate) {
        setAggregate(data.aggregate)
        setAggregateComputedAt(data.computedAt || null)
        if (data.priorAggregate) setPriorAggregate(data.priorAggregate)
      }
    } catch { /* silent */ }
  }

  async function fetchSalesProcess() {
    try {
      const res = await fetch('/api/sales-process')
      const data = await res.json()
      if (data.success && data.config) setSalesProcess(data.config)
    } catch { /* silent */ }
  }

  async function fetchRisks() {
    setLoadingRisks(true)
    try {
      const res = await fetch('/api/gong/intel-risk')
      const data = await res.json()
      if (data.success) setDealRisks(data.risks || [])
    } catch { /* silent */ }
    finally { setLoadingRisks(false) }
  }

  async function fetchNarrativeHistory() {
    try {
      const res = await fetch('/api/gong/intel-narrative-history')
      const data = await res.json()
      if (data.success) setNarrativeVersions(data.versions || [])
    } catch { /* silent */ }
  }

  async function saveNarrativeVersion(narrative) {
    try {
      await fetch('/api/gong/intel-narrative-history', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ narrative, callCount: analyzedCalls.length }),
      })
      await fetchNarrativeHistory()
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

  async function generateCoaching(call) {
    if (!call.analysis || loadingCoaching) return
    setLoadingCoaching(true)
    try {
      const res = await fetch('/api/gong/intel-coaching', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          analysis: call.analysis,
          callTitle: call.title,
          callType: call.callType,
          repName: call.repName,
          durationSeconds: call.durationSeconds,
        }),
      })
      const data = await res.json()
      if (data.coaching) setCoachingMap(prev => ({ ...prev, [call.gongCallId]: data.coaching }))
    } catch (e) { console.error('Coaching failed:', e) }
    finally { setLoadingCoaching(false) }
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

  const periodCutoff = { '7d': 7, '30d': 30, '6mo': 180 }[timePeriod]
  const periodCutoffDate = periodCutoff ? new Date(Date.now() - periodCutoff * 24 * 60 * 60 * 1000) : null

  // Stages that actually appear in loaded calls (excluding null/closedwon for active filtering)
  const availableStages = useMemo(() => {
    const stages = new Set(calls.map(c => c.dealStage).filter(Boolean))
    return [...stages].sort()
  }, [calls])

  // Per-stage aggregate metrics computed client-side from analyzed calls
  const stageBreakdown = useMemo(() => {
    if (!availableStages.length) return []
    return availableStages.map(stage => {
      const sc = analyzedCalls.filter(c => c.dealStage === stage)
      const icpScores = sc.map(c => c.analysis?.icp_score).filter(s => s != null)
      const discScores = sc.map(c => c.analysis?.discovery_score).filter(s => s != null)
      const ratios = sc.map(c => c.analysis?.rep_talk_ratio).filter(r => r != null)
      const sents = sc.map(c => c.analysis?.sentiment).filter(Boolean)
      const posCount = sents.filter(s => s === 'positive').length
      // Aggregate top objections for this stage
      const objCounts = {}
      sc.forEach(c => (c.analysis?.objections || []).forEach(o => { objCounts[o.text] = (objCounts[o.text] || 0) + 1 }))
      const topObjs = Object.entries(objCounts).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([text, count]) => ({ text, count }))
      return {
        name: stage,
        count: sc.length,
        avgIcp: icpScores.length ? (icpScores.reduce((a, b) => a + b, 0) / icpScores.length).toFixed(1) : null,
        avgDiscovery: discScores.length ? (discScores.reduce((a, b) => a + b, 0) / discScores.length).toFixed(1) : null,
        avgTalkRatio: ratios.length ? Math.round(ratios.reduce((a, b) => a + b, 0) / ratios.length) : null,
        positivePct: sents.length ? Math.round((posCount / sents.length) * 100) : null,
        topObjs,
      }
    }).sort((a, b) => b.count - a.count)
  }, [analyzedCalls, availableStages])

  const filteredCalls = calls
    .filter(c => !periodCutoffDate || !c.date || new Date(c.date) >= periodCutoffDate)
    .filter(c => salesReps == null || (c.repName && salesReps.has(c.repName)))
    .filter(c => stageFilter == null || (c.dealStage && stageFilter.has(c.dealStage)))
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
    { id: 'stage-breakdown', label: 'Stage Breakdown', disabled: false },
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

  async function openInsight({ title, text, count, colorClass, counter, isObjection }) {
    const stopWords = new Set(['about', 'their', 'these', 'which', 'where', 'there', 'being', 'never', 'every', 'often', 'first', 'deals', 'calls', 'sales', 'that', 'this', 'with', 'from', 'they', 'have', 'been', 'when', 'into', 'more', 'some', 'will'])
    const keywords = text.toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length > 4 && !stopWords.has(w))
    const relatedCalls = analyzedCalls
      .filter(c => {
        const blob = [
          c.analysis?.summary || '',
          ...(c.analysis?.red_flags || []),
          ...(c.analysis?.themes || []),
          ...(c.analysis?.objections?.map(o => o.text) || []),
          c.analysis?.disqualification_notes || '',
        ].join(' ').toLowerCase()
        return keywords.filter(kw => blob.includes(kw)).length >= 2
      })
      .sort((a, b) => (b.analysis?.icp_score || 0) - (a.analysis?.icp_score || 0))
      .slice(0, 8)

    setInsightPanel({ title, text, count, colorClass, counter, isObjection, calls: relatedCalls, linkedAccounts: null })

    // Fetch active pipeline accounts linked to these calls
    const accountIds = [...new Set(relatedCalls.map(c => c.accountId).filter(Boolean))]
    if (accountIds.length) {
      try {
        const res = await fetch('/api/gong/intel-linked-accounts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ accountIds }),
        })
        const data = await res.json()
        if (data.success) {
          setInsightPanel(prev => prev ? { ...prev, linkedAccounts: data.accounts || [] } : prev)
        }
      } catch { /* silent */ }
    } else {
      setInsightPanel(prev => prev ? { ...prev, linkedAccounts: [] } : prev)
    }
  }

  async function executeAction(action, idx) {
    setConfirmAction(null)
    setExecutingIdx(idx)
    try {
      const res = await fetch('/api/gong/intel-execute-action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      })
      const data = await res.json()
      if (data.success) {
        setExecutedMap(prev => ({ ...prev, [idx]: { taskId: data.taskId, url: data.artifactUrl } }))
      }
    } catch { /* silent */ }
    finally { setExecutingIdx(null) }
  }

  function findCounterForObjection(objectionText) {
    if (!salesProcess?.competitor_playbook) return null
    const text = (objectionText || '').toLowerCase()
    // Look for objection-handling sections in the competitor playbook or winning_tactics
    const tactics = salesProcess.winning_tactics || []
    const match = tactics.find(t => {
      const tText = (typeof t === 'string' ? t : t.tactic || t.description || '').toLowerCase()
      const tWords = tText.split(/\s+/).filter(w => w.length > 4)
      const kw = text.split(/\s+/).filter(w => w.length > 4)
      return kw.some(w => tText.includes(w)) || tWords.some(w => text.includes(w))
    })
    return match ? (typeof match === 'string' ? match : match.tactic || match.description) : null
  }

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

      {/* Rep + Stage filter bar */}
      {(allUsers.length > 0 || availableStages.length > 0) && (
        <div className="bg-white border-b border-gray-200 shrink-0 relative z-20 flex">
          {/* Rep filter */}
          {allUsers.length > 0 && (
          <div ref={repFilterRef} className="relative flex-1 px-6 py-2">
          <div className="flex items-center gap-3">
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
            <div className="absolute left-6 top-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg p-3 w-72 max-h-72 overflow-y-auto z-30">
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

          {/* Stage filter */}
          {availableStages.length > 0 && (
          <div ref={stageFilterRef} className="relative border-l border-gray-100">
            <div className="px-4 flex items-center gap-3 h-full py-1">
              <button
                onClick={() => setShowStageFilter(s => !s)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${stageFilter != null ? 'border-blue-400 bg-blue-50 text-blue-800' : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'}`}
              >
                <Building2 className="w-3.5 h-3.5" />
                {stageFilter != null ? `${stageFilter.size} stage${stageFilter.size !== 1 ? 's' : ''}` : 'All stages'}
                <ChevronRight className={`w-3.5 h-3.5 transition-transform ${showStageFilter ? 'rotate-90' : ''}`} />
              </button>
              {stageFilter != null && (
                <button onClick={() => setStageFilter(null)} className="text-xs text-gray-400 hover:text-gray-600 underline">Clear</button>
              )}
            </div>
            {showStageFilter && (
              <div className="absolute left-6 top-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg p-3 w-64 max-h-72 overflow-y-auto z-30">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Filter by stage</span>
                  <button onClick={() => setStageFilter(null)} className="text-xs text-gray-400 hover:text-gray-600">Reset</button>
                </div>
                {availableStages.map(stage => {
                  const active = stageFilter == null || stageFilter.has(stage)
                  const stageCallCount = calls.filter(c => c.dealStage === stage).length
                  return (
                    <label key={stage} className="flex items-center gap-2 py-1.5 cursor-pointer hover:bg-gray-50 rounded px-1">
                      <input type="checkbox" checked={active} onChange={() => {
                        setStageFilter(prev => {
                          const base = prev ?? new Set(availableStages)
                          const next = new Set(base)
                          if (next.has(stage)) next.delete(stage); else next.add(stage)
                          return next.size === availableStages.length ? null : next
                        })
                      }} className="accent-blue-600" />
                      <span className="text-sm text-gray-700 flex-1">{formatStageName(stage)}</span>
                      <span className="text-xs text-gray-400">{stageCallCount}</span>
                    </label>
                  )
                })}
              </div>
            )}
          </div>
          )}
        </div>
      )}

      {/* Time period filter */}
      <div className="bg-white border-b border-gray-200 px-6 py-2 shrink-0">
        <div className="max-w-[1400px] mx-auto flex items-center gap-2">
          <span className="text-xs text-gray-400 font-medium mr-1">Period:</span>
          {[
            { id: '7d', label: 'Last 7 days' },
            { id: '30d', label: 'Last 30 days' },
            { id: '6mo', label: 'Last 6 months' },
            { id: 'all', label: 'All time' },
          ].map(p => (
            <button key={p.id} onClick={() => setTimePeriod(p.id)}
              className={`px-3 py-1 text-xs rounded-full font-medium transition-colors ${timePeriod === p.id ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
              {p.label}
            </button>
          ))}
        </div>
      </div>

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
      {/* Single status line — shows data freshness. Banners only appear if action genuinely needed. */}
      {!loadingCalls && (unanalyzedCount > 0 || missingScoresCount > 0) && !analyzing && (
        <div className={`border-b px-6 py-2.5 shrink-0 ${unanalyzedCount > 0 ? 'bg-amber-50 border-amber-200' : 'bg-violet-50 border-violet-200'}`}>
          <div className="max-w-[1400px] mx-auto flex items-center justify-between">
            <div className="flex items-center gap-3 text-sm">
              <AlertCircle className={`w-4 h-4 shrink-0 ${unanalyzedCount > 0 ? 'text-amber-600' : 'text-violet-600'}`} />
              {unanalyzedCount > 0
                ? <span className="text-amber-800">{unanalyzedCount} call{unanalyzedCount > 1 ? 's' : ''} unanalyzed</span>
                : <span className="text-violet-800">{missingScoresCount} calls missing ICP/discovery scores</span>
              }
              {aggregateComputedAt && (
                <span className="text-gray-400 text-xs">· Last updated {new Date(aggregateComputedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {unanalyzedCount > 0 && (
                <>
                  {unanalyzedCount > 20 && (
                    <button onClick={() => runAnalysis(20)} className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-amber-400 text-amber-700 text-sm font-medium rounded-lg hover:bg-amber-50">
                      <Zap className="w-3.5 h-3.5" /> Analyze 20
                    </button>
                  )}
                  <button onClick={() => runAnalysis()} className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 text-white text-sm font-medium rounded-lg hover:bg-amber-600">
                    <Zap className="w-3.5 h-3.5" /> Analyze All ({unanalyzedCount})
                  </button>
                </>
              )}
              {unanalyzedCount === 0 && missingScoresCount > 0 && (
                <>
                  {missingScoresCount > 20 && (
                    <button onClick={() => runAnalysis(20, true)} className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-violet-400 text-violet-700 text-sm font-medium rounded-lg hover:bg-violet-50">
                      <Zap className="w-3.5 h-3.5" /> Update 20
                    </button>
                  )}
                  <button onClick={() => runAnalysis(null, true)} className="flex items-center gap-1.5 px-3 py-1.5 bg-violet-600 text-white text-sm font-medium rounded-lg hover:bg-violet-700">
                    <Zap className="w-3.5 h-3.5" /> Update All ({missingScoresCount})
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
      {!loadingCalls && unanalyzedCount === 0 && missingScoresCount === 0 && aggregateComputedAt && !analyzing && (
        <div className="bg-white border-b border-gray-100 px-6 py-1.5 shrink-0">
          <div className="max-w-[1400px] mx-auto">
            <span className="text-xs text-gray-400">
              {analyzedCalls.length} calls analyzed · Last updated {new Date(aggregateComputedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
            </span>
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
                  sub={`${activeCalls.filter(c => c.callType === 'intro').length} intro · ${activeCalls.filter(c => c.callType === 'demo').length} demo · ${activeCalls.filter(c => c.callType === 'solution_validation').length} follow-up`}
                  delta={priorAggregate ? <PeriodDelta current={analyzedCalls.length} prior={priorAggregate._call_count_snapshot || null} direction="higher_better" /> : null} />
                <KPICard label="Positive Sentiment"
                  value={positivePct !== null ? `${positivePct}%` : '—'}
                  sub={`${sentBreakdown.neutral || 0} neutral · ${sentBreakdown.negative || 0} negative`}
                  valueColor={positivePct >= 60 ? 'text-green-600' : positivePct >= 40 ? 'text-amber-600' : 'text-red-600'}
                  delta={priorAggregate ? (() => {
                    const prior = priorAggregate.sentiment_breakdown || {}
                    const tot = (prior.positive || 0) + (prior.neutral || 0) + (prior.negative || 0)
                    const priorPct = tot > 0 ? Math.round((prior.positive || 0) / tot * 100) : null
                    return <PeriodDelta current={positivePct} prior={priorPct} format="percent" direction="higher_better" />
                  })() : null} />
                <KPICard label="Avg ICP Fit"
                  value={aggregate.avg_icp_score ? `${aggregate.avg_icp_score}/10` : '—'}
                  sub={aggregate.avg_icp_score ? (aggregate.avg_icp_score >= 7 ? 'Strong pipeline fit' : aggregate.avg_icp_score >= 5 ? 'Mixed fit — review ICP' : 'Weak fit — off-ICP volume') : null}
                  valueColor={aggregate.avg_icp_score >= 7 ? 'text-green-600' : aggregate.avg_icp_score >= 5 ? 'text-amber-600' : 'text-red-600'}
                  delta={priorAggregate?.avg_icp_score ? <PeriodDelta current={aggregate.avg_icp_score} prior={priorAggregate.avg_icp_score} format="score" direction="higher_better" /> : null} />
                <KPICard label="Avg Discovery"
                  value={aggregate.avg_discovery_score ? `${aggregate.avg_discovery_score}/10` : '—'}
                  sub={aggregate.avg_discovery_score ? (aggregate.avg_discovery_score >= 7 ? 'Solid MEDDICC coverage' : 'Discovery gaps present') : null}
                  valueColor={aggregate.avg_discovery_score >= 7 ? 'text-green-600' : aggregate.avg_discovery_score >= 5 ? 'text-amber-600' : 'text-red-600'}
                  delta={priorAggregate?.avg_discovery_score ? <PeriodDelta current={aggregate.avg_discovery_score} prior={priorAggregate.avg_discovery_score} format="score" direction="higher_better" /> : null} />
                <KPICard label="Avg Talk Ratio"
                  value={aggregate.avg_rep_talk_ratio ? `${aggregate.avg_rep_talk_ratio}%` : '—'}
                  sub="rep speaking time"
                  valueColor={aggregate.avg_rep_talk_ratio <= 55 ? 'text-green-600' : aggregate.avg_rep_talk_ratio <= 65 ? 'text-amber-600' : 'text-red-600'}
                  delta={priorAggregate?.avg_rep_talk_ratio ? <PeriodDelta current={aggregate.avg_rep_talk_ratio} prior={priorAggregate.avg_rep_talk_ratio} format="percent" direction="lower_better" /> : null} />
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

                      {/* Action cards */}
                      {aggregate.weekly_actions?.length > 0 && (
                        <div>
                          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">This Week's Actions</p>
                          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                            {aggregate.weekly_actions.slice(0, 3).map((action, idx) => {
                              const done = executedMap[idx]
                              const executing = executingIdx === idx
                              const canExecute = ['coaching_task_create', 'outreach_batch_create'].includes(action.action_type)
                              const urgencyBorder = action.urgency === 'high' ? 'border-l-red-400' : action.urgency === 'medium' ? 'border-l-amber-400' : 'border-l-gray-300'
                              return (
                                <div key={idx} className={`bg-white rounded-xl border border-gray-200 border-l-4 ${urgencyBorder} p-5 flex flex-col gap-3`}>
                                  <div className="flex items-center justify-between">
                                    <ActionTypeChip type={action.action_type} />
                                    <span className={`text-xs font-medium ${action.urgency === 'high' ? 'text-red-500' : action.urgency === 'medium' ? 'text-amber-600' : 'text-gray-400'}`}>
                                      {action.urgency}
                                    </span>
                                  </div>
                                  <div className="flex-1">
                                    <p className="text-sm font-semibold text-gray-900 leading-snug">{action.title}</p>
                                    <p className="text-xs text-gray-500 mt-1.5 leading-relaxed">{action.description}</p>
                                  </div>
                                  {action.scope && (
                                    <p className="text-xs text-gray-400 border-t border-gray-100 pt-2">{action.scope}</p>
                                  )}
                                  {done ? (
                                    <a href={done.url} className="flex items-center gap-1.5 text-xs font-medium text-green-600 hover:text-green-700">
                                      <CheckCircle className="w-3.5 h-3.5" /> Created · View in Tasks
                                    </a>
                                  ) : canExecute ? (
                                    <button
                                      onClick={() => setConfirmAction({ action, idx })}
                                      disabled={executing || executingIdx != null}
                                      className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-900 text-white text-xs font-medium rounded-lg hover:bg-gray-700 disabled:opacity-50 self-start"
                                    >
                                      <Zap className="w-3 h-3" />
                                      {executing ? 'Creating…' : 'Execute'}
                                    </button>
                                  ) : (
                                    <span className="text-xs text-gray-400 italic">Manual action</span>
                                  )}
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      )}

                      {/* Loss reasons — primary section */}
                      {aggregate.loss_reasons?.length > 0 && (
                        <div className="bg-white rounded-xl border border-red-100 p-6">
                          <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-4 flex items-center gap-2">
                            <TrendingDown className="w-4 h-4 text-red-500" /> Why Deals Go Cold
                          </h3>
                          <div className="space-y-0.5">
                            {sortDesc(aggregate.loss_reasons, 'pct_of_negative_calls').map((lr, i) => (
                              <BarRow key={i} label={lr.reason}
                                count={lr.pct_of_negative_calls}
                                maxCount={sortDesc(aggregate.loss_reasons, 'pct_of_negative_calls')[0].pct_of_negative_calls}
                                colorClass="bg-red-400"
                                onClick={() => openInsight({ title: 'Why Deals Go Cold', text: lr.reason, count: lr.pct_of_negative_calls, colorClass: 'bg-red-400' })} />
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Buyer priorities */}
                      {(aggregate.buyer_priorities?.length > 0 || aggregate.top_themes?.length > 0) && (
                        <div className="bg-white rounded-xl border border-gray-200 p-6">
                          <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-4">What Buyers Care About</h3>
                          <div className="space-y-0.5">
                            {sortDesc(aggregate.buyer_priorities || aggregate.top_themes, 'count').slice(0, 8).map((item, i) => {
                              const label = typeof item === 'string' ? item : (item.priority || item.theme)
                              const sorted = sortDesc(aggregate.buyer_priorities || aggregate.top_themes, 'count')
                              return (
                                <BarRow key={i}
                                  label={label}
                                  count={item.count || 0}
                                  maxCount={sorted[0]?.count || 1}
                                  colorClass="bg-blue-500"
                                  onClick={() => openInsight({ title: 'What Buyers Care About', text: label, count: item.count, colorClass: 'bg-blue-500' })} />
                              )
                            })}
                          </div>
                        </div>
                      )}

                      {/* Key insights — structured action queue */}
                      {aggregate.key_insights?.length > 0 && (
                        <div className="bg-white rounded-xl border border-gray-200 p-6">
                          <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-4 flex items-center gap-2">
                            <Zap className="w-4 h-4 text-green-600" /> Key Insights
                          </h3>
                          {/* Structured table format (new AI output) */}
                          {typeof aggregate.key_insights[0] === 'object' ? (
                            <div className="overflow-x-auto">
                              <table className="w-full text-sm">
                                <thead>
                                  <tr className="border-b border-gray-100">
                                    <th className="text-left py-2 text-xs text-gray-400 font-semibold uppercase tracking-wide pr-4 w-8"></th>
                                    <th className="text-left py-2 text-xs text-gray-400 font-semibold uppercase tracking-wide pr-4">Signal</th>
                                    <th className="text-left py-2 text-xs text-gray-400 font-semibold uppercase tracking-wide pr-4">Scope</th>
                                    <th className="text-left py-2 text-xs text-gray-400 font-semibold uppercase tracking-wide pr-4">Recommended Action</th>
                                    <th className="text-left py-2 text-xs text-gray-400 font-semibold uppercase tracking-wide"></th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {[...aggregate.key_insights].sort((a, b) => {
                                    const order = { high: 0, medium: 1, low: 2 }
                                    return (order[a.urgency] ?? 1) - (order[b.urgency] ?? 1)
                                  }).map((insight, i) => (
                                    <tr key={i} className="border-b border-gray-50 hover:bg-gray-50">
                                      <td className="py-3 pr-4">
                                        <span className={`inline-flex w-5 h-5 rounded-full items-center justify-center text-xs font-bold ${
                                          insight.urgency === 'high' ? 'bg-red-100 text-red-700' :
                                          insight.urgency === 'medium' ? 'bg-amber-100 text-amber-700' :
                                          'bg-gray-100 text-gray-500'
                                        }`}>{i + 1}</span>
                                      </td>
                                      <td className="py-3 pr-4 font-medium text-gray-800 max-w-[220px]">{insight.signal}</td>
                                      <td className="py-3 pr-4 text-xs text-gray-500 max-w-[140px]">
                                        {insight.scope}
                                        {insight.scope_reps?.filter(Boolean).length > 0 && (
                                          <div className="mt-0.5">{insight.scope_reps.join(', ')}</div>
                                        )}
                                      </td>
                                      <td className="py-3 pr-4 text-sm text-gray-600 max-w-[200px]">{insight.recommended_action}</td>
                                      <td className="py-3">
                                        <ActionTypeChip type={insight.action_type} />
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          ) : (
                            // Legacy string format fallback
                            <ul className="space-y-3">
                              {aggregate.key_insights.map((insight, i) => (
                                <li key={i} className="flex items-start gap-3">
                                  <span className="w-5 h-5 rounded-full bg-green-100 text-green-700 text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">{i + 1}</span>
                                  <span className="text-sm text-gray-700">{insight}</span>
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      )}

                      {/* Objections + Win/Loss */}
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {aggregate.top_objections?.length > 0 && (
                          <div className="bg-white rounded-xl border border-gray-200 p-6">
                            <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-1">Top Objections</h3>
                            <p className="text-xs text-gray-400 mb-4">Click any row to see the counter-tactic and related deals</p>
                            <div className="space-y-1">
                              {sortDesc(aggregate.top_objections, 'count').map((obj, i) => {
                                const counter = findCounterForObjection(obj.text)
                                return (
                                  <BarRow key={i} label={obj.text} count={obj.count}
                                    maxCount={sortDesc(aggregate.top_objections, 'count')[0].count}
                                    colorClass={CATEGORY_COLORS[obj.category]?.split(' ')[0] || 'bg-red-400'}
                                    badge={<CategoryBadge category={obj.category} />}
                                    onClick={() => openInsight({ title: 'Objection', text: obj.text, count: obj.count, colorClass: CATEGORY_COLORS[obj.category]?.split(' ')[0] || 'bg-red-400', counter, isObjection: true })} />
                                )
                              })}
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
                                    {['Rep', 'Calls', 'ICP', 'Discovery', 'Positive %', ''].map(h => (
                                      <th key={h} className="text-left py-2 text-xs text-gray-400 font-semibold uppercase tracking-wide pr-3">{h}</th>
                                    ))}
                                  </tr>
                                </thead>
                                <tbody>
                                  {aggregate.rep_stats.map((rep, i) => {
                                    const isRamping = (rep.call_count || 0) < 10
                                    const prior = priorAggregate?.rep_stats?.find(r => r.rep === rep.rep)
                                    return (
                                      <tr key={i} className="border-b border-gray-50 hover:bg-gray-50">
                                        <td className="py-3 font-medium text-gray-800 pr-3">
                                          <div className="flex items-center gap-2">
                                            {rep.rep}
                                            {isRamping && <span className="text-xs px-1.5 py-0.5 bg-blue-100 text-blue-600 rounded font-medium">ramping</span>}
                                          </div>
                                        </td>
                                        <td className="py-3 text-gray-600 pr-3">
                                          {rep.call_count}
                                          {prior && <PeriodDelta current={rep.call_count} prior={prior.call_count} direction="higher_better" className="ml-1" />}
                                        </td>
                                        <td className="py-3 pr-3">
                                          <ScoreBadge score={rep.avg_icp_score} type="icp" />
                                          {prior?.avg_icp_score && <PeriodDelta current={rep.avg_icp_score} prior={prior.avg_icp_score} format="score" direction="higher_better" className="ml-1" />}
                                        </td>
                                        <td className="py-3 pr-3">
                                          <ScoreBadge score={rep.avg_discovery_score} type="discovery" />
                                          {prior?.avg_discovery_score && <PeriodDelta current={rep.avg_discovery_score} prior={prior.avg_discovery_score} format="score" direction="higher_better" className="ml-1" />}
                                        </td>
                                        <td className={`py-3 font-medium pr-3 ${(rep.positive_pct || 0) >= 60 ? 'text-green-600' : (rep.positive_pct || 0) >= 40 ? 'text-amber-600' : 'text-red-600'}`}>
                                          {rep.positive_pct !== undefined ? `${rep.positive_pct}%` : '—'}
                                          {prior?.positive_pct != null && <PeriodDelta current={rep.positive_pct} prior={prior.positive_pct} format="percent" direction="higher_better" className="ml-1" />}
                                        </td>
                                        <td className="py-3">
                                          <button
                                            onClick={() => router.push(`/modules/sales-reports/coaching?rep=${encodeURIComponent(rep.rep)}`)}
                                            className="text-xs text-gray-400 hover:text-green-600 flex items-center gap-1 whitespace-nowrap"
                                          >
                                            <BookOpen className="w-3 h-3" /> Coaching
                                          </button>
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

                      {/* Deals at Risk */}
                      {(loadingRisks || dealRisks.length > 0) && (
                        <div className="bg-white rounded-xl border border-gray-200 p-6">
                          <div className="flex items-center justify-between mb-4">
                            <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide flex items-center gap-2">
                              <AlertCircle className="w-4 h-4 text-amber-500" /> Deals at Risk
                            </h3>
                            <button onClick={fetchRisks} className="text-xs text-gray-400 hover:text-gray-600">Refresh</button>
                          </div>
                          {loadingRisks ? (
                            <div className="text-sm text-gray-400">Loading…</div>
                          ) : (
                            <div className="overflow-x-auto">
                              <table className="w-full text-sm">
                                <thead>
                                  <tr className="border-b border-gray-100">
                                    {['Account', 'Stage', 'Last Call', 'Risk', 'Reasons'].map(h => (
                                      <th key={h} className="text-left py-2 text-xs text-gray-400 font-semibold uppercase tracking-wide pr-4">{h}</th>
                                    ))}
                                  </tr>
                                </thead>
                                <tbody>
                                  {dealRisks.slice(0, 8).map((r, i) => (
                                    <tr key={i} className="border-b border-gray-50 hover:bg-gray-50">
                                      <td className="py-3 font-medium text-gray-800 pr-4 max-w-[160px] truncate">{r.accountName}</td>
                                      <td className="py-3 text-gray-500 pr-4 text-xs whitespace-nowrap">{formatStageName(r.stage)}</td>
                                      <td className="py-3 text-gray-500 pr-4 text-xs whitespace-nowrap">
                                        {r.lastCallDate
                                          ? `${r.daysSinceLastCall}d ago`
                                          : <span className="text-red-400">No calls</span>}
                                      </td>
                                      <td className="py-3 pr-4">
                                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${
                                          r.riskLevel === 'high' ? 'bg-red-100 text-red-700'
                                          : r.riskLevel === 'medium' ? 'bg-amber-100 text-amber-700'
                                          : 'bg-green-100 text-green-700'
                                        }`}>{r.riskLevel} · {r.riskScore}</span>
                                      </td>
                                      <td className="py-3 text-xs text-gray-500">{r.riskReasons.join(' · ')}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                              {dealRisks.filter(r => r.riskLevel === 'high').length === 0 && (
                                <p className="text-xs text-green-600 mt-3 flex items-center gap-1.5"><CheckCircle className="w-3.5 h-3.5" /> No high-risk deals — all active accounts have recent activity</p>
                              )}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Investor narrative */}
                      {aggregate.investor_narrative && (
                        <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-xl p-6">
                          <div className="flex items-start justify-between mb-3">
                            <div>
                              <h3 className="text-sm font-semibold text-green-800 uppercase tracking-wide flex items-center gap-2">
                                <TrendingUp className="w-4 h-4" /> Investor Narrative
                              </h3>
                              {aggregateComputedAt && (
                                <p className="text-xs text-green-600 mt-0.5">
                                  Last updated {new Date(aggregateComputedAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                                </p>
                              )}
                            </div>
                            <div className="flex items-center gap-2 shrink-0 ml-4">
                              <button
                                onClick={() => {
                                  navigator.clipboard.writeText(aggregate.investor_narrative)
                                  setNarrativeCopied(true)
                                  setTimeout(() => setNarrativeCopied(false), 2000)
                                  saveNarrativeVersion(aggregate.investor_narrative)
                                }}
                                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${narrativeCopied ? 'bg-green-200 text-green-800 border-green-300' : 'bg-white text-green-700 border-green-300 hover:bg-green-50'}`}
                              >
                                <Copy className="w-3.5 h-3.5" />
                                {narrativeCopied ? 'Copied!' : 'Copy'}
                              </button>
                              <button
                                onClick={() => {
                                  const blob = new Blob([aggregate.investor_narrative], { type: 'text/plain' })
                                  const a = document.createElement('a')
                                  a.href = URL.createObjectURL(blob)
                                  a.download = `investor-narrative-${new Date().toISOString().split('T')[0]}.txt`
                                  a.click()
                                }}
                                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border bg-white text-green-700 border-green-300 hover:bg-green-50"
                              >
                                <Download className="w-3.5 h-3.5" /> Export
                              </button>
                              {narrativeVersions.length > 0 && (
                                <button
                                  onClick={() => setShowNarrativeHistory(h => !h)}
                                  className="text-xs text-green-600 hover:text-green-800 underline"
                                >
                                  {showNarrativeHistory ? 'Hide' : `${narrativeVersions.length} prior version${narrativeVersions.length > 1 ? 's' : ''}`}
                                </button>
                              )}
                            </div>
                          </div>
                          <p className="text-gray-700 leading-relaxed">{aggregate.investor_narrative}</p>
                          {showNarrativeHistory && narrativeVersions.length > 0 && (
                            <div className="mt-4 border-t border-green-200 pt-4 space-y-3">
                              <p className="text-xs font-semibold text-green-700 uppercase tracking-wide">Version History</p>
                              {narrativeVersions.map((v, i) => (
                                <div key={i} className="bg-white/60 rounded-lg p-3 border border-green-100">
                                  <p className="text-xs text-green-600 mb-1">{new Date(v.generated_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })}{v.call_count ? ` · ${v.call_count} calls` : ''}</p>
                                  <p className="text-sm text-gray-600 leading-relaxed line-clamp-3">{v.narrative}</p>
                                  <button
                                    onClick={() => { navigator.clipboard.writeText(v.narrative) }}
                                    className="text-xs text-gray-400 hover:text-gray-600 mt-1"
                                  >Copy this version</button>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* ── Stage Breakdown tab ── */}
                  {activeTab === 'stage-breakdown' && (
                    <div className="space-y-6">
                      {availableStages.length === 0 ? (
                        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
                          <Building2 className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                          <h3 className="text-lg font-semibold text-gray-700 mb-2">No stage data yet</h3>
                          <p className="text-gray-500 text-sm mb-5">Sync HubSpot to link calls to deals — each call will be tagged with the deal's pipeline stage so you can compare performance across stages.</p>
                          <button onClick={runEnrichment} disabled={enriching}
                            className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 disabled:opacity-50">
                            <RefreshCw className={`w-4 h-4 ${enriching ? 'animate-spin' : ''}`} />
                            {enriching ? 'Syncing…' : 'Sync HubSpot'}
                          </button>
                        </div>
                      ) : (
                        <>
                          <p className="text-sm text-gray-500">{availableStages.length} stages · metrics computed from {analyzedCalls.filter(c => c.dealStage).length} analyzed calls with stage data</p>
                          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                            {stageBreakdown.map(stage => (
                              <div key={stage.name} className="bg-white rounded-xl border border-gray-200 p-5">
                                <div className="flex items-center justify-between mb-3">
                                  <h3 className="font-semibold text-gray-800">{formatStageName(stage.name)}</h3>
                                  <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">{stage.count} call{stage.count !== 1 ? 's' : ''}</span>
                                </div>
                                <div className="grid grid-cols-2 gap-3 mb-4">
                                  <div className="bg-gray-50 rounded-lg p-2.5">
                                    <p className="text-xs text-gray-400 mb-0.5">Avg ICP Fit</p>
                                    <p className={`text-xl font-bold ${stage.avgIcp >= 7 ? 'text-green-600' : stage.avgIcp >= 5 ? 'text-amber-600' : 'text-red-600'}`}>
                                      {stage.avgIcp ?? '—'}{stage.avgIcp && <span className="text-xs font-normal text-gray-400">/10</span>}
                                    </p>
                                  </div>
                                  <div className="bg-gray-50 rounded-lg p-2.5">
                                    <p className="text-xs text-gray-400 mb-0.5">Avg Discovery</p>
                                    <p className={`text-xl font-bold ${stage.avgDiscovery >= 7 ? 'text-green-600' : stage.avgDiscovery >= 5 ? 'text-amber-600' : 'text-red-600'}`}>
                                      {stage.avgDiscovery ?? '—'}{stage.avgDiscovery && <span className="text-xs font-normal text-gray-400">/10</span>}
                                    </p>
                                  </div>
                                  <div className="bg-gray-50 rounded-lg p-2.5">
                                    <p className="text-xs text-gray-400 mb-0.5">Talk Ratio</p>
                                    <p className={`text-xl font-bold ${stage.avgTalkRatio <= 55 ? 'text-green-600' : stage.avgTalkRatio <= 65 ? 'text-amber-600' : 'text-red-600'}`}>
                                      {stage.avgTalkRatio != null ? `${stage.avgTalkRatio}%` : '—'}
                                    </p>
                                  </div>
                                  <div className="bg-gray-50 rounded-lg p-2.5">
                                    <p className="text-xs text-gray-400 mb-0.5">Positive %</p>
                                    <p className={`text-xl font-bold ${stage.positivePct >= 60 ? 'text-green-600' : stage.positivePct >= 40 ? 'text-amber-600' : 'text-red-600'}`}>
                                      {stage.positivePct != null ? `${stage.positivePct}%` : '—'}
                                    </p>
                                  </div>
                                </div>
                                {stage.topObjs.length > 0 && (
                                  <div>
                                    <p className="text-xs text-gray-400 font-semibold uppercase tracking-wide mb-1.5">Top Objections</p>
                                    <div className="space-y-1">
                                      {stage.topObjs.map((obj, i) => {
                                        const maxCount = stage.topObjs[0]?.count || 1
                                        return (
                                          <div key={i} className="flex items-center gap-2">
                                            <div className="flex-1 bg-gray-100 rounded-full h-1.5">
                                              <div className="bg-red-400 h-1.5 rounded-full" style={{ width: `${Math.max(10, (obj.count / maxCount) * 100)}%` }} />
                                            </div>
                                            <span className="text-xs text-gray-600 shrink-0 max-w-[140px] truncate" title={obj.text}>{obj.text}</span>
                                            <span className="text-xs text-gray-400 w-4 text-right">{obj.count}</span>
                                          </div>
                                        )
                                      })}
                                    </div>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </>
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
                                { label: 'Disqual.', field: null },
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
                                <td className="px-4 py-3" onClick={() => !call.ignored && setSelectedCall(call)} style={{cursor: call.ignored ? 'default' : 'pointer'}}>
                                  {call.analysis?.disqualification_signal
                                    ? <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-orange-100 text-orange-700 text-xs rounded-full font-medium"><AlertCircle className="w-3 h-3" />Soft</span>
                                    : null}
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

      {/* Action confirmation modal */}
      {confirmAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setConfirmAction(null)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900">Confirm action</h3>
              <button onClick={() => setConfirmAction(null)} className="p-1 hover:bg-gray-100 rounded-lg">
                <X className="w-4 h-4 text-gray-400" />
              </button>
            </div>
            <div className="mb-4">
              <ActionTypeChip type={confirmAction.action.action_type} />
              <p className="font-semibold text-gray-900 mt-3 mb-1">{confirmAction.action.title}</p>
              <p className="text-sm text-gray-600 leading-relaxed">{confirmAction.action.description}</p>
              {(confirmAction.action.target_rep || confirmAction.action.target_account) && (
                <p className="text-xs text-gray-400 mt-2">
                  {confirmAction.action.target_rep && `Rep: ${confirmAction.action.target_rep}`}
                  {confirmAction.action.target_account && `Account: ${confirmAction.action.target_account}`}
                </p>
              )}
            </div>
            <p className="text-xs text-gray-400 mb-5 bg-gray-50 rounded-lg p-3">
              This will create a task in the Tasks module and assign it to you. You can edit or delete it there.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmAction(null)} className="flex-1 px-4 py-2 border border-gray-200 text-gray-600 rounded-lg text-sm hover:bg-gray-50">
                Cancel
              </button>
              <button
                onClick={() => executeAction(confirmAction.action, confirmAction.idx)}
                className="flex-1 px-4 py-2 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-700"
              >
                Create Task
              </button>
            </div>
          </div>
        </div>
      )}

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

                {/* Disqualification signal */}
                {selectedCall.analysis.disqualification_signal && (
                  <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                    <h3 className="text-xs font-semibold text-orange-700 uppercase tracking-wide mb-1 flex items-center gap-1.5">
                      <AlertCircle className="w-3.5 h-3.5" /> Disqualification Signal
                    </h3>
                    <p className="text-sm text-orange-800">{selectedCall.analysis.disqualification_notes || 'Call ended without a clear mutual next step — this deal may be limping along.'}</p>
                  </div>
                )}

                {/* Coaching card */}
                <div className="border-t border-gray-100 pt-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5" /> Coaching
                    </h3>
                    {!coachingMap[selectedCall.gongCallId] && (
                      <button
                        onClick={() => generateCoaching(selectedCall)}
                        disabled={loadingCoaching}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 text-white text-xs font-medium rounded-lg hover:bg-green-700 disabled:opacity-50"
                      >
                        {loadingCoaching ? 'Generating…' : 'Get Coaching'}
                      </button>
                    )}
                    {coachingMap[selectedCall.gongCallId] && (
                      <button
                        onClick={() => generateCoaching(selectedCall)}
                        disabled={loadingCoaching}
                        className="text-xs text-gray-400 hover:text-gray-600 disabled:opacity-50"
                      >
                        {loadingCoaching ? 'Generating…' : 'Regenerate'}
                      </button>
                    )}
                  </div>
                  {coachingMap[selectedCall.gongCallId] ? (
                    <div className="prose prose-sm max-w-none text-gray-700 prose-p:my-1 prose-ul:my-1 prose-li:my-0.5 prose-strong:text-gray-900">
                      <ReactMarkdown>{coachingMap[selectedCall.gongCallId]}</ReactMarkdown>
                    </div>
                  ) : (
                    <p className="text-xs text-gray-400 italic">Click "Get Coaching" to generate specific feedback for this call.</p>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Insight detail panel */}
      {insightPanel && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-black/30" onClick={() => setInsightPanel(null)} />
          <div className="relative bg-white w-full max-w-lg h-full overflow-y-auto shadow-2xl flex flex-col">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-start justify-between z-10">
              <div className="pr-4 flex-1">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">{insightPanel.title}</p>
                {(() => {
                  const dashIdx = insightPanel.text.indexOf(' — ')
                  const headline = dashIdx !== -1 ? insightPanel.text.slice(0, dashIdx) : insightPanel.text
                  const detail = dashIdx !== -1 ? insightPanel.text.slice(dashIdx + 3) : null
                  return (
                    <>
                      <h2 className="font-bold text-gray-900 leading-snug">{headline}</h2>
                      {detail && <p className="text-sm text-gray-600 mt-1 leading-relaxed">{detail}</p>}
                    </>
                  )
                })()}
                {insightPanel.count != null && (
                  <p className="text-xs text-gray-400 mt-2">
                    {typeof insightPanel.count === 'number' && insightPanel.count <= 100
                      ? `${insightPanel.count}% of negative calls`
                      : `${insightPanel.count} mentions`}
                  </p>
                )}
              </div>
              <button onClick={() => setInsightPanel(null)} className="p-2 hover:bg-gray-100 rounded-lg shrink-0">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <div className="px-6 py-6 flex-1 space-y-6">

              {/* Counter-tactic (objections only) */}
              {insightPanel.isObjection && (
                <div>
                  <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2 flex items-center gap-2">
                    <BookOpen className="w-3.5 h-3.5" /> Counter-Tactic
                  </h3>
                  {insightPanel.counter ? (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                      <p className="text-sm text-gray-700 leading-relaxed">{insightPanel.counter}</p>
                      <button
                        onClick={() => router.push('/modules/sales-processes')}
                        className="text-xs text-green-600 hover:text-green-800 mt-2 underline"
                      >Edit in Sales Processes →</button>
                    </div>
                  ) : (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm text-red-700">No counter-tactic documented for this objection.</p>
                        <button
                          onClick={() => router.push('/modules/sales-processes')}
                          className="text-xs text-red-600 hover:text-red-800 mt-1 underline"
                        >Add one in Sales Processes →</button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Active pipeline deals linked to this finding */}
              <div>
                <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3 flex items-center gap-2">
                  <Building2 className="w-3.5 h-3.5" /> Active Deals Affected
                  {insightPanel.linkedAccounts != null && (
                    <span className="bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded text-xs font-medium">
                      {insightPanel.linkedAccounts.length}
                    </span>
                  )}
                </h3>
                {insightPanel.linkedAccounts === null ? (
                  <div className="flex items-center gap-2 text-sm text-gray-400">
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Loading live deals…
                  </div>
                ) : insightPanel.linkedAccounts.length === 0 ? (
                  <p className="text-sm text-gray-400 italic">No active pipeline deals linked to these calls.</p>
                ) : (
                  <div className="space-y-2">
                    {insightPanel.linkedAccounts.map(account => (
                      <button
                        key={account.id}
                        onClick={() => router.push(`/modules/account-pipeline?account=${account.id}`)}
                        className="w-full text-left bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg p-3 transition-colors"
                      >
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-medium text-gray-800">{account.name}</p>
                          <ChevronRight className="w-4 h-4 text-gray-400 shrink-0" />
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-xs text-blue-600 capitalize">{account.stage?.replace(/_/g, ' ')}</span>
                          {account.repName && <span className="text-xs text-gray-400">· {account.repName}</span>}
                          {account.dealValue && <span className="text-xs text-green-600">· ${(account.dealValue / 1000).toFixed(0)}K</span>}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Related calls */}
              <div>
                <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3 flex items-center gap-2">
                  <Phone className="w-3.5 h-3.5" /> Related Calls
                  {insightPanel.calls.length > 0 && (
                    <span className="bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded text-xs font-medium">{insightPanel.calls.length}</span>
                  )}
                </h3>
                {insightPanel.calls.length === 0 ? (
                  <p className="text-sm text-gray-400 italic">No specific calls matched — this pattern was identified across many calls in aggregate.</p>
                ) : (
                  <div className="space-y-2">
                    {insightPanel.calls.map(call => (
                      <button
                        key={call.gongCallId}
                        onClick={() => { setSelectedCall(call); setInsightPanel(null) }}
                        className="w-full text-left bg-gray-50 hover:bg-green-50 border border-gray-200 hover:border-green-300 rounded-lg p-3 transition-colors"
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <TypeBadge type={call.callType} />
                          {call.analysis?.sentiment && <SentimentBadge sentiment={call.analysis.sentiment} />}
                          {call.analysis?.icp_score != null && <ScoreBadge score={call.analysis.icp_score} type="icp" />}
                        </div>
                        <p className="text-sm font-medium text-gray-800 leading-tight">{call.title}</p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {call.repName} · {call.date ? new Date(call.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
                        </p>
                        {call.analysis?.summary && (
                          <p className="text-xs text-gray-500 mt-1.5 line-clamp-2">{call.analysis.summary}</p>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
