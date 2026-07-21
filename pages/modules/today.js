import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/router';
import {
  Building2, Send, TrendingUp, Users, BarChart3,
  ChevronDown, ChevronUp, ChevronRight, X, RefreshCw,
  Calendar, Clock, Loader2, AlertCircle, CheckCircle2,
  Sparkles, ArrowRight, Target, Info, Phone, Mail,
  Linkedin, MessageSquare, Plus, ExternalLink, CheckSquare, Square,
} from 'lucide-react';
import { useAuthStore } from '../../stores/useAuthStore';
import { getSession } from '../../lib/auth';
import { isSupabaseConfigured } from '../../lib/supabase';
import AppShell from '../../components/layout/AppShell';
import { PRIORITY_COLORS } from '../../lib/constants';
import StageBadge from '../../components/ui/StageBadge';

// ─── Touch type helpers ───────────────────────────────────────────────────────

const TOUCH_TYPE_ICONS = {
  call: Phone,
  email: Mail,
  linkedin: Linkedin,
  voicemail: MessageSquare,
  meeting: Calendar,
}

const TOUCH_TYPE_COLORS = {
  call: 'bg-blue-100 text-blue-700',
  email: 'bg-purple-100 text-purple-700',
  linkedin: 'bg-indigo-100 text-indigo-700',
  voicemail: 'bg-gray-100 text-gray-600',
  meeting: 'bg-green-100 text-green-700',
}

const OUTCOME_COLORS = {
  connected: 'bg-green-100 text-green-700',
  voicemail: 'bg-gray-100 text-gray-600',
  no_answer: 'bg-gray-100 text-gray-500',
  replied: 'bg-blue-100 text-blue-700',
  meeting_booked: 'bg-emerald-100 text-emerald-700',
  not_interested: 'bg-red-100 text-red-600',
}

// ─── Helper: format event time ────────────────────────────────────────────────

function formatEventTime(isoString) {
  if (!isoString) return ''
  const d = new Date(isoString)
  const today = new Date()
  const tomorrow = new Date(today)
  tomorrow.setDate(today.getDate() + 1)
  const timeStr = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  if (d.toDateString() === today.toDateString()) return `Today ${timeStr}`
  if (d.toDateString() === tomorrow.toDateString()) return `Tomorrow ${timeStr}`
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) + ` ${timeStr}`
}

function formatTime(isoString) {
  if (!isoString) return ''
  return new Date(isoString).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}

function isToday(dateStr) {
  if (!dateStr) return false
  return new Date(dateStr).toDateString() === new Date().toDateString()
}

// ─── Prep Brief Modal ─────────────────────────────────────────────────────────

