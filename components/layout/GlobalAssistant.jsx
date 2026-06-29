import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/router'
import { Sparkles, X, Send, Loader2, Check, AlertTriangle, Trash2 } from 'lucide-react'

const STORE_KEY = 'global_assistant_thread'
const SUGGESTIONS = [
  'What should I focus on today?',
  'Which deals are cold 30+ days?',
  'Move [account] to proposal',
  'Add a task for the team to review pricing',
]

export default function GlobalAssistant() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [pending, setPending] = useState(null)   // resolved actions awaiting confirm
  const [applying, setApplying] = useState(false)
  const endRef = useRef(null)
  const inputRef = useRef(null)
  const sendingRef = useRef(false)

  useEffect(() => {
    try { const s = localStorage.getItem(STORE_KEY); if (s) { const p = JSON.parse(s); if (Array.isArray(p)) setMessages(p.slice(-30)) } } catch {}
  }, [])
  useEffect(() => { try { localStorage.setItem(STORE_KEY, JSON.stringify(messages.slice(-30))) } catch {} }, [messages])
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages, pending, open])
  useEffect(() => { if (open) inputRef.current?.focus() }, [open])

  // Cmd/Ctrl-J toggles the assistant from anywhere.
  useEffect(() => {
    const h = (e) => {
      if (e.altKey || e.shiftKey || !(e.metaKey || e.ctrlKey)) return
      if ((e.key || '').toLowerCase() !== 'j') return
      e.preventDefault(); setOpen(o => !o)
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [])

  const send = async (text) => {
    const msg = (text ?? input).trim()
    if (!msg || sendingRef.current) return
    sendingRef.current = true
    setInput(''); setPending(null)
    setMessages(m => [...m, { role: 'user', content: msg }])
    setLoading(true)
    try {
      const res = await fetch('/api/assistant', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: msg,
          history: messages.slice(-8).map(m => ({ role: m.role, content: m.content })),
          context: { module: router.pathname, accountId: router.query.account || null },
        }),
      })
      const data = await res.json()
      if (!res.ok || data.success === false) throw new Error(data.error || 'Assistant error')
      const actions = data.actions || []
      setMessages(m => [...m, { role: 'assistant', content: data.response, actions }])
      const runnable = actions.filter(a => a.ok)
      if (runnable.length) setPending(runnable)
    } catch (e) {
      setMessages(m => [...m, { role: 'error', content: e.message }])
    } finally {
      setLoading(false); sendingRef.current = false; inputRef.current?.focus()
    }
  }

  const apply = async () => {
    if (!pending?.length) return
    setApplying(true)
    const batch = pending
    setPending(null)  // clear immediately so a double-click can't re-apply
    try {
      const idempotencyKey = `asst-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
      const res = await fetch('/api/assistant/execute', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ actions: batch, idempotencyKey }),
      })
      const data = await res.json()
      if (!res.ok || data.success === false) throw new Error(data.error || 'Execute failed')
      const lines = (data.results || []).map(r => `${r.ok ? '✓' : '✗'} ${r.label}${r.error ? ` — ${r.error}` : ''}${r.detail ? ` — ${r.detail}` : ''}`).join('\n')
      setMessages(m => [...m, { role: 'system', content: `Applied ${data.applied}/${data.total}:\n${lines}` }])
      // Refresh open screens so writes are visible immediately (the flagship "it just did it").
      const acctIds = [...new Set(batch.filter(a => ['update_account_stage', 'update_account_field', 'add_account_note'].includes(a.type) && a.accountId).map(a => a.accountId))]
      if (acctIds.length) window.dispatchEvent(new CustomEvent('accounts:refresh', { detail: { ids: acctIds } }))
      window.dispatchEvent(new Event('tasks:refresh'))
    } catch (e) {
      setMessages(m => [...m, { role: 'error', content: e.message }])
    } finally {
      setApplying(false)
    }
  }

  const clear = () => { setMessages([]); setPending(null); try { localStorage.removeItem(STORE_KEY) } catch {} }

  return (
    <>
      {/* Floating launcher — on every screen */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          title="Assistant (⌘J)"
          className="fixed bottom-5 right-5 z-[60] w-14 h-14 rounded-full bg-gradient-to-br from-blue-600 to-indigo-700 text-white shadow-xl flex items-center justify-center hover:scale-105 transition-transform"
        >
          <Sparkles className="w-6 h-6" />
        </button>
      )}

      {open && (
        <div className="fixed inset-0 z-[60] pointer-events-none">
          <div className="absolute inset-0 bg-black/10 pointer-events-auto" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-0 h-full w-full max-w-md bg-white shadow-2xl flex flex-col pointer-events-auto">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b bg-gradient-to-r from-blue-600 to-indigo-700 text-white">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5" />
                <div>
                  <h2 className="font-semibold leading-tight">Assistant</h2>
                  <p className="text-[11px] text-blue-100">Ask anything · or tell me what to do</p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                {messages.length > 0 && <button onClick={clear} title="Clear" className="p-1.5 hover:bg-white/15 rounded"><Trash2 className="w-4 h-4" /></button>}
                <button onClick={() => setOpen(false)} className="p-1.5 hover:bg-white/15 rounded"><X className="w-5 h-5" /></button>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {messages.length === 0 && (
                <div className="text-center py-6">
                  <Sparkles className="w-10 h-10 mx-auto mb-3 text-blue-200" />
                  <p className="text-gray-600 text-sm mb-4">Ask about your pipeline, or tell me to update accounts and create tasks.</p>
                  <div className="space-y-2">
                    {SUGGESTIONS.map((s, i) => (
                      <button key={i} onClick={() => send(s)} disabled={loading} className="block w-full text-left text-sm px-3 py-2 bg-gray-50 hover:bg-gray-100 rounded-lg text-gray-700 disabled:opacity-50">{s}</button>
                    ))}
                  </div>
                </div>
              )}
              {messages.map((m, i) => (
                <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[88%] rounded-2xl px-3.5 py-2.5 text-sm whitespace-pre-wrap ${
                    m.role === 'user' ? 'bg-blue-600 text-white rounded-br-sm'
                    : m.role === 'error' ? 'bg-red-50 text-red-700 border border-red-200'
                    : m.role === 'system' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200 font-mono text-xs'
                    : 'bg-gray-100 text-gray-800 rounded-bl-sm'}`}>
                    {m.content}
                    {m.actions?.length > 0 && (
                      <div className="mt-2 pt-2 border-t border-gray-200 space-y-1">
                        {m.actions.map((a, j) => (
                          <div key={j} className={`flex items-start gap-1.5 text-xs ${a.ok ? 'text-gray-700' : 'text-amber-600'}`}>
                            {a.ok ? <Check className="w-3.5 h-3.5 mt-0.5 text-blue-500 shrink-0" /> : <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />}
                            <span>{a.label}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {loading && <div className="flex justify-start"><div className="bg-gray-100 rounded-2xl px-4 py-3"><Loader2 className="w-4 h-4 animate-spin text-gray-400" /></div></div>}
              <div ref={endRef} />
            </div>

            {/* Confirm bar */}
            {pending?.length > 0 && (
              <div className="px-4 py-3 bg-blue-50 border-t border-blue-100">
                <p className="text-xs text-blue-700 mb-2">Apply {pending.length} change{pending.length > 1 ? 's' : ''}? Nothing happens until you confirm.</p>
                <div className="flex gap-2">
                  <button onClick={() => setPending(null)} disabled={applying} className="flex-1 px-3 py-1.5 text-sm border rounded-lg hover:bg-white">Cancel</button>
                  <button onClick={apply} disabled={applying} className="flex-1 px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center justify-center gap-1">
                    {applying ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} Apply
                  </button>
                </div>
              </div>
            )}

            {/* Input */}
            <div className="p-3 border-t">
              <div className="flex gap-2">
                <input
                  ref={inputRef} value={input} onChange={e => setInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
                  placeholder="Ask or tell me to do something…" disabled={loading}
                  className="flex-1 border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button onClick={() => send()} disabled={loading || !input.trim()} className="px-3.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
