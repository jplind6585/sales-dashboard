import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/router';
import {
  CheckCircle2, Circle, Clock, AlertCircle, ChevronDown,
  Plus, Users, Filter, RefreshCw, Zap,
  Calendar, Building2, BarChart3, X, ChevronRight,
  LayoutGrid, TrendingUp, Send, ChevronUp
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

function TaskRow({ task, onStatusChange, onDelete }) {
  const [expanded, setExpanded] = useState(false)
  const [statusOpen, setStatusOpen] = useState(false)
  const overdue = isOverdue(task)
  const dateLabel = formatDate(task.dueDate)

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

          {/* Expanded description */}
          {expanded && task.description && (
            <p className="mt-3 text-sm text-gray-600 leading-relaxed border-t border-gray-100 pt-3">
              {task.description}
            </p>
          )}
          {expanded && (
            <div className="mt-3 pt-3 border-t border-gray-100 flex justify-end">
              <button onClick={() => onDelete(task.id)} className="text-xs text-red-500 hover:text-red-700">
                Delete task
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Rep View ─────────────────────────────────────────────────────────────────

function RepView({ tasks, onStatusChange, onDelete, onNewTask }) {
  const grouped = TYPE_ORDER.reduce((acc, type) => {
    const items = tasks.filter(t => t.type === type)
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
                <TaskRow key={task.id} task={task} onStatusChange={onStatusChange} onDelete={onDelete} />
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
    </div>
  )
}
