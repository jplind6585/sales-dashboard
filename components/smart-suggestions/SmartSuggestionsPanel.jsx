import { useState, useEffect, useRef } from 'react'
import {
  Mail, Calendar, RefreshCw, Plus, X, ChevronDown, ChevronRight,
  AlertCircle, Clock, Loader2, CheckCircle2, ExternalLink, Info,
  Shield, Sparkles, Target, ChevronUp, ArrowRight
} from 'lucide-react'

const CATEGORY_COLORS = {
  follow_up: 'bg-blue-100 text-blue-700',
  send_content: 'bg-purple-100 text-purple-700',
  schedule_meeting: 'bg-green-100 text-green-700',
  internal: 'bg-gray-100 text-gray-600',
}

const PRIORITY_COLORS = {
  high: 'text-red-600',
  medium: 'text-amber-600',
  low: 'text-gray-500',
}

const BLOCKLIST_KEY = 'email_sender_blocklist'
const SUGGESTIONS_CACHE_KEY = 'smart_suggestions_cache_v3'
const CACHE_TTL_MS = 2 * 60 * 60 * 1000 // 2 hours

function todayKey() {
  return new Date().toISOString().split('T')[0]
}
function loadDailySet(key) {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return new Set()
    const { date, items } = JSON.parse(raw)
    if (date !== todayKey()) return new Set()
    return new Set(items)
  } catch { return new Set() }
}
function saveDailySet(key, set) {
  try {
    localStorage.setItem(key, JSON.stringify({ date: todayKey(), items: [...set] }))
  } catch {}
}

function loadSuggestionsCache() {
  try {
    const raw = localStorage.getItem(SUGGESTIONS_CACHE_KEY)
    if (!raw) return null
    const cached = JSON.parse(raw)
    if (Date.now() - cached.cachedAt > CACHE_TTL_MS) return null
    return cached
  } catch {
    return null
  }
}

function saveSuggestionsCache(suggestions, calendarEvents, responseMetrics, sdrBookings) {
  try {
    localStorage.setItem(SUGGESTIONS_CACHE_KEY, JSON.stringify({
      suggestions,
      calendarEvents,
      responseMetrics,
      sdrBookings,
      cachedAt: Date.now(),
    }))
  } catch {}
}

