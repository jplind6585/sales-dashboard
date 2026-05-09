import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/router';
import {
  Zap, Building2, Send, TrendingUp, Users, LayoutGrid, BarChart3,
  ChevronDown, ChevronUp, ChevronRight, X, RefreshCw,
  Calendar, Clock, Loader2, AlertCircle, CheckCircle2,
  Sparkles, ArrowRight, Target, Info, Phone, Mail,
  Linkedin, MessageSquare, Plus, ExternalLink
} from 'lucide-react';
import { useAuthStore } from '../../stores/useAuthStore';
import { getSession } from '../../lib/auth';
import { isSupabaseConfigured } from '../../lib/supabase';
import UserMenu from '../../components/auth/UserMenu';

// ─── Modules quick-nav ────────────────────────────────────────────────────────
const QUICK_MODULES = [
  { label: 'Today', href: '/modules/today', icon: Zap, color: 'text-amber-500' },
  { label: 'Account Pipeline', href: '/modules/account-pipeline', icon: Building2, color: 'text-blue-600' },
  { label: 'Outbound Engine', href: '/modules/outbound-engine', icon: Send, color: 'text-purple-600' },
  { label: 'Pipeline Overview', href: '/modules/pipeline-overview', icon: TrendingUp, color: 'text-teal-600' },
  { label: 'Rep Coaching', href: '/modules/coaching', icon: Users, color: 'text-indigo-600' },
  { label: 'Account Pursuit', href: '/modules/pursuit', icon: Target, color: 'text-orange-500' },
  { label: 'Bottleneck', href: '/modules/bottleneck', icon: BarChart3, color: 'text-red-500' },
  { label: 'All Modules', href: '/modules', icon: LayoutGrid, color: 'text-gray-600' },
]

