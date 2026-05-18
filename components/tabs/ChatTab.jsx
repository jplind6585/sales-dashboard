import { useState, useEffect, useRef, useCallback } from 'react'
import { Send, Sparkles, Loader2, RotateCcw } from 'lucide-react'

const SUGGESTED_PROMPTS = [
  'Where does this deal stand?',
  "What's blocking us?",
  'Draft a check-in email',
  'What should I do next?',
]

function renderContent(text) {
  if (!text) return null
  const parts = text.split(/(\*\*[^*]+\*\*)/)
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i}>{part.slice(2, -2)}</strong>
    }
    const lines = part.split('\n')
    return lines.map((line, j) => (
      <span key={`${i}-${j}`}>
        {line}
        {j < lines.length - 1 && <br />}
      </span>
    ))
  })
}

const TYPE_BADGE = {
  chat_insight: 'bg-blue-100 text-blue-700',
  pipeline_call: 'bg-purple-100 text-purple-700',
  manual: 'bg-gray-100 text-gray-600',
  ai_summary: 'bg-green-100 text-green-700',
}

function typeBadgeClass(type) {
  return TYPE_BADGE[type] || 'bg-gray-100 text-gray-600'
}

function relativeDate(ts) {
  if (!ts) return ''
  const diff = Date.now() - new Date(ts)
  const days = Math.floor(diff / 86400000)
  if (days < 1) return 'today'
  if (days === 1) return 'yesterday'
  if (days < 30) return `${days}d ago`
  return new Date(ts).toLocaleDateString()
}

