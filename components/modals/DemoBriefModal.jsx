import { useState } from 'react'
import { X, Sparkles, AlertTriangle, CheckCircle2, MessageSquare, Loader2, ChevronDown, ChevronRight } from 'lucide-react'

function Section({ title, icon: Icon, children, defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="border rounded-lg overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-2 px-4 py-3 bg-gray-50 hover:bg-gray-100 text-left"
      >
        {open ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
        {Icon && <Icon className="w-4 h-4 text-blue-500" />}
        <span className="font-semibold text-gray-800 text-sm">{title}</span>
      </button>
      {open && <div className="px-4 py-3">{children}</div>}
    </div>
  )
}

function BulletList({ items, className = '' }) {
  if (!items?.length) return <p className="text-sm text-gray-400">None</p>
  return (
    <ul className="space-y-1.5">
      {items.map((item, i) => (
        <li key={i} className={`flex gap-2 text-sm text-gray-700 ${className}`}>
          <span className="text-blue-400 mt-0.5 shrink-0">•</span>
          <span>{item}</span>
        </li>
      ))}
    </ul>
  )
}

export default function DemoBriefModal({ account, onClose }) {
  const [brief, setBrief] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const generate = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/generate-demo-brief', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ account }),
      })
      const data = await res.json()
      if (!res.ok || data.error) throw new Error(data.error || 'Failed')
      setBrief(data.brief)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-6">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b bg-gradient-to-r from-indigo-50 to-blue-50">
          <div className="flex items-center gap-3">
            <Sparkles className="w-5 h-5 text-indigo-600" />
            <div>
              <h2 className="font-bold text-gray-900">Demo Prep Brief</h2>
              <p className="text-xs text-gray-500">{account.name}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-700 rounded hover:bg-gray-100">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 p-6">
          {!brief && !loading && !error && (
            <div className="text-center py-10">
              <Sparkles className="w-10 h-10 text-indigo-400 mx-auto mb-3" />
              <p className="text-gray-700 font-medium mb-1">Generate your demo brief</p>
              <p className="text-sm text-gray-500 mb-6">
                Claude will analyze your call history, stakeholders, and gaps to build a tailored prep brief for {account.name}.
              </p>
              <button
                onClick={generate}
                className="px-6 py-2.5 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 flex items-center gap-2 mx-auto"
              >
                <Sparkles className="w-4 h-4" />
                Generate Brief
              </button>
            </div>
          )}

          {loading && (
            <div className="text-center py-10">
              <Loader2 className="w-8 h-8 text-indigo-500 animate-spin mx-auto mb-3" />
              <p className="text-gray-600">Analyzing account data...</p>
            </div>
          )}

          {error && (
            <div className="text-center py-10">
              <AlertTriangle className="w-8 h-8 text-red-400 mx-auto mb-2" />
              <p className="text-red-600 font-medium">{error}</p>
              <button
                onClick={generate}
                className="mt-4 px-4 py-2 bg-red-50 text-red-700 rounded hover:bg-red-100 text-sm"
              >
                Retry
              </button>
            </div>
          )}

          {brief && !loading && (
            <div className="space-y-3">
              {/* Talking Points */}
              <Section title="Lead With These Pain Points" icon={MessageSquare}>
                <BulletList items={brief.talkingPoints} />
              </Section>

              {/* Demo Flow */}
              <Section title="Recommended Demo Flow">
                {brief.demoFlow?.length ? (
                  <ol className="space-y-1.5">
                    {brief.demoFlow.map((step, i) => (
                      <li key={i} className="flex gap-3 text-sm text-gray-700">
                        <span className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 text-xs font-semibold flex items-center justify-center shrink-0 mt-0.5">
                          {i + 1}
                        </span>
                        <span>{step}</span>
                      </li>
                    ))}
                  </ol>
                ) : <p className="text-sm text-gray-400">None</p>}
              </Section>

              {/* Stakeholder Tips */}
              {brief.stakeholderTips?.length > 0 && (
                <Section title="Stakeholder Tips">
                  <div className="space-y-3">
                    {brief.stakeholderTips.map((s, i) => (
                      <div key={i} className="p-3 bg-gray-50 rounded-lg">
                        <div className="font-medium text-sm text-gray-800">{s.name}</div>
                        {s.concern && <div className="text-xs text-gray-500 mt-0.5">Concern: {s.concern}</div>}
                        {s.tip && <div className="text-xs text-indigo-700 mt-1 font-medium">Tip: {s.tip}</div>}
                      </div>
                    ))}
                  </div>
                </Section>
              )}

              {/* Questions to Ask */}
              <Section title="Questions to Ask / Validate" defaultOpen={false}>
                <BulletList items={brief.questionsToAsk} />
              </Section>

              {/* Open Gaps */}
              {brief.openGapsToAddress?.length > 0 && (
                <Section title="Gaps to Address in Demo" defaultOpen={false}>
                  <BulletList items={brief.openGapsToAddress} />
                </Section>
              )}

              {/* Red Flags */}
              {brief.redFlags?.length > 0 && (
                <Section title="Watch Out For" icon={AlertTriangle} defaultOpen={false}>
                  <BulletList
                    items={brief.redFlags}
                    className="text-red-700"
                  />
                </Section>
              )}

              {/* Regenerate */}
              <div className="pt-2 text-center">
                <button
                  onClick={generate}
                  className="text-xs text-gray-400 hover:text-gray-600 underline"
                >
                  Regenerate
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