function ModulesNav({ router }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
      >
        <LayoutGrid className="w-4 h-4" />
        Modules
        {open ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
      </button>
      {open && (
        <div className="absolute left-0 top-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg py-1.5 w-52 z-20">
          {QUICK_MODULES.map(m => (
            <button
              key={m.href}
              onClick={() => { router.push(m.href); setOpen(false) }}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 text-left"
            >
              <m.icon className={`w-4 h-4 ${m.color}`} />
              {m.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Stage badge ──────────────────────────────────────────────────────────────

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

function StageBadge({ stage }) {
  const label = stage ? stage.replace(/_/g, ' ') : '—'
  const colorClass = STAGE_COLORS[stage] || 'bg-gray-100 text-gray-600 border-gray-200'
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium border ${colorClass}`}>
      {label}
    </span>
  )
}

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

function buildBriefTaskDescription(brief, event) {
  const attendeeNames = (event.externalAttendees || []).map(a => a.name).join(', ')
  const lines = [`Meeting: ${formatEventTime(event.start)}${attendeeNames ? `\nWith: ${attendeeNames}` : ''}`]
  if (brief.opening_recommendation) lines.push(`\nOPENING\n${brief.opening_recommendation}`)
  if (brief.key_objectives?.length) lines.push(`\nOBJECTIVES\n${brief.key_objectives.map(o => `• ${o}`).join('\n')}`)
  if (brief.talking_points?.length) lines.push(`\nKEY POINTS\n${brief.talking_points.map(p => `• ${p}`).join('\n')}`)
  if (brief.discovery_questions?.length) lines.push(`\nDISCOVERY QUESTIONS\n${brief.discovery_questions.map(q => `• ${q}`).join('\n')}`)
  if (brief.watch_outs?.length) lines.push(`\nWATCH OUTS\n${brief.watch_outs.map(w => `• ${w}`).join('\n')}`)
  if (brief.suggested_ask) lines.push(`\nCLOSING ASK\n${brief.suggested_ask}`)
  return lines.join('')
}

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
        {/* Header */}
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

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5">
          {loading && (
            <div className="flex flex-col items-center justify-center py-10 gap-3">
              <Loader2 className="w-6 h-6 text-indigo-500 animate-spin" />
              <p className="text-sm text-gray-500">Generating pre-call brief…</p>
              {(event.externalAttendees?.length > 0) && (
                <p className="text-xs text-gray-400">Pulling call history for {event.title}</p>
              )}
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

        {/* Footer */}
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

// ─── AE View — Morning Brief card ─────────────────────────────────────────────

function MorningBriefCard() {
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
      }
    } catch {}
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
          <p className="text-sm text-gray-400 italic py-2">No brief available.</p>
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

function TodaysTasksCard({ router }) {
  const [tasks, setTasks] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/tasks')
      .then(r => r.json())
      .then(d => {
        const open = (d.tasks || []).filter(t => t.status !== 'complete')
        open.sort((a, b) => (a.priority || 3) - (b.priority || 3))
        setTasks(open.slice(0, 5))
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const PRIORITY_COLOR = {
    1: 'text-red-600 bg-red-50 border-red-200',
    2: 'text-amber-600 bg-amber-50 border-amber-200',
    3: 'text-gray-500 bg-gray-50 border-gray-200',
  }
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
          <p className="text-sm text-gray-400 italic py-2">No open tasks.</p>
        )}

        {!loading && tasks.length > 0 && (
          <ul className="space-y-2">
            {tasks.map(task => (
              <li key={task.id} className="flex items-start gap-2">
                <span className={`mt-0.5 px-1.5 py-0.5 rounded text-xs font-medium border flex-shrink-0 ${PRIORITY_COLOR[task.priority] || PRIORITY_COLOR[3]}`}>
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

// ─── AE View — Calendar card ──────────────────────────────────────────────────

function CalendarCard({ providerToken }) {
  const [events, setEvents] = useState(null)
  const [loading, setLoading] = useState(false)
  const [prepEvent, setPrepEvent] = useState(null)

  useEffect(() => {
    if (!providerToken) return
    setLoading(true)
    fetch('/api/calendar/upcoming', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: providerToken, days: 1 }),
    })
      .then(r => r.json())
      .then(d => {
        // Filter to today only
        const todayEvents = (d.salesMeetings || []).filter(e => isToday(e.start))
        setEvents(todayEvents)
      })
      .catch(() => setEvents([]))
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
            <p className="text-sm text-gray-400 italic py-2">No external meetings today.</p>
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

// ─── AE View — Pipeline Focus card ───────────────────────────────────────────

function PipelineFocusCard({ userId, router }) {
  const [accounts, setAccounts] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/pipeline-overview')
      .then(r => r.json())
      .then(d => {
        // Collect all accounts across reps, filter to current user
        const allAccounts = (d.repSummaries || [])
          .flatMap(rep => (rep.accounts || rep.staleAccounts || []).map(a => ({ ...a, repId: rep.id, repName: rep.name })))

        // Also try to get stale accounts (the API exposes staleAccounts per rep)
        // Best effort: get stale accounts for the current user from pipeline overview
        // We sort by days since last activity ascending (most stale first)
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

function AEView({ userId, providerToken, router }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      {/* Column 1 — Your Day */}
      <div className="space-y-4">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Your Day</p>
        <MorningBriefCard />
        <TodaysTasksCard router={router} />
      </div>

      {/* Column 2 — Calendar */}
      <div className="space-y-4">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Calendar</p>
        <CalendarCard providerToken={providerToken} />
      </div>

      {/* Column 3 — Pipeline Focus */}
      <div className="space-y-4">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Pipeline Focus</p>
        <PipelineFocusCard userId={userId} router={router} />
      </div>
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
      {/* Left — Team Activity */}
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

      {/* Right — At-Risk Deals */}
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
  const [repType, setRepType] = useState(null) // 'sdr' | 'ae' | null

  // Auth + profile init
  useEffect(() => {
    const init = async () => {
      const useAuth = isSupabaseConfigured() && process.env.NEXT_PUBLIC_USE_SUPABASE !== 'false'
      if (useAuth) {
        const { session } = await getSession()
        if (!session) { router.push('/login'); return }
        setUser(session.user)
        if (session?.provider_token) setProviderToken(session.provider_token)
      }

      // Load rep type from localStorage
      const stored = localStorage.getItem('user_rep_type')
      setRepType(stored || 'ae')

      // Fetch profile for manager detection
      try {
        const res = await fetch('/api/me')
        const d = await res.json()
        if (d.profile) setProfile(d.profile)
      } catch {}

      setIsReady(true)
    }
    init()
  }, [])

  const handleRepTypeToggle = (type) => {
    localStorage.setItem('user_rep_type', type)
    setRepType(type)
  }

  const isManager = profile?.role === 'manager'

  // Determine active view
  const activeView = isManager ? 'manager' : (repType || 'ae')

  if (!isReady) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 shadow-sm sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <Zap className="w-5 h-5 text-amber-500" />
                <div>
                  <h1 className="text-xl font-bold text-gray-900 leading-tight">Today</h1>
                  <p className="text-xs text-gray-400 leading-none">Your daily focus</p>
                </div>
              </div>
              <ModulesNav router={router} />
            </div>

            <div className="flex items-center gap-3">
              {/* Role toggle — only show for non-managers */}
              {!isManager && (
                <div className="flex bg-gray-100 rounded-lg p-1">
                  <button
                    onClick={() => handleRepTypeToggle('sdr')}
                    className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                      activeView === 'sdr' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    SDR
                  </button>
                  <button
                    onClick={() => handleRepTypeToggle('ae')}
                    className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                      activeView === 'ae' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    AE
                  </button>
                </div>
              )}

              {user && <UserMenu />}
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-6xl mx-auto px-6 py-8">
        {activeView === 'manager' && <ManagerView router={router} />}
        {activeView === 'ae' && (
          <AEView userId={user?.id} providerToken={providerToken} router={router} />
        )}
        {activeView === 'sdr' && <SDRView router={router} />}
      </div>
    </div>
  )
}