export default function ChatTab({ account, user }) {
  if (!account?.id) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400 text-sm">
        No account selected.
      </div>
    )
  }

  const storageKey = `account_chat_${account.id}`
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [briefing, setBriefing] = useState(false)
  const bottomRef = useRef(null)
  const inputRef = useRef(null)

  // Memory state
  const [memories, setMemories] = useState([])
  const [memoriesExpanded, setMemoriesExpanded] = useState(false)

  // Per-message save state
  const [savingMessageIdx, setSavingMessageIdx] = useState(null)
  const [editedSaveText, setEditedSaveText] = useState('')
  const [savedConfirmIdx, setSavedConfirmIdx] = useState(null)
  const [hoveredMsgIdx, setHoveredMsgIdx] = useState(null)

  // End-of-session takeaways
  const [summarizing, setSummarizing] = useState(false)
  const [takeawayBullets, setTakeawayBullets] = useState([])
  const [showTakeawayModal, setShowTakeawayModal] = useState(false)
  const [savingTakeaways, setSavingTakeaways] = useState(false)

  const scrollToBottom = () => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  const persist = useCallback((msgs) => {
    try {
      const trimmed = msgs.slice(-30)
      localStorage.setItem(storageKey, JSON.stringify(trimmed))
    } catch {}
  }, [storageKey])

  const fetchMemories = useCallback(async () => {
    try {
      const r = await fetch(`/api/accounts/${account.id}/memory`)
      const d = await r.json()
      if (Array.isArray(d.memories)) setMemories(d.memories)
    } catch {}
  }, [account.id])

  const generateBriefing = useCallback(async () => {
    setBriefing(true)
    const briefingPrompt = 'Give me a quick briefing on where this deal stands right now — key status, top risk, and most important next action. Be direct and specific, 3-4 sentences max.'
    try {
      const r = await fetch('/api/accounts/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accountId: account.id,
          messages: [{ role: 'user', content: briefingPrompt }],
        }),
      })
      const data = await r.json()
      if (data.success && data.message) {
        const initialMsg = { role: 'assistant', content: data.message, ts: Date.now() }
        setMessages([initialMsg])
        persist([initialMsg])
      } else {
        const errMsg = { role: 'system', content: 'Could not load deal briefing. Ask me anything about this account.', ts: Date.now() }
        setMessages([errMsg])
        persist([errMsg])
      }
    } catch {
      const errMsg = { role: 'system', content: 'Could not load deal briefing. Ask me anything about this account.', ts: Date.now() }
      setMessages([errMsg])
      persist([errMsg])
    } finally {
      setBriefing(false)
    }
  }, [account.id, persist])

  useEffect(() => {
    setMessages([])
    setInput('')
    setMemories([])
    setMemoriesExpanded(false)
    setSavingMessageIdx(null)
    setSavedConfirmIdx(null)
    fetchMemories()
    try {
      const saved = localStorage.getItem(storageKey)
      if (saved) {
        const parsed = JSON.parse(saved)
        if (Array.isArray(parsed) && parsed.length > 0) {
          setMessages(parsed)
          return
        }
      }
    } catch {}
    generateBriefing()
  }, [account.id]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    scrollToBottom()
  }, [messages, briefing])

  const sendMessage = useCallback(async (text) => {
    const content = text.trim()
    if (!content || loading || briefing) return

    const userMsg = { role: 'user', content, ts: Date.now() }
    const newMessages = [...messages, userMsg]
    setMessages(newMessages)
    persist(newMessages)
    setInput('')
    setLoading(true)

    try {
      const r = await fetch('/api/accounts/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accountId: account.id,
          messages: newMessages.filter(m => m.role !== 'system').map(m => ({ role: m.role, content: m.content })),
        }),
      })
      const data = await r.json()
      if (data.success && data.message) {
        const assistantMsg = { role: 'assistant', content: data.message, ts: Date.now() }
        const updated = [...newMessages, assistantMsg]
        setMessages(updated)
        persist(updated)
      } else {
        const errMsg = { role: 'system', content: `Error: ${data.error || 'Something went wrong. Try again.'}`, ts: Date.now() }
        const updated = [...newMessages, errMsg]
        setMessages(updated)
        persist(updated)
      }
    } catch {
      const errMsg = { role: 'system', content: 'Network error. Check connection and try again.', ts: Date.now() }
      const updated = [...newMessages, errMsg]
      setMessages(updated)
      persist(updated)
    } finally {
      setLoading(false)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [messages, loading, briefing, account.id, persist])

  const handleSend = () => sendMessage(input)

  const handleChipClick = (prompt) => {
    setInput(prompt)
    sendMessage(prompt)
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleNewConversation = () => {
    try { localStorage.removeItem(storageKey) } catch {}
    setMessages([])
    setInput('')
    setSavingMessageIdx(null)
    generateBriefing()
  }

  const handleOpenSaveEditor = (idx, content) => {
    setSavingMessageIdx(idx)
    setEditedSaveText(content.trim().slice(0, 300))
  }

  const handleSaveMemory = async () => {
    if (!editedSaveText.trim()) return
    try {
      const r = await fetch(`/api/accounts/${account.id}/memory`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'chat_insight', content: editedSaveText.trim(), author: user?.email }),
      })
      const d = await r.json()
      if (d.memory) setMemories(prev => [d.memory, ...prev])
      setSavedConfirmIdx(savingMessageIdx)
      setSavingMessageIdx(null)
      setEditedSaveText('')
      setTimeout(() => setSavedConfirmIdx(null), 2000)
    } catch {}
  }

  const handleSummarize = async () => {
    setSummarizing(true)
    try {
      const r = await fetch(`/api/accounts/${account.id}/memory-summarize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages }),
      })
      const d = await r.json()
      if (Array.isArray(d.bullets) && d.bullets.length > 0) {
        setTakeawayBullets(d.bullets)
        setShowTakeawayModal(true)
      }
    } catch {}
    finally { setSummarizing(false) }
  }

  const handleSaveTakeaways = async () => {
    setSavingTakeaways(true)
    try {
      for (const bullet of takeawayBullets) {
        if (!bullet.trim()) continue
        const r = await fetch(`/api/accounts/${account.id}/memory`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: 'ai_summary', content: bullet.trim(), author: user?.email }),
        })
        const d = await r.json()
        if (d.memory) setMemories(prev => [d.memory, ...prev])
      }
    } catch {}
    finally {
      setSavingTakeaways(false)
      setShowTakeawayModal(false)
      setTakeawayBullets([])
    }
  }

  const assistantMessages = messages.filter(m => m.role !== 'system')

  return (
    <div className="flex flex-col h-full" style={{ minHeight: '500px', maxHeight: 'calc(100vh - 280px)' }}>
      {/* Tab header */}
      <div className="flex items-center justify-between mb-3 flex-shrink-0">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-blue-500" />
          <span className="text-sm font-medium text-gray-700">AI Deal Advisor</span>
          <span className="text-xs text-gray-400">— knows every call, task, and stakeholder</span>
        </div>
        <button
          onClick={handleNewConversation}
          disabled={briefing}
          className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-40"
          title="Start new conversation"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          New conversation
        </button>
      </div>

      {/* Memory bar */}
      {memories.length > 0 && (
        <div className="mb-2 flex-shrink-0 border border-blue-100 bg-blue-50 rounded-xl overflow-hidden">
          <button
            onClick={() => setMemoriesExpanded(e => !e)}
            className="w-full flex items-center justify-between px-3 py-2 text-xs text-blue-700 hover:bg-blue-100 transition-colors"
          >
            <span>📌 {memories.length} saved insight{memories.length !== 1 ? 's' : ''}</span>
            <span className="text-blue-400">{memoriesExpanded ? '▲ collapse' : '▼ expand'}</span>
          </button>
          {memoriesExpanded && (
            <div className="px-3 pb-3 space-y-2">
              {memories.map((m, i) => (
                <div key={m.id || i} className="flex items-start gap-2">
                  <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium shrink-0 ${typeBadgeClass(m.type)}`}>
                    {m.type?.replace(/_/g, ' ') || 'note'}
                  </span>
                  <span className="text-xs text-gray-700 flex-1">{m.content}</span>
                  <span className="text-xs text-gray-400 shrink-0">{relativeDate(m.created_at)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Message area */}
      <div className="flex-1 overflow-y-auto bg-gray-50 rounded-xl p-4 mb-3 min-h-0">
        {briefing && (
          <div className="flex items-center gap-3 p-4">
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center flex-shrink-0">
              <Sparkles className="w-3.5 h-3.5 text-white" />
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
              <span className="animate-pulse">Generating deal briefing...</span>
            </div>
          </div>
        )}

        {!briefing && messages.length === 0 && (
          <div className="flex items-center justify-center h-full text-gray-400 text-sm">
            Loading...
          </div>
        )}

        {messages.map((msg, i) => {
          const isUser = msg.role === 'user'
          const isSystem = msg.role === 'system'
          const isAssistant = msg.role === 'assistant'

          if (isSystem) {
            return (
              <div key={msg.ts || i} className="flex justify-center my-2">
                <span className="text-xs text-gray-400 bg-gray-100 px-3 py-1 rounded-full">
                  {msg.content}
                </span>
              </div>
            )
          }

          return (
            <div key={msg.ts || i}>
              <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-1`}>
                {!isUser && (
                  <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center flex-shrink-0 mr-2 mt-0.5">
                    <Sparkles className="w-3.5 h-3.5 text-white" />
                  </div>
                )}
                <div
                  className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                    isUser
                      ? 'bg-blue-600 text-white rounded-tr-sm'
                      : 'bg-white border border-gray-200 text-gray-800 rounded-tl-sm shadow-sm'
                  }`}
                  onMouseEnter={() => isAssistant && setHoveredMsgIdx(i)}
                  onMouseLeave={() => isAssistant && setHoveredMsgIdx(null)}
                >
                  {renderContent(msg.content)}
                </div>
              </div>

              {/* Save button for assistant messages */}
              {isAssistant && (
                <div className="flex justify-start ml-9 mb-2">
                  {savedConfirmIdx === i ? (
                    <span className="text-xs text-green-600 font-medium">Saved ✓</span>
                  ) : savingMessageIdx === i ? (
                    <div className="w-full max-w-[75%] mt-1">
                      <textarea
                        value={editedSaveText}
                        onChange={e => setEditedSaveText(e.target.value)}
                        rows={3}
                        className="w-full text-xs border border-gray-200 rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-blue-400"
                      />
                      <div className="flex items-center gap-2 mt-1">
                        <button
                          onClick={handleSaveMemory}
                          className="text-xs px-3 py-1 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                        >
                          Save to account
                        </button>
                        <button
                          onClick={() => { setSavingMessageIdx(null); setEditedSaveText('') }}
                          className="text-xs px-2 py-1 text-gray-400 hover:text-gray-600"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : hoveredMsgIdx === i ? (
                    <button
                      onClick={() => handleOpenSaveEditor(i, msg.content)}
                      className="text-xs text-gray-400 hover:text-blue-600 transition-colors"
                    >
                      Save
                    </button>
                  ) : null}
                </div>
              )}
            </div>
          )
        })}

        {loading && (
          <div className="flex justify-start mb-3">
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center flex-shrink-0 mr-2 mt-0.5">
              <Sparkles className="w-3.5 h-3.5 text-white" />
            </div>
            <div className="bg-white border border-gray-200 rounded-2xl rounded-tl-sm px-4 py-2.5 shadow-sm">
              <div className="flex gap-1 items-center h-5">
                <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* End-of-session takeaways bar */}
      {assistantMessages.length >= 4 && (
        <div className="flex-shrink-0 mb-2">
          <button
            onClick={handleSummarize}
            disabled={summarizing}
            className="w-full flex items-center justify-center gap-2 py-2 text-xs font-medium text-indigo-700 bg-indigo-50 border border-indigo-100 rounded-xl hover:bg-indigo-100 transition-colors disabled:opacity-50"
          >
            {summarizing ? (
              <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Summarizing...</>
            ) : (
              <>💾 Save key takeaways from this conversation</>
            )}
          </button>
        </div>
      )}

      {/* Suggested prompts */}
      <div className="flex gap-2 mb-2 flex-wrap flex-shrink-0">
        {SUGGESTED_PROMPTS.map(prompt => (
          <button
            key={prompt}
            onClick={() => handleChipClick(prompt)}
            disabled={loading || briefing}
            className="text-xs px-3 py-1.5 bg-white border border-gray-200 rounded-full text-gray-600 hover:border-blue-300 hover:text-blue-600 hover:bg-blue-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {prompt}
          </button>
        ))}
      </div>

      {/* Input bar */}
      <div className="flex gap-2 flex-shrink-0">
        <textarea
          ref={inputRef}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={loading || briefing}
          placeholder="Ask anything about this deal..."
          rows={1}
          className="flex-1 resize-none rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 bg-white"
          style={{ maxHeight: '120px', overflowY: 'auto' }}
          onInput={e => {
            e.target.style.height = 'auto'
            e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px'
          }}
        />
        <button
          onClick={handleSend}
          disabled={!input.trim() || loading || briefing}
          className="px-4 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center justify-center flex-shrink-0"
        >
          {loading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Send className="w-4 h-4" />
          )}
        </button>
      </div>

      {/* Takeaway modal */}
      {showTakeawayModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
            <div className="px-6 py-4 border-b flex items-center justify-between">
              <h3 className="font-semibold text-gray-900">Key Takeaways</h3>
              <button onClick={() => { setShowTakeawayModal(false); setTakeawayBullets([]) }} className="text-gray-400 hover:text-gray-600 text-xl leading-none">✕</button>
            </div>
            <div className="px-6 py-4 space-y-3">
              {takeawayBullets.map((bullet, i) => (
                <textarea
                  key={i}
                  value={bullet}
                  onChange={e => {
                    const updated = [...takeawayBullets]
                    updated[i] = e.target.value
                    setTakeawayBullets(updated)
                  }}
                  rows={2}
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
              ))}
            </div>
            <div className="px-6 py-4 border-t flex items-center justify-end gap-3">
              <button onClick={() => { setShowTakeawayModal(false); setTakeawayBullets([]) }} className="text-sm text-gray-500 hover:text-gray-700">Dismiss</button>
              <button
                onClick={handleSaveTakeaways}
                disabled={savingTakeaways}
                className="text-sm px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {savingTakeaways ? 'Saving...' : `Save all (${takeawayBullets.filter(b => b.trim()).length})`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