function loadBlocklist() {
  try {
    const raw = localStorage.getItem(BLOCKLIST_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function saveBlocklist(list) {
  try {
    localStorage.setItem(BLOCKLIST_KEY, JSON.stringify(list))
  } catch {}
}

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

function buildBriefTaskDescription(brief, event, formatFn) {
  const attendeeNames = event.externalAttendees.map(a => a.name).join(', ')
  const lines = [`Meeting: ${formatFn(event.start)}${attendeeNames ? `\nWith: ${attendeeNames}` : ''}`]
  if (brief.opening_recommendation) lines.push(`\nOPENING\n${brief.opening_recommendation}`)
  if (brief.key_objectives?.length) lines.push(`\nOBJECTIVES\n${brief.key_objectives.map(o => `• ${o}`).join('\n')}`)
  if (brief.talking_points?.length) lines.push(`\nKEY POINTS\n${brief.talking_points.map(p => `• ${p}`).join('\n')}`)
  if (brief.discovery_questions?.length) lines.push(`\nDISCOVERY QUESTIONS\n${brief.discovery_questions.map(q => `• ${q}`).join('\n')}`)
  if (brief.watch_outs?.length) lines.push(`\nWATCH OUTS\n${brief.watch_outs.map(w => `• ${w}`).join('\n')}`)
  if (brief.suggested_ask) lines.push(`\nCLOSING ASK\n${brief.suggested_ask}`)
  return lines.join('')
}

// ─── Prep Brief Modal ─────────────────────────────────────────────────────────

function PrepBriefModal({ event, onClose, onCreateTask }) {
  const [brief, setBrief] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    fetch('/api/calendar/prep-brief', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        meetingTitle: event.title,
        attendees: event.externalAttendees,
        meetingTime: formatEventTime(event.start),
        accountId: event.matchedAccount?.id || null,
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

  const handleCreate = () => {
    const description = brief
      ? buildBriefTaskDescription(brief, event, formatEventTime)
      : `Meeting ${formatEventTime(event.start)}\nWith: ${event.externalAttendees.map(a => a.name).join(', ')}`

    onCreateTask({
      title: `Prep for: ${event.title}`,
      description,
      type: 'assigned',
      priority: event.hoursUntil <= 24 ? 1 : 2,
      dueDate: new Date(new Date(event.start).getTime() - 30 * 60 * 1000).toISOString().split('T')[0],
      source: 'calendar',
    })
    onClose()
  }

  const handleSkip = () => {
    onCreateTask({
      title: `Prep for: ${event.title}`,
      description: `Meeting ${formatEventTime(event.start)}\nWith: ${event.externalAttendees.map(a => a.name).join(', ')}`,
      type: 'assigned',
      priority: event.hoursUntil <= 24 ? 1 : 2,
      dueDate: new Date(new Date(event.start).getTime() - 30 * 60 * 1000).toISOString().split('T')[0],
      source: 'calendar',
    })
    onClose()
  }

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
              {event.externalAttendees?.length > 0 && (
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
            onClick={handleSkip}
            className="px-3 py-2 text-sm text-gray-500 hover:text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50"
          >
            Basic task
          </button>
          <button
            onClick={handleCreate}
            disabled={loading}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors"
          >
            {loading ? (
              <><Loader2 className="w-3.5 h-3.5 animate-spin" />Generating…</>
            ) : (
              <><Plus className="w-3.5 h-3.5" />Add prep task with brief</>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Smart Suggestions Panel ──────────────────────────────────────────────────

/**
 * SmartSuggestionsPanel
 *
 * Shows Gmail-derived task suggestions and upcoming calendar meetings.
 * Auto-syncs on mount when a provider token is available.
 * Clicking a suggestion expands a detail panel with reason + source context.
 *
 * Props:
 * - providerToken: string — Google OAuth token from Supabase session
 * - onAddTask: (taskData) => void — called to create a task
 */
export default function SmartSuggestionsPanel({ providerToken, onAddTask }) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const [emailSuggestions, setEmailSuggestions] = useState(null)
  const [calendarEvents, setCalendarEvents] = useState(null)
  const [responseMetrics, setResponseMetrics] = useState(null)
  const [sdrBookings, setSdrBookings] = useState(null)
  const [addedBookings, setAddedBookings] = useState(() => loadDailySet('suggestions_added_bookings'))
  const [dismissedBookings, setDismissedBookings] = useState(() => loadDailySet('suggestions_dismissed_bookings'))

  const [dismissedEmails, setDismissedEmails] = useState(() => loadDailySet('suggestions_dismissed'))
  const [addedEmails, setAddedEmails] = useState(() => loadDailySet('suggestions_added'))
  const [confirmingEmails, setConfirmingEmails] = useState(new Set())
  const [addedCalendar, setAddedCalendar] = useState(() => loadDailySet('suggestions_added_calendar'))
  const [expandedEmailIndex, setExpandedEmailIndex] = useState(null)
  const [blockedSenders, setBlockedSenders] = useState([])
  const [autoPrepCount, setAutoPrepCount] = useState(0)
  const autoPrepCreatedRef = useRef(loadDailySet('auto_prep_created'))
  const autoFollowupCreatedRef = useRef(loadDailySet('auto_followup_created'))
  const [prepBriefEvent, setPrepBriefEvent] = useState(null)

  const hasSyncedRef = useRef(false)

  useEffect(() => { setBlockedSenders(loadBlocklist()) }, [])
  useEffect(() => { saveDailySet('suggestions_dismissed', dismissedEmails) }, [dismissedEmails])
  useEffect(() => { saveDailySet('suggestions_added', addedEmails) }, [addedEmails])
  useEffect(() => { saveDailySet('suggestions_added_calendar', addedCalendar) }, [addedCalendar])
  useEffect(() => { saveDailySet('suggestions_added_bookings', addedBookings) }, [addedBookings])
  useEffect(() => { saveDailySet('suggestions_dismissed_bookings', dismissedBookings) }, [dismissedBookings])

  const sync = async () => {
    if (!providerToken) {
      setError('No Google token available. Try signing out and back in.')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const [emailRes, calRes, opsRes] = await Promise.all([
        fetch('/api/gmail/suggestions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token: providerToken }),
        }),
        fetch('/api/calendar/upcoming', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token: providerToken }),
        }),
        fetch('/api/slack/sales-ops-feed'),
      ])

      const emailData = await emailRes.json()
      const calData = await calRes.json()
      const opsData = opsRes.ok ? await opsRes.json() : { bookings: [] }

      if (!emailRes.ok) throw new Error(emailData.error || 'Gmail sync failed')
      if (!calRes.ok) throw new Error(calData.error || 'Calendar sync failed')

      const suggestions = emailData.suggestions || []
      const meetings = calData.salesMeetings || []
      const metrics = emailData.responseMetrics || null
      const bookings = (opsData.bookings || []).filter(b =>
        b.ae?.toLowerCase().includes('james')
      )

      setEmailSuggestions(suggestions)
      setResponseMetrics(metrics)
      setCalendarEvents(meetings)
      setSdrBookings(bookings)
      setDismissedEmails(new Set())
      setAddedEmails(new Set())
      setAddedCalendar(new Set())
      setDismissedBookings(new Set())
      setExpandedEmailIndex(null)
      saveSuggestionsCache(suggestions, meetings, metrics, bookings)

      // Auto-create prep tasks for owned meetings that need prep and haven't been auto-created yet today
      if (onAddTask && meetings.length) {
        const toAutoPrep = meetings.filter(e =>
          e.needsPrep && e.isOwned !== false && !autoPrepCreatedRef.current.has(e.id)
        )
        if (toAutoPrep.length) {
          toAutoPrep.forEach(event => {
            const attendeeNames = event.externalAttendees.map(a => a.name).join(', ')
            onAddTask({
              title: `Prep for: ${event.title}`,
              description: `Meeting: ${formatEventTime(event.start)}${attendeeNames ? `\nWith: ${attendeeNames}` : ''}`,
              type: 'assigned',
              priority: event.hoursUntil <= 24 ? 1 : 2,
              dueDate: new Date(new Date(event.start).getTime() - 30 * 60 * 1000).toISOString().split('T')[0],
              source: 'calendar',
              sourceId: `cal_prep_${event.id}`,
            })
            autoPrepCreatedRef.current.add(event.id)
          })
          saveDailySet('auto_prep_created', autoPrepCreatedRef.current)
          setAddedCalendar(prev => new Set([...prev, ...toAutoPrep.map(e => e.id)]))
          setAutoPrepCount(toAutoPrep.length)
        }
      }
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (providerToken && !hasSyncedRef.current) {
      hasSyncedRef.current = true
      setOpen(true)

      const cached = loadSuggestionsCache()
      if (cached) {
        setEmailSuggestions(cached.suggestions)
        setCalendarEvents(cached.calendarEvents)
        setResponseMetrics(cached.responseMetrics)
        if (cached.sdrBookings) setSdrBookings(cached.sdrBookings)
      } else {
        sync()
      }
    }
  }, [providerToken])

  // Auto-create prep tasks when calendarEvents loads from cache (sync() handles the live case)
  const autoPrepFiredRef = useRef(false)
  useEffect(() => {
    if (!calendarEvents?.length || !onAddTask || autoPrepFiredRef.current) return
    autoPrepFiredRef.current = true
    const toAutoPrep = calendarEvents.filter(e =>
      e.needsPrep && e.isOwned !== false && !autoPrepCreatedRef.current.has(e.id)
    )
    if (!toAutoPrep.length) return
    toAutoPrep.forEach(event => {
      const attendeeNames = event.externalAttendees.map(a => a.name).join(', ')
      onAddTask({
        title: `Prep for: ${event.title}`,
        description: `Meeting: ${formatEventTime(event.start)}${attendeeNames ? `\nWith: ${attendeeNames}` : ''}`,
        type: 'assigned',
        priority: event.hoursUntil <= 24 ? 1 : 2,
        dueDate: new Date(new Date(event.start).getTime() - 30 * 60 * 1000).toISOString().split('T')[0],
        source: 'calendar',
      })
      autoPrepCreatedRef.current.add(event.id)
    })
    saveDailySet('auto_prep_created', autoPrepCreatedRef.current)
    setAddedCalendar(prev => new Set([...prev, ...toAutoPrep.map(e => e.id)]))
    setAutoPrepCount(toAutoPrep.length)
  }, [calendarEvents])

  // Auto-create a follow-up task (with a drafted email) for meetings that just ended.
  // Routes through /api/tasks/from-calendar so it gets account matching + an AI draft.
  const autoFollowupFiredRef = useRef(false)
  useEffect(() => {
    if (!calendarEvents?.length || autoFollowupFiredRef.current) return
    autoFollowupFiredRef.current = true
    const toFollowup = calendarEvents.filter(e =>
      e.needsFollowup && e.isOwned !== false && !autoFollowupCreatedRef.current.has(e.id)
    )
    if (!toFollowup.length) return
    let anyCreated = false
    Promise.all(toFollowup.map(async (event) => {
      try {
        const res = await fetch('/api/tasks/from-calendar', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phase: 'followup', accountId: event.matchedAccount?.id || null, event: { id: event.id, title: event.title, start: event.start, end: event.end } }),
        })
        const json = await res.json().catch(() => ({}))
        if (!res.ok || json.success === false) throw new Error(json.error || 'create failed')
        // Mark handled only on success — from-calendar is idempotent server-side, so a retry next sync is safe.
        autoFollowupCreatedRef.current.add(event.id)
        if (json.created) anyCreated = true
      } catch (e) {
        console.warn('[suggestions] follow-up task create failed, will retry next sync:', e.message)
      }
    })).then(() => {
      saveDailySet('auto_followup_created', autoFollowupCreatedRef.current)
      if (anyCreated) window.dispatchEvent(new Event('tasks:refresh')) // surface the new task without a manual reload
    })
  }, [calendarEvents])

  const handleAddEmailTask = (suggestion) => {
    onAddTask({
      title: suggestion.title,
      description: `From email: "${suggestion.emailSubject}"\n\n${suggestion.reason}`,
      type: 'assigned',
      priority: suggestion.priority === 'high' ? 1 : suggestion.priority === 'medium' ? 2 : 3,
      source: 'email',
      dueDate: suggestion.dueDate || null,
    })
    setConfirmingEmails(prev => new Set([...prev, suggestion.title]))
    setTimeout(() => {
      setAddedEmails(prev => new Set([...prev, suggestion.title]))
      setConfirmingEmails(prev => { const n = new Set(prev); n.delete(suggestion.title); return n; })
    }, 1200)
  }

  const handleBlockSender = (sender) => {
    if (!sender) return
    const updated = [...new Set([...blockedSenders, sender])]
    setBlockedSenders(updated)
    saveBlocklist(updated)
    // Dismiss all suggestions from this sender
    const toBlock = (emailSuggestions || [])
      .filter(s => s.sender === sender)
      .map(s => s.title)
    if (toBlock.length) {
      setDismissedEmails(prev => new Set([...prev, ...toBlock]))
    }
  }

  const isBlocked = (suggestion) => {
    if (!suggestion.sender) return false
    return blockedSenders.includes(suggestion.sender)
  }

  const isSpamLike = (suggestion) => {
    const subject = suggestion.emailSubject || ''
    return subject === '(no subject)' || subject === '' || subject.toLowerCase() === 'no subject'
  }

  const handleOpenPrepBrief = (event) => {
    setPrepBriefEvent(event)
  }

  const handleCreatePrepTask = (taskData) => {
    onAddTask(taskData)
    setAddedCalendar(prev => new Set([...prev, prepBriefEvent?.id]))
  }

  const visibleEmailSuggestions = (emailSuggestions || []).filter(
    s => !dismissedEmails.has(s.title) && !isBlocked(s) && !isSpamLike(s)
  )

  const newSuggestionsCount = visibleEmailSuggestions.filter(s => !addedEmails.has(s.title)).length
  const prepNeededCount = (calendarEvents || []).filter(e => e.needsPrep && !addedCalendar.has(e.id)).length
  const newBookingsCount = (sdrBookings || []).filter(b => !dismissedBookings.has(b.ts) && !addedBookings.has(b.ts)).length
  const totalBadge = newSuggestionsCount + prepNeededCount + newBookingsCount

  return (
    <>
      <div className="border border-blue-200 rounded-xl overflow-hidden bg-white">
        {/* Header */}
        <button
          onClick={() => setOpen(o => !o)}
          className="w-full flex items-center gap-3 px-4 py-3 bg-gradient-to-r from-blue-50 to-indigo-50 hover:from-blue-100 hover:to-indigo-100 text-left"
        >
          {open ? <ChevronDown className="w-4 h-4 text-blue-500 shrink-0" /> : <ChevronRight className="w-4 h-4 text-blue-500 shrink-0" />}
          <div className="flex items-center gap-2 flex-1">
            <Mail className="w-4 h-4 text-blue-600" />
            <span className="font-semibold text-gray-800 text-sm">Smart Suggestions</span>
            <span className="text-xs text-gray-400">Gmail · Calendar</span>
          </div>
          {totalBadge > 0 && (
            <span className="px-2 py-0.5 bg-blue-600 text-white text-xs font-bold rounded-full">
              {totalBadge}
            </span>
          )}
          <button
            onClick={e => { e.stopPropagation(); sync() }}
            disabled={loading}
            className={`p-1.5 rounded-lg text-blue-600 hover:bg-blue-100 transition-colors ${loading ? 'opacity-50' : ''}`}
            title="Sync email & calendar"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </button>

        {open && (
          <div className="p-4 space-y-4">
            {/* Error */}
            {error && (
              <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                {error}
              </div>
            )}

            {/* Not yet synced */}
            {!emailSuggestions && !loading && !error && (
              <div className="text-center py-6">
                <div className="flex justify-center gap-3 mb-3 text-gray-300">
                  <Mail className="w-6 h-6" />
                  <Calendar className="w-6 h-6" />
                </div>
                <p className="text-sm text-gray-500 mb-3">
                  Sync your Gmail and Google Calendar to get AI-powered task suggestions.
                </p>
                {!providerToken && (
                  <p className="text-xs text-amber-600 mb-3">
                    Google access not available. Sign out and back in to grant permission.
                  </p>
                )}
                <button
                  onClick={sync}
                  disabled={loading || !providerToken}
                  className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  Sync Now
                </button>
              </div>
            )}

            {loading && (
              <div className="flex items-center gap-2 text-sm text-gray-500 py-4 justify-center">
                <Loader2 className="w-4 h-4 animate-spin" />
                Reading your email and calendar...
              </div>
            )}

            {/* Auto-prep notice */}
            {autoPrepCount > 0 && !loading && (
              <div className="flex items-center gap-2 px-2.5 py-1.5 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-700">
                <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                Auto-created {autoPrepCount} prep task{autoPrepCount !== 1 ? 's' : ''} for upcoming meetings
              </div>
            )}

            {/* Response metrics strip */}
            {responseMetrics && !loading && (
              <div className="flex items-center gap-4 p-2.5 bg-gray-50 rounded-lg text-xs text-gray-500">
                <span className="flex items-center gap-1">
                  <Mail className="w-3.5 h-3.5" />
                  {responseMetrics.emailsAnalyzed} emails analyzed
                </span>
                {responseMetrics.unanswered > 0 && (
                  <span className="flex items-center gap-1 text-amber-600 font-medium">
                    <Clock className="w-3.5 h-3.5" />
                    {responseMetrics.unanswered} thread{responseMetrics.unanswered !== 1 ? 's' : ''} awaiting reply
                  </span>
                )}
                {blockedSenders.length > 0 && (
                  <span className="flex items-center gap-1 text-gray-400 ml-auto">
                    <Shield className="w-3 h-3" />
                    {blockedSenders.length} sender{blockedSenders.length !== 1 ? 's' : ''} blocked
                    <button
                      onClick={() => { setBlockedSenders([]); saveBlocklist([]) }}
                      className="ml-1 text-blue-500 hover:underline"
                    >
                      clear
                    </button>
                  </span>
                )}
              </div>
            )}

            {/* SDR Bookings from sales_operations */}
            {sdrBookings !== null && sdrBookings.length > 0 && !loading && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">From #sales_operations</span>
                </div>
                <div className="space-y-2">
                  {sdrBookings.filter(b => !dismissedBookings.has(b.ts)).map((b, i) => {
                    const key = b.ts || String(i)
                    const isAdded = addedBookings.has(key)
                    return (
                      <div key={key} className={`rounded-lg border p-3 ${isAdded ? 'bg-green-50 border-green-200' : 'bg-purple-50 border-purple-200'}`}>
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-800">
                              {b.action}: <span className="text-purple-700">{b.accountName}</span>
                            </p>
                            {b.contactName && (
                              <p className="text-xs text-gray-600 mt-0.5">
                                {b.contactName}{b.contactTitle ? ` — ${b.contactTitle}` : ''}
                              </p>
                            )}
                            {b.dateTime && (
                              <p className="text-xs text-gray-500 mt-0.5">{b.dateTime}</p>
                            )}
                            {b.contextBullets?.length > 0 && (
                              <ul className="mt-1 space-y-0.5">
                                {b.contextBullets.slice(0, 3).map((c, ci) => (
                                  <li key={ci} className="text-xs text-gray-600 flex gap-1">
                                    <span className="text-purple-400 shrink-0">•</span>{c}
                                  </li>
                                ))}
                              </ul>
                            )}
                            <p className="text-xs text-gray-400 mt-1">Booked by {b.sdrName}</p>
                          </div>
                          <div className="flex gap-1 shrink-0">
                            {isAdded ? (
                              <CheckCircle2 className="w-4 h-4 text-green-500" />
                            ) : (
                              <>
                                <button
                                  onClick={() => {
                                    onAddTask({
                                      title: `Prep for ${b.accountName} ${b.action}`,
                                      description: `Booked by ${b.sdrName}\n${b.contactName ? `Contact: ${b.contactName}${b.contactTitle ? ` — ${b.contactTitle}` : ''}\n` : ''}${b.dateTime ? `When: ${b.dateTime}\n` : ''}${b.contextBullets?.length ? `\nContext:\n${b.contextBullets.map(c => `• ${c}`).join('\n')}` : ''}`,
                                      type: 'assigned',
                                      priority: 1,
                                      source: 'calendar',
                                    })
                                    setAddedBookings(prev => new Set([...prev, key]))
                                  }}
                                  className="px-2 py-1 text-xs text-purple-600 hover:bg-purple-100 rounded border border-purple-200 font-medium"
                                >
                                  Add task
                                </button>
                                <button
                                  onClick={() => setDismissedBookings(prev => new Set([...prev, key]))}
                                  className="p-1.5 text-gray-400 hover:bg-gray-100 rounded"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Email suggestions */}
            {emailSuggestions !== null && !loading && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Mail className="w-3.5 h-3.5 text-gray-400" />
                  <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">From Email</span>
                </div>
                {visibleEmailSuggestions.length === 0 ? (
                  <p className="text-xs text-gray-400 italic pl-1">No action items found in recent emails.</p>
                ) : (
                  <div className="space-y-2">
                    {visibleEmailSuggestions.map((s, i) => {
                      const added = addedEmails.has(s.title)
                      const confirming = confirmingEmails.has(s.title)
                      const isExpanded = expandedEmailIndex === i
                      if (added) return null
                      return (
                        <div
                          key={i}
                          className={`rounded-lg border transition-all ${
                            confirming ? 'bg-green-50 border-green-200' : 'bg-white border-gray-200 hover:border-blue-200'
                          }`}
                        >
                          {/* Main row */}
                          <div
                            className="flex items-start gap-2 p-3 cursor-pointer"
                            onClick={() => !added && setExpandedEmailIndex(isExpanded ? null : i)}
                          >
                            <div className="flex-1 min-w-0">
                              <p className={`text-sm font-medium ${added ? 'text-green-700 line-through' : 'text-gray-800'}`}>
                                {s.title}
                              </p>
                              <p className="text-xs text-gray-500 truncate mt-0.5">
                                {s.sender ? `${s.sender}` : ''}{s.sender && s.emailSubject ? ' · ' : ''}{s.emailSubject || ''}
                              </p>
                              <div className="flex items-center gap-2 mt-1">
                                {s.category && (
                                  <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${CATEGORY_COLORS[s.category] || 'bg-gray-100 text-gray-600'}`}>
                                    {s.category.replace('_', ' ')}
                                  </span>
                                )}
                                {s.priority && (
                                  <span className={`text-xs font-medium ${PRIORITY_COLORS[s.priority]}`}>
                                    {s.priority}
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              {confirming ? (
                                <span className="text-xs text-green-600 font-medium flex items-center gap-1.5">
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                  Saved — check <span className="underline cursor-pointer" onClick={() => window.dispatchEvent(new CustomEvent('tasks:switchTab', { detail: 'all' }))}>All tasks</span>
                                </span>
                              ) : (
                                <>
                                  <button
                                    onClick={e => { e.stopPropagation(); handleAddEmailTask(s) }}
                                    className="px-2 py-1 text-xs text-blue-600 hover:bg-blue-50 rounded border border-blue-200 font-medium"
                                    title="Create task from this"
                                  >
                                    Add task
                                  </button>
                                  <button
                                    onClick={e => { e.stopPropagation(); setDismissedEmails(prev => new Set([...prev, s.title])) }}
                                    className="p-1.5 text-gray-400 hover:bg-gray-100 rounded"
                                    title="Not relevant — dismiss"
                                  >
                                    <X className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    onClick={e => { e.stopPropagation(); setExpandedEmailIndex(isExpanded ? null : i) }}
                                    className="p-1.5 text-gray-400 hover:bg-gray-100 rounded"
                                    title="Why was this surfaced?"
                                  >
                                    <Info className="w-3.5 h-3.5" />
                                  </button>
                                </>
                              )}
                            </div>
                          </div>

                          {/* Expanded context panel */}
                          {isExpanded && !added && (
                            <div className="mx-3 mb-3 p-3 bg-blue-50 border border-blue-100 rounded-lg text-xs space-y-2">
                              {s.reason && (
                                <div>
                                  <p className="font-semibold text-blue-800 mb-0.5">Why surfaced</p>
                                  <p className="text-blue-700 leading-relaxed">{s.reason}</p>
                                </div>
                              )}
                              {s.emailSubject && (
                                <div>
                                  <p className="font-semibold text-blue-800 mb-0.5">Source email</p>
                                  <p className="text-blue-700">{s.emailSubject}</p>
                                </div>
                              )}
                              {s.sender && (
                                <div className="flex items-center justify-between">
                                  <div>
                                    <p className="font-semibold text-blue-800 mb-0.5">From</p>
                                    <p className="text-blue-700">{s.sender}</p>
                                  </div>
                                  <button
                                    onClick={() => handleBlockSender(s.sender)}
                                    className="flex items-center gap-1 px-2 py-1 text-xs text-gray-500 hover:text-red-600 hover:bg-red-50 border border-gray-200 hover:border-red-200 rounded-lg transition-colors"
                                    title="Block this sender"
                                  >
                                    <Shield className="w-3 h-3" />
                                    Block sender
                                  </button>
                                </div>
                              )}
                              {s.context && (
                                <div>
                                  <p className="font-semibold text-blue-800 mb-0.5">Context</p>
                                  <p className="text-blue-700 leading-relaxed">{s.context}</p>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Calendar upcoming meetings */}
            {calendarEvents !== null && !loading && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Calendar className="w-3.5 h-3.5 text-gray-400" />
                  <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Upcoming Sales Meetings (7 days)</span>
                </div>
                {calendarEvents.length === 0 ? (
                  <p className="text-xs text-gray-400 italic pl-1">No external meetings in the next 7 days.</p>
                ) : (
                  <div className="space-y-2">
                    {calendarEvents.map(event => {
                      const added = addedCalendar.has(event.id)
                      const isTransferred = !!event.transferredTo
                      return (
                        <div
                          key={event.id}
                          className={`flex items-start gap-2 p-3 rounded-lg border transition-colors ${
                            added ? 'bg-green-50 border-green-200' :
                            isTransferred ? 'bg-gray-50 border-gray-200 opacity-70' :
                            event.needsPrep ? 'bg-amber-50 border-amber-200' :
                            'bg-white border-gray-200'
                          }`}
                        >
                          <div className="flex-1 min-w-0">
                            <p className={`text-sm font-medium ${added ? 'text-green-700' : isTransferred ? 'text-gray-500' : 'text-gray-800'}`}>
                              {event.title}
                            </p>
                            {event.originalTitle && (
                              <p className="text-xs text-gray-400 truncate">"{event.originalTitle}"</p>
                            )}
                            <p className="text-xs text-gray-500 mt-0.5">
                              {formatEventTime(event.start)}
                              {event.durationMin ? ` · ${event.durationMin}min` : ''}
                              {event.matchedAccount?.stage ? ` · ${event.matchedAccount.stage.replace(/_/g, ' ')}` : ''}
                            </p>
                            {event.externalAttendees.length > 0 && (
                              <p className="text-xs text-gray-400 mt-0.5 truncate">
                                With: {event.externalAttendees.map(a => a.name).join(', ')}
                              </p>
                            )}
                            {isTransferred && (
                              <span className="inline-block mt-1 px-1.5 py-0.5 bg-gray-100 text-gray-500 text-xs rounded">
                                Owned by {event.transferredTo}
                              </span>
                            )}
                            {event.needsPrep && !added && !isTransferred && (
                              <span className="inline-block mt-1 px-1.5 py-0.5 bg-amber-100 text-amber-700 text-xs rounded font-medium">
                                Prep needed
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
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
                            {added ? (
                              <CheckCircle2 className="w-4 h-4 text-green-500" />
                            ) : !isTransferred ? (
                              <button
                                onClick={() => handleOpenPrepBrief(event)}
                                className="flex items-center gap-1 px-2 py-1 text-xs text-indigo-600 hover:bg-indigo-50 rounded border border-indigo-200"
                                title="Generate AI prep brief"
                              >
                                <Sparkles className="w-3 h-3" />
                                AI Brief
                              </button>
                            ) : null}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Prep Brief Modal */}
      {prepBriefEvent && (
        <PrepBriefModal
          event={prepBriefEvent}
          onClose={() => setPrepBriefEvent(null)}
          onCreateTask={handleCreatePrepTask}
        />
      )}
    </>
  )
}
