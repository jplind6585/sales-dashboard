import { useState, useEffect, useRef, useCallback } from 'react'
import { Send, Sparkles, Loader2, RotateCcw } from 'lucide-react'

const SUGGESTED_PROMPTS = [
  'Where does this deal stand?',
  "What's blocking us?",
  'Draft a check-in email',
  'What should I do next?',
]

// Simple inline markdown renderer: bold and newlines only — no library
function renderContent(text) {
  if (!text) return null
  // Split on **bold** markers
  const parts = text.split(/(\*\*[^*]+\*\*)/)
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i}>{part.slice(2, -2)}</strong>
    }
    // Render newlines as <br>
    const lines = part.split('\n')
    return lines.map((line, j) => (
      <span key={`${i}-${j}`}>
        {line}
        {j < lines.length - 1 && <br />}
      </span>
    ))
  })
}

function ChatMessage({ message }) {
  const isUser = message.role === 'user'
  const isSystem = message.role === 'system'

  if (isSystem) {
    return (
      <div className="flex justify-center my-2">
        <span className="text-xs text-gray-400 bg-gray-100 px-3 py-1 rounded-full">
          {message.content}
        </span>
      </div>
    )
  }

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-3`}>
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
      >
        {renderContent(message.content)}
      </div>
    </div>
  )
}

export default function ChatTab({ account }) {
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

  const scrollToBottom = () => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  const persist = useCallback((msgs) => {
    try {
      const trimmed = msgs.slice(-30)
      localStorage.setItem(storageKey, JSON.stringify(trimmed))
    } catch {}
  }, [storageKey])

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

  // Load from localStorage or generate briefing on mount / account change
  useEffect(() => {
    setMessages([])
    setInput('')
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
    generateBriefing()
  }

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

        {messages.map((msg, i) => (
          <ChatMessage key={msg.ts || i} message={msg} />
        ))}

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
    </div>
  )
}
