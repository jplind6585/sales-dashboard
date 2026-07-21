import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/router';
import {
  CheckCircle2, Circle, Clock, AlertCircle, ChevronDown,
  Plus, Users, Filter, RefreshCw, Zap,
  Calendar, Building2, BarChart3, X, ChevronRight,
  LayoutGrid, TrendingUp, Send, Sparkles,
  Target, BanIcon, Info, Star, MessageSquare, ArrowRight,
  Loader2, CornerDownLeft, Phone, Mic, Square, CheckCheck,
  Copy, Search, FileText, MoreHorizontal, GripVertical
} from 'lucide-react';
import { useSpeechInput } from '../../hooks/useSpeechInput';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useAuthStore } from '../../stores/useAuthStore';
import { getCurrentUser, getSession } from '../../lib/auth';
import { isSupabaseConfigured } from '../../lib/supabase';
import AppShell from '../../components/layout/AppShell';
import StageBadge from '../../components/ui/StageBadge';
import { fmtUsd } from '../../lib/metrics';
import { PRIORITY_COLORS, PRIORITY_LABELS, stageHex, stageLabel, ACTIVE_STAGE_ORDER } from '../../lib/constants';
import SmartSuggestionsPanel from '../../components/smart-suggestions/SmartSuggestionsPanel';
import TaskCompleteModal from '../../components/tasks/TaskCompleteModal';

// ─── Work in Claude (per-task AI chat side panel) ────────────────────────────

const TASK_PLAYBOOKS = [
  {
    id: 'prepare-deck',
    match: task => /prepare deck|prep.*deck|demo prep/i.test(task.title || ''),
    fetchContext: 'calls',
    maxTokens: 2000,
    buildIntro(task, calls) {
      if (!calls?.length) return `Loading account call history to help you prepare the deck...`
      const lines = [`I've pulled in **${calls.length} analyzed call${calls.length !== 1 ? 's' : ''}** for ${task.account?.name || 'this account'}. Here's what I know going into the demo:\n`]
      const painPoints = [], buyingSignals = [], redFlags = [], meddiccGaps = []
      calls.forEach(c => {
        const a = c.analysis || {}
        if (a.pain_points_identified) painPoints.push(...(Array.isArray(a.pain_points_identified) ? a.pain_points_identified : [a.pain_points_identified]))
        if (a.buying_signals?.length) buyingSignals.push(...a.buying_signals)
        if (a.red_flags?.length) redFlags.push(...a.red_flags)
        const meddicc = a.meddicc || {}
        Object.entries(meddicc).forEach(([k, v]) => {
          if (!v || /unknown|not identified|not mentioned/i.test(v)) meddiccGaps.push(k)
        })
      })
      if (painPoints.length) lines.push(`**Pain points:**\n${[...new Set(painPoints)].slice(0, 5).map(p => `• ${p}`).join('\n')}`)
      if (buyingSignals.length) lines.push(`\n**Buying signals:**\n${[...new Set(buyingSignals)].slice(0, 4).map(s => `• ${s}`).join('\n')}`)
      if (redFlags.length) lines.push(`\n**Red flags to address:**\n${[...new Set(redFlags)].slice(0, 3).map(f => `• ${f}`).join('\n')}`)
      if (meddiccGaps.length) lines.push(`\n**MEDDIC gaps:** ${[...new Set(meddiccGaps)].join(', ')}`)
      lines.push(`\nAsk me to: draft "What We Have Heard" slides, build a MEDDIC capture plan, recommend the demo flow, or write objection handling.`)
      return lines.join('\n')
    },
  },
  {
    id: 'review-notes',
    match: task => /review.*notes|review.*pursuit|pursuit.*channel/i.test(task.title || ''),
    fetchContext: 'calls',
    maxTokens: 1200,
    buildIntro(task, calls) {
      if (!calls?.length) return `I'll help you review this deal before heading in. What do you need to know?`
      const latest = calls[0]
      const a = latest?.analysis || {}
      const lines = [`Here's where **${task.account?.name || 'this account'}** stands:\n`]
      if (a.summary) lines.push(`**Last call (${latest.analyzedAt?.slice(0,10)}):** ${a.summary.slice(0, 300)}`)
      const commitments = (a.next_steps_mentioned || []).concat(a.commitments || [])
      if (commitments.length) lines.push(`\n**Open commitments:** ${commitments.slice(0,4).join(' | ')}`)
      const meddicc = a.meddicc || {}
      const gaps = Object.entries(meddicc).filter(([, v]) => !v || /unknown|not identified|not mentioned/i.test(v)).map(([k]) => k)
      if (gaps.length) lines.push(`\n**MEDDIC still missing:** ${gaps.join(', ')}`)
      if (a.red_flags?.length) lines.push(`\n**Watch out for:** ${a.red_flags.slice(0,2).join(' | ')}`)
      lines.push(`\nWant a full deal snapshot, a draft pursuit channel update, or talking points for a specific person?`)
      return lines.join('\n')
    },
  },
  {
    id: 'plan-ask',
    match: task => /plan.*ask|plan.*next step/i.test(task.title || ''),
    fetchContext: 'calls',
    maxTokens: 1000,
    buildIntro(task, calls) {
      const latest = calls?.[0]
      const a = latest?.analysis || {}
      const lines = []
      if (task.account?.name) lines.push(`Planning the ask for **${task.account.name}**${task.account.stage ? ` — currently at ${task.account.stage} stage` : ''}.\n`)
      const meddicc = a.meddicc || {}
      const gaps = Object.entries(meddicc).filter(([, v]) => !v || /unknown|not identified|not mentioned/i.test(v)).map(([k]) => k)
      if (gaps.length) lines.push(`**MEDDIC gaps:** ${gaps.join(', ')} — the next step should address at least one of these.`)
      if (a.next_steps_mentioned?.length) lines.push(`\n**Last committed next steps:** ${a.next_steps_mentioned.slice(0,3).join(' | ')}`)
      lines.push(`\nTell me what the ideal outcome of the next meeting is and I'll help you plan exactly how to ask for it and what to say if they push back.`)
      return lines.join('\n')
    },
  },
  {
    id: 'follow-up-email',
    match: task => /follow.?up|send recap|send.*email(?!.*urg)|recap.*email/i.test(task.title || ''),
    fetchContext: 'calls',
    maxTokens: 1000,
    buildIntro(task, calls) {
      const latest = calls?.[0]
      const a = latest?.analysis || {}
      const lines = []
      if (task.account?.name) lines.push(`Drafting a follow-up for **${task.account.name}**.\n`)
      if (a.next_steps_mentioned?.length) lines.push(`**Next steps from last call:** ${a.next_steps_mentioned.slice(0,4).join(' | ')}`)
      if (a.commitments?.length) lines.push(`**Your commitments:** ${a.commitments.slice(0,3).join(' | ')}`)
      lines.push(`\nReady to draft the email. Want a short "thanks + recap + next step" format, or something longer with a specific ask?`)
      return lines.join('\n')
    },
  },
  {
    id: 'gong-task',
    match: task => ['gong_next_step', 'gong_commitment'].includes(task.sourceType),
    fetchContext: 'calls',
    maxTokens: 1200,
    buildIntro(task, calls) {
      const lines = []
      const acct = task.account?.name
      const stage = task.account?.stage?.replace(/_/g, ' ')
      if (acct) lines.push(`Working on **${acct}**${stage ? ` — ${stage} stage` : ''}.`)
      lines.push(`\n**Task:** ${task.title}`)
      if (task.rationale) lines.push(`**From the call:** ${task.rationale}`)
      if (task.primaryAction) lines.push(`**Suggested move:** ${task.primaryAction}`)
      if (calls?.length) {
        const latest = calls[0]
        const a = latest?.analysis || {}
        if (a.summary) lines.push(`\n**Last call summary:** ${a.summary.slice(0, 200)}`)
        const open = (a.next_steps_mentioned || []).concat(a.commitments || []).slice(0, 3)
        if (open.length) lines.push(`**Other open items:** ${open.join(' | ')}`)
        const meddicc = a.meddicc || {}
        const gaps = Object.entries(meddicc).filter(([, v]) => !v || /unknown|not identified|not mentioned/i.test(v)).map(([k]) => k)
        if (gaps.length) lines.push(`**MEDDIC gaps:** ${gaps.join(', ')}`)
      }
      lines.push(`\nReady to draft the email, write a message, or build the deliverable. What format do you need?`)
      return lines.join('\n')
    },
  },
  {
    id: 'sdr_intro_booked',
    match: task => /intro|book/i.test(task.title || ''),
    fetchContext: 'calls',
    maxTokens: 1000,
    buildIntro(task) {
      const account = task.account?.name || 'this account'
      const lines = [`You booked an intro with **${account}**. Here's what to do before and after.\n`]
      lines.push(`**Before the meeting:**\n• Send confirmation email with agenda (I can draft this)\n• Research the company — pull any prior call history\n• Identify potential decision-maker and champion hypothesis\n• Confirm internal attendees`)
      lines.push(`\n**After the meeting:**\n• Send follow-up within 2 hours (I can draft this)\n• Log call notes and update deal stage\n• Confirm next step is on calendar\n• Tag AE if this is a handoff`)
      lines.push(`\nWhat do you need? I can draft the email, prep the talking points, or run through objections.`)
      return lines.join('\n')
    },
  },
  {
    id: 'sdr_no_show',
    match: task => /no.?show|missed/i.test(task.title || ''),
    fetchContext: null,
    maxTokens: 1000,
    buildIntro(task) {
      const account = task.account?.name || 'this account'
      const lines = [`Looks like **${account}** didn't show. Here's how to recover fast.\n`]
      lines.push(`• Send a "missed you" email within 1 hour (I can draft this)\n• Try calling if you have a mobile\n• Re-send calendar invite with 3 new time slots\n• If 2nd no-show, flag for escalation`)
      lines.push(`\nWhat do you need? I can draft the email, prep the talking points, or run through objections.`)
      return lines.join('\n')
    },
  },
  {
    id: 'ae_intro',
    match: task => /intro/i.test(task.title || '') && !/book/i.test(task.title || ''),
    fetchContext: 'calls',
    maxTokens: 1000,
    buildIntro(task, calls) {
      const account = task.account?.name || 'this account'
      const lines = [`You just completed an intro with **${account}**. Time to lock in next steps.\n`]
      if (calls?.length) {
        const latest = calls[0]
        const a = latest?.analysis || {}
        if (a.next_steps_mentioned?.length) lines.push(`**Next steps from the call:** ${a.next_steps_mentioned.slice(0,3).join(' | ')}`)
      }
      lines.push(`\n• Review SDR handoff notes if available\n• Send personalized follow-up within 4 hours (I can draft this)\n• Fill in MEDDICC: Metrics and Identify Pain at minimum\n• Book discovery call with agenda\n• Update deal stage in HubSpot`)
      lines.push(`\nWhat do you need? I can draft the email, prep the talking points, or run through objections.`)
      return lines.join('\n')
    },
  },
  {
    id: 'ae_demo',
    match: task => /demo/i.test(task.title || ''),
    fetchContext: 'calls',
    maxTokens: 1200,
    buildIntro(task, calls) {
      const account = task.account?.name || 'this account'
      const lines = [`Demo with **${account}** — let's make sure you're set up to win.\n`]
      if (calls?.length) {
        const painPoints = []
        calls.forEach(c => {
          const a = c.analysis || {}
          if (a.pain_points_identified) painPoints.push(...(Array.isArray(a.pain_points_identified) ? a.pain_points_identified : [a.pain_points_identified]))
        })
        if (painPoints.length) lines.push(`**Known pain points:** ${[...new Set(painPoints)].slice(0,3).join(' | ')}`)
      }
      lines.push(`\n**Pre-demo:**\n• Customize demo flow for their stated pain points\n• Confirm all key stakeholders are on the invite\n• Send pre-read 24h before (I can draft this)\n• Internal dry-run if new features involved`)
      lines.push(`\n**Post-demo:**\n• Send recap and tailored follow-up within 2 hours (I can draft this)\n• Attach relevant case study or reference customer\n• Book evaluation/next-step call before leaving the demo\n• Update MEDDICC: Decision Criteria, Economic Buyer\n• Advance stage to solution_validation`)
      lines.push(`\nWhat do you need? I can draft the email, prep the talking points, or run through objections.`)
      return lines.join('\n')
    },
  },
  {
    id: 'ae_evaluation',
    match: task => /eval(uation)?|proof|validation/i.test(task.title || ''),
    fetchContext: 'calls',
    maxTokens: 1000,
    buildIntro(task, calls) {
      const account = task.account?.name || 'this account'
      const lines = [`Evaluation call with **${account}** — this is where deals are won or lost.\n`]
      if (calls?.length) {
        const objections = []
        calls.forEach(c => {
          const a = c.analysis || {}
          if (a.red_flags?.length) objections.push(...a.red_flags)
        })
        if (objections.length) lines.push(`**Objections to address:** ${[...new Set(objections)].slice(0,3).join(' | ')}`)
      }
      lines.push(`\n• Confirm champion will be on the call\n• Map the decision process: who signs, what's the procurement path\n• Address top 3 objections from prior calls (I can pull these)\n• Set a firm next step with a date before ending the call\n• Update MEDDICC: Decision Process, Champion`)
      lines.push(`\nWhat do you need? I can draft the email, prep the talking points, or run through objections.`)
      return lines.join('\n')
    },
  },
  {
    id: 'ae_proposal',
    match: task => /pricing|proposal|price/i.test(task.title || ''),
    fetchContext: 'calls',
    maxTokens: 1000,
    buildIntro(task, calls) {
      const account = task.account?.name || 'this account'
      const lines = [`Pricing conversation with **${account}** — here's how to navigate it.\n`]
      if (calls?.length) {
        const metrics = []
        calls.forEach(c => {
          const a = c.analysis || {}
          const m = a.meddicc || {}
          if (m.metrics && !/unknown|not identified|not mentioned/i.test(m.metrics)) metrics.push(m.metrics)
        })
        if (metrics.length) lines.push(`**Known ROI/metrics context:** ${metrics.slice(0,2).join(' | ')}`)
      }
      lines.push(`\n• Draft business case tying price to their stated ROI/metrics (I can draft this)\n• Confirm champion will present internally\n• Identify all objections from call analysis and address each\n• Legal/finance loop-in if deal size warrants it\n• Set firm next step date`)
      lines.push(`\nWhat do you need? I can draft the email, prep the talking points, or run through objections.`)
      return lines.join('\n')
    },
  },
]