function PrepBriefModal({ event, onClose }) {
  const [brief, setBrief] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    fetch('/api/calendar/prep-brief', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        meetingTitle: event.title,
        attendees: event.externalAttendees || [],
        meetingTime: formatEventTime(event.start),
      }),
    })
      .then(r => r.json())
      .then(d => {
        if (d.brief) setBrief(d.brief)
        else setError(d.error || 'Failed to generate brief')
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [event])

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col">
        <div className="flex items-start justify-between p-5 border-b">
          <div className="flex-1 min-w-0 mr-3">
            <div className="flex items-center gap-1.5 mb-1">
              <Sparkles className="w-4 h-4 text-indigo-600" />
              <span className="text-xs font-semibold text-indigo-700 uppercase tracking-wide">AI Pre-Call Brief</span>
              {brief?.account_match && (
                <span className="text-xs text-gray-400">· {brief.account_match}</span>
              )}
            </div>
            <h2 className="text-base font-semibold text-gray-900 line-clamp-2">{event.title}</h2>
            <p className="text-xs text-gray-500 mt-0.5">{formatEventTime(event.start)}</p>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg flex-shrink-0">
            <X className="w-4 h-4 text-gray-400" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {loading && (
            <div className="flex flex-col items-center justify-center py-10 gap-3">
              <Loader2 className="w-6 h-6 text-indigo-500 animate-spin" />
              <p className="text-sm text-gray-500">Generating pre-call brief…</p>
            </div>
          )}

          {error && (
            <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              {error}
            </div>
          )}

          {brief && !loading && (
            <div className="space-y-4">
              {brief.opening_recommendation && (
                <div>
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <ArrowRight className="w-3.5 h-3.5 text-indigo-600" />
                    <span className="text-xs font-semibold text-gray-700 uppercase tracking-wide">How to Open</span>
                  </div>
                  <p className="text-sm text-gray-800 leading-relaxed bg-indigo-50 rounded-lg px-3 py-2.5">
                    {brief.opening_recommendation}
                  </p>
                </div>
              )}

              {brief.key_objectives?.length > 0 && (
                <div>
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <Target className="w-3.5 h-3.5 text-green-600" />
                    <span className="text-xs font-semibold text-gray-700 uppercase tracking-wide">Key Objectives</span>
                  </div>
                  <ul className="space-y-1">
                    {brief.key_objectives.map((obj, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                        <span className="text-green-500 mt-0.5 flex-shrink-0">✓</span>
                        {obj}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {brief.talking_points?.length > 0 && (
                <div>
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <Info className="w-3.5 h-3.5 text-blue-600" />
                    <span className="text-xs font-semibold text-gray-700 uppercase tracking-wide">Key Points</span>
                  </div>
                  <ul className="space-y-1">
                    {brief.talking_points.map((pt, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                        <span className="text-blue-400 mt-0.5 flex-shrink-0">•</span>
                        {pt}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {brief.discovery_questions?.length > 0 && (
                <div>
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <span className="text-xs font-semibold text-gray-700 uppercase tracking-wide">Discovery Questions</span>
                  </div>
                  <ul className="space-y-1">
                    {brief.discovery_questions.map((q, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                        <span className="text-purple-400 mt-0.5 flex-shrink-0">?</span>
                        {q}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {brief.watch_outs?.length > 0 && (
                <div>
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <AlertCircle className="w-3.5 h-3.5 text-amber-500" />
                    <span className="text-xs font-semibold text-gray-700 uppercase tracking-wide">Watch Outs</span>
                  </div>
                  <ul className="space-y-1">
                    {brief.watch_outs.map((w, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                        <span className="text-amber-400 mt-0.5 flex-shrink-0">⚠</span>
                        {w}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {brief.suggested_ask && (
                <div className="bg-green-50 border border-green-200 rounded-lg px-3 py-2.5">
                  <p className="text-xs font-semibold text-green-700 mb-1 uppercase tracking-wide">Closing Ask</p>
                  <p className="text-sm text-gray-800">{brief.suggested_ask}</p>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex gap-3 p-4 border-t">
          <button
            onClick={onClose}
            className="px-3 py-2 text-sm text-gray-500 hover:text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Meeting prep checklist ───────────────────────────────────────────────────

function getPrepItems(title) {
  const t = (title || '').toLowerCase()
  if (/intro|discovery/.test(t)) {
    return [
      'Research company on LinkedIn',
      'Review last activity in pipeline',
      'Confirm agenda sent to attendees',
    ]
  }
  if (/demo|demonstration/.test(t)) {
    return [
      'Pull open MEDDICC gaps',
      'Confirm use case alignment',
      'Prepare 3 discovery questions',
      'Send pre-read deck',
    ]
  }
  if (/proposal|pricing/.test(t)) {
    return [
      'Confirm economic buyer is on the call',
      'Review competitor positioning',
      'Prepare ROI numbers',
    ]
  }
  return [
    'Review account notes',
    'Check last Gong call',
    'Define your ask for this meeting',
  ]
}

function MeetingPrepChecklist({ eventId, title }) {
  const storageKey = `prep_checklist_${eventId}`
  const items = getPrepItems(title)
  const [open, setOpen] = useState(false)
  const [checked, setChecked] = useState(() => {
    try {
      const stored = localStorage.getItem(storageKey)
      return stored ? JSON.parse(stored) : {}
    } catch { return {} }
  })

  const toggle = (item) => {
    const next = { ...checked, [item]: !checked[item] }
    setChecked(next)
    try { localStorage.setItem(storageKey, JSON.stringify(next)) } catch {}
  }

  const doneCount = items.filter(i => checked[i]).length

  return (
    <div className="mt-2 border-t border-gray-100 pt-2">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700"
      >
        <CheckSquare className="w-3.5 h-3.5" />
        <span>{doneCount}/{items.length} prep items</span>
        {open ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
      </button>
      {open && (
        <ul className="mt-1.5 space-y-1">
          {items.map(item => (
            <li
              key={item}
              onClick={() => toggle(item)}
              className="flex items-center gap-1.5 cursor-pointer select-none"
            >
              {checked[item]
                ? <CheckSquare className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
                : <Square className="w-3.5 h-3.5 text-gray-300 flex-shrink-0" />
              }
              <span className={`text-xs ${checked[item] ? 'line-through text-gray-400' : 'text-gray-700'}`}>
                {item}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

// ─── AE View — Morning Brief card ─────────────────────────────────────────────

function MorningBriefCard({ fallbackTasks }) {
  const [brief, setBrief] = useState(null)
  const [loading, setLoading] = useState(false)

  const fetchBrief = useCallback(async (force = false) => {
    const today = new Date().toDateString()
    if (!force) {
      const cachedDate = localStorage.getItem('brief_cached_date')
      if (cachedDate === today) {
        const cached = localStorage.getItem('brief_cached_data')
        if (cached) {
          try { setBrief(JSON.parse(cached)); return } catch {}
        }
      }
    }
    setLoading(true)
    try {
      const res = await fetch('/api/rep/morning-brief')
      const d = await res.json()
      if (d.brief) {
        setBrief(d.brief)
        localStorage.setItem('brief_cached_date', today)
        localStorage.setItem('brief_cached_data', JSON.stringify(d.brief))
      } else {
        const stale = localStorage.getItem('brief_cached_data')
        if (stale) { try { setBrief(JSON.parse(stale)) } catch {} }
      }
    } catch {
      const stale = localStorage.getItem('brief_cached_data')
      if (stale) { try { setBrief(JSON.parse(stale)) } catch {} }
    }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchBrief() }, [fetchBrief])

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-gradient-to-r from-indigo-50 to-purple-50">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-indigo-600" />
          <span className="text-sm font-semibold text-indigo-900">Morning Brief</span>
        </div>
        <button
          onClick={() => fetchBrief(true)}
          disabled={loading}
          className="p-1.5 hover:bg-indigo-100 rounded-lg text-indigo-400 hover:text-indigo-700 transition-colors disabled:opacity-40"
          title="Refresh brief"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <div className="p-4">
        {loading && (
          <div className="flex items-center gap-2 text-sm text-gray-400 py-3">
            <Loader2 className="w-4 h-4 animate-spin text-indigo-400" />
            Generating your morning brief…
          </div>
        )}

        {!loading && !brief && (
          <div className="space-y-3">
            <p className="text-xs text-gray-500 italic">Generating your brief — check back shortly, or hit refresh above.</p>
            {fallbackTasks && fallbackTasks.length > 0 ? (
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Your open tasks</p>
                <ul className="space-y-1.5">
                  {fallbackTasks.slice(0, 3).map(task => (
                    <li key={task.id} className="flex items-start gap-2">
                      <span className={`mt-0.5 px-1.5 py-0.5 rounded text-xs font-medium border flex-shrink-0 ${
                        task.priority === 1 ? PRIORITY_COLORS[1] : task.priority === 2 ? PRIORITY_COLORS[2] : PRIORITY_COLORS[3]
                      }`}>
                        {task.priority === 1 ? 'High' : task.priority === 2 ? 'Med' : 'Low'}
                      </span>
                      <p className="text-xs text-gray-700 leading-snug">{task.title}</p>
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <p className="text-xs text-gray-400">Start your day: review your open tasks and cold deals below</p>
            )}
          </div>
        )}

        {brief && !loading && (
          <div className="space-y-3">
            {brief.headline && (
              <p className="text-sm font-medium text-gray-800 leading-snug">{brief.headline}</p>
            )}
            {brief.top_priority && (
              <div className="flex items-start gap-2 bg-indigo-50 rounded-lg px-3 py-2">
                <Target className="w-3.5 h-3.5 text-indigo-600 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-xs font-semibold text-indigo-700 uppercase tracking-wide mb-0.5">Do First</p>
                  <p className="text-sm text-gray-800">{brief.top_priority}</p>
                </div>
              </div>
            )}
            {brief.deals_to_watch?.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Deals to Watch</p>
                <ul className="space-y-1">
                  {brief.deals_to_watch.slice(0, 3).map((d, i) => (
                    <li key={i} className="text-sm text-gray-700 flex items-start gap-1.5">
                      <span className="text-amber-400 mt-0.5">•</span>{d}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {brief.quick_wins?.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Quick Wins</p>
                <ul className="space-y-1">
                  {brief.quick_wins.slice(0, 3).map((w, i) => (
                    <li key={i} className="text-sm text-gray-700 flex items-start gap-1.5">
                      <span className="text-green-500 mt-0.5">✓</span>{w}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {brief.insight && (
              <p className="text-xs text-gray-500 italic border-t border-gray-100 pt-2">{brief.insight}</p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── AE View — Today's Tasks card ─────────────────────────────────────────────

function TodaysTasksCard({ router, coldDeals, onTasksLoaded }) {
  const [tasks, setTasks] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/tasks')
      .then(r => r.json())
      .then(d => {
        const open = (d.tasks || []).filter(t => t.status !== 'complete')
        open.sort((a, b) => (a.priority || 3) - (b.priority || 3))
        const top5 = open.slice(0, 5)
        setTasks(top5)
        if (onTasksLoaded) onTasksLoaded(open)
      })
      .catch(() => { if (onTasksLoaded) onTasksLoaded([]) })
      .finally(() => setLoading(false))
  }, [])

  const PRIORITY_LABEL = { 1: 'High', 2: 'Med', 3: 'Low' }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-blue-600" />
          <span className="text-sm font-semibold text-gray-900">Today's Tasks</span>
        </div>
        <button
          onClick={() => router.push('/modules/tasks')}
          className="text-xs text-blue-600 hover:underline"
        >
          View all
        </button>
      </div>

      <div className="p-4">
        {loading && (
          <div className="flex items-center gap-2 text-sm text-gray-400 py-3">
            <Loader2 className="w-4 h-4 animate-spin text-blue-400" />
            Loading tasks…
          </div>
        )}

        {!loading && tasks.length === 0 && (
          <div className="space-y-3">
            <p className="text-sm text-gray-500">No open tasks — here are deals worth touching today</p>
            {coldDeals && coldDeals.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {coldDeals.slice(0, 2).map(d => (
                  <button
                    key={d.account_id}
                    onClick={() => router.push(`/modules/account-pipeline?account=${d.account_id}`)}
                    className="px-2.5 py-1 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800 hover:bg-amber-100 transition-colors"
                  >
                    {d.account_name} {d.days_cold ? `— ${d.days_cold}d cold` : ''}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {!loading && tasks.length > 0 && (
          <ul className="space-y-2">
            {tasks.map(task => (
              <li key={task.id} className="flex items-start gap-2">
                <span className={`mt-0.5 px-1.5 py-0.5 rounded text-xs font-medium border flex-shrink-0 ${PRIORITY_COLORS[task.priority] || PRIORITY_COLORS[3]}`}>
                  {PRIORITY_LABEL[task.priority] || 'Low'}
                </span>
                <div className="min-w-0">
                  <p className="text-sm text-gray-800 leading-snug">{task.title}</p>
                  {task.account?.name && (
                    <p className="text-xs text-gray-400 mt-0.5 flex items-center gap-1">
                      <Building2 className="w-3 h-3" />{task.account.name}
                    </p>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

// ─── Next Best Action Card ────────────────────────────────────────────────────

const NBA_LOG_KEY = 'nba_log'

function getNBALog() {
  try { return JSON.parse(localStorage.getItem(NBA_LOG_KEY) || '[]') } catch { return [] }
}

function appendNBALog(entry) {
  try {
    const log = getNBALog()
    log.unshift(entry)
    localStorage.setItem(NBA_LOG_KEY, JSON.stringify(log.slice(0, 30)))
  } catch {}
}

function getNBADismissedToday() {
  const today = new Date().toISOString().split('T')[0]
  try { return JSON.parse(localStorage.getItem(`nba_dismissed_${today}`) || '[]') } catch { return [] }
}

function dismissNBAToday(accountId) {
  const today = new Date().toISOString().split('T')[0]
  try {
    const d = getNBADismissedToday()
    if (!d.includes(accountId)) localStorage.setItem(`nba_dismissed_${today}`, JSON.stringify([...d, accountId]))
  } catch {}
}

function FollowUpPrompt({ entry, onResolve }) {
  return (
    <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
      <p className="text-sm font-medium text-blue-900 mb-1">Quick follow-up</p>
      <p className="text-sm text-blue-700 mb-3">
        7 days ago you took action on <strong>{entry.accountName}</strong>. Did the deal move forward?
      </p>
      <div className="flex gap-2">
        <button onClick={() => onResolve(entry, true)} className="px-3 py-1.5 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700">
          Yes, it did
        </button>
        <button onClick={() => onResolve(entry, false)} className="px-3 py-1.5 text-sm font-medium text-white bg-gray-600 rounded-lg hover:bg-gray-700">
          Not yet
        </button>
        <button onClick={() => onResolve(entry, null)} className="px-3 py-1.5 text-sm text-gray-400 hover:text-gray-600">
          Skip
        </button>
      </div>
    </div>
  )
}

function NextBestActionCard({ router, insightsData }) {
  const [dismissed, setDismissed] = useState(getNBADismissedToday)
  const [done, setDone] = useState(false)
  const [followUp, setFollowUp] = useState(null)

  useEffect(() => {
    // Check if there's a 7-day-old NBA log entry needing follow-up
    const log = getNBALog()
    const sevenDaysAgo = Date.now() - 7 * 86400000
    const pending = log.find(e => !e.outcome && e.doneAt && new Date(e.doneAt).getTime() < sevenDaysAgo)
    if (pending) setFollowUp(pending)
  }, [])

  const handleResolve = (entry, moved) => {
    const log = getNBALog()
    const updated = log.map(e => e.doneAt === entry.doneAt ? { ...e, outcome: moved === true ? 'moved' : moved === false ? 'stale' : 'skipped', resolvedAt: new Date().toISOString() } : e)
    localStorage.setItem(NBA_LOG_KEY, JSON.stringify(updated))
    setFollowUp(null)
  }

  if (followUp) {
    return <FollowUpPrompt entry={followUp} onResolve={handleResolve} />
  }

  if (done) return null

  // Pick the top action from idle queue (most overdue high-stage deal)
  const idleQueue = insightsData?.idle_queue || []
  const target = idleQueue.find(i => !dismissed.includes(i.account_id))
  if (!target) return null

  const stageLabel = (target.stage || '').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
  const daysCold = target.days_since_last_call

  const handleDone = () => {
    appendNBALog({
      accountId: target.account_id,
      accountName: target.name,
      stage: target.stage,
      action: target.suggested_angle,
      doneAt: new Date().toISOString(),
      outcome: null,
    })
    // Mark as dismissed for today too
    dismissNBAToday(target.account_id)
    setDone(true)
  }

  const handleSkip = () => {
    dismissNBAToday(target.account_id)
    setDismissed(getNBADismissedToday())
  }

  return (
    <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl p-5 text-white">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-blue-200 mb-1">Next Best Action</p>
          <p className="text-base font-bold leading-tight mb-1">
            {daysCold != null
              ? `Touch ${target.name} today — ${stageLabel} deal, ${daysCold}d no contact`
              : `Follow up with ${target.name} — ${stageLabel}`}
          </p>
          <p className="text-sm text-blue-100">{target.suggested_angle}</p>
        </div>
        <button onClick={handleSkip} className="text-blue-300 hover:text-white mt-0.5">
          <X className="w-4 h-4" />
        </button>
      </div>
      <div className="flex items-center gap-3 mt-4">
        <button
          onClick={() => router.push(`/modules/account-pipeline?account=${target.account_id}`)}
          className="flex-1 py-2 bg-white/20 hover:bg-white/30 text-white text-sm font-medium rounded-lg text-center transition-colors"
        >
          Open account
        </button>
        <button
          onClick={handleDone}
          className="flex-1 py-2 bg-white text-blue-700 text-sm font-semibold rounded-lg hover:bg-blue-50 transition-colors"
        >
          Done — I did this
        </button>
      </div>
    </div>
  )
}

// ─── AE View — Deal Intelligence panel ───────────────────────────────────────

function getDismissedInsights() {
  const dateKey = new Date().toISOString().split('T')[0]
  try {
    return JSON.parse(localStorage.getItem(`dismissed_deal_insights_${dateKey}`) || '[]')
  } catch { return [] }
}

function dismissInsight(accountId) {
  const dateKey = new Date().toISOString().split('T')[0]
  try {
    const current = getDismissedInsights()
    if (!current.includes(accountId)) {
      localStorage.setItem(`dismissed_deal_insights_${dateKey}`, JSON.stringify([...current, accountId]))
    }
  } catch {}
}

function DealInsightCard({ insight, router, onDismiss }) {
  const [expanded, setExpanded] = useState(false)
  const urgencyBar = insight.urgency === 'high' ? 'bg-red-500' : 'bg-amber-400'

  return (
    <div className="flex gap-0 rounded-lg border border-gray-200 overflow-hidden">
      <div className={`w-1 flex-shrink-0 ${urgencyBar}`} />
      <div className="flex-1 p-3">
        <div className="flex items-start justify-between gap-2 mb-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-gray-900">{insight.account_name}</span>
            {insight.stage && <StageBadge stage={insight.stage} />}
          </div>
          <button
            onClick={() => onDismiss(insight.account_id)}
            className="text-gray-300 hover:text-gray-500 flex-shrink-0"
            title="Dismiss"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
        <p className="text-xs font-medium text-gray-700 mb-0.5">{insight.headline}</p>
        {insight.insight_text && (
          <>
            {expanded && (
              <p className="text-xs text-gray-500 mb-1 leading-relaxed">{insight.insight_text}</p>
            )}
            <button
              onClick={() => setExpanded(e => !e)}
              className="text-xs text-blue-500 hover:underline mb-1"
            >
              {expanded ? 'Less' : 'More'}
            </button>
          </>
        )}
        <p className="text-xs italic text-gray-500 mb-2">{insight.recommended_action}</p>
        <div className="flex gap-2">
          <button
            onClick={() => router.push(`/modules/account-pipeline?account=${insight.account_id}&tab=chat`)}
            className="flex items-center gap-1 px-2 py-1 bg-indigo-600 hover:bg-indigo-700 text-white text-xs rounded-lg transition-colors"
          >
            <Sparkles className="w-3 h-3" />
            Work in Claude
          </button>
          <button
            onClick={() => onDismiss(insight.account_id)}
            className="px-2 py-1 text-xs text-gray-500 hover:text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50"
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>
  )
}

function DealIntelligencePanel({ router, onInsightsLoaded }) {
  const [insights, setInsights] = useState([])
  const [loading, setLoading] = useState(true)
  const [dismissed, setDismissed] = useState(getDismissedInsights)

  useEffect(() => {
    fetch('/api/rep/deal-insights')
      .then(r => r.json())
      .then(d => {
        const all = d.insights || []
        setInsights(all)
        if (onInsightsLoaded) onInsightsLoaded(d)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const handleDismiss = (accountId) => {
    dismissInsight(accountId)
    setDismissed(getDismissedInsights())
  }

  const visible = insights.filter(i => !dismissed.includes(i.account_id))

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      <div className="flex items-center px-4 py-3 border-b border-gray-100 bg-gradient-to-r from-red-50 to-amber-50">
        <AlertCircle className="w-4 h-4 text-red-500 mr-2" />
        <span className="text-sm font-semibold text-gray-900">Deal Intelligence</span>
        {!loading && visible.length > 0 && (
          <span className="ml-2 px-1.5 py-0.5 bg-red-100 text-red-700 text-xs font-semibold rounded-full">
            {visible.length}
          </span>
        )}
      </div>

      <div className="p-4">
        {loading && (
          <div className="flex items-center gap-2 text-sm text-gray-400 py-3">
            <Loader2 className="w-4 h-4 animate-spin text-red-400" />
            Scanning pipeline…
          </div>
        )}

        {!loading && visible.length === 0 && (
          <div className="flex items-center gap-2 text-sm text-green-600 py-2">
            <CheckCircle2 className="w-4 h-4" />
            All deals look healthy today
          </div>
        )}

        {!loading && visible.length > 0 && (
          <div className="space-y-3">
            {visible.slice(0, 3).map(insight => (
              <DealInsightCard
                key={insight.account_id}
                insight={insight}
                router={router}
                onDismiss={handleDismiss}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── AE View — Calendar card with prep checklist ──────────────────────────────

function CalendarCard({ providerToken, onEventsLoaded }) {
  const [events, setEvents] = useState(null)
  const [loading, setLoading] = useState(false)
  const [prepEvent, setPrepEvent] = useState(null)

  useEffect(() => {
    if (!providerToken) {
      if (onEventsLoaded) onEventsLoaded([])
      return
    }
    setLoading(true)
    fetch('/api/calendar/upcoming', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: providerToken, days: 1 }),
    })
      .then(r => r.json())
      .then(d => {
        const todayEvents = (d.salesMeetings || []).filter(e => isToday(e.start))
        setEvents(todayEvents)
        if (onEventsLoaded) onEventsLoaded(todayEvents)
      })
      .catch(() => {
        setEvents([])
        if (onEventsLoaded) onEventsLoaded([])
      })
      .finally(() => setLoading(false))
  }, [providerToken])

  return (
    <>
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="flex items-center px-4 py-3 border-b border-gray-100">
          <Calendar className="w-4 h-4 text-blue-600 mr-2" />
          <span className="text-sm font-semibold text-gray-900">Calendar</span>
        </div>

        <div className="p-4">
          {!providerToken && (
            <p className="text-sm text-gray-400 italic py-2">
              Connect Google Calendar in Tasks to see events.
            </p>
          )}

          {providerToken && loading && (
            <div className="flex items-center gap-2 text-sm text-gray-400 py-3">
              <Loader2 className="w-4 h-4 animate-spin text-blue-400" />
              Loading today's meetings…
            </div>
          )}

          {providerToken && !loading && events !== null && events.length === 0 && (
            <p className="text-sm text-gray-500 italic py-2">
              No meetings today — a good day to reach out proactively
            </p>
          )}

          {providerToken && !loading && events !== null && events.length > 0 && (
            <ul className="space-y-3">
              {events.map(event => (
                <li key={event.id} className="border border-gray-100 rounded-lg p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-gray-800 leading-snug">{event.title}</p>
                      <p className="text-xs text-gray-500 mt-0.5 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {formatTime(event.start)}
                        {event.durationMin && ` · ${event.durationMin}min`}
                      </p>
                      {event.externalAttendees?.length > 0 && (
                        <p className="text-xs text-gray-400 mt-0.5 flex items-center gap-1">
                          <Users className="w-3 h-3" />
                          {event.externalAttendees.length} attendee{event.externalAttendees.length !== 1 ? 's' : ''}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      {event.meetLink && (
                        <a
                          href={event.meetLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1.5 text-gray-400 hover:text-blue-600 rounded"
                          title="Join meeting"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      )}
                      <button
                        onClick={() => setPrepEvent(event)}
                        className="flex items-center gap-1 px-2 py-1 text-xs text-indigo-600 hover:bg-indigo-50 rounded border border-indigo-200"
                      >
                        <Sparkles className="w-3 h-3" />
                        AI Brief
                      </button>
                    </div>
                  </div>
                  <MeetingPrepChecklist eventId={event.id} title={event.title} />
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {prepEvent && (
        <PrepBriefModal event={prepEvent} onClose={() => setPrepEvent(null)} />
      )}
    </>
  )
}

// ─── AE View — Cold Deal Strip ────────────────────────────────────────────────

function ColdDealStrip({ router, coldDeals }) {
  const [expanded, setExpanded] = useState(null)

  if (!coldDeals || coldDeals.length === 0) return null

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      <div className="flex items-center px-4 py-3 border-b border-gray-100">
        <AlertCircle className="w-4 h-4 text-amber-500 mr-2" />
        <span className="text-sm font-semibold text-gray-900">Deals Gone Cold</span>
        <span className="ml-2 px-1.5 py-0.5 bg-amber-100 text-amber-700 text-xs font-semibold rounded-full">
          {coldDeals.length}
        </span>
      </div>

      <div className="p-4">
        <div className="flex gap-2 overflow-x-auto pb-1">
          {coldDeals.map(deal => (
            <div key={deal.account_id} className="flex-shrink-0">
              <button
                onClick={() => setExpanded(expanded === deal.account_id ? null : deal.account_id)}
                className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors ${
                  expanded === deal.account_id
                    ? 'bg-amber-100 border-amber-300 text-amber-900'
                    : 'bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100'
                }`}
              >
                {deal.account_name}{deal.days_cold ? ` — ${deal.days_cold}d` : ''}
              </button>
              {expanded === deal.account_id && (
                <div className="mt-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs space-y-1.5 min-w-48">
                  {deal.days_cold != null && (
                    <p className="text-amber-800">Last call: {deal.days_cold} days ago</p>
                  )}
                  <p className="text-gray-600 italic">{deal.recommended_action || 'Schedule a check-in'}</p>
                  <button
                    onClick={() => router.push(`/modules/account-pipeline?account=${deal.account_id}&tab=chat`)}
                    className="flex items-center gap-1 px-2 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded transition-colors"
                  >
                    <Mail className="w-3 h-3" />
                    Draft email
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── AE View — Idle Account Queue ────────────────────────────────────────────

function IdleAccountQueue({ router, idleQueue }) {
  if (!idleQueue || idleQueue.length === 0) return null

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      <div className="flex items-center px-4 py-3 border-b border-gray-100 bg-gradient-to-r from-blue-50 to-indigo-50">
        <Target className="w-4 h-4 text-blue-600 mr-2" />
        <span className="text-sm font-semibold text-gray-900">Where to Focus Today</span>
      </div>

      <div className="p-4 space-y-2">
        {idleQueue.map(account => (
          <div
            key={account.account_id}
            className="flex items-center justify-between gap-3 p-2.5 rounded-lg border border-gray-100 hover:border-gray-200 hover:bg-gray-50 transition-colors"
          >
            <div className="min-w-0">
              <p className="text-sm font-medium text-gray-800 truncate">{account.name}</p>
              <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                <StageBadge stage={account.stage} />
                {account.days_since_last_call != null && (
                  <span className="text-xs text-amber-600 font-medium">{account.days_since_last_call}d no contact</span>
                )}
              </div>
              <p className="text-xs text-gray-400 mt-0.5 italic">{account.suggested_angle}</p>
            </div>
            <button
              onClick={() => router.push(`/modules/account-pipeline?account=${account.account_id}&tab=chat`)}
              className="flex items-center gap-1 px-2 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs rounded-lg border border-blue-200 transition-colors flex-shrink-0"
            >
              Draft outreach
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── AE View — Pipeline Focus card ───────────────────────────────────────────

function PipelineFocusCard({ userId, router }) {
  const [accounts, setAccounts] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/pipeline-overview')
      .then(r => r.json())
      .then(d => {
        const allAccounts = (d.repSummaries || [])
          .flatMap(rep => (rep.accounts || rep.staleAccounts || []).map(a => ({ ...a, repId: rep.id, repName: rep.name })))

        const userAccounts = allAccounts
          .filter(a => !userId || a.repId === userId || a.userId === userId)
          .sort((a, b) => (b.daysSinceActivity ?? 9999) - (a.daysSinceActivity ?? 9999))
          .slice(0, 3)

        setAccounts(userAccounts)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [userId])

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-teal-600" />
          <span className="text-sm font-semibold text-gray-900">Pipeline Focus</span>
        </div>
        <button
          onClick={() => router.push('/modules/account-pipeline')}
          className="text-xs text-blue-600 hover:underline"
        >
          View Pipeline
        </button>
      </div>

      <div className="p-4">
        {loading && (
          <div className="flex items-center gap-2 text-sm text-gray-400 py-3">
            <Loader2 className="w-4 h-4 animate-spin text-teal-400" />
            Loading pipeline…
          </div>
        )}

        {!loading && accounts.length === 0 && (
          <p className="text-sm text-gray-400 italic py-2">No accounts found.</p>
        )}

        {!loading && accounts.length > 0 && (
          <ul className="space-y-2">
            {accounts.map(account => (
              <li
                key={account.id}
                className="flex items-center justify-between gap-2 p-2 rounded-lg hover:bg-gray-50 cursor-pointer border border-transparent hover:border-gray-200 transition-colors"
                onClick={() => router.push(`/modules/account-pipeline?account=${account.id}`)}
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-800 truncate">{account.name}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <StageBadge stage={account.stage} />
                    {account.daysSinceActivity != null && (
                      <span className="text-xs text-amber-600 font-medium">
                        {account.daysSinceActivity}d stale
                      </span>
                    )}
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-gray-300 flex-shrink-0" />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

// ─── AE View ──────────────────────────────────────────────────────────────────

// ─── Onboarding card (dismissed per-browser) ──────────────────────────────────

function OnboardingCard({ profile, router }) {
  const [dismissed, setDismissed] = useState(true)

  useEffect(() => {
    const isDismissed = localStorage.getItem('onboarding_card_dismissed') === '1'
    if (!isDismissed) setDismissed(false)
  }, [])

  const hasSlack = !!profile?.slack_user_id
  const allDone = hasSlack

  const dismiss = () => {
    localStorage.setItem('onboarding_card_dismissed', '1')
    setDismissed(true)
  }

  if (dismissed || allDone) return null

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-start justify-between gap-4">
      <div className="flex-1">
        <p className="text-sm font-semibold text-blue-900 mb-2">Finish setting up</p>
        <div className="space-y-1.5">
          <div className="flex items-center gap-2 text-sm">
            <div className="w-4 h-4 rounded-full border-2 border-blue-300 shrink-0" />
            <span className="text-blue-800">
              <button onClick={() => router.push('/modules/settings')} className="underline hover:text-blue-600">
                Add your Slack ID
              </button>
              {' '}to receive daily digests
            </span>
          </div>
        </div>
      </div>
      <button onClick={dismiss} className="text-blue-300 hover:text-blue-500 shrink-0 mt-0.5">
        <X className="w-4 h-4" />
      </button>
    </div>
  )
}

// Weekly cadence — AE re-engagement goal (10/wk) + dormant picks to work, or SDR meetings goal (3/wk).
function WeeklyCadenceCard({ router }) {
  const [data, setData] = useState(null)
  useEffect(() => { fetch('/api/rep/cadence').then(r => r.json()).then(d => { if (d && d.success !== false && d.target != null) setData(d) }).catch(() => {}) }, [])
  if (!data) return null
  const pct = data.target ? Math.min(100, Math.round((data.current / data.target) * 100)) : 0
  const hit = data.current >= data.target
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <Target className="w-4 h-4 text-coral-600" />
          <span className="text-sm font-semibold text-gray-900">Weekly Cadence</span>
        </div>
        <span className={`text-sm font-semibold tabular-nums ${hit ? 'text-emerald-600' : 'text-gray-700'}`}>{data.current}/{data.target}</span>
      </div>
      <div className="p-4">
        <p className="text-xs text-gray-500 mb-2">{data.label}{hit ? ' — goal hit' : ''}</p>
        <div className="h-2 bg-gray-100 rounded-full overflow-hidden mb-3">
          <div className={`h-full rounded-full transition-all ${hit ? 'bg-emerald-500' : 'bg-coral-500'}`} style={{ width: `${pct}%` }} />
        </div>
        {data.role === 'ae' && data.picks?.length > 0 && (
          <>
            <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-1.5">Re-engage next</p>
            <ul className="space-y-1.5">
              {data.picks.slice(0, 5).map(p => (
                <li key={p.accountId} className="flex items-center justify-between gap-2">
                  <span className="text-sm text-gray-800 truncate min-w-0">{p.name}{p.daysCold != null ? <span className="text-xs text-gray-400 ml-1.5">{p.daysCold}d cold</span> : null}</span>
                  <button onClick={() => router.push(`/modules/content?account=${p.accountId}`)}
                    className="flex-shrink-0 text-xs px-2 py-1 bg-coral-50 text-coral-700 rounded-lg border border-coral-200 hover:bg-coral-100">Draft</button>
                </li>
              ))}
            </ul>
          </>
        )}
        {data.role === 'sdr' && (
          <button onClick={() => router.push('/modules/pursuit')} className="text-xs text-blue-600 hover:underline">Log touches in Pursuit →</button>
        )}
      </div>
    </div>
  )
}

function AEView({ userId, providerToken, router, profile }) {
  const [allTasks, setAllTasks] = useState(null)
  const [insightsData, setInsightsData] = useState(null)
  const [todayEvents, setTodayEvents] = useState(null)

  const isIdle = allTasks !== null && todayEvents !== null
    && allTasks.length === 0 && todayEvents.length === 0

  const coldDeals = (insightsData?.insights || []).filter(i => i.type === 'gone_cold')
  const idleQueue = insightsData?.idle_queue || []

  return (
    <div className="space-y-6">
      <OnboardingCard profile={profile} router={router} />

      {/* Row 1 — Next Best Action */}
      <NextBestActionCard router={router} insightsData={insightsData} />

      {/* Row 2 — Deal Intelligence (full width) */}
      <DealIntelligencePanel router={router} onInsightsLoaded={setInsightsData} />

      {/* Row 2 — three-col grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Column 1 — Your Day */}
        <div className="space-y-4">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Your Day</p>
          <MorningBriefCard fallbackTasks={allTasks} />
          <TodaysTasksCard
            router={router}
            coldDeals={coldDeals}
            onTasksLoaded={setAllTasks}
          />
        </div>

        {/* Column 2 — Calendar */}
        <div className="space-y-4">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Calendar</p>
          <CalendarCard providerToken={providerToken} onEventsLoaded={setTodayEvents} />
          {isIdle && idleQueue.length > 0 && (
            <IdleAccountQueue router={router} idleQueue={idleQueue} />
          )}
        </div>

        {/* Column 3 — Cadence + Pipeline Focus */}
        <div className="space-y-4">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">This Week</p>
          <WeeklyCadenceCard router={router} />
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Pipeline Focus</p>
          <PipelineFocusCard userId={userId} router={router} />
        </div>
      </div>

      {/* Cold Deal Strip — below calendar section */}
      {coldDeals.length > 0 && (
        <ColdDealStrip router={router} coldDeals={coldDeals} />
      )}
    </div>
  )
}

// ─── SDR View — Daily Targets ─────────────────────────────────────────────────

function loadTouchesToday() {
  try {
    const raw = localStorage.getItem('sdr_touches_today')
    if (!raw) return []
    const touches = JSON.parse(raw)
    const todayStr = new Date().toDateString()
    return touches.filter(t => t.touched_at && new Date(t.touched_at).toDateString() === todayStr)
  } catch {
    return []
  }
}

function saveTouchToStorage(touch) {
  try {
    const raw = localStorage.getItem('sdr_touches_today')
    const all = raw ? JSON.parse(raw) : []
    all.push(touch)
    localStorage.setItem('sdr_touches_today', JSON.stringify(all))
  } catch {}
}

function updatePursuitAccount(accountId, lastTouched) {
  try {
    const raw = localStorage.getItem('pursuit_accounts')
    if (!raw) return
    const accounts = JSON.parse(raw)
    const updated = accounts.map(a => a.id === accountId ? { ...a, lastTouched } : a)
    localStorage.setItem('pursuit_accounts', JSON.stringify(updated))
  } catch {}
}

function DailyTargets({ touches }) {
  const callCount = touches.filter(t => t.touch_type === 'call').length
  const connectCount = touches.filter(t => t.outcome === 'connected').length
  const meetingCount = touches.filter(t => t.outcome === 'meeting_booked').length

  const stats = [
    { label: 'Calls Today', value: callCount, color: 'text-blue-600' },
    { label: 'Connects', value: connectCount, color: 'text-green-600' },
    { label: 'Meetings Booked', value: meetingCount, color: 'text-emerald-600' },
  ]

  return (
    <div className="grid grid-cols-3 gap-4 mb-6">
      {stats.map(s => (
        <div key={s.label} className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 text-center">
          <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
          <p className="text-xs text-gray-500 mt-1">{s.label}</p>
        </div>
      ))}
    </div>
  )
}

// ─── SDR View — Log Touch Dropdown ───────────────────────────────────────────

function LogTouchDropdown({ account, onLogged, onClose }) {
  const [touchType, setTouchType] = useState('call')
  const [outcome, setOutcome] = useState('no_answer')
  const [notes, setNotes] = useState('')

  const TOUCH_TYPES = ['call', 'email', 'linkedin', 'voicemail', 'meeting']
  const OUTCOMES = ['connected', 'voicemail', 'no_answer', 'replied', 'meeting_booked', 'not_interested']

  const handleSave = () => {
    const touch = {
      id: `${Date.now()}_${account.id}`,
      account_id: account.id,
      account_name: account.name,
      touch_type: touchType,
      outcome,
      notes: notes.trim() || null,
      touched_at: new Date().toISOString(),
    }
    saveTouchToStorage(touch)
    updatePursuitAccount(account.id, touch.touched_at)
    onLogged(touch)
    onClose()
  }

  return (
    <div className="absolute right-0 top-8 z-30 bg-white border border-gray-200 rounded-xl shadow-xl p-4 w-64">
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-semibold text-gray-800">Log touch</p>
        <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded"><X className="w-3.5 h-3.5 text-gray-400" /></button>
      </div>

      <div className="mb-3">
        <p className="text-xs font-medium text-gray-600 mb-1.5">Touch type</p>
        <div className="flex flex-wrap gap-1.5">
          {TOUCH_TYPES.map(t => (
            <button
              key={t}
              onClick={() => setTouchType(t)}
              className={`px-2 py-1 rounded text-xs font-medium capitalize transition-colors ${
                touchType === t ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      <div className="mb-3">
        <p className="text-xs font-medium text-gray-600 mb-1.5">Outcome</p>
        <div className="flex flex-wrap gap-1.5">
          {OUTCOMES.map(o => (
            <button
              key={o}
              onClick={() => setOutcome(o)}
              className={`px-2 py-1 rounded text-xs font-medium capitalize transition-colors ${
                outcome === o ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {o.replace(/_/g, ' ')}
            </button>
          ))}
        </div>
      </div>

      <div className="mb-3">
        <p className="text-xs font-medium text-gray-600 mb-1">Notes (optional)</p>
        <textarea
          value={notes}
          onChange={e => setNotes(e.target.value)}
          rows={2}
          className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 resize-none focus:outline-none focus:ring-1 focus:ring-blue-400"
          placeholder="Quick note…"
        />
      </div>

      <button
        onClick={handleSave}
        className="w-full px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
      >
        Save touch
      </button>
    </div>
  )
}

// ─── SDR View — Call Queue ────────────────────────────────────────────────────

function CallQueue({ onTouchLogged }) {
  const [accounts, setAccounts] = useState([])
  const [logOpen, setLogOpen] = useState(null)

  const reload = useCallback(() => {
    try {
      const raw = localStorage.getItem('pursuit_accounts')
      if (!raw) { setAccounts([]); return }
      const parsed = JSON.parse(raw)
      const sorted = [...parsed].sort((a, b) => (a.rank || 999) - (b.rank || 999))
      setAccounts(sorted.slice(0, 10))
    } catch {
      setAccounts([])
    }
  }, [])

  useEffect(() => { reload() }, [reload])

  const handleLogged = (touch) => {
    reload()
    onTouchLogged(touch)
  }

  const TOUCH_BADGE = {
    call: { label: 'Call', cls: 'bg-blue-100 text-blue-700' },
    email: { label: 'Email', cls: 'bg-purple-100 text-purple-700' },
    linkedin: { label: 'LinkedIn', cls: 'bg-indigo-100 text-indigo-700' },
    voicemail: { label: 'Voicemail', cls: 'bg-gray-100 text-gray-600' },
    meeting: { label: 'Meeting', cls: 'bg-green-100 text-green-700' },
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <Phone className="w-4 h-4 text-blue-600" />
          <span className="text-sm font-semibold text-gray-900">Call Queue</span>
          <span className="text-xs text-gray-400">top {accounts.length} accounts</span>
        </div>
      </div>

      <div className="p-4">
        {accounts.length === 0 && (
          <div className="text-center py-6">
            <p className="text-sm text-gray-400 mb-2">No accounts in your pursuit list yet.</p>
            <p className="text-xs text-gray-400">Add accounts in the Pursuit module to build your queue.</p>
          </div>
        )}

        {accounts.length > 0 && (
          <ul className="space-y-2">
            {accounts.map((account, idx) => {
              const badge = TOUCH_BADGE[account.nextTouchType] || TOUCH_BADGE['call']
              const lastLabel = account.lastTouched
                ? new Date(account.lastTouched).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                : 'Never'

              return (
                <li key={account.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 relative">
                  <span className="text-sm font-bold text-gray-300 w-5 text-center flex-shrink-0">{idx + 1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">{account.name}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-gray-400">{lastLabel}</span>
                      <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${badge.cls}`}>
                        {badge.label}
                      </span>
                    </div>
                  </div>
                  <div className="relative flex-shrink-0">
                    <button
                      onClick={() => setLogOpen(logOpen === account.id ? null : account.id)}
                      className="flex items-center gap-1 px-2 py-1 text-xs text-gray-600 hover:bg-gray-100 border border-gray-200 rounded-lg"
                    >
                      <Plus className="w-3 h-3" />
                      Log touch
                    </button>
                    {logOpen === account.id && (
                      <LogTouchDropdown
                        account={account}
                        onLogged={handleLogged}
                        onClose={() => setLogOpen(null)}
                      />
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}

// ─── SDR View — Today's Log ───────────────────────────────────────────────────

function TodaysLog({ touches }) {
  const sorted = [...touches].sort((a, b) => new Date(b.touched_at) - new Date(a.touched_at))

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-gray-500" />
          <span className="text-sm font-semibold text-gray-900">Today's Log</span>
          {touches.length > 0 && (
            <span className="px-2 py-0.5 bg-blue-600 text-white text-xs font-bold rounded-full">{touches.length}</span>
          )}
        </div>
      </div>

      <div className="p-4">
        {sorted.length === 0 && (
          <p className="text-sm text-gray-400 italic py-4 text-center">No touches logged yet today.</p>
        )}

        {sorted.length > 0 && (
          <ul className="space-y-2">
            {sorted.map(touch => {
              const TIcon = TOUCH_TYPE_ICONS[touch.touch_type] || Phone
              const typeCls = TOUCH_TYPE_COLORS[touch.touch_type] || 'bg-gray-100 text-gray-600'
              const outcomeCls = OUTCOME_COLORS[touch.outcome] || 'bg-gray-100 text-gray-600'

              return (
                <li key={touch.id} className="flex items-start gap-3 p-2 rounded-lg border border-gray-100">
                  <div className={`p-1.5 rounded-lg flex-shrink-0 ${typeCls}`}>
                    <TIcon className="w-3.5 h-3.5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800">{touch.account_name}</p>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      <span className="text-xs text-gray-400">{formatTime(touch.touched_at)}</span>
                      <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${outcomeCls}`}>
                        {(touch.outcome || '').replace(/_/g, ' ')}
                      </span>
                      {touch.notes && (
                        <span className="text-xs text-gray-400 truncate">"{touch.notes}"</span>
                      )}
                    </div>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}

// ─── SDR View ─────────────────────────────────────────────────────────────────

function SDRView({ router }) {
  const [touches, setTouches] = useState([])

  useEffect(() => {
    setTouches(loadTouchesToday())
  }, [])

  const handleTouchLogged = useCallback(() => {
    setTouches(loadTouchesToday())
  }, [])

  return (
    <div>
      <DailyTargets touches={touches} />

      <div className="mb-6">
        <WeeklyCadenceCard router={router} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <CallQueue onTouchLogged={handleTouchLogged} />
        <TodaysLog touches={touches} />
      </div>

      <div className="mt-4 text-right">
        <button
          onClick={() => router.push('/modules/pursuit')}
          className="text-sm text-blue-600 hover:underline"
        >
          Manage pursuit list →
        </button>
      </div>
    </div>
  )
}

// ─── Manager View — Team Activity ─────────────────────────────────────────────

function ManagerView({ router }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/pipeline-overview')
      .then(r => r.json())
      .then(d => setData(d))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const AT_RISK_STAGES = ['demo', 'proposal', 'legal']

  const atRiskAccounts = data
    ? data.repSummaries
        .flatMap(r => (r.staleAccounts || []).map(a => ({ ...a, ownerName: r.name })))
        .filter(a => a.daysSinceActivity > 14 && AT_RISK_STAGES.includes(a.stage))
        .sort((a, b) => (b.daysSinceActivity || 0) - (a.daysSinceActivity || 0))
    : []

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 text-blue-400 animate-spin" />
      </div>
    )
  }

  const reps = data?.repSummaries || []

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-indigo-600" />
            <span className="text-sm font-semibold text-gray-900">Team Activity Today</span>
          </div>
        </div>

        <div className="p-4">
          {reps.length === 0 && (
            <p className="text-sm text-gray-400 italic py-4">No rep data available.</p>
          )}

          {reps.length > 0 && (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-gray-400 border-b border-gray-100">
                  <th className="text-left pb-2 font-medium">Rep</th>
                  <th className="text-center pb-2 font-medium">Open</th>
                  <th className="text-center pb-2 font-medium">Overdue</th>
                  <th className="text-center pb-2 font-medium">Accounts</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {reps.map(rep => (
                  <tr key={rep.id} className="hover:bg-gray-50">
                    <td className="py-2.5 font-medium text-gray-800">{rep.name}</td>
                    <td className="py-2.5 text-center text-gray-700">{rep.openTasks ?? 0}</td>
                    <td className="py-2.5 text-center">
                      {rep.overdueTasks > 0
                        ? <span className="text-red-600 font-semibold">{rep.overdueTasks}</span>
                        : <span className="text-green-500">✓</span>
                      }
                    </td>
                    <td className="py-2.5 text-center text-gray-700">{rep.totalAccounts ?? 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-amber-500" />
            <span className="text-sm font-semibold text-gray-900">At-Risk Deals</span>
            <span className="text-xs text-gray-400">14+ days stale in late stages</span>
          </div>
        </div>

        <div className="p-4">
          {atRiskAccounts.length === 0 && (
            <div className="flex items-center gap-2 text-sm text-green-600 py-2">
              <CheckCircle2 className="w-4 h-4" />
              No at-risk deals right now.
            </div>
          )}

          {atRiskAccounts.length > 0 && (
            <ul className="space-y-2">
              {atRiskAccounts.map(account => (
                <li
                  key={account.id}
                  className="flex items-start justify-between gap-2 p-2 rounded-lg hover:bg-gray-50 cursor-pointer border border-transparent hover:border-gray-200 transition-colors"
                  onClick={() => router.push(`/modules/account-pipeline?account=${account.id}`)}
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">{account.name}</p>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      <StageBadge stage={account.stage} />
                      <span className="text-xs text-gray-400">{account.ownerName}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="text-xs text-amber-600 font-semibold">{account.daysSinceActivity}d</span>
                    <ChevronRight className="w-4 h-4 text-gray-300" />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="md:col-span-2 text-right">
        <button
          onClick={() => router.push('/modules/pipeline-overview')}
          className="text-sm text-blue-600 hover:underline"
        >
          Full pipeline view →
        </button>
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function TodayPage() {
  const router = useRouter()
  const { user, setUser } = useAuthStore()

  const [isReady, setIsReady] = useState(false)
  const [profile, setProfile] = useState(null)
  const [providerToken, setProviderToken] = useState(null)
  const [teamView, setTeamView] = useState(false) // managers/admins only — default to their own day

  useEffect(() => {
    const init = async () => {
      const useAuth = isSupabaseConfigured() && process.env.NEXT_PUBLIC_USE_SUPABASE !== 'false'
      if (useAuth) {
        const { session } = await getSession()
        if (!session) { router.push('/login'); return }
        setUser(session.user)
        if (session?.provider_token) setProviderToken(session.provider_token)
      }

      try {
        const res = await fetch('/api/me')
        const d = await res.json()
        if (d.profile) setProfile(d.profile)
      } catch {}

      setIsReady(true)
    }
    init()
  }, [])

  const isManager = ['manager', 'admin'].includes(profile?.role)
  const isSdr = (profile?.rep_type || '').toLowerCase() === 'sdr'
  const personalView = isSdr ? 'sdr' : 'ae'          // a manager sells too — their own day follows rep_type
  const activeView = isManager && teamView ? 'manager' : personalView

  if (!isReady) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
      </div>
    )
  }

  return (
    <AppShell
      title="Today"
      subtitle="Your daily focus"
      actions={isManager && (
        <div className="flex bg-gray-100 rounded-lg p-1">
          <button
            onClick={() => setTeamView(false)}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              !teamView ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            My Day
          </button>
          <button
            onClick={() => setTeamView(true)}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              teamView ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Team
          </button>
        </div>
      )}
    >
      <div className="max-w-6xl mx-auto px-6 py-8">
        {activeView === 'manager' && <ManagerView router={router} />}
        {activeView === 'ae' && (
          <AEView userId={user?.id} providerToken={providerToken} router={router} profile={profile} />
        )}
        {activeView === 'sdr' && <SDRView router={router} />}
      </div>
    </AppShell>
  )
}
