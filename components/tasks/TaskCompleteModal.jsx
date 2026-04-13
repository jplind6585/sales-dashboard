import { useState, useEffect, useRef } from 'react'
import { X, Send, CheckCircle2, Loader2, Sparkles } from 'lucide-react'
import ReactMarkdown from 'react-markdown'

/**
 * TaskCompleteModal
 *
 * Opens when a user marks a task complete.
 * Claude generates a first draft of the deliverable and asks refinement questions.
 * User iterates via chat, then clicks "Mark Complete" to finalize.
 *
 * Props:
 * - task: { id, title, description, type }
 * - onComplete: () => void — called when user confirms completion
 * - onClose: () => void — called when modal is dismissed without completing
 */
export default function TaskCompleteModal({ task, onComplete, onClose }) {
  const [messages, setMessages] = useState([]) // [{role, content}]
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [completing, setCompleting] = useState(false)
  const bottomRef = useRef(null)

  // Auto-generate first draft on open
  useEffect(() => {
    generate([])
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  const generate = async (history) => {
    setLoading(true)
    try {
      const res = await fetch('/api/tasks/complete-assist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ task, messages: history }),
      })
      const data = await res.json()
      if (data.reply) {
        setMessages(prev => [...prev, { role: 'assistant', content: data.reply }])
      }
    } catch (err) {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Something went wrong. Please try again.' }])
    } finally {
      setLoading(false)
    }
  }

  const handleSend = () => {
    if (!input.trim() || loading) return
    const userMsg = { role: 'user', content: input.trim() }
    const newHistory = [...messages, userMsg]
    setMessages(newHistory)
    setInput('')
    generate(newHistory)
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleComplete = async () => {
    setCompleting(true)
    await onComplete()
    setCompleting(false)
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-6">
      <div className="bg-white w-full sm:rounded-2xl shadow-2xl flex flex-col max-h-screen sm:max-h-[85vh] sm:max-w-2xl">
        {/* Header */}
        <div className="flex items-start justify-between px-5 py-4 border-b bg-gradient-to-r from-blue-50 to-indigo-50 sm:rounded-t-2xl">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            <Sparkles className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" />
            <div className="min-w-0">
              <p className="text-xs font-medium text-indigo-600 uppercase tracking-wide mb-0.5">AI Work Assistant</p>
              <p className="font-semibold text-gray-900 leading-tight truncate">{task.title}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg ml-2 shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Chat area */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {/* Initial loading */}
          {messages.length === 0 && loading && (
            <div className="flex items-center gap-3 text-gray-500 py-6">
              <Loader2 className="w-5 h-5 animate-spin text-indigo-500" />
              <span className="text-sm">Generating first draft...</span>
            </div>
          )}

          {messages.map((m, i) => (
            <div
              key={i}
              className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {m.role === 'assistant' ? (
                <div className="max-w-full bg-white border border-gray-200 rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm">
                  <div className="prose prose-sm max-w-none text-gray-800 prose-p:my-1 prose-ul:my-1 prose-ol:my-1 prose-headings:my-2 prose-hr:my-3">
                    <ReactMarkdown>{m.content}</ReactMarkdown>
                  </div>
                </div>
              ) : (
                <div className="max-w-[80%] bg-indigo-600 text-white rounded-2xl rounded-tr-sm px-4 py-2.5 text-sm">
                  {m.content}
                </div>
              )}
            </div>
          ))}

          {/* Loading indicator for follow-up messages */}
          {loading && messages.length > 0 && (
            <div className="flex justify-start">
              <div className="bg-white border border-gray-200 rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm">
                <div className="flex gap-1 items-center">
                  <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div className="border-t px-4 py-3 bg-gray-50 sm:rounded-b-2xl">
          <div className="flex gap-2 mb-3">
            <textarea
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Answer the questions or ask for changes..."
              rows={2}
              className="flex-1 resize-none text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white"
              disabled={loading}
            />
            <button
              onClick={handleSend}
              disabled={loading || !input.trim()}
              className="self-end p-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-40 transition-colors"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>

          <button
            onClick={handleComplete}
            disabled={completing || loading}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-green-600 text-white rounded-xl font-medium hover:bg-green-700 disabled:opacity-50 transition-colors text-sm"
          >
            {completing ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <CheckCircle2 className="w-4 h-4" />
            )}
            Mark Complete & Close
          </button>
        </div>
      </div>
    </div>
  )
}