function getPlaybook(task) {
  return TASK_PLAYBOOKS.find(p => p.match(task)) || null
}

function buildGenericIntro(task) {
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

function detectDraftedEmail(text) {
  const match = text.match(/(?:^|\n)\*{0,2}Subject:\*{0,2}\s*(.+)/i)
  if (!match) return null
  const subject = match[1].replace(/\*+/g, '').trim()
  if (!subject) return null
  const body = text.slice(text.indexOf(match[0]) + match[0].length).trim()
  if (body.length < 20) return null
  return { subject, body }
}

function buildGmailUrl(subject, body, signature) {
  const fullBody = signature ? `${body}\n\n${signature}` : body
  return `https://mail.google.com/mail/u/0/?view=cm&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(fullBody)}`
}

function WorkInClaude({ task, onClose, onStatusChange, providerToken }) {
  const storageKey = `wic_${task.id}`
  const playbook = getPlaybook(task)
  const needsFetch = playbook?.fetchContext === 'calls' && task.accountId
  const [accountCalls, setAccountCalls] = useState([])
  const [callsLoading, setCallsLoading] = useState(!!needsFetch)
  const [copiedId, setCopiedId] = useState(null)
  const [hubspotLoggedFor, setHubspotLoggedFor] = useState(new Set())
  const [sendOpenFor, setSendOpenFor] = useState(null) // msg key whose Send-row is open
  const [sendTo, setSendTo] = useState('')
  const [sending, setSending] = useState(false)
  const [sentKeys, setSentKeys] = useState(new Set())
  const [markedDone, setMarkedDone] = useState(false)

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  const sendEmail = async (msgKey, draft) => {
    if (!sendTo.trim()) return
    setSending(true)
    try {
      const res = await fetch('/api/gmail/send', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: sendTo.trim(), subject: draft.subject, body: draft.body, providerToken }),
      })
      const d = await res.json()
      if (res.ok && d.success !== false) {
        setSentKeys(prev => new Set([...prev, msgKey]))
        setSendOpenFor(null); setSendTo('')
        if (task.accountId) {
          fetch('/api/hubspot/log-note', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ accountId: task.accountId, subject: draft.subject }) }).catch(() => {})
        }
      } else {
        window.alert(d.error || 'Send failed')
      }
    } catch (e) { window.alert(e.message || 'Send failed') }
    finally { setSending(false) }
  }
  const [messages, setMessages] = useState(() => {
    try {
      const saved = localStorage.getItem(storageKey)
      if (saved) return JSON.parse(saved)
    } catch {}
    // Never blank: prefer the task's pre-generated AI draft as the opening message.
    if (task.aiDraft?.content) {
      return [{ role: 'assistant', content: task.aiDraft.content, ts: Date.now() }]
    }
    const intro = playbook ? playbook.buildIntro(task, []) : buildGenericIntro(task)
    return [{ role: 'assistant', content: intro, ts: Date.now() }]
  })
  const [draftGenerating, setDraftGenerating] = useState(false)
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef(null)
  const inputRef = useRef(null)
  const { listening: micListening, transcript: micTranscript, start: micStart, stop: micStop, supported: micSupported } = useSpeechInput()

  // For playbooks that need call context: fetch account calls once on open (skip if thread already has history)
  useEffect(() => {
    if (!needsFetch) return
    const hasHistory = (() => { try { return !!localStorage.getItem(storageKey) } catch { return false } })()
    if (hasHistory) { setCallsLoading(false); return }
    fetch(`/api/gong/account-calls?accountId=${task.accountId}`)
      .then(r => r.json())
      .then(d => {
        const calls = d.calls || []
        setAccountCalls(calls)
        // Don't overwrite a real pre-generated draft with the generic playbook intro.
        if (!task.aiDraft?.content) {
          const intro = playbook.buildIntro(task, calls)
          const fresh = [{ role: 'assistant', content: intro, ts: Date.now() }]
          setMessages(fresh)
          try { localStorage.setItem(storageKey, JSON.stringify(fresh)) } catch {}
        }
      })
      .catch(() => {})
      .finally(() => setCallsLoading(false))
  }, [])

  // Never blank (fallback): no saved thread, no pre-generated draft, no playbook
  // context to fetch → lazily generate the first action and seed the thread.
  useEffect(() => {
    if (needsFetch || task.aiDraft?.content) return
    const hasHistory = (() => { try { return !!localStorage.getItem(storageKey) } catch { return false } })()
    if (hasHistory) return
    setDraftGenerating(true)
    fetch('/api/tasks/generate-action', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ taskId: task.id }),
    })
      .then(r => r.json())
      .then(d => {
        if (d?.aiDraft?.content) {
          const fresh = [{ role: 'assistant', content: d.aiDraft.content, ts: Date.now() }]
          setMessages(fresh)
          try { localStorage.setItem(storageKey, JSON.stringify(fresh)) } catch {}
        }
      })
      .catch(() => {})
      .finally(() => setDraftGenerating(false))
  }, [])

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])
  useEffect(() => { inputRef.current?.focus() }, [])

  const persistMessages = (msgs) => {
    try { localStorage.setItem(storageKey, JSON.stringify(msgs.slice(-20))) } catch {}
  }

  const toggleWicMic = () => {
    if (micListening) {
      micStop()
    } else {
      micStart(
        (final) => setInput(prev => prev ? `${prev} ${final}` : final),
        () => {}
      )
    }
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
            role: playbook?.id || 'generic',
            account: task.account ? { name: task.account.name, stage: task.account.stage } : null,
            calls: accountCalls.length ? accountCalls.slice(0, 10).map(c => ({
              title: c.callTitle || c.analysis?.call_title,
              date: c.analyzedAt,
              summary: c.analysis?.summary,
              painPoints: c.analysis?.pain_points_identified,
              nextSteps: c.analysis?.next_steps_mentioned,
              buyingSignals: c.analysis?.buying_signals,
              redFlags: c.analysis?.red_flags,
              objections: c.analysis?.objections,
              meddicc: c.analysis?.meddicc,
              commitments: c.analysis?.commitments,
              discoveryScore: c.analysis?.discovery_score,
            })) : undefined,
          },
        }),
      })
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'request failed')
      const data = await res.json()
      if (data.message) {
        const assistantMsg = { role: 'assistant', content: data.message, ts: Date.now() }
        const withReply = [...withUser, assistantMsg]
        setMessages(withReply)
        persistMessages(withReply)
      }
    } catch (e) {
      console.error('Work in Claude error:', e)
      const errMsg = { role: 'assistant', content: '⚠️ Something went wrong — try again.', ts: Date.now(), _error: true }
      setMessages(prev => [...prev, errMsg])
    } finally {
      setLoading(false)
      inputRef.current?.focus()
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() }
  }

  const clearThread = () => {
    const intro = playbook ? playbook.buildIntro(task, accountCalls) : buildGenericIntro(task)
    const fresh = [{ role: 'assistant', content: intro, ts: Date.now() }]
    setMessages(fresh)
    persistMessages(fresh)
  }

  return (
    <>
      {/* Backdrop — dims the page but does NOT close on click, so an accidental click-away can't
          discard your draft. Close explicitly via the X (or Esc). */}
      <div className="fixed inset-0 bg-black/30 z-40" />

      {/* Panel */}
      <div className="fixed inset-y-0 right-0 w-full max-w-3xl bg-white border-l border-gray-200 flex flex-col shadow-2xl z-50">
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
            {task.status !== 'complete' && onStatusChange && (
              <button
                onClick={() => { if (markedDone) return; setMarkedDone(true); onStatusChange(task.id, 'complete'); onClose() }}
                disabled={markedDone}
                className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg hover:bg-emerald-100 transition-colors disabled:opacity-50"
              >
                <CheckCircle2 className="w-3.5 h-3.5" /> Mark done
              </button>
            )}
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
              {msg.role === 'assistant' ? (
                <div className="group relative max-w-[85%] space-y-1.5">
                  <div className="bg-gray-100 text-gray-800 rounded-2xl rounded-bl-sm px-4 py-3 text-sm leading-relaxed">
                    {renderMarkdown(msg.content)}
                  </div>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(msg.content).then(() => {
                        setCopiedId(msg.ts ?? i)
                        setTimeout(() => setCopiedId(null), 1500)
                      })
                    }}
                    className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded bg-white/80 hover:bg-white shadow-sm"
                    title="Copy"
                  >
                    {copiedId === (msg.ts ?? i) ? (
                      <span className="text-xs text-gray-400 px-1">Copied</span>
                    ) : (
                      <Copy className="w-3.5 h-3.5 text-gray-400" />
                    )}
                  </button>
                  {(() => {
                    const emailDraft = detectDraftedEmail(msg.content)
                    if (!emailDraft) return null
                    const msgKey = msg.ts ?? i
                    const isLogged = hubspotLoggedFor.has(msgKey)
                    return (
                      <div className="flex items-center gap-2 flex-wrap">
                        <button
                          onClick={() => {
                            let sig = ''
                            try { sig = localStorage.getItem('email_signature') || '' } catch {}
                            window.open(buildGmailUrl(emailDraft.subject, emailDraft.body, sig), '_blank')
                            // Auto-log to HubSpot if task has account
                            if (task.accountId && !isLogged) {
                              fetch('/api/hubspot/log-note', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ accountId: task.accountId, subject: emailDraft.subject }),
                              })
                                .then(r => r.json())
                                .then(d => { if (d.success) setHubspotLoggedFor(prev => new Set([...prev, msgKey])) })
                                .catch(() => {})
                            }
                          }}
                          className="flex items-center gap-1.5 px-2.5 py-1 bg-white border border-gray-200 hover:border-blue-300 hover:bg-blue-50 rounded-lg text-xs font-medium text-gray-700 hover:text-blue-700 transition-colors shadow-sm"
                        >
                          <Send className="w-3 h-3" />
                          Open in Gmail
                        </button>
                        {sentKeys.has(msgKey) ? (
                          <span className="flex items-center gap-1 text-xs font-medium text-emerald-600"><CheckCheck className="w-3.5 h-3.5" /> Sent</span>
                        ) : sendOpenFor === msgKey ? (
                          <span className="flex items-center gap-1.5">
                            <input value={sendTo} onChange={e => setSendTo(e.target.value)} placeholder="recipient@company.com" type="email"
                              className="text-xs border border-gray-200 rounded-lg px-2 py-1 w-52 focus:outline-none focus:ring-1 focus:ring-coral-300" autoFocus
                              onKeyDown={e => e.key === 'Enter' && sendEmail(msgKey, emailDraft)} />
                            <button onClick={() => sendEmail(msgKey, emailDraft)} disabled={sending || !sendTo.trim()}
                              className="flex items-center gap-1 px-2.5 py-1 bg-coral-500 text-white rounded-lg text-xs font-medium hover:bg-coral-600 disabled:opacity-40">
                              {sending ? 'Sending…' : 'Send'}
                            </button>
                            <button onClick={() => { setSendOpenFor(null); setSendTo('') }} className="text-xs text-gray-400 hover:text-gray-600">Cancel</button>
                          </span>
                        ) : (
                          <button onClick={() => { setSendOpenFor(msgKey); setSendTo('') }}
                            className="flex items-center gap-1.5 px-2.5 py-1 bg-coral-500 text-white rounded-lg text-xs font-medium hover:bg-coral-600 transition-colors shadow-sm">
                            <Send className="w-3 h-3" /> Send from app
                          </button>
                        )}
                        {task.accountId && !sentKeys.has(msgKey) && (
                          <span className="text-xs text-gray-400">
                            {isLogged ? 'Logged to HubSpot' : 'Will log to HubSpot'}
                          </span>
                        )}
                      </div>
                    )
                  })()}
                </div>
              ) : (
                <div className="max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap bg-indigo-600 text-white rounded-br-sm">
                  {msg.content}
                </div>
              )}
            </div>
          ))}
          {(loading || draftGenerating || callsLoading) && (
            <div className="flex justify-start">
              <div className="bg-gray-100 rounded-2xl rounded-bl-sm px-4 py-3 flex items-center gap-2">
                <Loader2 className="w-4 h-4 text-gray-400 animate-spin" />
                {(draftGenerating || callsLoading) && <span className="text-xs text-gray-400">Drafting your starting point…</span>}
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div className="px-4 pb-4 pt-2 border-t border-gray-200">
          <div className="flex items-end gap-2">
            <div className="flex-1 relative">
              <textarea
                ref={inputRef}
                value={micListening ? (input + (micTranscript ? ` ${micTranscript}` : '')) : input}
                onChange={e => { if (!micListening) setInput(e.target.value) }}
                onKeyDown={handleKeyDown}
                placeholder={micListening ? 'Listening…' : 'Ask Claude to draft an email, prep talking points, handle objections…'}
                rows={2}
                className="w-full resize-none border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 placeholder-gray-400"
                style={{ minHeight: '60px', maxHeight: '120px', fontStyle: micListening ? 'italic' : 'normal' }}
              />
              {micListening && (
                <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              )}
            </div>
            {micSupported && (
              <button
                onClick={toggleWicMic}
                title={micListening ? 'Stop recording' : 'Voice input'}
                className={`flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${micListening ? 'bg-red-500 hover:bg-red-600 text-white' : 'bg-gray-100 hover:bg-violet-100 text-gray-500 hover:text-violet-600'}`}
              >
                {micListening ? <Square className="w-3.5 h-3.5" /> : <Mic className="w-4 h-4" />}
              </button>
            )}
            <button
              onClick={send}
              disabled={!input.trim() || loading || micListening}
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

// ─── Debrief Bar ─────────────────────────────────────────────────────────────

function DebriefBar({ onBulkCreate }) {
  const [text, setText] = useState('')
  const [parsing, setParsing] = useState(false)
  const [preview, setPreview] = useState(null)
  const [creating, setCreating] = useState(false)
  const { listening, transcript, start, stop, supported } = useSpeechInput()

  const parseText = async (input) => {
    if (!input?.trim()) return
    setParsing(true)
    try {
      const res = await fetch('/api/tasks/debrief', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: input }),
      })
      const data = await res.json()
      if (data.tasks) setPreview(data.tasks)
    } catch {}
    finally { setParsing(false) }
  }

  const handleVoiceDone = (final) => { setText(final); parseText(final) }
  const toggleMic = () => {
    if (listening) { stop() }
    else { setPreview(null); setText(''); start(handleVoiceDone, () => {}) }
  }

  const removeTask = (i) => setPreview(prev => prev.filter((_, j) => j !== i))
  const updateTask = (i, field, value) => setPreview(prev => prev.map((t, j) => j === i ? { ...t, [field]: value } : t))

  const handleConfirmAll = async () => {
    if (!preview?.length || creating) return
    setCreating(true)
    const created = []
    for (const t of preview.filter(t => t.title?.trim())) {
      try {
        const res = await fetch('/api/tasks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: t.title.trim(),
            description: t.description || null,
            priority: t.priority || 2,
            dueDate: t.dueDate || null,
            type: 'triggered',
            accountId: t.accountId || null,
            source: 'manual',
          }),
        })
        const json = await res.json()
        if (json.success) created.push(json.task)
      } catch {}
    }
    setCreating(false)
    setText('')
    setPreview(null)
    onBulkCreate?.(created)
  }

  const PRIORITY_OPTS = [
    { value: 1, label: 'High', cls: 'text-red-600 bg-red-50 border-red-200' },
    { value: 2, label: 'Med', cls: 'text-amber-600 bg-amber-50 border-amber-200' },
    { value: 3, label: 'Low', cls: 'text-gray-500 bg-gray-50 border-gray-200' },
  ]

  return (
    <div className="mb-5">
      <div className={`bg-white border rounded-xl overflow-hidden transition-all ${
        listening ? 'border-red-400 ring-1 ring-red-200' : 'border-gray-200 focus-within:border-indigo-400 focus-within:ring-1 focus-within:ring-indigo-300'
      }`}>
        <div className="flex items-center gap-2 px-3 pt-3 pb-1.5">
          {listening
            ? <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse flex-shrink-0" />
            : <Sparkles className="w-3.5 h-3.5 text-indigo-400 flex-shrink-0" />
          }
          <span className="text-xs font-semibold text-indigo-700 uppercase tracking-wide">Task Debrief</span>
          <span className="text-xs text-gray-400 ml-1">— speak or type multiple tasks at once</span>
        </div>
        <textarea
          value={listening ? (transcript || '') : text}
          onChange={e => { if (!listening) { setText(e.target.value); setPreview(null) } }}
          onKeyDown={e => { if (e.key === 'Enter' && e.metaKey && !listening) parseText(text) }}
          readOnly={listening}
          placeholder='e.g. "CSM — review the JSP proposal. Westover — draft a reach-out email. Schedule a team sync for Thursday."'
          rows={2}
          className={`w-full px-3 pb-2 resize-none text-sm bg-transparent outline-none placeholder-gray-400 ${listening ? 'text-gray-500 italic' : 'text-gray-800'}`}
        />
        <div className="flex items-center gap-2 px-3 py-2 border-t border-gray-100 bg-gray-50/50">
          {supported && (
            <button
              onClick={toggleMic}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                listening
                  ? 'bg-red-500 text-white shadow-sm'
                  : 'bg-white text-gray-500 border border-gray-200 hover:bg-violet-50 hover:text-violet-600 hover:border-violet-200'
              }`}
            >
              {listening ? <Square className="w-3 h-3" /> : <Mic className="w-3 h-3" />}
              {listening ? 'Stop' : 'Voice'}
            </button>
          )}
          {text && !listening && (
            <button onClick={() => { setText(''); setPreview(null) }} className="text-xs text-gray-400 hover:text-gray-600 px-1">
              Clear
            </button>
          )}
          {!listening && (
            <button
              onClick={() => parseText(text)}
              disabled={!text.trim() || parsing}
              className="ml-auto flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white rounded-lg text-xs font-medium transition-colors"
            >
              {parsing ? <Loader2 className="w-3 h-3 animate-spin" /> : <CornerDownLeft className="w-3 h-3" />}
              {parsing ? 'Parsing…' : '⌘↵ Parse tasks'}
            </button>
          )}
        </div>
      </div>

      {preview !== null && (
        <div className="mt-2.5 bg-white border border-indigo-200 rounded-xl shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-indigo-50 to-purple-50 border-b border-indigo-100">
            <div className="flex items-center gap-2">
              <CheckCheck className="w-4 h-4 text-indigo-600" />
              <span className="text-sm font-semibold text-gray-900">
                {preview.length > 0 ? `${preview.length} task${preview.length !== 1 ? 's' : ''} extracted` : 'No tasks found'}
              </span>
            </div>
            <button onClick={() => setPreview(null)} className="text-gray-300 hover:text-gray-500">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          {preview.length > 0 ? (
            <>
              <div className="p-3 space-y-2">
                {preview.map((t, i) => (
                  <div key={i} className="flex items-start gap-2 p-3 bg-gray-50 rounded-xl">
                    <div className="flex-1 min-w-0">
                      <input
                        value={t.title}
                        onChange={e => updateTask(i, 'title', e.target.value)}
                        className="w-full text-sm font-medium text-gray-900 bg-transparent border-none outline-none"
                        placeholder="Task title"
                      />
                      <div className="flex flex-wrap items-center gap-2 mt-1.5">
                        {t.accountName && (
                          <span className="flex items-center gap-1 text-xs text-gray-500">
                            <Building2 className="w-3 h-3" />{t.accountName}
                          </span>
                        )}
                        {PRIORITY_OPTS.map(o => (
                          <button
                            key={o.value}
                            onClick={() => updateTask(i, 'priority', o.value)}
                            className={`px-2 py-0.5 rounded-full text-xs border transition-colors ${t.priority === o.value ? o.cls : 'text-gray-300 bg-white border-gray-200'}`}
                          >
                            {o.label}
                          </button>
                        ))}
                      </div>
                    </div>
                    <button onClick={() => removeTask(i)} className="text-gray-300 hover:text-red-400 flex-shrink-0 mt-0.5">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
              <div className="px-3 pb-3">
                <button
                  onClick={handleConfirmAll}
                  disabled={creating || preview.every(t => !t.title?.trim())}
                  className="w-full flex items-center justify-center gap-2 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold disabled:opacity-50 transition-colors"
                >
                  {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                  {creating ? 'Creating…' : `Create ${preview.length} task${preview.length !== 1 ? 's' : ''}`}
                </button>
              </div>
            </>
          ) : (
            <div className="px-4 py-3 text-sm text-gray-400">
              Couldn't extract tasks. Try being specific: "CSM — follow up on proposal."
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Call Commitments Panel ───────────────────────────────────────────────────

const COMMITMENTS_DISMISSED_KEY = 'call_commitments_dismissed'

function loadDismissedCommitments() {
  try {
    const raw = localStorage.getItem(COMMITMENTS_DISMISSED_KEY)
    return raw ? new Set(JSON.parse(raw)) : new Set()
  } catch {
    return new Set()
  }
}

function saveDismissedCommitments(set) {
  try {
    localStorage.setItem(COMMITMENTS_DISMISSED_KEY, JSON.stringify([...set]))
  } catch {}
}

function CallCommitmentsPanel({ onAddTask }) {
  const [commitments, setCommitments] = useState(null)
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [dismissed, setDismissed] = useState(new Set())
  const [added, setAdded] = useState(new Set())

  useEffect(() => {
    const storedDismissed = loadDismissedCommitments()
    setDismissed(storedDismissed)

    fetch('/api/tasks/call-commitments')
      .then(r => r.json())
      .then(d => {
        const items = (d.commitments || []).filter(c => !storedDismissed.has(c.id))
        setCommitments(items)
        if (items.length > 0) setOpen(true)
      })
      .catch(() => setCommitments([]))
      .finally(() => setLoading(false))
  }, [])

  const handleDismiss = (id) => {
    const updated = new Set([...dismissed, id])
    setDismissed(updated)
    saveDismissedCommitments(updated)
    setCommitments(prev => (prev || []).filter(c => c.id !== id))
  }

  const handleAdd = (commitment) => {
    onAddTask({
      title: commitment.text,
      description: `From call: "${commitment.callTitle}" on ${commitment.callDate}${commitment.accountName ? `\nAccount: ${commitment.accountName}` : ''}`,
      type: 'triggered',
      priority: commitment.type === 'commitment' ? 1 : 2,
      source: 'gong',
      accountId: commitment.accountId || null,
      sourceType: commitment.type === 'commitment' ? 'gong_commitment' : 'gong_next_step',
    })
    setAdded(prev => new Set([...prev, commitment.id]))
    // Remove after a brief moment so user sees the checkmark
    setTimeout(() => {
      setCommitments(prev => (prev || []).filter(c => c.id !== commitment.id))
    }, 800)
  }

  const visible = (commitments || []).filter(c => !dismissed.has(c.id))

  if (loading || visible.length === 0) return null

  return (
    <div className="mb-6 border border-orange-200 rounded-xl overflow-hidden bg-white">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-3 px-4 py-3 bg-gradient-to-r from-orange-50 to-amber-50 hover:from-orange-100 hover:to-amber-100 text-left"
      >
        {open ? <ChevronDown className="w-4 h-4 text-orange-500 shrink-0" /> : <ChevronRight className="w-4 h-4 text-orange-500 shrink-0" />}
        <div className="flex items-center gap-2 flex-1">
          <Phone className="w-4 h-4 text-orange-600" />
          <span className="font-semibold text-gray-800 text-sm">From Recent Calls</span>
          <span className="text-xs text-gray-400">Commitments & next steps</span>
        </div>
        <span className="px-2 py-0.5 bg-orange-500 text-white text-xs font-bold rounded-full">
          {visible.length}
        </span>
      </button>

      {open && (
        <div className="p-4 space-y-2">
          <p className="text-xs text-gray-400 mb-3">
            These items came up in your last 7 days of calls and don't appear to have a task yet.
          </p>
          {visible.map(c => {
            const isAdded = added.has(c.id)
            return (
              <div
                key={c.id}
                className={`flex items-start gap-2 p-3 rounded-lg border transition-all ${
                  isAdded ? 'bg-green-50 border-green-200' : 'bg-white border-gray-200'
                }`}
              >
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium ${isAdded ? 'text-green-700' : 'text-gray-800'}`}>
                    {c.text}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    {c.accountName && (
                      <span className="flex items-center gap-1 text-xs text-gray-500">
                        <Building2 className="w-3 h-3" />
                        {c.accountName}
                      </span>
                    )}
                    <span className="text-xs text-gray-400">{c.callDate}</span>
                    <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                      c.type === 'commitment'
                        ? 'bg-orange-100 text-orange-700'
                        : 'bg-blue-100 text-blue-700'
                    }`}>
                      {c.type === 'commitment' ? 'your commitment' : 'next step'}
                    </span>
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5 truncate">{c.callTitle}</p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {isAdded ? (
                    <CheckCircle2 className="w-4 h-4 text-green-500" />
                  ) : (
                    <>
                      <button
                        onClick={() => handleAdd(c)}
                        className="flex items-center gap-1 px-2 py-1 text-xs text-blue-600 hover:bg-blue-50 rounded border border-blue-200"
                        title="Add as task"
                      >
                        <Plus className="w-3 h-3" />
                        Add task
                      </button>
                      <button
                        onClick={() => handleDismiss(c.id)}
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
          <span className="text-sm font-semibold text-indigo-900">Morning Brief</span>
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

// ─── Daily Focus Brief ───────────────────────────────────────────────────────

// Weekly cadence progress, surfaced where the work happens. Fed by /api/rep/cadence (AE
// re-engagements/wk or SDR meetings/wk). Hidden until a target resolves.
function CadenceStrip() {
  const [data, setData] = useState(null)
  useEffect(() => { fetch('/api/rep/cadence').then(r => r.json()).then(d => { if (d && d.success !== false && d.target != null) setData(d) }).catch(() => {}) }, [])
  if (!data || !data.target) return null
  const pct = Math.min(100, Math.round((data.current / data.target) * 100))
  const done = data.current >= data.target
  return (
    <div className="mb-4 flex items-center gap-3 bg-white rounded-xl border border-gray-200 px-4 py-2.5">
      <span className="text-xs font-medium text-gray-600 whitespace-nowrap">{data.label || 'This week'}</span>
      <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${done ? 'bg-emerald-500' : 'bg-coral-500'}`} style={{ width: `${pct}%` }} />
      </div>
      <span className={`text-xs font-semibold whitespace-nowrap ${done ? 'text-emerald-600' : 'text-gray-700'}`}>{data.current}/{data.target}{done ? ' ✓' : ''}</span>
    </div>
  )
}

