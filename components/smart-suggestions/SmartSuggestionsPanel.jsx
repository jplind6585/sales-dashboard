import { useState } from 'react'
import {
  Mail, Calendar, RefreshCw, Plus, X, ChevronDown, ChevronRight,
  AlertCircle, Clock, Loader2, CheckCircle2, ExternalLink
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

/**
 * SmartSuggestionsPanel
 *
 * Shows Gmail-derived task suggestions and upcoming calendar meetings.
 * User clicks "Sync" to pull fresh data, then can add suggestions as tasks
 * or add prep tasks for upcoming meetings.
 *
 * Props:
 * - providerToken: string — Google OAuth token from Supabase session
 * - onAddTask: (taskData) => void — called to create a task
 */
export default function SmartSuggestionsPanel({ providerToken, onAddTask }) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const [emailSuggestions, setEmailSuggestions] = useState(null)   // null = not yet synced
  const [calendarEvents, setCalendarEvents] = useState(null)
  const [responseMetrics, setResponseMetrics] = useState(null)

  const [dismissedEmails, setDismissedEmails] = useState(new Set())
  const [addedEmails, setAddedEmails] = useState(new Set())
  const [addedCalendar, setAddedCalendar] = useState(new Set())

  const sync = async () => {
    if (!providerToken) {
      setError('No Google token available. Try signing out and back in.')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const [emailRes, calRes] = await Promise.all([
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
      ])

      const emailData = await emailRes.json()
      const calData = await calRes.json()

      if (!emailRes.ok) throw new Error(emailData.error || 'Gmail sync failed')
      if (!calRes.ok) throw new Error(calData.error || 'Calendar sync failed')

      setEmailSuggestions(emailData.suggestions || [])
      setResponseMetrics(emailData.responseMetrics || null)
      setCalendarEvents(calData.salesMeetings || [])
      setDismissedEmails(new Set())
      setAddedEmails(new Set())
      setAddedCalendar(new Set())
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const handleAddEmailTask = (suggestion) => {
    onAddTask({
      title: suggestion.title,
      description: `From email: "${suggestion.emailSubject}"\n\n${suggestion.reason}`,
      type: 'assigned',
      priority: suggestion.priority === 'high' ? 1 : suggestion.priority === 'medium' ? 2 : 3,
      source: 'email',
    })
    setAddedEmails(prev => new Set([...prev, suggestion.title]))
  }

  const handleAddCalendarPrepTask = (event) => {
    const attendeeNames = event.externalAttendees.map(a => a.name).join(', ')
    onAddTask({
      title: `Prep for: ${event.title}`,
      description: `Meeting ${formatEventTime(event.start)}${attendeeNames ? `\nWith: ${attendeeNames}` : ''}`,
      type: 'assigned',
      priority: event.hoursUntil <= 24 ? 1 : 2,
      dueDate: new Date(new Date(event.start).getTime() - 30 * 60 * 1000).toISOString().split('T')[0],
      source: 'calendar',
    })
    setAddedCalendar(prev => new Set([...prev, event.id]))
  }

  const visibleEmailSuggestions = (emailSuggestions || []).filter(
    s => !dismissedEmails.has(s.title)
  )

  const newSuggestionsCount = visibleEmailSuggestions.filter(s => !addedEmails.has(s.title)).length
  const prepNeededCount = (calendarEvents || []).filter(e => e.needsPrep && !addedCalendar.has(e.id)).length
  const totalBadge = newSuggestionsCount + prepNeededCount

  return (
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
                    return (
                      <div
                        key={i}
                        className={`flex items-start gap-2 p-3 rounded-lg border transition-colors ${
                          added ? 'bg-green-50 border-green-200' : 'bg-white border-gray-200 hover:border-blue-200'
                        }`}
                      >
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm font-medium ${added ? 'text-green-700 line-through' : 'text-gray-800'}`}>
                            {s.title}
                          </p>
                          <p className="text-xs text-gray-400 truncate mt-0.5">{s.emailSubject}</p>
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
                          {added ? (
                            <CheckCircle2 className="w-4 h-4 text-green-500" />
                          ) : (
                            <>
                              <button
                                onClick={() => handleAddEmailTask(s)}
                                className="p-1.5 text-blue-600 hover:bg-blue-50 rounded"
                                title="Add as task"
                              >
                                <Plus className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => setDismissedEmails(prev => new Set([...prev, s.title]))}
                                className="p-1.5 text-gray-400 hover:bg-gray-100 rounded"
                                title="Dismiss"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </>
                          )}
                        </div>
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
                    return (
                      <div
                        key={event.id}
                        className={`flex items-start gap-2 p-3 rounded-lg border transition-colors ${
                          added ? 'bg-green-50 border-green-200' :
                          event.needsPrep ? 'bg-amber-50 border-amber-200' :
                          'bg-white border-gray-200'
                        }`}
                      >
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm font-medium ${added ? 'text-green-700' : 'text-gray-800'}`}>
                            {event.title}
                          </p>
                          <p className="text-xs text-gray-500 mt-0.5">
                            {formatEventTime(event.start)}
                            {event.durationMin && ` · ${event.durationMin}min`}
                          </p>
                          {event.externalAttendees.length > 0 && (
                            <p className="text-xs text-gray-400 mt-0.5 truncate">
                              With: {event.externalAttendees.map(a => a.name).join(', ')}
                            </p>
                          )}
                          {event.needsPrep && !added && (
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
                          ) : (
                            <button
                              onClick={() => handleAddCalendarPrepTask(event)}
                              className="flex items-center gap-1 px-2 py-1 text-xs text-blue-600 hover:bg-blue-50 rounded border border-blue-200"
                              title="Add prep task"
                            >
                              <Plus className="w-3 h-3" />
                              Prep task
                            </button>
                          )}
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
  )
}
