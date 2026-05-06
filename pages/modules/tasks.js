import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/router';
import {
  CheckCircle2, Circle, Clock, AlertCircle, ChevronDown,
  Plus, Users, Filter, RefreshCw, Zap,
  Calendar, Building2, BarChart3, X, ChevronRight,
  LayoutGrid, TrendingUp, Send, ChevronUp, Sparkles,
  Target, BanIcon, Info, Star, MessageSquare, ArrowRight,
  Loader2, CornerDownLeft
} from 'lucide-react';
import { useAuthStore } from '../../stores/useAuthStore';
import { getCurrentUser, getSession } from '../../lib/auth';
import { isSupabaseConfigured } from '../../lib/supabase';
import UserMenu from '../../components/auth/UserMenu';
import SmartSuggestionsPanel from '../../components/smart-suggestions/SmartSuggestionsPanel';
import TaskCompleteModal from '../../components/tasks/TaskCompleteModal';

// ─── Modules quick-nav ────────────────────────────────────────────────────────
const QUICK_MODULES = [
  { label: 'Account Pipeline', href: '/modules/account-pipeline', icon: Building2, color: 'text-blue-600' },
  { label: 'Outbound Engine', href: '/modules/outbound-engine', icon: Send, color: 'text-purple-600' },
  { label: 'Pipeline Overview', href: '/modules/pipeline-overview', icon: TrendingUp, color: 'text-teal-600' },
  { label: 'Rep Coaching', href: '/modules/coaching', icon: Users, color: 'text-indigo-600' },
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

// ─── Work in Claude (per-task AI chat side panel) ────────────────────────────

function buildIntroMessage(task) {
  const lines = [`I'm ready to help you work through this task.`]
  if (task.rationale) lines.push(`\n**Why it matters:** ${task.rationale}`)
  if (task.primaryAction) lines.push(`\n**Suggested first move:** ${task.primaryAction}`)
  if (task.dueDate) {
    const d = new Date(task.dueDate)
    const today = new Date(); today.setHours(0,0,0,0)
    const diff = Math.floor((d - today) / 86400000)
    const label = diff < 0 ? `${Math.abs(diff)}d overdue` : diff === 0 ? 'due today' : diff === 1 ? 'due tomorrow' : `due ${d.toLocaleDateString('en-US',{month:'short',day:'numeric'})}`
    lines.push(`\n**Deadline:** ${label}`)
  }
  lines.push(`\nWhat do you need — a draft email, talking points, a call prep outline? Just ask.`)
  return lines.join('')
}

function WorkInClaude({ task, onClose }) {
  const storageKey = `wic_${task.id}`
  const [messages, setMessages] = useState(() => {
    try {
      const saved = localStorage.getItem(storageKey)
      if (saved) return JSON.parse(saved)
    } catch {}
    return [{ role: 'assistant', content: buildIntroMessage(task), ts: Date.now() }]
  })
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef(null)
  const inputRef = useRef(null)

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])
  useEffect(() => { inputRef.current?.focus() }, [])

  const persistMessages = (msgs) => {
    try { localStorage.setItem(storageKey, JSON.stringify(msgs.slice(-20))) } catch {}
  }

  const send = async () => {
    const text = input.trim()
    if (!text || loading) return
    const userMsg = { role: 'user', content: text, ts: Date.now() }
    const withUser = [...messages, userMsg]
    setMessages(withUser)
    persistMessages(withUser)
    setInput('')
    setLoading(true)

    try {
      const res = await fetch('/api/work-in-claude', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: withUser.map(m => ({ role: m.role, content: m.content })),
          taskContext: {
            title: task.title,
            description: task.description,
            rationale: task.rationale,
            primaryAction: task.primaryAction,
            dueDate: task.dueDate,
            source: task.source,
            sourceType: task.sourceType,
            account: task.account ? { name: task.account.name, stage: task.account.stage } : null,
          },
        }),
      })
      const data = await res.json()
      if (data.message) {
        const assistantMsg = { role: 'assistant', content: data.message, ts: Date.now() }
        const withReply = [...withUser, assistantMsg]
        setMessages(withReply)
        persistMessages(withReply)
      }
    } catch (e) {
      console.error('Work in Claude error:', e)
    } finally {
      setLoading(false)
      inputRef.current?.focus()
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() }
  }

  const clearThread = () => {
    const fresh = [{ role: 'assistant', content: buildIntroMessage(task), ts: Date.now() }]
    setMessages(fresh)
    persistMessages(fresh)
  }

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/30 z-40" onClick={onClose} />

      {/* Panel */}
      <div className="fixed inset-y-0 right-0 w-full max-w-md bg-white border-l border-gray-200 flex flex-col shadow-2xl z-50">
        {/* Header */}
        <div className="flex items-start justify-between px-4 py-3 border-b border-gray-200 bg-gradient-to-r from-indigo-50 to-purple-50">
          <div className="flex-1 min-w-0 mr-3">
            <div className="flex items-center gap-1.5 mb-0.5">
              <Sparkles className="w-3.5 h-3.5 text-indigo-600 flex-shrink-0" />
              <span className="text-xs font-semibold text-indigo-700 uppercase tracking-wide">Work in Claude</span>
            </div>
            <p className="text-sm font-semibold text-gray-900 leading-snug line-clamp-2">{task.title}</p>
            {task.account?.name && (
              <p className="text-xs text-gray-500 mt-0.5 flex items-center gap-1">
                <Building2 className="w-3 h-3" />{task.account.name}
              </p>
            )}
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            <button onClick={clearThread} className="px-2 py-1 text-xs text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">
              Clear
            </button>
            <button onClick={onClose} className="p-1.5 hover:bg-white/80 rounded-lg text-gray-400 hover:text-gray-700 transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 min-h-0">
          {messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${
                msg.role === 'user'
                  ? 'bg-indigo-600 text-white rounded-br-sm'
                  : 'bg-gray-100 text-gray-800 rounded-bl-sm'
              }`}>
                {msg.content}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start">
              <div className="bg-gray-100 rounded-2xl rounded-bl-sm px-4 py-3">
                <Loader2 className="w-4 h-4 text-gray-400 animate-spin" />
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div className="px-4 pb-4 pt-2 border-t border-gray-200">
          <div className="flex items-end gap-2">
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask Claude to draft an email, prep talking points, handle objections…"
              rows={2}
              className="flex-1 resize-none border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 placeholder-gray-400"
              style={{ minHeight: '60px', maxHeight: '120px' }}
            />
            <button
              onClick={send}
              disabled={!input.trim() || loading}
              className="flex-shrink-0 w-10 h-10 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl flex items-center justify-center transition-colors"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
            </button>
          </div>
          <p className="text-xs text-gray-400 mt-1.5 flex items-center gap-1">
            <CornerDownLeft className="w-3 h-3" />Enter to send · Shift+Enter for new line
          </p>
        </div>
      </div>
    </>
  )
}

// ─── NL Task Bar ──────────────────────────────────────────────────────────────

function NLTaskBar({ onCreate }) {
  const [text, setText] = useState('')
  const [parsing, setParsing] = useState(false)
  const [preview, setPreview] = useState(null) // parsed task fields
  const [creating, setCreating] = useState(false)

  const handleParse = async () => {
    if (!text.trim() || parsing) return
    setParsing(true)
    try {
      const res = await fetch('/api/tasks-nl', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: text.trim() }),
      })
      const data = await res.json()
      if (data.task) setPreview(data.task)
    } catch {}
    finally { setParsing(false) }
  }

  const handleConfirm = async () => {
    if (!preview || creating) return
    setCreating(true)
    await onCreate({
      title: preview.title,
      description: preview.description || null,
      priority: preview.priority || 2,
      dueDate: preview.dueDate || null,
      type: preview.type || 'triggered',
      source: 'manual',
    })
    setText('')
    setPreview(null)
    setCreating(false)
  }

  const PRIORITY_OPTS = [
    { value: 1, label: 'High', cls: 'text-red-600 bg-red-50 border-red-200' },
    { value: 2, label: 'Medium', cls: 'text-amber-600 bg-amber-50 border-amber-200' },
    { value: 3, label: 'Low', cls: 'text-gray-500 bg-gray-50 border-gray-200' },
  ]

  return (
    <div className="mb-4">
      {/* Input row */}
      <div className="flex items-center gap-2">
        <div className="flex-1 flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-3 py-2.5 focus-within:border-indigo-400 focus-within:ring-1 focus-within:ring-indigo-300 transition-all">
          <Sparkles className="w-4 h-4 text-indigo-400 flex-shrink-0" />
          <input
            type="text"
            value={text}
            onChange={e => { setText(e.target.value); setPreview(null) }}
            onKeyDown={e => { if (e.key === 'Enter') handleParse() }}
            placeholder='Quick add — "Send deck to Coastal Ridge tomorrow" or "Call John at Preiss"'
            className="flex-1 text-sm bg-transparent outline-none text-gray-800 placeholder-gray-400"
          />
          {text && (
            <button onClick={() => { setText(''); setPreview(null) }} className="text-gray-300 hover:text-gray-500">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        <button
          onClick={handleParse}
          disabled={!text.trim() || parsing}
          className="flex items-center gap-1.5 px-3 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white rounded-xl text-sm font-medium transition-colors"
        >
          {parsing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CornerDownLeft className="w-3.5 h-3.5" />}
          {parsing ? 'Parsing…' : 'Add'}
        </button>
      </div>

      {/* Preview card */}
      {preview && (
        <div className="mt-2 bg-white border border-indigo-200 rounded-xl p-4 shadow-sm">
          <div className="flex items-start justify-between gap-2 mb-3">
            <div className="flex-1">
              <input
                className="w-full text-sm font-semibold text-gray-900 border-none outline-none focus:ring-0 bg-transparent"
                value={preview.title}
                onChange={e => setPreview(p => ({ ...p, title: e.target.value }))}
              />
              {preview.rationale && (
                <p className="text-xs text-gray-500 mt-0.5 italic">{preview.rationale}</p>
              )}
            </div>
            <button onClick={() => setPreview(null)} className="text-gray-300 hover:text-gray-500 flex-shrink-0">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2 mb-3">
            {/* Priority picker */}
            {PRIORITY_OPTS.map(o => (
              <button
                key={o.value}
                onClick={() => setPreview(p => ({ ...p, priority: o.value }))}
                className={`px-2 py-0.5 rounded-full text-xs font-medium border transition-colors ${
                  preview.priority === o.value ? o.cls : 'text-gray-400 bg-gray-50 border-gray-200 opacity-50'
                }`}
              >
                {o.label}
              </button>
            ))}

            {/* Due date */}
            <input
              type="date"
              value={preview.dueDate || ''}
              onChange={e => setPreview(p => ({ ...p, dueDate: e.target.value || null }))}
              className="text-xs border border-gray-200 rounded-lg px-2 py-0.5 text-gray-600 outline-none focus:ring-1 focus:ring-indigo-400"
            />
          </div>

          <div className="flex gap-2">
            <button onClick={() => setPreview(null)} className="px-3 py-1.5 text-xs text-gray-500 hover:text-gray-700 border border-gray-200 rounded-lg">
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              disabled={creating || !preview.title?.trim()}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg disabled:opacity-50 transition-colors"
            >
              {creating ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3" />}
              {creating ? 'Creating…' : 'Create task'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Today's Focus (Morning Brief) ───────────────────────────────────────────

function TodaysFocus() {
  const [brief, setBrief] = useState(null)
  const [loading, setLoading] = useState(false)
  const [collapsed, setCollapsed] = useState(false)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    const today = new Date().toDateString()
    const dismissedDate = localStorage.getItem('brief_dismissed_date')
    if (dismissedDate === today) { setDismissed(true); return }

    const cachedDate = localStorage.getItem('brief_cached_date')
    if (cachedDate === today) {
      const cached = localStorage.getItem('brief_cached_data')
      if (cached) { try { setBrief(JSON.parse(cached)); return } catch {} }
    }

    setLoading(true)
    fetch('/api/rep/morning-brief')
      .then(r => r.json())
      .then(d => {
        if (d.brief) {
          setBrief(d.brief)
          localStorage.setItem('brief_cached_date', today)
          localStorage.setItem('brief_cached_data', JSON.stringify(d.brief))
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const handleDismiss = () => {
    localStorage.setItem('brief_dismissed_date', new Date().toDateString())
    setDismissed(true)
  }

  if (dismissed) return null

  if (loading) {
    return (
      <div className="mb-6 rounded-2xl bg-gradient-to-br from-indigo-50 to-purple-50 border border-indigo-200 p-5">
        <div className="flex items-center gap-2 text-indigo-700 text-sm">
          <Sparkles className="w-4 h-4 animate-pulse" />
          Generating your morning brief…
        </div>
      </div>
    )
  }

  if (!brief) return null

  const { headline, top_priority, deals_to_watch, quick_wins, insight, task_count } = brief

  return (
    <div className="mb-6 rounded-2xl bg-gradient-to-br from-indigo-50 via-purple-50 to-blue-50 border border-indigo-200 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-indigo-100">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-indigo-600" />
          <span className="text-sm font-semibold text-indigo-900">Today's Focus</span>
          {task_count && (
            <span className="text-xs text-indigo-500 font-normal">
              {task_count.total} open{task_count.overdue > 0 ? ` · ${task_count.overdue} overdue` : ''}{task_count.today > 0 ? ` · ${task_count.today} due today` : ''}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => setCollapsed(c => !c)} className="p-1 hover:bg-indigo-100 rounded-lg text-indigo-400 hover:text-indigo-700 transition-colors">
            <ChevronDown className={`w-4 h-4 transition-transform ${collapsed ? 'rotate-180' : ''}`} />
          </button>
          <button onClick={handleDismiss} className="p-1 hover:bg-indigo-100 rounded-lg text-indigo-400 hover:text-indigo-700 transition-colors" title="Dismiss for today">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {!collapsed && (
        <div className="p-5 space-y-4">
          {/* Headline */}
          {headline && <p className="text-sm font-medium text-indigo-900 leading-snug">{headline}</p>}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Top priority */}
            {top_priority && (
              <div className="bg-white/70 rounded-xl p-4 border border-indigo-100">
                <div className="flex items-center gap-1.5 mb-2">
                  <Target className="w-3.5 h-3.5 text-indigo-600" />
                  <span className="text-xs font-semibold text-indigo-700 uppercase tracking-wide">Do First</span>
                </div>
                <p className="text-sm text-gray-800 leading-snug">{top_priority}</p>
              </div>
            )}

            {/* Insight */}
            {insight && (
              <div className="bg-white/70 rounded-xl p-4 border border-purple-100">
                <div className="flex items-center gap-1.5 mb-2">
                  <Info className="w-3.5 h-3.5 text-purple-600" />
                  <span className="text-xs font-semibold text-purple-700 uppercase tracking-wide">Insight</span>
                </div>
                <p className="text-sm text-gray-800 leading-snug italic">{insight}</p>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Deals to watch */}
            {deals_to_watch?.length > 0 && (
              <div>
                <div className="flex items-center gap-1.5 mb-2">
                  <Star className="w-3.5 h-3.5 text-amber-500" />
                  <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Deals to Watch</span>
                </div>
                <ul className="space-y-1">
                  {deals_to_watch.slice(0, 3).map((d, i) => (
                    <li key={i} className="text-sm text-gray-700 flex items-start gap-1.5">
                      <span className="text-amber-400 mt-0.5">•</span>{d}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Quick wins */}
            {quick_wins?.length > 0 && (
              <div>
                <div className="flex items-center gap-1.5 mb-2">
                  <Zap className="w-3.5 h-3.5 text-green-500" />
                  <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Quick Wins</span>
                </div>
                <ul className="space-y-1">
                  {quick_wins.slice(0, 3).map((q, i) => (
                    <li key={i} className="text-sm text-gray-700 flex items-start gap-1.5">
                      <span className="text-green-400 mt-0.5">✓</span>{q}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Dismiss Modal ────────────────────────────────────────────────────────────

const DISMISS_REASONS = [
  'Already done',
  'No longer relevant',
  'Prospect went cold',
  'Duplicate task',
  'Deprioritized',
  'Other',
]

function DismissModal({ task, onClose, onDismiss }) {
  const [reason, setReason] = useState('')
  const [dismissing, setDismissing] = useState(false)

  const handleDismiss = async () => {
    setDismissing(true)
    await onDismiss(task.id, reason || null)
    setDismissing(false)
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
        <div className="flex items-center justify-between p-5 border-b">
          <div className="flex items-center gap-2">
            <BanIcon className="w-4 h-4 text-gray-500" />
            <h2 className="text-base font-semibold text-gray-900">Dismiss task</h2>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg">
            <X className="w-4 h-4 text-gray-400" />
          </button>
        </div>
        <div className="p-5">
          <p className="text-sm text-gray-600 mb-4 line-clamp-2">"{task.title}"</p>
          <p className="text-xs font-medium text-gray-700 mb-2">Reason (optional)</p>
          <div className="grid grid-cols-2 gap-2 mb-3">
            {DISMISS_REASONS.map(r => (
              <button
                key={r}
                onClick={() => setReason(reason === r ? '' : r)}
                className={`px-3 py-2 rounded-lg text-xs text-left transition-colors border ${
                  reason === r
                    ? 'bg-red-50 border-red-300 text-red-700 font-medium'
                    : 'border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50'
                }`}
              >
                {r}
              </button>
            ))}
          </div>
        </div>
        <div className="flex gap-3 px-5 pb-5">
          <button onClick={onClose} className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm hover:bg-gray-50">
            Cancel
          </button>
          <button
            onClick={handleDismiss}
            disabled={dismissing}
            className="flex-1 px-4 py-2 bg-red-500 text-white rounded-lg text-sm hover:bg-red-600 disabled:opacity-50"
          >
            {dismissing ? 'Dismissing…' : 'Dismiss'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Constants ────────────────────────────────────────────────────────────────

const PRIORITY_LABEL = { 1: 'High', 2: 'Medium', 3: 'Low' }
const PRIORITY_COLOR = {
  1: 'text-red-600 bg-red-50 border-red-200',
  2: 'text-amber-600 bg-amber-50 border-amber-200',
  3: 'text-gray-500 bg-gray-50 border-gray-200',
}
const TYPE_LABEL = {
  triggered:  'Triggered',
  assigned:   'Assigned',
  recurring:  'Recurring',
  project:    'Project',
}
const TYPE_COLOR = {
  triggered:  'bg-blue-100 text-blue-700',
  assigned:   'bg-purple-100 text-purple-700',
  recurring:  'bg-teal-100 text-teal-700',
  project:    'bg-orange-100 text-orange-700',
}
const STATUS_OPTIONS = ['open', 'in_progress', 'complete', 'blocked']
const TYPE_ORDER = ['triggered', 'assigned', 'recurring', 'project']

// ─── Helpers ─────────────────────────────────────────────────────────────────

// ─── AI Priority Score ────────────────────────────────────────────────────────
// Client-side urgency score 0–100. Used to rank within each task type group.

function computeTaskPriority(task) {
  let score = 0
  const today = new Date(); today.setHours(0,0,0,0)

  // Due date proximity
  if (task.dueDate) {
    const d = new Date(task.dueDate)
    const diff = Math.floor((d - today) / 86400000)
    if (diff < 0)   score += 60   // overdue
    else if (diff === 0) score += 50 // due today
    else if (diff === 1) score += 35 // tomorrow
    else if (diff <= 3)  score += 20 // this week
    else if (diff <= 7)  score += 10
  }

  // Explicit priority field
  if (task.priority === 1) score += 20
  else if (task.priority === 2) score += 8

  // Source type — commitments and gong next steps have extra urgency
  if (task.sourceType === 'gong_commitment') score += 15
  else if (task.sourceType === 'gong_next_step') score += 8

  // Rationale keywords
  const rationale = (task.rationale || '').toLowerCase()
  if (/near.close|final|contract|overdue|blocking|close step/.test(rationale)) score += 12
  if (/demo|follow.up|schedule/.test(rationale)) score += 5

  return Math.min(score, 100)
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDate(dateStr) {
  if (!dateStr) return null
  const d = new Date(dateStr)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const diff = Math.floor((d - today) / (1000 * 60 * 60 * 24))
  if (diff === 0) return 'Today'
  if (diff === 1) return 'Tomorrow'
  if (diff === -1) return 'Yesterday'
  if (diff < 0) return `${Math.abs(diff)}d overdue`
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function isOverdue(task) {
  if (task.status === 'complete') return false
  if (!task.dueDate) return false
  return new Date(task.dueDate) < new Date(new Date().toDateString())
}

// ─── New Task Modal ───────────────────────────────────────────────────────────

function NewTaskModal({ onClose, onCreate, currentUserId, users }) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [priority, setPriority] = useState(2)
  const [ownerId, setOwnerId] = useState(currentUserId || '')
  const [saving, setSaving] = useState(false)

  const handleCreate = async () => {
    if (!title.trim()) return
    setSaving(true)
    await onCreate({ title: title.trim(), description: description.trim() || null, dueDate: dueDate || null, priority, ownerId: ownerId || currentUserId })
    setSaving(false)
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-lg font-semibold text-gray-900">New Task</h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg">
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Title <span className="text-red-500">*</span></label>
            <input
              autoFocus
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleCreate()}
              placeholder="What needs to be done?"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Optional context or notes"
              rows={3}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Due Date</label>
              <input
                type="date"
                value={dueDate}
                onChange={e => setDueDate(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
              <select
                value={priority}
                onChange={e => setPriority(Number(e.target.value))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value={1}>High</option>
                <option value={2}>Medium</option>
                <option value={3}>Low</option>
              </select>
            </div>
          </div>
          {users && users.length > 1 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Assign to</label>
              <select
                value={ownerId}
                onChange={e => setOwnerId(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {users.map(u => (
                  <option key={u.id} value={u.id}>
                    {u.full_name || u.email}{u.id === currentUserId ? ' (you)' : ''}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
        <div className="flex gap-3 p-6 border-t">
          <button onClick={onClose} className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm hover:bg-gray-50">
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={!title.trim() || saving}
            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? 'Creating...' : 'Create Task'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Task Row ─────────────────────────────────────────────────────────────────

function TaskRow({ task, onStatusChange, onDelete, onDismiss, onWorkInClaude }) {
  const [expanded, setExpanded] = useState(false)
  const [statusOpen, setStatusOpen] = useState(false)
  const overdue = isOverdue(task)
  const dateLabel = formatDate(task.dueDate)
  const isGong = task.source === 'gong'

  return (
    <div className={`border rounded-xl transition-all ${overdue ? 'border-red-200 bg-red-50/30' : 'border-gray-200 bg-white'} hover:shadow-sm`}>
      <div className="flex items-start gap-3 p-4">
        {/* Complete toggle */}
        <button
          onClick={() => onStatusChange(task.id, task.status === 'complete' ? 'open' : 'complete')}
          className="mt-0.5 flex-shrink-0 text-gray-400 hover:text-green-500 transition-colors"
        >
          {task.status === 'complete'
            ? <CheckCircle2 className="w-5 h-5 text-green-500" />
            : <Circle className="w-5 h-5" />
          }
        </button>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <p className={`text-sm font-medium leading-snug ${task.status === 'complete' ? 'line-through text-gray-400' : 'text-gray-900'}`}>
              {task.title}
            </p>
            <button onClick={() => setExpanded(!expanded)} className="flex-shrink-0 text-gray-400 hover:text-gray-600 mt-0.5">
              <ChevronDown className={`w-4 h-4 transition-transform ${expanded ? 'rotate-180' : ''}`} />
            </button>
          </div>

          {/* Meta row */}
          <div className="flex flex-wrap items-center gap-2 mt-2">
            {/* Type badge */}
            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${TYPE_COLOR[task.type]}`}>
              {TYPE_LABEL[task.type]}
            </span>

            {/* Priority */}
            <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${PRIORITY_COLOR[task.priority]}`}>
              {PRIORITY_LABEL[task.priority]}
            </span>

            {/* Account link */}
            {task.account && (
              <span className="flex items-center gap-1 text-xs text-gray-500">
                <Building2 className="w-3 h-3" />
                {task.account.name}
              </span>
            )}

            {/* Due date */}
            {dateLabel && (
              <span className={`flex items-center gap-1 text-xs ${overdue ? 'text-red-600 font-medium' : 'text-gray-500'}`}>
                <Clock className="w-3 h-3" />
                {dateLabel}
              </span>
            )}

            {/* Work in Claude */}
            {onWorkInClaude && task.status !== 'complete' && (
              <button
                onClick={() => onWorkInClaude(task)}
                className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-50 text-indigo-600 border border-indigo-200 hover:bg-indigo-100 transition-colors"
                title="Work in Claude"
              >
                <Sparkles className="w-3 h-3" />
                Work
              </button>
            )}

            {/* Status selector */}
            <div className="relative ml-auto">
              <button
                onClick={() => setStatusOpen(!statusOpen)}
                className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border transition-colors ${
                  task.status === 'complete' ? 'bg-green-50 text-green-700 border-green-200' :
                  task.status === 'in_progress' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                  task.status === 'blocked' ? 'bg-red-50 text-red-700 border-red-200' :
                  'bg-gray-50 text-gray-600 border-gray-200'
                }`}
              >
                {task.status.replace('_', ' ')}
                <ChevronDown className="w-3 h-3" />
              </button>
              {statusOpen && (
                <div className="absolute right-0 top-6 bg-white border border-gray-200 rounded-lg shadow-lg z-10 py-1 min-w-[120px]">
                  {STATUS_OPTIONS.map(s => (
                    <button
                      key={s}
                      onClick={() => { onStatusChange(task.id, s); setStatusOpen(false) }}
                      className="block w-full text-left px-3 py-1.5 text-xs hover:bg-gray-50 text-gray-700"
                    >
                      {s.replace('_', ' ')}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Expanded details */}
          {expanded && (
            <div className="mt-3 border-t border-gray-100 pt-3 space-y-2">
              {task.rationale && (
                <div className="flex items-start gap-1.5 bg-blue-50 rounded-lg px-3 py-2">
                  <Info className="w-3.5 h-3.5 text-blue-500 mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-blue-700 leading-relaxed">{task.rationale}</p>
                </div>
              )}
              {task.description && !task.rationale && (
                <p className="text-sm text-gray-600 leading-relaxed">{task.description}</p>
              )}
              {task.description && task.rationale && (
                <p className="text-xs text-gray-500 leading-relaxed">{task.description}</p>
              )}
              <div className="flex justify-end gap-3 pt-1">
                {onDismiss && (
                  <button onClick={() => onDismiss(task)} className="text-xs text-orange-500 hover:text-orange-700">
                    Dismiss
                  </button>
                )}
                <button onClick={() => onDelete(task.id)} className="text-xs text-red-400 hover:text-red-700">
                  Delete
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Rep View ─────────────────────────────────────────────────────────────────

function RepView({ tasks, onStatusChange, onDelete, onDismiss, onWorkInClaude, onNewTask }) {
  const grouped = TYPE_ORDER.reduce((acc, type) => {
    const items = tasks
      .filter(t => t.type === type)
      .sort((a, b) => computeTaskPriority(b) - computeTaskPriority(a))
    if (items.length) acc[type] = items
    return acc
  }, {})

  const open = tasks.filter(t => t.status !== 'complete')
  const overdue = tasks.filter(isOverdue)
  const completedToday = tasks.filter(t => {
    if (t.status !== 'complete' || !t.completedAt) return false
    return new Date(t.completedAt).toDateString() === new Date().toDateString()
  })

  return (
    <div className="space-y-6">
      {/* Summary strip */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
          <p className="text-2xl font-bold text-gray-900">{open.length}</p>
          <p className="text-xs text-gray-500 mt-1">Open tasks</p>
        </div>
        <div className={`rounded-xl border p-4 text-center ${overdue.length > 0 ? 'bg-red-50 border-red-200' : 'bg-white border-gray-200'}`}>
          <p className={`text-2xl font-bold ${overdue.length > 0 ? 'text-red-600' : 'text-gray-900'}`}>{overdue.length}</p>
          <p className="text-xs text-gray-500 mt-1">Overdue</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
          <p className="text-2xl font-bold text-green-600">{completedToday.length}</p>
          <p className="text-xs text-gray-500 mt-1">Done today</p>
        </div>
      </div>

      {/* Task groups */}
      {Object.keys(grouped).length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <CheckCircle2 className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="text-sm">No tasks yet.</p>
          <button onClick={onNewTask} className="mt-3 text-sm text-blue-600 hover:underline">Create your first task</button>
        </div>
      ) : (
        TYPE_ORDER.filter(type => grouped[type]).map(type => (
          <div key={type}>
            <div className="flex items-center gap-2 mb-3">
              <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${TYPE_COLOR[type]}`}>
                {TYPE_LABEL[type]}
              </span>
              <span className="text-xs text-gray-400">{grouped[type].length} task{grouped[type].length !== 1 ? 's' : ''}</span>
            </div>
            <div className="space-y-2">
              {grouped[type].map(task => (
                <TaskRow key={task.id} task={task} onStatusChange={onStatusChange} onDelete={onDelete} onDismiss={onDismiss} onWorkInClaude={onWorkInClaude} />
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  )
}

// ─── Manager View ─────────────────────────────────────────────────────────────

function ManagerView({ summary, allTasks, onStatusChange, onDelete }) {
  const [selectedRep, setSelectedRep] = useState(null)

  const totalOpen = summary.reduce((s, r) => s + r.open, 0)
  const totalOverdue = summary.reduce((s, r) => s + r.overdue, 0)
  const totalDoneWeek = summary.reduce((s, r) => s + r.completedThisWeek, 0)

  const repTasks = selectedRep
    ? allTasks.filter(t => t.ownerId === selectedRep.userId)
    : []

  return (
    <div className="space-y-6">
      {/* Team summary strip */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
          <p className="text-2xl font-bold text-gray-900">{totalOpen}</p>
          <p className="text-xs text-gray-500 mt-1">Team open tasks</p>
        </div>
        <div className={`rounded-xl border p-4 text-center ${totalOverdue > 0 ? 'bg-red-50 border-red-200' : 'bg-white border-gray-200'}`}>
          <p className={`text-2xl font-bold ${totalOverdue > 0 ? 'text-red-600' : 'text-gray-900'}`}>{totalOverdue}</p>
          <p className="text-xs text-gray-500 mt-1">Team overdue</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
          <p className="text-2xl font-bold text-green-600">{totalDoneWeek}</p>
          <p className="text-xs text-gray-500 mt-1">Done this week</p>
        </div>
      </div>

      {/* Rep grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {summary.map(rep => (
          <button
            key={rep.userId}
            onClick={() => setSelectedRep(selectedRep?.userId === rep.userId ? null : rep)}
            className={`text-left p-5 rounded-xl border transition-all ${
              selectedRep?.userId === rep.userId
                ? 'border-blue-400 bg-blue-50 shadow-sm'
                : 'border-gray-200 bg-white hover:border-blue-200 hover:shadow-sm'
            }`}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white text-sm font-bold">
                {rep.name?.charAt(0)?.toUpperCase() || '?'}
              </div>
              <ChevronRight className={`w-4 h-4 text-gray-400 transition-transform ${selectedRep?.userId === rep.userId ? 'rotate-90' : ''}`} />
            </div>
            <p className="font-semibold text-gray-900 text-sm truncate">{rep.name}</p>
            <p className="text-xs text-gray-400 capitalize mb-3">{rep.role}</p>
            <div className="flex gap-3">
              <div>
                <p className="text-lg font-bold text-gray-900">{rep.open}</p>
                <p className="text-xs text-gray-400">open</p>
              </div>
              {rep.overdue > 0 && (
                <div>
                  <p className="text-lg font-bold text-red-600">{rep.overdue}</p>
                  <p className="text-xs text-gray-400">overdue</p>
                </div>
              )}
              <div>
                <p className="text-lg font-bold text-green-600">{rep.completedThisWeek}</p>
                <p className="text-xs text-gray-400">this wk</p>
              </div>
            </div>
          </button>
        ))}
      </div>

      {/* Selected rep task list */}
      {selectedRep && (
        <div>
          <div className="flex items-center gap-2 mb-4">
            <Users className="w-4 h-4 text-gray-400" />
            <h3 className="font-semibold text-gray-800">{selectedRep.name}'s tasks</h3>
            <span className="text-sm text-gray-400">({repTasks.length})</span>
          </div>
          {repTasks.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">No tasks</p>
          ) : (
            <div className="space-y-2">
              {repTasks.map(task => (
                <TaskRow key={task.id} task={task} onStatusChange={onStatusChange} onDelete={onDelete} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function TasksPage() {
  const router = useRouter()
  const { user, setUser } = useAuthStore()

  const [isReady, setIsReady] = useState(false)
  const [tasks, setTasks] = useState([])
  const [summary, setSummary] = useState([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState('rep') // 'rep' | 'manager'
  const [showNewTask, setShowNewTask] = useState(false)
  const [filterStatus, setFilterStatus] = useState('active') // 'active' | 'all' | 'complete'
  const [providerToken, setProviderToken] = useState(null)
  const [completeTask, setCompleteTask] = useState(null) // task being completed via AI modal
  const [dismissTask, setDismissTask] = useState(null) // task being dismissed
  const [workTask, setWorkTask] = useState(null) // task open in Work in Claude panel
  const [users, setUsers] = useState([])
  const demoSeeded = useRef(false)

  // Auth check — AuthGuard handles redirects; we just need the user + provider token
  useEffect(() => {
    const init = async () => {
      const useAuth = isSupabaseConfigured() && process.env.NEXT_PUBLIC_USE_SUPABASE !== 'false'
      if (useAuth) {
        const { user: currentUser } = await getCurrentUser()
        if (!currentUser) { router.push('/login'); return }
        setUser(currentUser)
        // Grab Google provider_token for Gmail/Calendar (non-blocking)
        getSession().then(({ session }) => {
          if (session?.provider_token) setProviderToken(session.provider_token)
        }).catch(() => {})
        // Fetch team members for assign-to dropdown (non-blocking)
        fetch('/api/users').then(r => r.json()).then(d => { if (d.users) setUsers(d.users) }).catch(() => {})
      }
      setIsReady(true)
    }
    init()
  }, [])

  const seedDemoTasks = useCallback(async () => {
    if (demoSeeded.current) return
    demoSeeded.current = true
    const demos = [
      { title: 'Email UDR for an update', description: 'Check in on where they are in the evaluation and see if they need anything from us.', type: 'assigned', priority: 2 },
      { title: 'Create swim lanes for IRT', description: 'Map out the key stakeholders and workstreams for the IRT deal — who owns what in their buying process.', type: 'assigned', priority: 2 },
    ]
    const created = []
    for (const d of demos) {
      try {
        const res = await fetch('/api/tasks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(d),
        })
        const json = await res.json()
        if (json.success) created.push(json.task)
      } catch {}
    }
    if (created.length) setTasks(prev => [...created, ...prev])
  }, [])

  const fetchTasks = useCallback(async () => {
    setLoading(true)
    try {
      const [tasksRes, summaryRes] = await Promise.all([
        fetch('/api/tasks'),
        fetch('/api/tasks?view=team'),
      ])
      const tasksData = await tasksRes.json()
      const summaryData = await summaryRes.json()
      const fetched = tasksData.tasks || []
      if (tasksData.success) setTasks(fetched)
      if (summaryData.success) setSummary(summaryData.summary || [])
      // Auto-seed demo tasks if list is empty
      if (fetched.length === 0 && isSupabaseConfigured()) {
        seedDemoTasks()
      }
    } catch (err) {
      console.error('Failed to fetch tasks:', err)
    } finally {
      setLoading(false)
    }
  }, [seedDemoTasks])

  useEffect(() => {
    if (isReady) fetchTasks()
  }, [isReady, fetchTasks])

  const handleStatusChange = async (taskId, newStatus) => {
    // Completing a task → open AI assistant modal first
    if (newStatus === 'complete') {
      const task = tasks.find(t => t.id === taskId)
      if (task) { setCompleteTask(task); return }
    }
    // Optimistic update for non-complete status changes
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: newStatus } : t))
    try {
      await fetch(`/api/tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })
    } catch (err) {
      console.error('Failed to update task:', err)
      fetchTasks()
    }
  }

  const handleConfirmComplete = async () => {
    if (!completeTask) return
    setTasks(prev => prev.map(t => t.id === completeTask.id ? { ...t, status: 'complete' } : t))
    try {
      await fetch(`/api/tasks/${completeTask.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'complete' }),
      })
      // Fire Slack notification to account's channel (non-blocking)
      if (completeTask.account?.name) {
        fetch('/api/slack/notify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            event: 'task_complete',
            accountName: completeTask.account.name,
            slackChannel: completeTask.account.slackChannel || null,
            taskTitle: completeTask.title,
            repName: user?.email?.split('@')[0] || null,
          }),
        }).catch(() => {})
      }
    } catch (err) {
      console.error('Failed to complete task:', err)
    }
    setCompleteTask(null)
  }

  const handleDelete = async (taskId) => {
    setTasks(prev => prev.filter(t => t.id !== taskId))
    try {
      await fetch(`/api/tasks/${taskId}`, { method: 'DELETE' })
    } catch (err) {
      console.error('Failed to delete task:', err)
      fetchTasks()
    }
  }

  const handleDismiss = async (taskId, reason) => {
    setTasks(prev => prev.filter(t => t.id !== taskId))
    try {
      await fetch(`/api/tasks/${taskId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'dismiss', reason }),
      })
    } catch (err) {
      console.error('Failed to dismiss task:', err)
      fetchTasks()
    }
  }

  const handleCreate = async (data) => {
    try {
      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...data, type: data.type || 'assigned' }),
      })
      const json = await res.json()
      if (json.success) setTasks(prev => [json.task, ...prev])
    } catch (err) {
      console.error('Failed to create task:', err)
    }
  }

  // Filter tasks for rep view
  const filteredTasks = tasks.filter(t => {
    if (filterStatus === 'active') return t.status !== 'complete'
    if (filterStatus === 'complete') return t.status === 'complete'
    return true
  })

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
        <div className="max-w-5xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <Zap className="w-5 h-5 text-blue-600" />
                <h1 className="text-xl font-bold text-gray-900">Tasks</h1>
              </div>
              <ModulesNav router={router} />
            </div>

            <div className="flex items-center gap-3">
              {/* View toggle (only shown if user has team access) */}
              {summary.length > 0 && (
                <div className="flex bg-gray-100 rounded-lg p-1">
                  <button
                    onClick={() => setView('rep')}
                    className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${view === 'rep' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                  >
                    My Tasks
                  </button>
                  <button
                    onClick={() => setView('manager')}
                    className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${view === 'manager' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                  >
                    Team
                  </button>
                </div>
              )}

              <button
                onClick={fetchTasks}
                className="p-2 hover:bg-gray-100 rounded-lg text-gray-500 transition-colors"
                title="Refresh"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              </button>

              <button
                onClick={() => setShowNewTask(true)}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
              >
                <Plus className="w-4 h-4" />
                New Task
              </button>

              {user && <UserMenu />}
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-5xl mx-auto px-6 py-8">
        {loading ? (
          <div className="flex items-center justify-center py-24">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
          </div>
        ) : view === 'manager' ? (
          <ManagerView
            summary={summary}
            allTasks={tasks}
            onStatusChange={handleStatusChange}
            onDelete={handleDelete}
          />
        ) : (
          <>
            {/* Filter bar */}
            <div className="flex items-center gap-2 mb-6">
              <Filter className="w-4 h-4 text-gray-400" />
              {['active', 'all', 'complete'].map(f => (
                <button
                  key={f}
                  onClick={() => setFilterStatus(f)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors capitalize ${
                    filterStatus === f
                      ? 'bg-blue-600 text-white'
                      : 'bg-white border border-gray-200 text-gray-600 hover:border-blue-300'
                  }`}
                >
                  {f}
                </button>
              ))}
              <span className="ml-auto text-sm text-gray-400">{filteredTasks.length} task{filteredTasks.length !== 1 ? 's' : ''}</span>
            </div>

            {/* NL Quick-Add bar */}
            <NLTaskBar onCreate={handleCreate} />

            {/* Today's Focus morning brief */}
            <TodaysFocus />

            {/* Smart Suggestions from Gmail + Calendar */}
            <div className="mb-6">
              <SmartSuggestionsPanel
                providerToken={providerToken}
                onAddTask={handleCreate}
              />
            </div>

            <RepView
              tasks={filteredTasks}
              onStatusChange={handleStatusChange}
              onDelete={handleDelete}
              onDismiss={task => setDismissTask(task)}
              onWorkInClaude={task => setWorkTask(task)}
              onNewTask={() => setShowNewTask(true)}
            />
          </>
        )}
      </div>

      {/* New Task Modal */}
      {showNewTask && (
        <NewTaskModal
          onClose={() => setShowNewTask(false)}
          onCreate={handleCreate}
          currentUserId={user?.id}
          users={users}
        />
      )}

      {/* AI Task Complete Modal */}
      {completeTask && (
        <TaskCompleteModal
          task={completeTask}
          onComplete={handleConfirmComplete}
          onClose={() => setCompleteTask(null)}
        />
      )}

      {/* Dismiss Modal */}
      {dismissTask && (
        <DismissModal
          task={dismissTask}
          onClose={() => setDismissTask(null)}
          onDismiss={handleDismiss}
        />
      )}

      {/* Work in Claude side panel */}
      {workTask && (
        <WorkInClaude
          task={workTask}
          onClose={() => setWorkTask(null)}
        />
      )}
    </div>
  )
}