// Start-of-day surface: the tasks that came out of TODAY's calls, grouped by call. Hidden when
// there are none. Lets a rep act on today's calls before wading into the full backlog.
function TodaysCallTasks({ onStatusChange }) {
  const [calls, setCalls] = useState(null)
  const [doneIds, setDoneIds] = useState(new Set())
  useEffect(() => { fetch('/api/tasks/from-todays-calls').then(r => r.json()).then(d => setCalls(d.calls || [])).catch(() => setCalls([])) }, [])
  if (!calls || calls.length === 0) return null
  const complete = (id) => { setDoneIds(s => new Set([...s, id])); onStatusChange?.(id, 'complete') }
  const total = calls.reduce((n, c) => n + c.tasks.length, 0)
  return (
    <div className="mb-5 bg-white rounded-xl border border-coral-200 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 bg-coral-50 border-b border-coral-100">
        <div className="flex items-center gap-2">
          <Phone className="w-4 h-4 text-coral-600" />
          <span className="text-sm font-semibold text-coral-800">From Today's Calls</span>
          <span className="text-xs text-coral-400">{calls.length} call{calls.length !== 1 ? 's' : ''} · {total} task{total !== 1 ? 's' : ''}</span>
        </div>
        {doneIds.size > 0 && <span className="text-xs text-emerald-600 font-medium">{doneIds.size} done</span>}
      </div>
      <div className="divide-y divide-gray-100">
        {calls.map(c => (
          <div key={c.callId} className="px-4 py-3">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-sm font-medium text-gray-800 truncate">{c.title || 'Untitled call'}</span>
              {c.stage && <StageBadge stage={c.stage} />}
              {c.callDate && <span className="text-xs text-gray-400">{new Date(c.callDate).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}</span>}
            </div>
            <ul className="space-y-1.5">
              {c.tasks.map(t => {
                const done = doneIds.has(t.id)
                return (
                  <li key={t.id} className="flex items-center gap-2">
                    <button onClick={() => complete(t.id)} disabled={done} className="flex-shrink-0 text-gray-300 hover:text-green-500 transition-colors">
                      {done ? <CheckCircle2 className="w-4 h-4 text-green-500" /> : <Circle className="w-4 h-4" />}
                    </button>
                    <span className={`flex-1 text-sm truncate ${done ? 'line-through text-gray-400' : 'text-gray-700'}`}>{t.title}</span>
                    {t.sourceType === 'gong_reengage' && <span className="flex-shrink-0 text-[10px] px-1.5 py-0.5 rounded bg-coral-50 text-coral-600 border border-coral-200">re-engage</span>}
                    {t.sourceType === 'gong_commitment' && <span className="flex-shrink-0 text-[10px] px-1.5 py-0.5 rounded bg-blue-50 text-blue-600 border border-blue-200">commitment</span>}
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
      </div>
    </div>
  )
}

function DailyFocusBrief({ tasks, onWorkInClaude, onStatusChange }) {
  const [focus, setFocus] = useState(null)
  const [loading, setLoading] = useState(false)
  const CACHE_KEY = 'daily_focus_cache'
  const CACHE_DATE_KEY = 'daily_focus_date'
  const removeItem = (i) => setFocus(f => { const next = (f || []).filter((_, idx) => idx !== i); try { localStorage.setItem(CACHE_KEY, JSON.stringify(next)) } catch {} return next })
  // Only drop the item optimistically for tasks that complete instantly. Tasks with a primaryAction
  // open the completion modal — if the rep cancels there, we mustn't have already removed it (it
  // disappears on its own once the parent's task list updates post-confirm).
  const completesInstantly = (t) => !t?.primaryAction || (t.type === 'triggered' && t.source === 'manual')
  const completeItem = (task, i) => { if (task && onStatusChange) onStatusChange(task.id, 'complete'); if (completesInstantly(task)) removeItem(i) }

  useEffect(() => {
    if (!tasks?.length) return
    const today = new Date().toDateString()
    const cachedDate = localStorage.getItem(CACHE_DATE_KEY)
    if (cachedDate === today) {
      try {
        const cached = JSON.parse(localStorage.getItem(CACHE_KEY))
        if (cached?.length) { setFocus(cached); return }
      } catch {}
    }
    setLoading(true)
    fetch('/api/tasks/daily-focus')
      .then(r => r.json())
      .then(d => {
        if (d.focus?.length) {
          setFocus(d.focus)
          localStorage.setItem(CACHE_KEY, JSON.stringify(d.focus))
          localStorage.setItem(CACHE_DATE_KEY, today)
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [tasks?.length])

  const refresh = () => {
    localStorage.removeItem(CACHE_DATE_KEY)
    localStorage.removeItem(CACHE_KEY)
    setFocus(null)
    setLoading(true)
    fetch('/api/tasks/daily-focus')
      .then(r => r.json())
      .then(d => {
        if (d.focus?.length) {
          setFocus(d.focus)
          const today = new Date().toDateString()
          localStorage.setItem(CACHE_KEY, JSON.stringify(d.focus))
          localStorage.setItem(CACHE_DATE_KEY, today)
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  if (!loading && !focus?.length) return null

  return (
    <div className="mb-5 bg-white rounded-xl border border-blue-200 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-blue-100">
        <div className="flex items-center gap-2">
          <Target className="w-4 h-4 text-blue-600" />
          <span className="text-sm font-semibold text-blue-900">Today's Focus</span>
          <span className="text-xs text-blue-400">AI-ranked priorities</span>
        </div>
        <button onClick={refresh} disabled={loading} className="text-blue-300 hover:text-blue-600 disabled:opacity-40 transition-colors p-1">
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>
      {loading ? (
        <div className="flex items-center gap-2 px-4 py-3 text-sm text-blue-500">
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
          Ranking your priorities for today…
        </div>
      ) : (
        <div className="divide-y divide-gray-100">
          {(focus || []).map((item, i) => {
            const task = tasks?.find(t => t.id === item.taskId)
            return (
              <div key={i} className="flex items-start gap-3 px-4 py-3 group">
                <button onClick={() => completeItem(task, i)} title="Mark done" className="flex-shrink-0 mt-0.5 text-gray-300 hover:text-green-500 transition-colors">
                  <CheckCircle2 className="w-5 h-5" />
                </button>
                <span className={`flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold mt-0.5 ${
                  i === 0 ? 'bg-red-500 text-white' : i === 1 ? 'bg-orange-400 text-white' : 'bg-amber-400 text-white'
                }`}>
                  {i + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900">{item.title || task?.title}</p>
                  {item.account && (
                    <p className="text-xs text-gray-400 flex items-center gap-1 mt-0.5">
                      <Building2 className="w-3 h-3" />{item.account}
                    </p>
                  )}
                  <p className="text-xs text-blue-600 mt-0.5 italic">{item.reason}</p>
                </div>
                {task && onWorkInClaude && task.status !== 'complete' && (
                  <button
                    onClick={() => onWorkInClaude(task)}
                    className="flex-shrink-0 flex items-center gap-1 px-2 py-1 text-xs text-indigo-600 bg-indigo-50 border border-indigo-200 rounded-lg hover:bg-indigo-100 transition-colors"
                  >
                    <Sparkles className="w-3 h-3" />
                    Work
                  </button>
                )}
                <button onClick={() => removeItem(i)} title="Remove from focus" className="flex-shrink-0 mt-0.5 text-gray-300 hover:text-gray-500 opacity-0 group-hover:opacity-100 transition-opacity">
                  <X className="w-4 h-4" />
                </button>
              </div>
            )
          })}
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

const PRIORITY_LABEL = PRIORITY_LABELS
const PRIORITY_COLOR = PRIORITY_COLORS
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

// Parse a task due date in LOCAL time. due_date is a date-only 'YYYY-MM-DD' string; new Date(str)
// would read it as UTC midnight and shift it a day earlier in any negative-UTC zone (the whole US
// team), so due-today renders "Yesterday"/overdue. Build from parts so midnight is local.
function parseDueDate(dateStr) {
  if (!dateStr) return null
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr)
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
  return new Date(dateStr)
}

function computeTaskPriority(task) {
  let score = 0
  const today = new Date(); today.setHours(0,0,0,0)

  // Due date proximity
  if (task.dueDate) {
    const d = parseDueDate(task.dueDate)
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

// Shared sort comparator so the Sort control is honored everywhere — the flat list AND the grouped
// All / By-Account views (which previously hardcoded computeTaskPriority and ignored the control).
function taskComparator(sortBy) {
  if (sortBy === 'due') return (a, b) => (a.dueDate || '9999-12-31').localeCompare(b.dueDate || '9999-12-31')
  if (sortBy === 'priority') return (a, b) => (a.priority || 3) - (b.priority || 3)
  if (sortBy === 'account') return (a, b) => (a.account?.name || 'zzz').localeCompare(b.account?.name || 'zzz')
  if (sortBy === 'recent') return (a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)
  return (a, b) => computeTaskPriority(b) - computeTaskPriority(a)
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDate(dateStr) {
  if (!dateStr) return null
  const d = parseDueDate(dateStr)
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
  const today = new Date(); today.setHours(0, 0, 0, 0)
  return parseDueDate(task.dueDate) < today // due-today is NOT overdue
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

// ─── Markdown renderer (handles **bold**, # headers, line breaks) ─────────────
// Render AI output as real, skimmable markdown — headers, bullets, tables (via GFM), bold, code —
// instead of a dense wrapped wall. Tables scroll horizontally so long plans don't blow out the panel.
function renderMarkdown(text) {
  if (!text) return null
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        h1: (p) => <h3 className="text-[15px] font-bold text-gray-900 mt-4 mb-1.5 first:mt-0" {...p} />,
        h2: (p) => <h4 className="text-sm font-semibold text-gray-900 mt-3 mb-1 first:mt-0" {...p} />,
        h3: (p) => <h5 className="text-[13px] font-semibold text-gray-700 mt-2.5 mb-0.5" {...p} />,
        p: (p) => <p className="my-1.5" {...p} />,
        ul: (p) => <ul className="my-1.5 ml-4 list-disc space-y-1" {...p} />,
        ol: (p) => <ol className="my-1.5 ml-4 list-decimal space-y-1" {...p} />,
        li: (p) => <li className="pl-0.5" {...p} />,
        strong: (p) => <strong className="font-semibold text-gray-900" {...p} />,
        em: (p) => <em className="italic" {...p} />,
        a: (p) => <a className="text-coral-600 underline" target="_blank" rel="noreferrer" {...p} />,
        hr: () => <hr className="my-3 border-gray-200" />,
        blockquote: (p) => <blockquote className="border-l-2 border-gray-300 pl-3 my-2 text-gray-600 italic" {...p} />,
        code: ({ inline, ...p }) => inline
          ? <code className="px-1 py-0.5 bg-gray-200 rounded text-[12px] font-mono" {...p} />
          : <code className="block bg-gray-900 text-gray-100 rounded-lg p-3 my-2 text-[12px] font-mono overflow-x-auto" {...p} />,
        table: (p) => <div className="my-2 overflow-x-auto"><table className="text-[12px] border-collapse w-full" {...p} /></div>,
        thead: (p) => <thead className="bg-gray-50" {...p} />,
        th: (p) => <th className="border border-gray-300 px-2 py-1 text-left font-semibold whitespace-nowrap" {...p} />,
        td: (p) => <td className="border border-gray-200 px-2 py-1 align-top" {...p} />,
      }}
    >
      {text}
    </ReactMarkdown>
  )
}

// ─── Kanban board ───────────────────────────────────────────────────────────
// Columns are workflow status; dragging a card applies that status/momentum. Everything else
// (account, stage, action-type, search) is a filter. Cards are tinted by the account's deal stage.
const KANBAN_COLUMNS = [
  { id: 'todo', label: 'To do' },
  { id: 'in_progress', label: 'In progress' },
  { id: 'waiting', label: 'Waiting on them' },
  { id: 'done', label: 'Done' },
]
const KANBAN_APPLY = {
  todo: { status: 'open', momentum: 'on_me' },
  in_progress: { status: 'in_progress', momentum: 'on_me' },
  waiting: { momentum: 'waiting_on_them' },
  done: { status: 'complete' },
}
function kanbanColumnOf(t) {
  if (t.status === 'complete') return 'done'
  if (t.momentum === 'waiting_on_them') return 'waiting'
  if (t.status === 'in_progress') return 'in_progress'
  return 'todo'
}
// Action-type classification for the Type filter (matches James's categories).
const ACTION_TYPE_OPTIONS = [
  { value: 'all', label: 'All types' },
  { value: 'pre_call', label: 'Pre-call' },
  { value: 'call_followup', label: 'Call follow-ups' },
  { value: 're_engage', label: 'Re-engage' },
  { value: 'recurring', label: 'Recurring' },
  { value: 'assigned', label: 'Assigned' },
]
function deriveActionType(task) {
  const st = task.sourceType || ''
  const title = (task.title || '').toLowerCase()
  if (task.type === 'recurring') return 'recurring'
  if (st === 'gong_reengage') return 're_engage'
  if (/\b(prep|pre-?call|prepare)\b/.test(title)) return 'pre_call'
  if (st === 'gong_commitment' || st === 'gong_next_step' || /\b(recap|follow.?up|post.?call)\b/.test(title)) return 'call_followup'
  if (task.type === 'assigned') return 'assigned'
  return 'other'
}

function KanbanCard({ task, onComplete, onWork, onDelete, onDismiss, onDragStart, onDragEnd, dragging }) {
  const [menuOpen, setMenuOpen] = useState(false)
  useEffect(() => {
    if (!menuOpen) return
    const c = () => setMenuOpen(false)
    const id = setTimeout(() => document.addEventListener('click', c), 0)
    return () => { clearTimeout(id); document.removeEventListener('click', c) }
  }, [menuOpen])
  const stage = task.account?.stage
  const tint = stage ? stageHex(stage) : '#cbd5e1'
  const dateLabel = formatDate(task.dueDate)
  const overdue = isOverdue(task)
  const hasDraft = task.aiDraft?.content || (typeof task.aiDraft === 'string' && task.aiDraft.trim())
  return (
    <div
      draggable
      onDragStart={(e) => { e.dataTransfer.effectAllowed = 'move'; onDragStart(task.id) }}
      onDragEnd={onDragEnd}
      className={`group relative bg-white rounded-lg border border-gray-200 p-2.5 shadow-sm hover:shadow-md transition-all cursor-grab active:cursor-grabbing ${dragging ? 'opacity-40' : ''}`}
      style={{ borderLeft: `3px solid ${tint}` }}
    >
      <div className="flex items-start gap-2">
        <button onClick={(e) => { e.stopPropagation(); onComplete(task.id) }} title="Complete" className="mt-0.5 flex-shrink-0 text-gray-300 hover:text-green-500 transition-colors">
          {task.status === 'complete' ? <CheckCircle2 className="w-4 h-4 text-green-500" /> : <Circle className="w-4 h-4" />}
        </button>
        <div className="flex-1 min-w-0">
          <p className={`text-[13px] font-medium leading-snug ${task.status === 'complete' ? 'line-through text-gray-400' : 'text-gray-800'}`}>{task.title}</p>
          <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
            {task.priority === 1 && <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-50 text-red-600 border border-red-200 font-medium">High</span>}
            {stage && <StageBadge stage={stage} />}
            {task.account?.name && <span className="text-[11px] text-gray-500 truncate max-w-[110px]">{task.account.name}</span>}
            {dateLabel && <span className={`text-[11px] ${overdue ? 'text-red-600 font-medium' : 'text-gray-400'}`}>{dateLabel}</span>}
            {hasDraft && <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">Draft</span>}
          </div>
        </div>
        <div className="relative flex-shrink-0">
          <button onClick={(e) => { e.stopPropagation(); setMenuOpen(o => !o) }} className="text-gray-300 hover:text-gray-600 opacity-0 group-hover:opacity-100 transition-opacity p-0.5"><MoreHorizontal className="w-4 h-4" /></button>
          {menuOpen && (
            <div className="absolute right-0 top-6 z-20 bg-white border border-gray-200 rounded-lg shadow-lg py-1 w-32 text-[13px]">
              <button onClick={(e) => { e.stopPropagation(); setMenuOpen(false); onWork(task) }} className="w-full text-left px-3 py-1.5 hover:bg-gray-50 flex items-center gap-2"><Sparkles className="w-3.5 h-3.5 text-indigo-500" /> Work</button>
              <button onClick={(e) => { e.stopPropagation(); setMenuOpen(false); onDismiss(task) }} className="w-full text-left px-3 py-1.5 hover:bg-gray-50 flex items-center gap-2"><BanIcon className="w-3.5 h-3.5 text-gray-400" /> Dismiss</button>
              <button onClick={(e) => { e.stopPropagation(); setMenuOpen(false); onDelete(task.id) }} className="w-full text-left px-3 py-1.5 hover:bg-red-50 text-red-600 flex items-center gap-2"><X className="w-3.5 h-3.5" /> Delete</button>
            </div>
          )}
        </div>
      </div>
      {hasDraft && task.status !== 'complete' && (
        <button onClick={(e) => { e.stopPropagation(); onWork(task) }} className="mt-2 w-full text-[12px] font-medium text-indigo-600 bg-indigo-50 border border-indigo-100 rounded-md py-1 hover:bg-indigo-100 transition-colors flex items-center justify-center gap-1"><Sparkles className="w-3 h-3" /> Work the draft</button>
      )}
    </div>
  )
}

function KanbanBoard({ tasks, onComplete, onMove, onWork, onDelete, onDismiss }) {
  const [draggedId, setDraggedId] = useState(null)
  const [overCol, setOverCol] = useState(null)
  const byCol = { todo: [], in_progress: [], waiting: [], done: [] }
  for (const t of tasks) (byCol[kanbanColumnOf(t)] || byCol.todo).push(t)
  const drop = (colId) => { if (draggedId) onMove(draggedId, colId); setDraggedId(null); setOverCol(null) }
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3 items-start">
      {KANBAN_COLUMNS.map(col => (
        <div key={col.id}
          onDragOver={(e) => { e.preventDefault(); setOverCol(col.id) }}
          onDragLeave={() => setOverCol(c => (c === col.id ? null : c))}
          onDrop={() => drop(col.id)}
          className={`rounded-xl border p-2 min-h-[140px] transition-colors ${overCol === col.id ? 'border-coral-400 bg-coral-500/10' : 'border-gray-200 bg-gray-50/50'}`}>
          <div className="flex items-center justify-between px-1.5 py-1 mb-2">
            <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">{col.label}</span>
            <span className="text-xs text-gray-400">{byCol[col.id].length}</span>
          </div>
          <div className="space-y-2">
            {byCol[col.id].map(t => (
              <KanbanCard key={t.id} task={t} dragging={draggedId === t.id}
                onDragStart={setDraggedId} onDragEnd={() => setDraggedId(null)}
                onComplete={onComplete} onWork={onWork} onDelete={onDelete} onDismiss={onDismiss} />
            ))}
            {!byCol[col.id].length && <p className="text-[11px] text-gray-400 text-center py-6 select-none">Drop here</p>}
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Task Row ─────────────────────────────────────────────────────────────────

function TaskRow({ task, onStatusChange, onDelete, onDismiss, onWorkInClaude, onMomentumChange, selected, onToggleSelect, bulkMode }) {
  const [expanded, setExpanded] = useState(false)
  const [statusOpen, setStatusOpen] = useState(false)
  useEffect(() => {
    if (!statusOpen) return
    const close = () => setStatusOpen(false)
    const id = setTimeout(() => document.addEventListener('click', close), 0) // attach next tick so the opening click doesn't close it
    return () => { clearTimeout(id); document.removeEventListener('click', close) }
  }, [statusOpen])
  const overdue = isOverdue(task)
  const dateLabel = formatDate(task.dueDate)
  const isGong = task.source === 'gong'
  // Surface the source call (title + date) that's buried in the auto-generated description.
  const callMatch = isGong ? (task.description || '').match(/Gong call: "([^"]+)" on ([^(]+)/) : null
  const callCtx = callMatch ? { title: callMatch[1].trim(), date: callMatch[2].trim() } : null

  return (
    <div className={`group border rounded-xl transition-all ${
      task._justCompleted ? 'border-green-300 bg-green-50' :
      selected ? 'border-blue-300 bg-blue-50/30' :
      overdue ? 'border-red-200 bg-red-50/30' : 'border-gray-200 bg-white'
    } hover:shadow-sm`}>
      <div className="flex items-start gap-3 p-4" onClick={() => setExpanded(e => !e)} style={{ cursor: 'pointer' }}>
        {/* Checkbox — visible on hover or in bulk mode */}
        <div className={`mt-0.5 flex-shrink-0 ${bulkMode ? '' : 'opacity-0 group-hover:opacity-100'}`} style={{ width: '16px' }}>
          <input
            type="checkbox"
            checked={!!selected}
            onChange={() => onToggleSelect?.(task.id)}
            onClick={e => e.stopPropagation()}
            style={{ width: '14px', height: '14px', cursor: 'pointer', accentColor: '#2563eb' }}
          />
        </div>

        {/* Complete toggle */}
        <button
          onClick={(e) => { e.stopPropagation(); onStatusChange(task.id, task.status === 'complete' ? 'open' : 'complete') }}
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
            <button onClick={(e) => { e.stopPropagation(); setExpanded(!expanded) }} className="flex-shrink-0 text-gray-400 hover:text-gray-600 mt-0.5">
              <ChevronDown className={`w-4 h-4 transition-transform ${expanded ? 'rotate-180' : ''}`} />
            </button>
          </div>

          {/* Source-call context (which call this came from) */}
          {callCtx && (
            <p className="text-xs text-gray-400 mt-0.5 truncate" title={`${callCtx.title} · ${callCtx.date}`}>
              From call: “{callCtx.title}” · {callCtx.date}
            </p>
          )}

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

            {/* Momentum badge */}
            {task.status !== 'complete' && task.momentum && (
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${
                task.momentum === 'waiting_on_them' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                task.momentum === 'no_next_step' ? 'bg-red-50 text-red-700 border-red-200' :
                'bg-blue-50 text-blue-700 border-blue-200'
              }`}>
                {task.momentum === 'waiting_on_them' ? 'Waiting' :
                 task.momentum === 'no_next_step' ? 'No step' : 'On me'}
              </span>
            )}

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

            {/* Ready AI draft — the engine pre-wrote a deliverable; flag it so the rep sees it at a glance */}
            {task.status !== 'complete' && (task.aiDraft?.content || (typeof task.aiDraft === 'string' && task.aiDraft.trim())) && (
              <button
                onClick={(e) => { e.stopPropagation(); onWorkInClaude?.(task) }}
                className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 transition-colors"
                title="A draft is ready — open it"
              >
                <FileText className="w-3 h-3" />
                Draft ready
              </button>
            )}

            {/* Work in Claude */}
            {onWorkInClaude && task.status !== 'complete' && (
              <button
                onClick={(e) => { e.stopPropagation(); onWorkInClaude(task) }}
                className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-50 text-indigo-600 border border-indigo-200 hover:bg-indigo-100 transition-colors"
                title="Work in Claude"
              >
                <Sparkles className="w-3 h-3" />
                Work
              </button>
            )}

            {/* Status selector */}
            <div className="relative ml-auto" onClick={e => e.stopPropagation()}>
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
            <div className="mt-3 border-t border-gray-100 pt-3 space-y-2" onClick={e => e.stopPropagation()}>
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
              {/* Momentum setter */}
              {onMomentumChange && task.status !== 'complete' && (
                <div className="flex items-center gap-2 flex-wrap pt-1">
                  <span className="text-xs text-gray-500 font-medium">Momentum:</span>
                  {[
                    { value: 'on_me', label: 'On me', cls: 'text-blue-700 bg-blue-50 border-blue-200' },
                    { value: 'waiting_on_them', label: 'Waiting on them', cls: 'text-amber-700 bg-amber-50 border-amber-200' },
                    { value: 'no_next_step', label: 'No next step', cls: 'text-red-700 bg-red-50 border-red-200' },
                  ].map(m => (
                    <button
                      key={m.value}
                      onClick={() => onMomentumChange(task.id, task.momentum === m.value ? null : m.value)}
                      className={`px-2 py-0.5 rounded-full text-xs border transition-colors ${
                        task.momentum === m.value ? m.cls : 'text-gray-400 bg-gray-50 border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
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

function RepView({ tasks, sortBy = 'smart', onStatusChange, onDelete, onDismiss, onWorkInClaude, onMomentumChange, onNewTask, selectedTaskIds, onToggleSelect, bulkMode }) {
  // Honor the chosen Sort within each type group; 'Smart' keeps overdue-first + priority.
  const cmp = sortBy && sortBy !== 'smart'
    ? taskComparator(sortBy)
    : (a, b) => { const aOver = isOverdue(a) ? 1 : 0, bOver = isOverdue(b) ? 1 : 0; if (bOver !== aOver) return bOver - aOver; return computeTaskPriority(b) - computeTaskPriority(a) }
  const grouped = TYPE_ORDER.reduce((acc, type) => {
    const items = tasks.filter(t => t.type === type).sort(cmp)
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
                <TaskRow key={task.id} task={task} onStatusChange={onStatusChange} onDelete={onDelete} onDismiss={onDismiss} onWorkInClaude={onWorkInClaude} onMomentumChange={onMomentumChange} selected={selectedTaskIds?.has(task.id)} onToggleSelect={onToggleSelect} bulkMode={bulkMode} />
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

// ─── Focus List View ─────────────────────────────────────────────────────────

function FocusListView({ tasks, onStatusChange, onDelete, onDismiss, onWorkInClaude, onMomentumChange, selectedTaskIds, onToggleSelect, bulkMode }) {
  const sorted = [...tasks].sort((a, b) => {
    const aOver = isOverdue(a) ? 1 : 0
    const bOver = isOverdue(b) ? 1 : 0
    if (bOver !== aOver) return bOver - aOver
    return computeTaskPriority(b) - computeTaskPriority(a)
  })

  if (!sorted.length) {
    return (
      <div className="text-center py-12 text-gray-400">
        <CheckCircle2 className="w-10 h-10 mx-auto mb-3 opacity-30" />
        <p className="text-sm">Nothing left to do right now.</p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {sorted.map(task => (
        <TaskRow
          key={task.id}
          task={task}
          onStatusChange={onStatusChange}
          onDelete={onDelete}
          onDismiss={onDismiss}
          onWorkInClaude={onWorkInClaude}
          onMomentumChange={onMomentumChange}
          selected={selectedTaskIds?.has(task.id)}
          onToggleSelect={onToggleSelect}
          bulkMode={bulkMode}
        />
      ))}
    </div>
  )
}

// ─── By Account View ──────────────────────────────────────────────────────────

// Filter/sort <select> styling as a class (not inline) so the dark theme can restyle it.
const FILTER_SELECT_CLS = 'text-xs border border-gray-200 rounded-lg px-2 py-1 bg-white text-gray-700 outline-none cursor-pointer'

const STAGE_WEIGHT = {
  legal: 9, proposal: 8, solution_validation: 7, demo: 6,
  active_pursuit: 5, intro_scheduled: 4, qualifying: 3,
}

function ByAccountView({ tasks, sortBy = 'smart', onStatusChange, onDelete, onDismiss, onWorkInClaude, onMomentumChange, selectedTaskIds, onToggleSelect, bulkMode }) {
  const [collapsed, setCollapsed] = useState(new Set())
  const toggleCollapse = (id) => setCollapsed(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  const open = tasks // parent already applied the Active/All/Complete status filter (sortedFilteredTasks)
  const grouped = {}
  const noAccount = []

  open.forEach(t => {
    if (t.account) {
      if (!grouped[t.account.id]) grouped[t.account.id] = { account: t.account, tasks: [] }
      grouped[t.account.id].tasks.push(t)
    } else {
      noAccount.push(t)
    }
  })

  const sorted = Object.values(grouped).sort((a, b) =>
    (STAGE_WEIGHT[b.account.stage] || 0) - (STAGE_WEIGHT[a.account.stage] || 0)
  )

  if (!sorted.length && !noAccount.length) {
    return (
      <div className="text-center py-12 text-gray-400">
        <CheckCircle2 className="w-10 h-10 mx-auto mb-3 opacity-30" />
        <p className="text-sm">No open tasks.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {sorted.map(({ account, tasks: grpTasks }) => {
        const isCollapsed = collapsed.has(account.id)
        return (
          <div key={account.id}>
            <button onClick={() => toggleCollapse(account.id)} className="flex items-center gap-2 mb-3 w-full text-left group">
              <ChevronRight className={`w-4 h-4 text-gray-400 transition-transform ${isCollapsed ? '' : 'rotate-90'}`} />
              <Building2 className="w-4 h-4 text-gray-400" />
              <span className="font-semibold text-gray-800 text-sm">{account.name}</span>
              {account.stage && <StageBadge stage={account.stage} />}
              {account.deal_value ? <span className="text-xs font-semibold text-gray-500 tabular-nums">{fmtUsd(account.deal_value)}</span> : null}
              <span className="text-xs text-gray-400">{grpTasks.length} task{grpTasks.length !== 1 ? 's' : ''}</span>
            </button>
            {!isCollapsed && (
              <div className="space-y-2">
                {[...grpTasks].sort(taskComparator(sortBy)).map(task => (
                  <TaskRow
                    key={task.id}
                    task={task}
                    onStatusChange={onStatusChange}
                    onDelete={onDelete}
                    onDismiss={onDismiss}
                    onWorkInClaude={onWorkInClaude}
                    onMomentumChange={onMomentumChange}
                    selected={selectedTaskIds?.has(task.id)}
                    onToggleSelect={onToggleSelect}
                    bulkMode={bulkMode}
                  />
                ))}
              </div>
            )}
          </div>
        )
      })}
      {noAccount.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <span className="text-sm font-medium text-gray-500">No account</span>
            <span className="text-xs text-gray-400">{noAccount.length} task{noAccount.length !== 1 ? 's' : ''}</span>
          </div>
          <div className="space-y-2">
            {noAccount.map(task => (
              <TaskRow
                key={task.id}
                task={task}
                onStatusChange={onStatusChange}
                onDelete={onDelete}
                onDismiss={onDismiss}
                onWorkInClaude={onWorkInClaude}
                onMomentumChange={onMomentumChange}
                selected={selectedTaskIds?.has(task.id)}
                onToggleSelect={onToggleSelect}
                bulkMode={bulkMode}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Global Search (Cmd+K) ────────────────────────────────────────────────────

function GlobalSearch({ tasks, onClose, router, onSelectTask }) {
  const [query, setQuery] = useState('')
  const [accounts, setAccounts] = useState([])
  const [selectedIdx, setSelectedIdx] = useState(0)
  const inputRef = useRef(null)

  useEffect(() => {
    inputRef.current?.focus()
    // Build unique accounts from loaded tasks
    const seen = new Set()
    const fromTasks = []
    tasks.forEach(t => {
      if (t.account?.id && !seen.has(t.account.id)) {
        seen.add(t.account.id)
        fromTasks.push({ id: t.account.id, name: t.account.name, stage: t.account.stage })
      }
    })
    setAccounts(fromTasks)
  }, [tasks])

  const q = query.toLowerCase().trim()

  const taskResults = q
    ? tasks.filter(t => t.title?.toLowerCase().includes(q) || t.account?.name?.toLowerCase().includes(q)).slice(0, 5).map(t => ({
        type: 'task', id: t.id, label: t.title, sub: t.account?.name || '', data: t,
      }))
    : []

  const accountResults = q
    ? accounts.filter(a => a.name?.toLowerCase().includes(q)).slice(0, 5).map(a => ({
        type: 'account', id: a.id, label: a.name, sub: a.stage || '', data: a,
      }))
    : []

  const results = [...accountResults, ...taskResults]

  useEffect(() => { setSelectedIdx(0) }, [query])

  const handleSelect = (item) => {
    if (item.type === 'account') {
      router.push(`/modules/account-pipeline?account=${item.id}`)
    } else {
      onSelectTask?.(item.data) // filter the list to this task instead of a no-op self-navigation
    }
    onClose()
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') { onClose(); return }
    if (e.key === 'ArrowDown') { e.preventDefault(); setSelectedIdx(i => Math.min(i + 1, results.length - 1)) }
    if (e.key === 'ArrowUp') { e.preventDefault(); setSelectedIdx(i => Math.max(i - 1, 0)) }
    if (e.key === 'Enter' && results[selectedIdx]) handleSelect(results[selectedIdx])
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center pt-24 px-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100">
          <Search className="w-4 h-4 text-gray-400 shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search accounts and tasks..."
            className="flex-1 text-sm text-gray-900 outline-none bg-transparent placeholder-gray-400"
          />
          <kbd className="text-xs text-gray-400 border border-gray-200 rounded px-1.5 py-0.5">Esc</kbd>
        </div>
        {query && (
          <div className="max-h-80 overflow-y-auto py-1">
            {results.length === 0 ? (
              <p className="text-sm text-gray-400 px-4 py-3">No results</p>
            ) : (
              results.map((item, idx) => (
                <button
                  key={`${item.type}-${item.id}`}
                  onClick={() => handleSelect(item)}
                  onMouseEnter={() => setSelectedIdx(idx)}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${idx === selectedIdx ? 'bg-blue-50' : 'hover:bg-gray-50'}`}
                >
                  <span className={`shrink-0 text-xs px-1.5 py-0.5 rounded font-medium ${item.type === 'account' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}`}>
                    {item.type === 'account' ? 'Account' : 'Task'}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-900 truncate">{item.label}</p>
                    {item.sub && <p className="text-xs text-gray-400 truncate">{item.sub}</p>}
                  </div>
                  <ChevronRight className="w-3.5 h-3.5 text-gray-300 shrink-0" />
                </button>
              ))
            )}
          </div>
        )}
        {!query && (
          <div className="px-4 py-3 text-xs text-gray-400">
            Type to search accounts and tasks
          </div>
        )}
      </div>
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
  const [taskSearch, setTaskSearch] = useState('') // inline title/account search
  const [filterAccount, setFilterAccount] = useState('all') // Kanban: filter by account
  const [filterType, setFilterType] = useState('all')        // Kanban: filter by action-type
  const [filterCoached, setFilterCoached] = useState(false)  // Kanban: show tasks from calls I coached
  const [coachedTasks, setCoachedTasks] = useState([])
  const [sdrViewTab, setSdrViewTab] = useState('all') // 'all' | 'campaigns' | 'top50' | 'standard'
  const [repType, setRepType] = useState(null)
  const [providerToken, setProviderToken] = useState(null)
  const [completeTask, setCompleteTask] = useState(null) // task being completed via AI modal
  const [dismissTask, setDismissTask] = useState(null) // task being dismissed
  const [workTask, setWorkTask] = useState(null) // task open in Work in Claude panel
  const [showSearch, setShowSearch] = useState(false)
  const [users, setUsers] = useState([])
  const [selectedTaskIds, setSelectedTaskIds] = useState(new Set())
  const [toast, setToast] = useState(null)
  const showToast = (message) => { setToast(message); setTimeout(() => setToast(null), 3500) }
  const [focusShowAll, setFocusShowAll] = useState(false)
  const [filterStage, setFilterStage] = useState('all')
  const [filterAssignee, setFilterAssignee] = useState('mine')
  const [filterSource, setFilterSource] = useState('all')
  const [filterDue, setFilterDue] = useState('all')
  const [filterTier, setFilterTier] = useState('all')
  const [sortBy, setSortBy] = useState('smart') // smart | due | priority | account | recent
  const [taskView, setTaskView] = useState('board') // 'board' (Kanban). Legacy focus/by_account/all blocks are unreachable.
  const [backfilling, setBackfilling] = useState(false)
  const [clearingNoise, setClearingNoise] = useState(false)
  const [startingClean, setStartingClean] = useState(false)
  const demoSeeded = useRef(false)

  const bulkMode = selectedTaskIds.size > 0

  // Auth check — AuthGuard handles redirects; we just need the user + provider token
  useEffect(() => {
    const init = async () => {
      const useAuth = isSupabaseConfigured() && process.env.NEXT_PUBLIC_USE_SUPABASE !== 'false'
      if (useAuth) {
        const { session } = await getSession()
        if (!session) { router.push('/login'); return }
        setUser(session.user)
        if (session?.provider_token) setProviderToken(session.provider_token)
        // Fetch team members for assign-to dropdown (non-blocking)
        fetch('/api/users').then(r => r.json()).then(d => { if (d.users) setUsers(d.users) }).catch(() => {})
      }
      setIsReady(true)
    }
    init()
  }, [])

  useEffect(() => {
    // rep_type is assigned by an admin; read it from the profile, not a self-set toggle.
    fetch('/api/me').then(r => r.json()).then(d => setRepType(d.profile?.rep_type || null)).catch(() => {})
  }, [])

  useEffect(() => {
    // Lazily load tasks from calls I coached (owned by other reps) when that filter is turned on.
    if (!filterCoached) return
    fetch('/api/tasks?coached=me').then(r => r.json()).then(d => setCoachedTasks(d.tasks || [])).catch(() => setCoachedTasks([]))
  }, [filterCoached])

  useEffect(() => {
    const handler = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setShowSearch(s => !s)
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [])

  const seedDemoTasks = useCallback(async () => {
    if (demoSeeded.current) return
    demoSeeded.current = true
    try { localStorage.setItem('tasks_seeded', '1') } catch {}
    const demos = [
      { title: 'Set up your Slack ID in Settings', description: 'Add your Slack Member ID so you receive daily digests with your deal updates and commitments.', type: 'assigned', priority: 1 },
      { title: 'Review your accounts in Account Pipeline', description: 'Open Account Pipeline to see all your active deals. Check for stale accounts and review any AI-analyzed calls.', type: 'assigned', priority: 2 },
      { title: 'Connect Google Calendar for meeting prep', description: 'Grant calendar access in Settings so the app can surface prep briefs before your sales calls.', type: 'assigned', priority: 3 },
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
        fetch('/api/tasks?scope=all'), // server returns the whole team only for managers, else just the caller
        fetch('/api/tasks?view=team'),
      ])
      const tasksData = await tasksRes.json()
      const summaryData = await summaryRes.json()
      const fetched = tasksData.tasks || []
      if (tasksData.success) setTasks(fetched)
      if (summaryData.success) setSummary(summaryData.summary || [])
      // Seed demo tasks ONLY for a genuine first-time user. Once they've ever had tasks (or ran a
      // Start Clean), the flag is set and we never repopulate — clearing the backlog must stay clear.
      let seeded = true
      try { seeded = !!localStorage.getItem('tasks_seeded') } catch {}
      if (fetched.length > 0) { try { localStorage.setItem('tasks_seeded', '1') } catch {} }
      else if (isSupabaseConfigured() && !seeded) { seedDemoTasks() }
    } catch (err) {
      console.error('Failed to fetch tasks:', err)
    } finally {
      setLoading(false)
    }
  }, [seedDemoTasks])

  useEffect(() => {
    if (isReady) fetchTasks()
  }, [isReady, fetchTasks])

  useEffect(() => {
    const handler = (e) => {
      if (e.detail === 'all') setTaskView('board')
    }
    window.addEventListener('tasks:switchTab', handler)
    return () => window.removeEventListener('tasks:switchTab', handler)
  }, [])

  // Lightweight refresh hook — e.g. when a follow-up task is created server-side from a just-ended meeting.
  useEffect(() => {
    const handler = () => fetchTasks()
    window.addEventListener('tasks:refresh', handler)
    return () => window.removeEventListener('tasks:refresh', handler)
  }, [fetchTasks])

  // Kanban: dragging a card to a column applies that column's status/momentum.
  const handleMoveToColumn = async (taskId, colId) => {
    const apply = KANBAN_APPLY[colId]
    if (!apply) return
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, ...apply } : t))
    try {
      const res = await fetch(`/api/tasks/${taskId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(apply) })
      if (!res.ok) throw new Error('move failed')
    } catch { showToast("Couldn't move task — reverted"); fetchTasks() }
  }

  // Completing a task just completes it — directly, optimistically. (No more opening a modal on the
  // check; drafting a deliverable lives behind the explicit "Work" action instead.)
  const handleStatusChange = async (taskId, newStatus) => {
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: newStatus, _justCompleted: newStatus === 'complete' } : t))
    if (newStatus === 'complete') setTimeout(() => setTasks(prev => prev.map(t => t.id === taskId ? { ...t, _justCompleted: false } : t)), 1000)
    try {
      const res = await fetch(`/api/tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })
      if (!res.ok) throw new Error('save failed')
    } catch (err) {
      console.error('Failed to update task:', err)
      showToast(newStatus === 'complete' ? "Couldn't complete task — reverted" : "Couldn't update task — reverted")
      fetchTasks()
    }
  }

  const handleConfirmComplete = async () => {
    if (!completeTask) return
    const target = completeTask
    setTasks(prev => prev.map(t => t.id === target.id ? { ...t, status: 'complete' } : t))
    setCompleteTask(null)
    try {
      const res = await fetch(`/api/tasks/${target.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'complete' }),
      })
      if (!res.ok) throw new Error('save failed')
      // task_complete Slack notify now fires server-side in PATCH /api/tasks/[id] (every path).
    } catch (err) {
      console.error('Failed to complete task:', err)
      showToast("Couldn't complete task — reverted")
      fetchTasks()
    }
  }

  const handleDelete = async (taskId) => {
    setTasks(prev => prev.filter(t => t.id !== taskId))
    try {
      const res = await fetch(`/api/tasks/${taskId}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('delete failed')
    } catch (err) {
      console.error('Failed to delete task:', err)
      showToast("Couldn't delete task — reverted")
      fetchTasks()
    }
  }

  const handleDismiss = async (taskId, reason) => {
    setTasks(prev => prev.filter(t => t.id !== taskId))
    try {
      const res = await fetch(`/api/tasks/${taskId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'dismiss', reason }),
      })
      if (!res.ok) throw new Error('dismiss failed')
    } catch (err) {
      console.error('Failed to dismiss task:', err)
      showToast("Couldn't dismiss task — reverted")
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
      if (json.success) {
        setTasks(prev => [json.task, ...prev])
        fetchTasks()
      }
    } catch (err) {
      console.error('Failed to create task:', err)
    }
  }

  const handleBulkComplete = async () => {
    const ids = [...selectedTaskIds]
    const results = await Promise.all(ids.map(id =>
      fetch(`/api/tasks/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'complete' }),
      }).then(r => r.ok).catch(() => false)
    ))
    const failed = results.filter(ok => !ok).length
    if (failed) showToast(`${failed} of ${ids.length} couldn't be completed`)
    setSelectedTaskIds(new Set())
    fetchTasks()
  }

  const handleBulkSnooze = async () => {
    const ids = [...selectedTaskIds]
    const until = new Date(Date.now() + 2 * 86400000).toISOString().split('T')[0]
    const results = await Promise.all(ids.map(id =>
      fetch(`/api/tasks/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ snoozeUntil: until }), // hides the task until it wakes; doesn't touch the real due date
      }).then(r => r.ok).catch(() => false)
    ))
    const failed = results.filter(ok => !ok).length
    if (failed) showToast(`${failed} of ${ids.length} couldn't be snoozed`)
    setSelectedTaskIds(new Set())
    fetchTasks()
  }

  const handleMomentumChange = async (taskId, momentum) => {
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, momentum } : t))
    try {
      const res = await fetch(`/api/tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ momentum }),
      })
      if (!res.ok) throw new Error('save failed')
    } catch { showToast("Couldn't update — reverted"); fetchTasks() }
  }

  const handleBulkCreate = (created) => {
    if (created?.length) setTasks(prev => [...created, ...prev])
  }

  const handleBackfill = async () => {
    setBackfilling(true)
    try {
      const res = await fetch('/api/gong/backfill-tasks', { method: 'POST' })
      const d = await res.json()
      if (d.success) fetchTasks()
    } catch {}
    finally { setBackfilling(false) }
  }

  const toggleTaskSelected = (taskId) => {
    setSelectedTaskIds(prev => {
      const next = new Set(prev)
      if (next.has(taskId)) next.delete(taskId)
      else next.add(taskId)
      return next
    })
  }

  const currentUserId = user?.id
  // Managers load the whole team's tasks (for the All/By-Account assignee filter), but the Focus
  // landing tab and the header counters are always about YOUR own work — scope them to the caller.
  const myTasks = currentUserId ? tasks.filter(t => t.ownerId === currentUserId) : tasks

  // Filter tasks for rep view
  const handleClearNoise = async () => {
    setClearingNoise(true)
    try {
      const prev = await fetch('/api/tasks/clear-noise', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' }).then(r => r.json())
      const n = prev.count || 0
      if (!n) { window.alert('No low-signal tasks to clear — your list is already clean.'); return }
      const sample = (prev.sample || []).slice(0, 5).map(s => `• ${s}`).join('\n')
      if (!window.confirm(`Clear ${n} low-signal task${n === 1 ? '' : 's'} (in-call narration / boilerplate from Gong)?\n\nExamples:\n${sample}\n\nThey'll be dismissed (recoverable), not deleted.`)) return
      const res = await fetch('/api/tasks/clear-noise', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ execute: true }) }).then(r => r.json())
      if (res.cleared != null) fetchTasks()
    } catch (e) { window.alert('Clear noise failed: ' + e.message) }
    finally { setClearingNoise(false) }
  }

  const handleStartClean = async () => {
    setStartingClean(true)
    try {
      const prev = await fetch('/api/tasks/start-clean', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' }).then(r => r.json())
      const n = prev.count || 0
      if (!n) { window.alert('Nothing to archive — your list already starts from today.'); return }
      const kept = prev.keptScheduled ? `\n\nKept: ${prev.keptScheduled} future-scheduled task${prev.keptScheduled === 1 ? '' : 's'}.` : ''
      if (!window.confirm(`Start clean from today?\n\nThis archives ${n} open task${n === 1 ? '' : 's'} from before today. New tasks from your calls still appear as they come in.${kept}\n\nThey're dismissed (recoverable), not deleted.`)) return
      const res = await fetch('/api/tasks/start-clean', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ execute: true }) }).then(r => r.json())
      try { localStorage.setItem('tasks_seeded', '1') } catch {} // don't repopulate demo tasks into a just-cleared list
      if (res.cleared != null) fetchTasks()
    } catch (e) { window.alert('Start clean failed: ' + e.message) }
    finally { setStartingClean(false) }
  }

  const filteredTasks = tasks.filter(t => {
    if (filterStatus === 'active') return t.status !== 'complete'
    if (filterStatus === 'complete') return t.status === 'complete'
    return true
  }).filter(t => {
    const s = taskSearch.trim().toLowerCase()
    if (!s) return true
    return (t.title || '').toLowerCase().includes(s) || (t.account?.name || '').toLowerCase().includes(s)
  }).filter(task => {
    if (repType !== 'sdr' || sdrViewTab === 'all') return true
    if (sdrViewTab === 'campaigns') return task.sourceType === 'campaign'
    if (sdrViewTab === 'top50') return task.sourceType === 'pursuit'
    if (sdrViewTab === 'standard') return task.sourceType !== 'campaign' && task.sourceType !== 'pursuit'
    return true
  }).filter(task => {
    if (filterStage !== 'all' && task.account?.stage !== filterStage) return false

    if (filterAssignee === 'mine') {
      if (currentUserId && task.ownerId !== currentUserId) return false
    } else if (filterAssignee !== 'everyone') {
      const ownerUser = users.find(u => u.id === task.ownerId)
      const ownerName = ownerUser?.full_name || ownerUser?.email || ''
      if (ownerName !== filterAssignee) return false
    }

    if (filterSource !== 'all') {
      const src = (task.source || '').toLowerCase()
      const srcType = (task.sourceType || '').toLowerCase()
      if (filterSource === 'voice' && !srcType.includes('voice') && src !== 'voice') return false
      if (filterSource === 'manual' && src !== 'manual') return false
      if (filterSource === 'gong' && src !== 'gong' && !srcType.startsWith('gong')) return false
      if (filterSource === 'gmail' && src !== 'email' && src !== 'gmail') return false
      if (filterSource === 'calendar' && src !== 'calendar') return false
      if (filterSource === 'playbook' && src !== 'playbook' && src !== 'stage_change') return false
    }

    if (filterDue !== 'all') {
      const today = new Date(); today.setHours(0,0,0,0)
      const todayStr = today.toISOString().split('T')[0]
      if (filterDue === 'overdue') {
        if (!task.dueDate || task.dueDate >= todayStr || task.status === 'complete') return false
      } else if (filterDue === 'today') {
        if (task.dueDate !== todayStr) return false
      } else if (filterDue === 'this_week') {
        const weekEnd = new Date(today); weekEnd.setDate(weekEnd.getDate() + 7)
        const weekEndStr = weekEnd.toISOString().split('T')[0]
        if (!task.dueDate || task.dueDate < todayStr || task.dueDate > weekEndStr) return false
      } else if (filterDue === 'no_due') {
        if (task.dueDate) return false
      }
    }

    if (filterTier !== 'all' && task.account?.tier !== filterTier) return false

    return true
  })

  // Sort (applied on top of the filters) — consistent across every task tab.
  const SORT_OPTIONS = [
    { value: 'smart', label: 'Smart' },
    { value: 'due', label: 'Due date' },
    { value: 'priority', label: 'Priority' },
    { value: 'account', label: 'Account' },
    { value: 'recent', label: 'Recently added' },
  ]
  const sortTasks = (list) => [...list].sort(taskComparator(sortBy))
  const sortedFilteredTasks = sortTasks(filteredTasks)

  // One filter+sort bar, rendered on every task tab so the affordance is consistent (Tasks v2).
  const renderFilters = () => {
    const STAGE_OPTIONS = [
      { value: 'all', label: 'All Stages' }, { value: 'qualifying', label: 'Qualifying' },
      { value: 'intro_scheduled', label: 'Intro Scheduled' }, { value: 'active_pursuit', label: 'Active Pursuit' },
      { value: 'demo', label: 'Demo' }, { value: 'solution_validation', label: 'Solution Validation' },
      { value: 'proposal', label: 'Proposal' }, { value: 'legal', label: 'Legal' },
    ]
    const distinctOwners = [...new Map(tasks.map(t => { const u = users.find(u => u.id === t.ownerId); return u ? [u.full_name || u.email, u.full_name || u.email] : null }).filter(Boolean)).entries()].map(([k]) => k)
    const anyNonDefault = filterStage !== 'all' || filterAssignee !== 'mine' || filterSource !== 'all' || filterDue !== 'all' || filterTier !== 'all'
    const sel = { fontSize: '12px', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '4px 8px', background: '#fff', color: '#374151', outline: 'none', cursor: 'pointer' }
    return (
      <>
        <div className="sticky z-[9] bg-gray-50 py-2 mb-2 border-b border-gray-100" style={{ top: '64px' }}>
          <div className="flex items-center gap-2 flex-wrap">
            <Filter className="w-4 h-4 text-gray-400" />
            {['active', 'all', 'complete'].map(f => (
              <button key={f} onClick={() => setFilterStatus(f)} className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors capitalize ${filterStatus === f ? 'bg-coral-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:border-coral-300'}`}>{f}</button>
            ))}
            <input value={taskSearch} onChange={e => setTaskSearch(e.target.value)} placeholder="Search tasks or accounts…" className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 w-56 focus:outline-none focus:ring-2 focus:ring-coral-200 focus:border-coral-400" />
            <div className="ml-auto flex items-center gap-3">
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '13px', color: '#6b7280' }}>
                <input type="checkbox" checked={sortedFilteredTasks.length > 0 && sortedFilteredTasks.every(t => selectedTaskIds.has(t.id))} onChange={e => { if (e.target.checked) setSelectedTaskIds(new Set(sortedFilteredTasks.map(t => t.id))); else setSelectedTaskIds(new Set()) }} style={{ width: '14px', height: '14px', accentColor: '#EE5340' }} />
                Select all
              </label>
              <span className="text-sm text-gray-400">{sortedFilteredTasks.length} task{sortedFilteredTasks.length !== 1 ? 's' : ''}</span>
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '20px' }}>
          <select value={filterStage} onChange={e => setFilterStage(e.target.value)} className={FILTER_SELECT_CLS}>{STAGE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}</select>
          <select value={filterAssignee} onChange={e => setFilterAssignee(e.target.value)} className={FILTER_SELECT_CLS}>
            <option value="mine">Mine</option>
            {distinctOwners.map(name => <option key={name} value={name}>{name}</option>)}
            <option value="everyone">Everyone</option>
          </select>
          <select value={filterSource} onChange={e => setFilterSource(e.target.value)} className={FILTER_SELECT_CLS}>
            <option value="all">All Sources</option><option value="voice">Voice</option><option value="manual">Manual</option>
            <option value="gong">Gong</option><option value="gmail">Gmail</option><option value="calendar">Calendar</option><option value="playbook">Playbook</option>
          </select>
          <select value={filterDue} onChange={e => setFilterDue(e.target.value)} className={FILTER_SELECT_CLS}>
            <option value="all">All</option><option value="overdue">Overdue</option><option value="today">Today</option><option value="this_week">This week</option><option value="no_due">No due date</option>
          </select>
          <select value={filterTier} onChange={e => setFilterTier(e.target.value)} className={FILTER_SELECT_CLS}>
            <option value="all">All Tiers</option><option value="hot">Hot</option><option value="active">Active</option><option value="watching">Watching</option><option value="archived">Archived</option>
          </select>
          <div className="w-px h-[18px] bg-gray-200" />
          <select value={sortBy} onChange={e => setSortBy(e.target.value)} className={FILTER_SELECT_CLS}>{SORT_OPTIONS.map(o => <option key={o.value} value={o.value}>Sort: {o.label}</option>)}</select>
          {anyNonDefault && (
            <button onClick={() => { setFilterStage('all'); setFilterAssignee('mine'); setFilterSource('all'); setFilterDue('all'); setFilterTier('all') }} style={{ fontSize: '12px', color: '#6366f1', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline', padding: '4px 0' }}>Clear filters</button>
          )}
        </div>
      </>
    )
  }

  if (!isReady) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
      </div>
    )
  }

  return (
    <AppShell
      title="Tasks"
      actions={
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
        </div>
      }
    >
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
            {/* Debrief bar — always visible */}
            <DebriefBar onBulkCreate={handleBulkCreate} />

            {/* Board header */}
            <div className="flex items-center gap-2 mb-4">
              <LayoutGrid className="w-4 h-4 text-gray-500" />
              <span className="text-sm font-semibold text-gray-700">Your board</span>
              <div className="ml-auto flex items-center gap-3">
                <button onClick={handleStartClean} disabled={startingClean} title="Archive the old backlog and start fresh from today. New tasks from your calls still appear. Reversible." className="text-xs text-gray-400 hover:text-coral-600 disabled:opacity-40 transition-colors">
                  {startingClean ? 'Cleaning…' : 'Start clean'}
                </button>
                <button onClick={handleClearNoise} disabled={clearingNoise} title="Dismiss low-signal Gong tasks (in-call narration / boilerplate)" className="text-xs text-gray-400 hover:text-coral-600 disabled:opacity-40 transition-colors">
                  {clearingNoise ? 'Clearing…' : 'Clear noise'}
                </button>
                <span className="text-sm text-gray-400">
                  {myTasks.filter(t => t.status !== 'complete').length} open
                  {myTasks.filter(t => t.momentum === 'waiting_on_them' && t.status !== 'complete').length > 0 && (
                    <span className="ml-1 text-amber-500">
                      · {myTasks.filter(t => t.momentum === 'waiting_on_them' && t.status !== 'complete').length} waiting
                    </span>
                  )}
                </span>
              </div>
            </div>

            {/* Bulk action bar — all tabs */}
            {bulkMode && (
              <div className="sticky top-[72px] z-[15] flex justify-center mb-3 pointer-events-none">
                <div className="flex items-center gap-3 bg-white border border-gray-200 rounded-2xl shadow-lg px-4 py-2.5 pointer-events-auto">
                  <span className="text-[13px] font-semibold text-gray-700">{selectedTaskIds.size} selected</span>
                  <div className="w-px h-[18px] bg-gray-200" />
                  <button onClick={handleBulkComplete} className="text-[13px] font-medium text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-1.5 hover:bg-green-100">Complete</button>
                  <button onClick={handleBulkSnooze} className="text-[13px] font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-1.5 hover:bg-amber-100">Snooze 2 days</button>
                  <button onClick={() => setSelectedTaskIds(new Set())} className="text-[13px] font-medium text-gray-500 bg-gray-50 border border-gray-200 rounded-lg px-3 py-1.5 hover:bg-gray-100">Clear</button>
                </div>
              </div>
            )}

            {/* ── BOARD (Kanban) ─────────────────────────────────────────── */}
            {taskView === 'board' && (() => {
              const weekAgo = Date.now() - 7 * 86400000
              const boardSource = filterCoached ? coachedTasks : myTasks
              // Pool = active tasks + anything completed in the last 7 days (so Done isn't flooded
              // by your whole history but a fresh completion still lands there).
              const pool = boardSource.filter(t => t.status !== 'complete' || !t.completedAt || new Date(t.completedAt).getTime() >= weekAgo)
              const s = taskSearch.trim().toLowerCase()
              const boardTasks = pool.filter(t => {
                if (s && !(t.title || '').toLowerCase().includes(s) && !(t.account?.name || '').toLowerCase().includes(s)) return false
                if (filterStage !== 'all' && t.account?.stage !== filterStage) return false
                if (filterAccount !== 'all' && t.account?.id !== filterAccount) return false
                if (filterType !== 'all' && deriveActionType(t) !== filterType) return false
                return true
              })
              const acctOpts = []
              const seenAcct = new Set()
              for (const t of boardSource) { if (t.account?.id && !seenAcct.has(t.account.id)) { seenAcct.add(t.account.id); acctOpts.push({ id: t.account.id, name: t.account.name || 'Untitled' }) } }
              acctOpts.sort((a, b) => a.name.localeCompare(b.name))
              const anyFilter = s || filterStage !== 'all' || filterAccount !== 'all' || filterType !== 'all' || filterCoached
              return (
                <>
                  <CadenceStrip />
                  <DailyFocusBrief tasks={myTasks.filter(t => t.status !== 'complete')} onWorkInClaude={task => setWorkTask(task)} onStatusChange={handleStatusChange} />

                  {/* Filter bar */}
                  <div className="flex flex-wrap items-center gap-2 mb-3 mt-5">
                    <div className="relative">
                      <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                      <input value={taskSearch} onChange={e => setTaskSearch(e.target.value)} placeholder="Search tasks or accounts…" className="text-sm border border-gray-200 rounded-lg pl-8 pr-3 py-1.5 w-64 focus:outline-none focus:ring-2 focus:ring-coral-200 focus:border-coral-400" />
                    </div>
                    <select value={filterAccount} onChange={e => setFilterAccount(e.target.value)} className={FILTER_SELECT_CLS}>
                      <option value="all">All accounts</option>
                      {acctOpts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                    </select>
                    <select value={filterStage} onChange={e => setFilterStage(e.target.value)} className={FILTER_SELECT_CLS}>
                      <option value="all">All stages</option>
                      {ACTIVE_STAGE_ORDER.map(st => <option key={st} value={st}>{stageLabel(st)}</option>)}
                    </select>
                    <select value={filterType} onChange={e => setFilterType(e.target.value)} className={FILTER_SELECT_CLS}>
                      {ACTION_TYPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                    <button
                      onClick={() => setFilterCoached(v => !v)}
                      title="Show action items from calls you coached (owned by the deal owner)"
                      className={`text-xs px-2.5 py-1 rounded-lg border transition-colors ${filterCoached ? 'bg-coral-50 border-coral-300 text-coral-700 font-medium' : 'border-gray-200 text-gray-500 hover:border-gray-300'}`}
                    >
                      Calls I coached
                    </button>
                    {anyFilter && (
                      <button onClick={() => { setTaskSearch(''); setFilterAccount('all'); setFilterStage('all'); setFilterType('all'); setFilterCoached(false) }} className="text-xs text-gray-400 hover:text-coral-600">Clear filters</button>
                    )}
                    <span className="ml-auto text-xs text-gray-400">{boardTasks.length} shown · drag to move</span>
                  </div>

                  <KanbanBoard
                    tasks={boardTasks}
                    onComplete={handleStatusChange}
                    onMove={handleMoveToColumn}
                    onWork={task => setWorkTask(task)}
                    onDelete={handleDelete}
                    onDismiss={task => setDismissTask(task)}
                  />
                </>
              )
            })()}

            {/* ── FOCUS TAB (legacy — unreachable; taskView is 'board') ────── */}
            {taskView === 'focus' && (() => {
              const activeTasks = myTasks.filter(t => t.status !== 'complete')
              const onMeTasks = activeTasks.filter(t => t.momentum !== 'waiting_on_them')
              const waitingTasks = activeTasks.filter(t => t.momentum === 'waiting_on_them')
              // The AI hero (DailyFocusBrief) shows the top 3 by priority — dedup those out of the
              // list below so the same task isn't the hero AND repeated in the wall.
              const heroIds = new Set([...onMeTasks].sort((a, b) => computeTaskPriority(b) - computeTaskPriority(a)).slice(0, 3).map(t => t.id))
              const restTasks = onMeTasks.filter(t => !heroIds.has(t.id))
              const CAP = 15
              const shownRest = focusShowAll ? restTasks : restTasks.slice(0, CAP)
              return (
                <>
                  <CadenceStrip />
                  <TodaysCallTasks onStatusChange={handleStatusChange} />
                  <DailyFocusBrief tasks={activeTasks} onWorkInClaude={task => setWorkTask(task)} onStatusChange={handleStatusChange} />
                  <FocusListView
                    tasks={shownRest}
                    onStatusChange={handleStatusChange}
                    onDelete={handleDelete}
                    onDismiss={task => setDismissTask(task)}
                    onWorkInClaude={task => setWorkTask(task)}
                    onMomentumChange={handleMomentumChange}
                    selectedTaskIds={selectedTaskIds}
                    onToggleSelect={toggleTaskSelected}
                    bulkMode={bulkMode}
                  />
                  {!focusShowAll && restTasks.length > CAP && (
                    <button onClick={() => setFocusShowAll(true)} className="mt-3 text-xs font-medium text-coral-600 hover:text-coral-700">
                      Show all {restTasks.length} tasks
                    </button>
                  )}
                  {/* Secondary surfaces collapsed so Focus leads with the few things that matter. */}
                  <details className="mt-5 group">
                    <summary className="flex items-center gap-2 text-xs text-gray-500 cursor-pointer hover:text-gray-700 list-none select-none py-1">
                      <ChevronRight className="w-3 h-3 group-open:rotate-90 transition-transform" />
                      <span className="font-medium">More to review</span>
                      <span className="text-gray-400">— morning brief, recent calls, inbox &amp; calendar</span>
                    </summary>
                    <div className="mt-3 space-y-4">
                      <TodaysFocus />
                      <CallCommitmentsPanel onAddTask={handleCreate} />
                      <SmartSuggestionsPanel providerToken={providerToken} onAddTask={handleCreate} />
                    </div>
                  </details>
                  {waitingTasks.length > 0 && (
                    <details className="mt-5">
                      <summary className="flex items-center gap-2 text-xs text-amber-600 cursor-pointer hover:text-amber-800 list-none select-none py-1">
                        <ChevronRight className="w-3 h-3" />
                        <span className="font-medium">{waitingTasks.length} waiting on them</span>
                        <span className="text-amber-400">— paused, not actionable</span>
                      </summary>
                      <div className="space-y-2 mt-2 ml-4 opacity-70">
                        {waitingTasks.map(task => (
                          <TaskRow
                            key={task.id}
                            task={task}
                            onStatusChange={handleStatusChange}
                            onDelete={handleDelete}
                            onDismiss={task => setDismissTask(task)}
                            onWorkInClaude={task => setWorkTask(task)}
                            onMomentumChange={handleMomentumChange}
                            selected={selectedTaskIds.has(task.id)}
                            onToggleSelect={toggleTaskSelected}
                            bulkMode={bulkMode}
                          />
                        ))}
                      </div>
                    </details>
                  )}
                </>
              )
            })()}

            {/* ── BY ACCOUNT TAB ─────────────────────────────────────────── */}
            {taskView === 'by_account' && (
              <>
                {renderFilters()}
                <ByAccountView
                  tasks={sortedFilteredTasks}
                  sortBy={sortBy}
                  onStatusChange={handleStatusChange}
                  onDelete={handleDelete}
                  onDismiss={task => setDismissTask(task)}
                  onWorkInClaude={task => setWorkTask(task)}
                  onMomentumChange={handleMomentumChange}
                  selectedTaskIds={selectedTaskIds}
                  onToggleSelect={toggleTaskSelected}
                  bulkMode={bulkMode}
                />
              </>
            )}

            {/* ── ALL TAB ────────────────────────────────────────────────── */}
            {taskView === 'all' && (() => {
              const STAGE_OPTIONS = [
                { value: 'all', label: 'All Stages' },
                { value: 'qualifying', label: 'Qualifying' },
                { value: 'intro_scheduled', label: 'Intro Scheduled' },
                { value: 'active_pursuit', label: 'Active Pursuit' },
                { value: 'demo', label: 'Demo' },
                { value: 'solution_validation', label: 'Solution Validation' },
                { value: 'proposal', label: 'Proposal' },
                { value: 'legal', label: 'Legal' },
              ]
              const distinctOwners = [...new Map(
                tasks.map(t => {
                  const u = users.find(u => u.id === t.ownerId)
                  return u ? [u.full_name || u.email, u.full_name || u.email] : null
                }).filter(Boolean)
              ).entries()].map(([k]) => k)
              const anyNonDefault = filterStage !== 'all' || filterAssignee !== 'mine' || filterSource !== 'all' || filterDue !== 'all' || filterTier !== 'all'
              const sel = { fontSize: '12px', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '4px 8px', background: '#fff', color: '#374151', outline: 'none', cursor: 'pointer' }
              return (
                <>
                  {repType === 'sdr' && (
                    <div className="flex items-center gap-1 mb-3">
                      {[{ id: 'all', label: 'All' }, { id: 'campaigns', label: 'Campaigns' }, { id: 'top50', label: 'My Top 50' }, { id: 'standard', label: 'Standard' }].map(tab => (
                        <button key={tab.id} onClick={() => setSdrViewTab(tab.id)} className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${sdrViewTab === tab.id ? tab.id === 'campaigns' ? 'bg-indigo-600 text-white' : tab.id === 'top50' ? 'bg-orange-500 text-white' : 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>{tab.label}</button>
                      ))}
                    </div>
                  )}
                  <div className="sticky z-[9] bg-gray-50 py-2 mb-2 border-b border-gray-100" style={{ top: '64px' }}>
                    <div className="flex items-center gap-2 flex-wrap">
                      <Filter className="w-4 h-4 text-gray-400" />
                      {['active', 'all', 'complete'].map(f => (
                        <button key={f} onClick={() => setFilterStatus(f)} className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors capitalize ${filterStatus === f ? 'bg-coral-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:border-coral-300'}`}>{f}</button>
                      ))}
                      <input value={taskSearch} onChange={e => setTaskSearch(e.target.value)} placeholder="Search tasks or accounts…" className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 w-56 focus:outline-none focus:ring-2 focus:ring-coral-200 focus:border-coral-400" />
                      <div className="ml-auto flex items-center gap-3">
                        <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '13px', color: '#6b7280' }}>
                          <input type="checkbox" checked={filteredTasks.length > 0 && filteredTasks.every(t => selectedTaskIds.has(t.id))} onChange={e => { if (e.target.checked) setSelectedTaskIds(new Set(filteredTasks.map(t => t.id))); else setSelectedTaskIds(new Set()) }} style={{ width: '14px', height: '14px', accentColor: '#EE5340' }} />
                          Select all
                        </label>
                        <span className="text-sm text-gray-400">{filteredTasks.length} task{filteredTasks.length !== 1 ? 's' : ''}</span>
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '20px' }}>
                    <select value={filterStage} onChange={e => setFilterStage(e.target.value)} className={FILTER_SELECT_CLS}>{STAGE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}</select>
                    <select value={filterAssignee} onChange={e => setFilterAssignee(e.target.value)} className={FILTER_SELECT_CLS}>
                      <option value="mine">Mine</option>
                      {distinctOwners.map(name => <option key={name} value={name}>{name}</option>)}
                      <option value="everyone">Everyone</option>
                    </select>
                    <select value={filterSource} onChange={e => setFilterSource(e.target.value)} className={FILTER_SELECT_CLS}>
                      <option value="all">All Sources</option>
                      <option value="voice">Voice</option>
                      <option value="manual">Manual</option>
                      <option value="gong">Gong</option>
                      <option value="gmail">Gmail</option>
                      <option value="calendar">Calendar</option>
                      <option value="playbook">Playbook</option>
                    </select>
                    <select value={filterDue} onChange={e => setFilterDue(e.target.value)} className={FILTER_SELECT_CLS}>
                      <option value="all">All</option>
                      <option value="overdue">Overdue</option>
                      <option value="today">Today</option>
                      <option value="this_week">This week</option>
                      <option value="no_due">No due date</option>
                    </select>
                    <select value={filterTier} onChange={e => setFilterTier(e.target.value)} className={FILTER_SELECT_CLS}>
                      <option value="all">All Tiers</option>
                      <option value="hot">Hot</option>
                      <option value="active">Active</option>
                      <option value="watching">Watching</option>
                      <option value="archived">Archived</option>
                    </select>
                    <div className="w-px h-[18px] bg-gray-200" />
                    <select value={sortBy} onChange={e => setSortBy(e.target.value)} className={FILTER_SELECT_CLS}>{SORT_OPTIONS.map(o => <option key={o.value} value={o.value}>Sort: {o.label}</option>)}</select>
                    {anyNonDefault && (
                      <button onClick={() => { setFilterStage('all'); setFilterAssignee('mine'); setFilterSource('all'); setFilterDue('all'); setFilterTier('all') }} style={{ fontSize: '12px', color: '#6366f1', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline', padding: '4px 0' }}>Clear filters</button>
                    )}
                  </div>
                  {repType === 'sdr' && sdrViewTab === 'campaigns' ? (
                    (() => {
                      const campaignGroups = sortedFilteredTasks.reduce((acc, task) => { const key = task.sourceId || 'ungrouped'; if (!acc[key]) acc[key] = []; acc[key].push(task); return acc }, {})
                      const groupKeys = Object.keys(campaignGroups)
                      if (!groupKeys.length) return <div className="text-center py-16 text-gray-400"><CheckCircle2 className="w-12 h-12 mx-auto mb-3 opacity-30" /><p className="text-sm">No campaign tasks yet.</p></div>
                      return (
                        <div className="space-y-6">
                          {groupKeys.map(campaignId => {
                            const group = campaignGroups[campaignId]
                            const firstTask = group[0]
                            const titleMatch = firstTask.title?.match(/Stage \d+:\s*(.+?)\s*[—-]/)
                            const accountLabel = titleMatch ? titleMatch[1] : (firstTask.account?.name || campaignId)
                            const pastDue = group.filter(t => isOverdue(t) && t.status === 'open').length
                            const completed = group.filter(t => t.status === 'complete').length
                            return (
                              <div key={campaignId}>
                                <div className="flex items-center gap-2 mb-3">
                                  <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-indigo-100 text-indigo-700">Campaign</span>
                                  <span className="text-sm font-semibold text-gray-800">{accountLabel}</span>
                                  <span className="text-xs text-gray-400">Stage {completed} of {group.length}</span>
                                  {pastDue > 0 ? <span className="w-2 h-2 rounded-full bg-red-500 shrink-0" /> : completed === group.length ? <span className="w-2 h-2 rounded-full bg-green-500 shrink-0" /> : <span className="w-2 h-2 rounded-full bg-gray-300 shrink-0" />}
                                </div>
                                <div className="space-y-2">
                                  {group.map(task => <TaskRow key={task.id} task={task} onStatusChange={handleStatusChange} onDelete={handleDelete} onDismiss={task => setDismissTask(task)} onWorkInClaude={task => setWorkTask(task)} onMomentumChange={handleMomentumChange} selected={selectedTaskIds.has(task.id)} onToggleSelect={toggleTaskSelected} bulkMode={bulkMode} />)}
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      )
                    })()
                  ) : (
                    <RepView
                      tasks={sortedFilteredTasks}
                      sortBy={sortBy}
                      onStatusChange={handleStatusChange}
                      onDelete={handleDelete}
                      onDismiss={task => setDismissTask(task)}
                      onWorkInClaude={task => setWorkTask(task)}
                      onMomentumChange={handleMomentumChange}
                      onNewTask={() => setShowNewTask(true)}
                      selectedTaskIds={selectedTaskIds}
                      onToggleSelect={toggleTaskSelected}
                      bulkMode={bulkMode}
                    />
                  )}
                </>
              )
            })()}
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
          onStatusChange={handleStatusChange}
          providerToken={providerToken}
        />
      )}

      {/* Cmd+K Global Search */}
      {showSearch && (
        <GlobalSearch
          tasks={tasks}
          onClose={() => setShowSearch(false)}
          router={router}
          onSelectTask={(t) => { setTaskView('board'); setTaskSearch(t.title || '') }}
        />
      )}

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-gray-900 text-white text-sm font-medium px-4 py-2.5 rounded-xl shadow-lg">
          {toast}
        </div>
      )}
    </AppShell>
  )
}
